// personnage.js — habitants de Corent jouables, modelés et animés en code.
import * as THREE from 'three';
import { etoffe } from './textures.js';

export const PERSONNAGES = [
  {
    id: 'epadnactos',
    nom: 'Epadnactos',
    role: 'Noble arverne',
    resume: "Membre de l'aristocratie, il siège à l'assemblée et prend part aux banquets du sanctuaire.",
    peau: '#e2b896', cheveux: '#b9773f', barbe: 'moustache',
    tunique: ['#8e3528', '#d4a24e', '#2c2b38'], braies: ['#47566b', '#c9b27a', '#1f2430'],
    manteau: ['#3d5a3a', '#c9a14a', '#1d2a1c'], torque: true, robe: false, tablier: null, cheveuxLongs: false,
  },
  {
    id: 'seuva',
    nom: 'Seuva',
    role: 'Potière',
    resume: "Elle façonne et cuit la vaisselle vendue sur la place, dans le quartier des artisans.",
    peau: '#d9a985', cheveux: '#5b3a24', barbe: null,
    tunique: ['#b88a4a', '#7c3b28', '#e6d4a8'], braies: null,
    manteau: ['#6b3d5a', '#d6b46a', '#2a1a24'], torque: false, robe: true, tablier: '#8b6a4c', cheveuxLongs: true,
  },
  {
    id: 'cintugnatos',
    nom: 'Cintugnatos',
    role: 'Forgeron',
    resume: "Il travaille le fer au quartier des artisans : outils, clous, armes et pièces de char.",
    peau: '#c99572', cheveux: '#3b2a1e', barbe: 'barbe',
    tunique: ['#6e5a42', '#3a2e22', '#a08a62'], braies: ['#5a4a38', '#2e261c', '#8a7658'],
    manteau: null, torque: false, robe: false, tablier: '#4a3424', cheveuxLongs: false,
  },
];

function mat(couleur, options = {}) {
  return new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85, ...options });
}

function membre(longueur, rayon, materiau) {
  const g = new THREE.CapsuleGeometry(rayon, longueur - rayon * 2, 4, 8);
  g.translate(0, -longueur / 2, 0);
  const m = new THREE.Mesh(g, materiau);
  m.castShadow = true;
  return m;
}

