// audio.js : paysage sonore spatialisé. Sons synthétisés (sons.js) ou, s'ils sont fournis,
// vrais enregistrements déclarés dans audio/sons.json.
import { fabriquerSons, reponseImpulsionnelle } from './sons.js';
import { distPlateau } from './relief.js';
import { rueProche, PLACE, SANCTUAIRE } from './plan.js';

const CLE_VOLUME = 'corent-volume';

/** Promesse de la banque synthétisée, lancée dès le chargement de la page (aucun geste requis). */
let banquePromesse = null;
export function prechargerSons() {
  if (!banquePromesse) {
    banquePromesse = typeof OfflineAudioContext === 'undefined'
      ? Promise.resolve(null)
      : fabriquerSons().catch((e) => { console.warn('Synthèse sonore impossible :', e); return null; });
  }
  return banquePromesse;
}

const hasard = (t) => t[Math.floor(Math.random() * t.length)];
const entre = (a, b) => a + Math.random() * (b - a);

export class PaysageSonore {
  constructor() {
    this.pret = false;
    this.coupe = false;
    try { const v = parseFloat(localStorage.getItem(CLE_VOLUME)); this.volume = Number.isFinite(v) ? v : 0.8; }
    catch { this.volume = 0.8; }
    this.boucles = {};
    this.minuteurs = { oiseau: 3, corneille: 12, chien: 15, chouette: 25, animal: 2 };
  }

  /** À appeler depuis un clic : le navigateur n'autorise le son qu'après un geste de l'utilisateur. */
  async demarrer() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.maitre = ctx.createGain();
    this.maitre.gain.value = this.coupe ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    this.maitre.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = reponseImpulsionnelle(ctx);
    this.envoiReverb = ctx.createGain();
    this.envoiReverb.gain.value = 0.22;
    this.envoiReverb.connect(this.reverb).connect(this.maitre);

