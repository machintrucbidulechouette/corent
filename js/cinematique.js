// cinematique.js : plans de caméra propres à chaque lieu, avec sous-titres et possibilité de passer.
import * as THREE from 'three';
import { hauteurSol } from './relief.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Point (dx, dz) exprimé dans le repère du sujet (rot = direction de sa façade), hauteur au-dessus du sol. */
function autour(s, dx, dz, h, solMin = true) {
  const c = Math.cos(s.rot), sn = Math.sin(s.rot);
  const x = s.x + dx * c + dz * sn, z = s.z - dx * sn + dz * c;
  const y = solMin ? Math.max(hauteurSol(x, z), s.y) + h : s.y + h;
  return V(x, y, z);
}

/** Orbite : n points sur un arc autour du sujet. */
function orbite(s, rayon, h, a0, a1, n = 6, hFin = h) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = a0 + (a1 - a0) * t;
    pts.push(autour(s, Math.sin(a) * rayon, Math.cos(a) * rayon, h + (hFin - h) * t));
  }
  return pts;
}

/**
 * Recettes de plans. Chacune renvoie { cam: [points], cible: [points], duree }.
 * Les points sont parcourus par des courbes lissées ; la cible est le point regardé.
 */
const RECETTES = {
  porte: (s) => ({
    duree: 15,
    cam: [autour(s, 0, -45, 16), autour(s, 4, -22, 7), autour(s, 0, -7, 2.6), autour(s, 0, 4, 2.4), autour(s, -3, 18, 3.5)],
    cible: [autour(s, 0, 0, 5), autour(s, 0, 0, 4), autour(s, 0, 6, 3), autour(s, 0, 30, 2.5), autour(s, 2, 80, 3)],
  }),
  belvedere: (s, lieu) => {
    const y = lieu.y + 1.7;
    return {
      duree: 17,
      cam: [V(lieu.x + 6, y + 0.5, lieu.z + 10), V(lieu.x + 2, y + 6, lieu.z + 2), V(lieu.x, y + 18, lieu.z - 12), V(lieu.x - 8, y + 22, lieu.z - 20)],
      cible: [V(lieu.x - 200, y - 40, lieu.z - 900), V(-700, 80, -3200), V(-1500, 120, -3800), V(-3900, 500, -5000)],
    };
  },
  sanctuaire: (s) => ({
    duree: 19,
    cam: [...orbite(s, 62, 34, -0.6, 1.4, 6, 18), autour(s, 0, 36, 3.2), autour(s, 0, 27.5, 2.2)],
    cible: [autour(s, 0, 0, 2), autour(s, 0, 0, 2), autour(s, 0, 0, 2), autour(s, 0, 4, 2), autour(s, 0, 10, 2), autour(s, 0, 24, 3), autour(s, 0, 25, 3.6), autour(s, 0, 10, 2)],
  }),
  temples: (s) => ({
    duree: 16,
    cam: orbite(s, 12, 4.5, 0.2, 2.6, 6, 2.2),
    cible: [autour(s, 0, 0, 3), autour(s, 0, 0, 3.2), autour(s, 0, 0, 2.5), autour(s, 0, 0, 2.2)],
  }),
  fosses: (s) => ({
    duree: 15,
    cam: [autour(s, -12, -6, 5), autour(s, -6, -2, 2.2), autour(s, 0, 2, 1.4), autour(s, 6, 5, 1.2), autour(s, 12, 2, 2.4)],
    cible: [autour(s, 0, 2, 0), autour(s, -3, 4, 0.3), autour(s, 3, 6, 0.3), autour(s, 8, 6, 0.4), autour(s, 14, 6, 0.5)],
  }),
  assemblee: (s) => ({
    // s.rot = π : « devant » (+dz) est le côté nord, ouvert
    duree: 15,
    cam: [autour(s, 0, 2.6, 1.9), autour(s, 2.5, 1.5, 2.2), autour(s, 4.5, -3.5, 3.2), autour(s, 0, -6.2, 3.6), autour(s, -3, -9, 8)],
    cible: [autour(s, 0, -4, 1.4), autour(s, 0, -4, 1.6), autour(s, 0, 0, 1.2), autour(s, 0, 2.4, 1.2), autour(s, 0, 4, 0.5)],
  }),
  place: (s) => ({
    duree: 16,
    cam: [autour(s, -10, 34, 14), autour(s, -6, 24, 9), autour(s, 0, 12, 4), autour(s, 6, 2, 2.4), autour(s, 12, -6, 3)],
    cible: [autour(s, 0, 0, 2), autour(s, 0, 0, 2), autour(s, 0, -4, 1.6), autour(s, 4, -12, 1.8), autour(s, 0, -18, 2)],
  }),
  // bâtiments : orbite rapprochée autour du lot
  maison: (s) => batiment(s, 1, 14),
  forge: (s) => batiment(s, 0.8, 13),
  potier: (s) => batiment(s, 0.7, 13),
  grenier: (s) => batiment(s, 0.6, 12),
};