export class Personnage {
  constructor(def, renderer) {
    this.def = def;
    this.racine = new THREE.Group();     // posée au sol, tournée dans la direction de marche
    this.corps = new THREE.Group();      // oscille pendant la marche
    this.racine.add(this.corps);
    this.phase = 0;
    this.vitesseLissee = 0;

    const peau = mat(def.peau, { roughness: 0.7 });
    const cheveux = mat(def.cheveux, { roughness: 0.95 });
    const tex = (c) => etoffe(renderer, c[0], c[1], c[2]);
    const tunique = mat('#ffffff', { map: tex(def.tunique) });
    const braies = def.braies ? mat('#ffffff', { map: tex(def.braies) }) : tunique;
    const chaussures = mat('#3a2a1e');
    const cuir = mat('#5a4030');

    // --- jambes ---
    const hanche = 0.92;
    this.jambes = [-1, 1].map((cote) => {
      const pivot = new THREE.Group();
      pivot.position.set(cote * 0.1, hanche, 0);
      const cuisse = membre(0.46, 0.075, braies);
      pivot.add(cuisse);
      const genou = new THREE.Group();
      genou.position.y = -0.44;
      pivot.add(genou);
      const mollet = membre(0.44, 0.062, def.robe ? peau : braies);
      genou.add(mollet);
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), chaussures);
      pied.position.set(0, -0.44, 0.05);
      pied.castShadow = true;
      genou.add(pied);
      this.corps.add(pivot);
      return { pivot, genou };
    });

    // --- buste ---
    const longTunique = def.robe ? 0.82 : 0.62;
    const buste = new THREE.Mesh(new THREE.CylinderGeometry(0.17, def.robe ? 0.32 : 0.25, longTunique, 12), tunique);
    buste.position.y = 1.44 - longTunique / 2;
    buste.castShadow = true;
    this.corps.add(buste);
    this.buste = buste;
    const torse = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), tunique);
    torse.scale.set(1, 0.6, 0.75);
    torse.position.y = 1.42;
    torse.castShadow = true;
    this.corps.add(torse);
    const ceinture = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.022, 6, 16), cuir);
    ceinture.rotation.x = Math.PI / 2;
    ceinture.position.y = 1.06;
    this.corps.add(ceinture);
    const boucle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), mat('#a07d3a', { metalness: 0.8, roughness: 0.4 }));
    boucle.position.set(0, 1.06, 0.21);
    this.corps.add(boucle);
    if (def.tablier) {
      const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.58), mat(def.tablier, { side: THREE.DoubleSide }));
      tab.position.set(0, 0.86, 0.235);
      tab.rotation.x = -0.08;
      this.corps.add(tab);
    }
    if (def.manteau) {
      // sagum : manteau de laine agrafé sur l'épaule
      const manteau = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 0.78, 14, 1, true, Math.PI * 0.55, Math.PI * 0.9),
        mat('#ffffff', { map: tex(def.manteau), side: THREE.DoubleSide }));
      manteau.position.set(0, 1.08, -0.02);
      manteau.castShadow = true;
      this.corps.add(manteau);
      this.manteau = manteau;
      const fibule = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat('#c9a14a', { metalness: 0.9, roughness: 0.3 }));
      fibule.position.set(0.15, 1.46, 0.12);
      this.corps.add(fibule);
    }

    // --- bras ---
    this.bras = [-1, 1].map((cote) => {
      const pivot = new THREE.Group();
      pivot.position.set(cote * 0.23, 1.44, 0);
      pivot.add(membre(0.3, 0.058, def.id === 'cintugnatos' ? peau : tunique));
      const coude = new THREE.Group();
      coude.position.y = -0.28;
      pivot.add(coude);
      coude.add(membre(0.26, 0.05, peau));
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), peau);
      main.position.y = -0.27;
      coude.add(main);
      if (cote > 0) this.mainDroite = main;
      this.corps.add(pivot);
      return { pivot, coude, cote };
    });

    // --- tête ---
    const tete = new THREE.Group();
    tete.position.y = 1.62;
    this.corps.add(tete);
    this.tete = tete;
    const cou = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), peau);
    cou.position.y = -0.1;
    tete.add(cou);
    const crane = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), peau);
    crane.scale.set(0.92, 1.05, 1);
    crane.castShadow = true;
    tete.add(crane);
    const nez = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 6), peau);
    nez.rotation.x = Math.PI / 2;
    nez.position.set(0, -0.005, 0.115);
    tete.add(nez);
    for (const s of [-1, 1]) {
      const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), mat('#1c1a18'));
      oeil.position.set(s * 0.04, 0.025, 0.1);
      tete.add(oeil);
    }
    const chevelure = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cheveux);
    chevelure.position.y = 0.012;
    chevelure.rotation.x = -0.25;
    tete.add(chevelure);
    if (def.cheveuxLongs) {
      const nuque = membre(0.4, 0.075, cheveux);
      nuque.position.set(0, 0.02, -0.08);
      nuque.rotation.x = 0.12;
      tete.add(nuque);
      const tresse = membre(0.32, 0.03, cheveux);
      tresse.position.set(0.09, -0.06, 0.02);
      tete.add(tresse);
    } else {
      const arriere = new THREE.Mesh(new THREE.SphereGeometry(0.118, 10, 8), cheveux);
      arriere.scale.set(1, 0.95, 0.9);
      arriere.position.set(0, -0.005, -0.03);
      tete.add(arriere);
    }
    if (def.barbe === 'moustache') {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.07, 3, 6), cheveux);
        m.rotation.z = s * 1.0;
        m.position.set(s * 0.03, -0.045, 0.105);
        tete.add(m);
      }
    } else if (def.barbe === 'barbe') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), cheveux);
      b.position.set(0, -0.025, 0.025);
      tete.add(b);
    }
    if (def.torque) {
      const torque = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20, Math.PI * 1.75),
        mat('#d4a640', { metalness: 1, roughness: 0.25 }));
      torque.rotation.set(Math.PI / 2, 0, Math.PI * 0.375 + Math.PI / 2);
      torque.position.y = -0.13;
      tete.add(torque);
    }

    this.racine.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.action = null;
  }

  /** Donne un outil à la main droite (marteau du forgeron). */
  outil(type) {
    if (type !== 'marteau' || !this.mainDroite) return;
    const bois = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
    const fer = new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.45, metalness: 0.8 });
    const manche = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.38, 6), bois);
    manche.rotation.x = Math.PI / 2;
    manche.position.z = 0.15;
    const tete = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.06), fer);
    tete.position.z = 0.32;
    this.mainDroite.add(manche, tete);
  }

  /**
   * Anime la marche.
   * @param dt pas de temps (s), @param vitesse vitesse horizontale (m/s), @param auSol vrai si au sol
   */
  animer(dt, vitesse, auSol, temps) {
    this.vitesseLissee += (vitesse - this.vitesseLissee) * Math.min(1, dt * 10);
    const v = this.vitesseLissee;
    const course = Math.min(1, Math.max(0, (v - 3) / 3));
    this.phase += dt * (v * (2.1 - course * 0.6) + 0.0001);
    const amp = Math.min(1, v / 2.6) * (0.55 + course * 0.35);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    // un pas à chaque fois qu'un pied repasse sous le corps
    const signe = Math.sign(s);
    this.pas = auSol && v > 0.35 && signe !== 0 && signe !== this.signePas;
    if (signe !== 0) this.signePas = signe;

    if (auSol) {
      this.jambes[0].pivot.rotation.x = s * amp;
      this.jambes[1].pivot.rotation.x = -s * amp;
      this.jambes[0].genou.rotation.x = Math.max(0, -c) * amp * 1.3 + 0.03;
      this.jambes[1].genou.rotation.x = Math.max(0, c) * amp * 1.3 + 0.03;
      this.corps.position.y = Math.abs(c) * 0.045 * amp - 0.02 * amp;
      this.corps.rotation.x = 0.06 * course;
    } else {
      for (const [i, j] of this.jambes.entries()) {
        j.pivot.rotation.x += ((i ? -0.5 : 0.3) - j.pivot.rotation.x) * Math.min(1, dt * 8);
        j.genou.rotation.x += (0.8 - j.genou.rotation.x) * Math.min(1, dt * 8);
      }
      this.corps.position.y = 0;
    }
    // bras en balancier, respiration au repos
    const respiration = Math.sin(temps * 1.6) * 0.02;
    for (const b of this.bras) {
      const sens = b.cote < 0 ? 1 : -1;
      b.pivot.rotation.x = (auSol ? -sens * s * amp * 0.9 : -0.6) + respiration;
      b.pivot.rotation.z = b.cote * (0.08 + (auSol ? 0 : 0.35));
      b.coude.rotation.x = -0.15 - amp * 0.45 - course * 0.5;
    }
    this.tete.rotation.y = Math.sin(temps * 0.4) * 0.08 * (1 - Math.min(1, v));
    this.frappe = false;
    if (this.action === 'marteau') {
      // cycle de frappe : lever lent, abattre rapide ; `frappe` passe à vrai à l'impact
      const periode = 1.15;
      const avant = this.cycle ?? 0;
      this.cycle = (avant + dt / periode) % 1;
      const c = this.cycle;
      const levee = c < 0.7 ? Math.sin((c / 0.7) * Math.PI / 2) : 1 - (c - 0.7) / 0.12;
      const b = this.bras[1];
      b.pivot.rotation.x = -0.4 - Math.max(0, levee) * 2.2;
      b.pivot.rotation.z = 0.15;
      b.coude.rotation.x = -0.9 + Math.max(0, levee) * 0.5;
      const g = this.bras[0];
      g.pivot.rotation.x = -0.75; g.coude.rotation.x = -0.6;
      this.corps.rotation.x = 0.15 + (levee < 0.3 ? 0.08 : 0);
      if (avant < 0.82 && c >= 0.82) this.frappe = true;
    } else if (this.action === 'parler') {
      const g = this.bras[(Math.floor(temps / 2.7) % 2)];
      g.pivot.rotation.x = -0.5 + Math.sin(temps * 2.3) * 0.25;
      g.coude.rotation.x = -0.9 + Math.sin(temps * 3.1) * 0.2;
      this.tete.rotation.y = Math.sin(temps * 0.9) * 0.25;
    }
    if (this.manteau) this.manteau.rotation.x = 0.04 + amp * 0.12 + course * 0.1;
    if (this.def.robe) this.buste.rotation.z = s * amp * 0.03;
  }
}