    const banque = await prechargerSons();
    this.banque = banque || {};
    await this.chargerEnregistrements();
    this.creerVent();
    this.creerBoucles();
    this.pret = true;
  }

  /** Remplace des sons synthétisés par des fichiers listés dans audio/sons.json, s'il en existe. */
  async chargerEnregistrements() {
    let liste;
    try {
      const r = await fetch('audio/sons.json', { cache: 'no-cache' });
      if (!r.ok) return;
      liste = await r.json();
    } catch { return; }
    const charger = async (fichier) => {
      const r = await fetch(`audio/${fichier}`);
      if (!r.ok) throw new Error(fichier);
      return this.ctx.decodeAudioData(await r.arrayBuffer());
    };
    for (const [cle, valeur] of Object.entries(liste || {})) {
      if (cle.startsWith('_')) continue;
      try {
        if (Array.isArray(valeur)) {
          const bufs = await Promise.all(valeur.map(charger));
          if (cle.startsWith('pas-')) { this.banque.pas = this.banque.pas || {}; this.banque.pas[cle.slice(4)] = bufs; }
          else this.banque[cle] = bufs;
        } else {
          this.banque[cle] = await charger(valeur);
          if (cle === 'vent') this.ventEnregistre = this.banque.vent;
        }
      } catch (e) { console.warn('Enregistrement introuvable ou illisible, synthèse utilisée :', e.message); }
    }
  }

  // ---------- vent ----------

  creerVent() {
    const ctx = this.ctx;
    const duree = 6;
    const buf = ctx.createBuffer(2, duree * ctx.sampleRate, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = this.ventEnregistre || buf;
    src.loop = true;
    this.ventFiltre = ctx.createBiquadFilter();
    this.ventFiltre.type = 'lowpass';
    this.ventFiltre.frequency.value = 500;
    this.ventGain = ctx.createGain();
    this.ventGain.gain.value = 0;
    src.connect(this.ventFiltre).connect(this.ventGain).connect(this.maitre);
    // sifflement dans les rafales, au bord du plateau
    const src2 = ctx.createBufferSource();
    src2.buffer = buf; src2.loop = true; src2.playbackRate.value = 0.93;
    this.sifflement = ctx.createBiquadFilter();
    this.sifflement.type = 'bandpass'; this.sifflement.Q.value = 9; this.sifflement.frequency.value = 700;
    this.sifflementGain = ctx.createGain(); this.sifflementGain.gain.value = 0;
    src2.connect(this.sifflement).connect(this.sifflementGain).connect(this.maitre);
    // bruissement des feuilles et des herbes
    const src3 = ctx.createBufferSource();
    src3.buffer = buf; src3.loop = true; src3.playbackRate.value = 1.7;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    this.feuillesGain = ctx.createGain(); this.feuillesGain.gain.value = 0;
    src3.connect(hp).connect(this.feuillesGain).connect(this.maitre);
    for (const s of [src, src2, src3]) s.start(0, Math.random() * duree);
    this.rafale = 0.5;
    this.rafaleCible = 0.5;
  }

  // ---------- sources spatialisées ----------

  panner(refDistance = 4, rolloff = 1.2, maxDistance = 300) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = refDistance;
    p.rolloffFactor = rolloff;
    p.maxDistance = maxDistance;
    return p;
  }

  placer(panner, x, y, z) {
    if (panner.positionX) {
      const t = this.ctx.currentTime;
      panner.positionX.setTargetAtTime(x, t, 0.05);
      panner.positionY.setTargetAtTime(y, t, 0.05);
      panner.positionZ.setTargetAtTime(z, t, 0.05);
    } else panner.setPosition(x, y, z);
  }

  /** Boucle spatialisée : renvoie { gain, panner }. */
  boucleSpatiale(buffer, ref, rolloff, volume = 1, reverb = 0.3) {
    if (!buffer) return null;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = buffer; s.loop = true;
    s.playbackRate.value = entre(0.94, 1.06);
    const g = ctx.createGain(); g.gain.value = 0;
    const p = this.panner(ref, rolloff);
    s.connect(g).connect(p).connect(this.maitre);
    if (reverb) { const r = ctx.createGain(); r.gain.value = reverb; p.connect(r).connect(this.envoiReverb); }
    s.start(0, Math.random() * buffer.duration);
    return { gain: g, panner: p, volume };
  }

  creerBoucles() {
    const b = this.banque;
    this.boucles.feux = [0, 1, 2].map(() => this.boucleSpatiale(b.feu, 2.5, 1.4, 0.55, 0.15)).filter(Boolean);
    this.boucles.foule = this.boucleSpatiale(b.foule, 14, 1.1, 0.7, 0.5);
    this.boucles.alouette = this.boucleSpatiale(b.alouette, 18, 1, 0.25, 0);
    this.boucles.grillons = [0, 1].map(() => this.boucleSpatiale(b.grillons, 6, 1, 0.35, 0)).filter(Boolean);
    this.posGrillons = [];
  }

  /** Son ponctuel spatialisé. */
  jouer(buffer, x, y, z, { volume = 1, ref = 5, rolloff = 1.2, vitesse = entre(0.93, 1.07), reverb = 0.35 } = {}) {
    if (!buffer || !this.pret) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = vitesse;
    const g = ctx.createGain(); g.gain.value = volume;
    const p = this.panner(ref, rolloff);
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    s.connect(g).connect(p).connect(this.maitre);
    if (reverb) { const r = ctx.createGain(); r.gain.value = reverb; p.connect(r).connect(this.envoiReverb); }
    s.start();
    s.onended = () => { s.disconnect(); g.disconnect(); p.disconnect(); };
  }

  /** Son ponctuel non spatialisé (pas du joueur). */
  jouerProche(buffer, volume) {
    if (!buffer || !this.pret) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = entre(0.9, 1.1);
    const g = this.ctx.createGain(); g.gain.value = volume;
    s.connect(g).connect(this.maitre);
    const r = this.ctx.createGain(); r.gain.value = 0.15; g.connect(r).connect(this.envoiReverb);
    s.start();
    s.onended = () => { s.disconnect(); g.disconnect(); };
  }

  // ---------- réglages ----------

  regler(volume) {
    this.volume = volume;
    try { localStorage.setItem(CLE_VOLUME, String(volume)); } catch { /* rien */ }
    if (this.maitre && !this.coupe) this.maitre.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  basculerCoupure() {
    this.coupe = !this.coupe;
    if (this.maitre) this.maitre.gain.setTargetAtTime(this.coupe ? 0 : this.volume, this.ctx.currentTime, 0.05);
    return this.coupe;
  }

  /** Atténue l'ambiance pendant une cinématique narrée. */
  attenuer(oui) {
    if (!this.maitre || this.coupe) return;
    this.maitre.gain.setTargetAtTime(oui ? this.volume * 0.55 : this.volume, this.ctx.currentTime, 0.4);
  }

  // ---------- mise à jour à chaque image ----------

  /**
   * @param ecoute { position, avant, haut } de la caméra
   * @param etat { dt, jour, heure, joueur, foyers, frappes, animaux, pas, surface }
   */
  maj(ecoute, etat) {
    if (!this.pret || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime, L = ctx.listener;
    const { position: P, avant: F, haut: U } = ecoute;
    if (L.positionX) {
      L.positionX.value = P.x; L.positionY.value = P.y; L.positionZ.value = P.z;
      L.forwardX.value = F.x; L.forwardY.value = F.y; L.forwardZ.value = F.z;
      L.upX.value = U.x; L.upY.value = U.y; L.upZ.value = U.z;
    } else {
      L.setPosition(P.x, P.y, P.z);
      L.setOrientation(F.x, F.y, F.z, U.x, U.y, U.z);
    }
    const { dt, jour, joueur } = etat;
    const nuit = 1 - jour;
    const j = joueur || P;

    // vent : rafales aléatoires, plus fortes près du bord et en hauteur
    this.rafaleMinuteur = (this.rafaleMinuteur ?? 0) - dt;
    if (this.rafaleMinuteur <= 0) { this.rafaleCible = Math.pow(Math.random(), 1.6); this.rafaleMinuteur = entre(1.5, 6); }
    this.rafale += (this.rafaleCible - this.rafale) * Math.min(1, dt * 0.8);
    const bord = Math.max(0, Math.min(1, (distPlateau(j.x, j.z) + 60) / 60));
    const expose = 0.35 + 0.65 * bord;
    this.ventGain.gain.setTargetAtTime((0.1 + this.rafale * 0.3) * expose, t, 0.3);
    this.ventFiltre.frequency.setTargetAtTime(280 + this.rafale * 900 * expose, t, 0.3);
    this.sifflementGain.gain.setTargetAtTime(Math.max(0, this.rafale - 0.55) * 0.12 * bord, t, 0.4);
    this.sifflement.frequency.setTargetAtTime(600 + this.rafale * 500, t, 0.5);
    this.feuillesGain.gain.setTargetAtTime(0.012 + this.rafale * 0.045, t, 0.3);
    this.vent = 0.4 + this.rafale * 1.2;

    // foyers : les trois plus proches reçoivent une boucle de feu
    if (this.boucles.feux.length && etat.foyers) {
      const proches = etat.foyers
        .map((f) => ({ f, d: Math.hypot(f.pos.x - j.x, f.pos.z - j.z) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, this.boucles.feux.length);
      this.boucles.feux.forEach((b, i) => {
        const p = proches[i];
        if (!p || p.d > 45) { b.gain.gain.setTargetAtTime(0, t, 0.3); return; }
        this.placer(b.panner, p.f.pos.x, p.f.pos.y - 0.4, p.f.pos.z);
        const v = p.f.type === 'toit' ? 0.25 : p.f.type === 'four' ? 0.6 : 0.9;
        b.gain.gain.setTargetAtTime(b.volume * v, t, 0.3);
      });
    }

    // foule de la place, plus clairsemée la nuit
    if (this.boucles.foule) {
      this.placer(this.boucles.foule.panner, PLACE.x, (P.y + 1.5), PLACE.z);
      this.boucles.foule.gain.gain.setTargetAtTime(this.boucles.foule.volume * (0.15 + 0.85 * jour), t, 0.5);
    }

    // alouette au-dessus des champs, de jour ; elle se déplace lentement
    if (this.boucles.alouette) {
      this.alouetteAngle = (this.alouetteAngle ?? Math.random() * 6) + dt * 0.03;
      const r = 60;
      this.placer(this.boucles.alouette.panner, j.x + Math.cos(this.alouetteAngle) * r, j.y + 30, j.z + Math.sin(this.alouetteAngle) * r);
      this.boucles.alouette.gain.gain.setTargetAtTime(this.boucles.alouette.volume * Math.max(0, jour - 0.3), t, 1);
    }

    // grillons dans l'herbe, le soir et la nuit
    this.boucles.grillons.forEach((b, i) => {
      const pos = this.posGrillons[i];
      if (!pos || Math.hypot(pos[0] - j.x, pos[1] - j.z) > 30) {
        const a = Math.random() * Math.PI * 2, r = entre(6, 18);
        this.posGrillons[i] = [j.x + Math.cos(a) * r, j.z + Math.sin(a) * r];
      }
      const [gx, gz] = this.posGrillons[i];
      this.placer(b.panner, gx, j.y, gz);
      const champ = rueProche(gx, gz).d > 3 ? 1 : 0.3;
      b.gain.gain.setTargetAtTime(b.volume * Math.max(0, nuit - 0.25) * 1.3 * champ, t, 1);
    });

    // événements ponctuels
    const m = this.minuteurs;
    for (const k in m) m[k] -= dt;
    const b = this.banque;
    if (m.oiseau <= 0) {
      m.oiseau = entre(2, 7) / Math.max(0.15, jour);
      if (jour > 0.4) {
        const a = Math.random() * Math.PI * 2, r = entre(8, 35);
        this.jouer(hasard(b.passereau || [null]), j.x + Math.cos(a) * r, j.y + entre(3, 8), j.z + Math.sin(a) * r, { volume: 0.35, ref: 4, reverb: 0.1 });
      }
    }
    if (m.corneille <= 0) {
      m.corneille = entre(14, 40);
      if (jour > 0.3) {
        const a = Math.random() * Math.PI * 2, r = entre(40, 120);
        this.jouer(hasard(b.corneille || [null]), j.x + Math.cos(a) * r, j.y + entre(10, 25), j.z + Math.sin(a) * r, { volume: 0.45, ref: 10, rolloff: 0.8, reverb: 0.2 });
      }
    }
    if (m.chien <= 0) {
      m.chien = entre(12, 40);
      const a = Math.random() * Math.PI * 2, r = entre(30, 110);
      if (distPlateau(j.x + Math.cos(a) * r, j.z + Math.sin(a) * r) < -10) {
        this.jouer(hasard(b.chien || [null]), j.x + Math.cos(a) * r, j.y + 0.6, j.z + Math.sin(a) * r, { volume: 0.5, ref: 8, rolloff: 0.9, reverb: 0.45 });
      }
    }
    if (m.chouette <= 0) {
      m.chouette = entre(20, 60);
      if (nuit > 0.6) {
        const a = Math.random() * Math.PI * 2, r = entre(40, 90);
        this.jouer(hasard(b.chouette || [null]), j.x + Math.cos(a) * r, j.y + 12, j.z + Math.sin(a) * r, { volume: 0.5, ref: 12, rolloff: 0.8, reverb: 0.3, vitesse: 1 });
      }
    }
    // animaux : un cri de temps à autre, venant d'un animal proche
    if (m.animal <= 0 && etat.animaux?.length) {
      m.animal = entre(2, 6);
      const proches = etat.animaux.filter((a) => a.racine.position.distanceTo(j) < 50);
      if (proches.length) {
        const a = hasard(proches);
        const cri = { porc: b.cochon, mouton: b.mouton, boeuf: b.boeuf }[a.espece];
        const proba = { porc: 0.55, mouton: 0.4, boeuf: 0.2 }[a.espece];
        if (Math.random() < proba) {
          const p = a.racine.position;
          this.jouer(hasard(cri || [null]), p.x, p.y + 0.6, p.z, { volume: a.espece === 'boeuf' ? 0.8 : 0.6, ref: a.espece === 'boeuf' ? 7 : 4 });
        }
      }
    }
    // marteaux des forgerons
    for (const f of etat.frappes || []) {
      if (f.distanceTo(j) < 90) this.jouer(hasard(b.enclume || [null]), f.x, f.y, f.z, { volume: 0.55, ref: 4, rolloff: 1.1, reverb: 0.5 });
    }
    // pas du joueur
    if (etat.pas) {
      const sons = b.pas?.[etat.surface] || b.pas?.terre;
      this.jouerProche(hasard(sons || [null]), etat.surface === 'bois' ? 0.3 : etat.course ? 0.32 : 0.22);
    }
  }
}

/** Nature du sol sous les pieds du joueur, pour choisir le bruit de pas. */
export function surfaceSous(x, z, surEstrade) {
  if (surEstrade) return 'bois';
  if (rueProche(x, z).d < 0.4) return 'gravier';
  if (Math.max(Math.abs(x - SANCTUAIRE.x), Math.abs(z - SANCTUAIRE.z)) < SANCTUAIRE.cote / 2) return 'terre';
  if (Math.abs(x - PLACE.x) < PLACE.lx / 2 && Math.abs(z - PLACE.z) < PLACE.lz / 2) return 'gravier';
  return 'herbe';
}