function batiment(s, echelle, duree) {
  const r = s.taille * 1.25 * echelle + 5;
  return {
    duree,
    cam: [...orbite(s, r * 1.4, 9, 0.9, 0.2, 3, 5), ...orbite(s, r, 3, 0, -0.9, 3, 1.8)],
    cible: [autour(s, 0, 0, 1.5), autour(s, 0, 0, 1.5), autour(s, 0, 1, 1.4), autour(s, 0, 2, 1.4), autour(s, 0, 1.5, 1.3), autour(s, 0, 0, 1.5)],
  };
}

function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/** Découpe les textes d'un lieu en phrases à afficher en sous-titres. */
function phrases(lieu) {
  const res = [];
  for (const p of lieu.texte) for (const ph of p.split(/(?<=[.!?])\s+/)) if (ph.trim()) res.push(ph.trim());
  return res;
}

export class Cinematique {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;            // { racine, titre, epoque, sousTitre, progression }
    this.active = false;
    this.narration = false;
    this.voix = null;
  }

  lancer(lieu, { surFin }) {
    const recette = RECETTES[lieu.id] || ((s) => batiment(s, 1, 12));
    const plan = recette(lieu.sujet, lieu);
    this.courbeCam = new THREE.CatmullRomCurve3(plan.cam, false, 'centripetal');
    this.courbeCible = new THREE.CatmullRomCurve3(plan.cible, false, 'centripetal');
    this.duree = plan.duree;
    this.t = 0;
    this.lieu = lieu;
    this.surFin = surFin;
    this.phrases = phrases(lieu);
    this.indexPhrase = -1;
    this.active = true;
    this.cible = new THREE.Vector3();
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();

    const d = this.dom;
    d.epoque.textContent = lieu.epoque;
    d.titre.textContent = lieu.titre;
    d.sousTitre.textContent = '';
    d.racine.hidden = false;
    d.racine.classList.remove('fin');
    // reflow pour relancer l'animation d'entrée
    void d.racine.offsetWidth;
    d.racine.classList.add('ouverte');
    if (this.narration) this.parler(lieu);
  }

  parler(lieu) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(`${lieu.titre}. ${lieu.texte.join(' ')}`);
      u.lang = 'fr-FR';
      u.rate = 0.98;
      const fr = synth.getVoices().filter(v => v.lang && v.lang.startsWith('fr'));
      if (fr.length) u.voice = fr.find(v => /natural|neural|premium|enhanced/i.test(v.name)) || fr[0];
      synth.speak(u);
    } catch { /* synthèse vocale indisponible */ }
  }

  maj(dt) {
    if (!this.active) return;
    this.t += dt;
    const k = Math.min(1, this.t / this.duree);
    const e = ease(k);
    this.courbeCam.getPoint(e, this.camera.position);
    this.courbeCible.getPoint(Math.min(1, e * 1.02), this.cible);
    // la caméra ne passe jamais sous le sol
    const sol = hauteurSol(this.camera.position.x, this.camera.position.z) + 0.6;
    if (this.camera.position.y < sol) this.camera.position.y = sol;
    this.camera.lookAt(this.cible);

    // sous-titres répartis sur la durée, en laissant le titre seul au début
    const debut = 2.2;
    const n = this.phrases.length;
    const i = this.t < debut ? -1 : Math.min(n - 1, Math.floor(((this.t - debut) / (this.duree - debut)) * n));
    if (i !== this.indexPhrase) {
      this.indexPhrase = i;
      this.dom.sousTitre.classList.remove('visible');
      void this.dom.sousTitre.offsetWidth;
      this.dom.sousTitre.textContent = i >= 0 ? this.phrases[i] : '';
      if (i >= 0) this.dom.sousTitre.classList.add('visible');
    }
    this.dom.progression.style.transform = `scaleX(${k})`;
    if (k >= 1) this.terminer();
  }

  passer() { if (this.active) this.terminer(); }

  terminer() {
    this.active = false;
    try { window.speechSynthesis?.cancel(); } catch { /* rien */ }
    this.dom.racine.classList.remove('ouverte');
    this.dom.racine.hidden = true;
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    const f = this.surFin;
    this.surFin = null;
    f?.(this.lieu);
  }
}
