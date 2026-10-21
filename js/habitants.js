// habitants.js : la ville vivante : passants dans les rues, forgerons, marchands, animaux.
import * as THREE from 'three';
import { Personnage } from './personnage.js';
import { RUES, PLACE } from './plan.js';
import { hauteurSol } from './relief.js';
import { aleatoire } from './bruit.js';
import { versMonde } from './batiments.js';

const PEAUX = ['#e2b896', '#d9a985', '#c99572', '#e8c4a2', '#d2a07c'];
const CHEVEUX = ['#b9773f', '#5b3a24', '#3b2a1e', '#8a5a2e', '#c89a5a', '#2a1f18', '#6e6258'];
const ETOFFES = [
  ['#8e3528', '#d4a24e', '#2c2b38'], ['#47566b', '#c9b27a', '#1f2430'], ['#6e5a42', '#3a2e22', '#a08a62'],
  ['#b88a4a', '#7c3b28', '#e6d4a8'], ['#3d5a3a', '#c9a14a', '#1d2a1c'], ['#7a6a52', '#4a3e30', '#c9b89a'],
  ['#9a6a3a', '#3a5a6a', '#e0c890'], ['#5a3a4a', '#d6b46a', '#2a1a24'], ['#8a8070', '#5a5040', '#c0b8a0'],
];

function definitionAleatoire(alea, i) {
  const femme = alea() < 0.45;
  const choix = (t) => t[Math.floor(alea() * t.length)];
  return {
    id: `habitant-${i}`, nom: '', role: '',
    peau: choix(PEAUX), cheveux: choix(CHEVEUX),
    barbe: femme ? null : choix(['moustache', 'barbe', null, 'moustache']),
    tunique: choix(ETOFFES), braies: femme ? null : choix(ETOFFES),
    manteau: alea() < 0.35 ? choix(ETOFFES) : null,
    torque: !femme && alea() < 0.08, robe: femme, tablier: alea() < 0.25 ? '#6b5440' : null, cheveuxLongs: femme,
  };
}

// ---------- réseau de rues ----------

function intersection(r1, r2) {
  const [x1, z1] = r1.a, [x2, z2] = r1.b, [x3, z3] = r2.a, [x4, z4] = r2.b;
  const d = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

function reseau() {
  const croisements = RUES.map(() => []);
  for (let i = 0; i < RUES.length; i++) for (let j = i + 1; j < RUES.length; j++) {
    const k = intersection(RUES[i], RUES[j]);
    if (!k) continue;
    croisements[i].push({ t: k.t, vers: j, tAutre: k.u });
    croisements[j].push({ t: k.u, vers: i, tAutre: k.t });
  }
  return croisements;
}

const pointRue = (r, t) => [r.a[0] + (r.b[0] - r.a[0]) * t, r.a[1] + (r.b[1] - r.a[1]) * t];

// ---------- passant ----------

class Passant {
  constructor(def, renderer, alea, croisements, monde) {
    this.p = new Personnage(def, renderer);
    this.alea = alea;
    this.croisements = croisements;
    this.monde = monde;
    this.rue = Math.floor(alea() * RUES.length);
    this.t = alea();
    this.decalage = (alea() - 0.5) * 0.7;
    this.vitesse = 1.05 + alea() * 0.45;
    this.pause = 0;
    this.choisirBut();
    this.pos = new THREE.Vector3();
    this.placer();
    this.orientation = 0;
  }

  choisirBut() {
    const liste = this.croisements[this.rue];
    if (liste.length && this.alea() < 0.75) this.but = liste[Math.floor(this.alea() * liste.length)];
    else this.but = { t: this.alea(), vers: null };
  }

  placer() {
    const r = RUES[this.rue];
    const [x, z] = pointRue(r, this.t);
    const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], l = Math.hypot(dx, dz);
    // on marche à droite de la chaussée selon son sens
    const sens = this.but.t >= this.t ? 1 : -1;
    const off = (r.l / 2 - 0.9) * (0.4 + Math.abs(this.decalage)) * sens;
    this.pos.set(x - (dz / l) * off, 0, z + (dx / l) * off);
    this.pos.y = hauteurSol(this.pos.x, this.pos.z);
  }

  maj(dt, temps, joueur) {
    const r = RUES[this.rue];
    const l = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
    let v = 0;
    const dJoueur = joueur ? Math.hypot(joueur.x - this.pos.x, joueur.z - this.pos.z) : 99;
    if (this.pause > 0) {
      this.pause -= dt;
    } else if (dJoueur < 1.4) {
      // laisse passer le joueur
    } else {
      const sens = Math.sign(this.but.t - this.t);
      const pas = (this.vitesse * dt) / l;
      if (Math.abs(this.but.t - this.t) <= pas) {
        this.t = this.but.t;
        if (this.but.vers !== null && this.alea() < 0.6) { this.t = this.but.tAutre; this.rue = this.but.vers; }
        if (this.alea() < 0.3) this.pause = 2 + this.alea() * 6;
        this.choisirBut();
      } else {
        this.t += sens * pas;
        v = this.vitesse;
      }
    }
    const avant = this.pos.clone();
    this.placer();
    // ne pas passer à travers les étals ou les poteaux posés au bord des rues
    this.monde.collisions.resoudre(this.pos, 0.3);
    this.pos.y = hauteurSol(this.pos.x, this.pos.z);
    const dx = this.pos.x - avant.x, dz = this.pos.z - avant.z;
    if (Math.hypot(dx, dz) > 0.002) {
      const voulu = Math.atan2(dx, dz);
      let e = voulu - this.orientation;
      e = Math.atan2(Math.sin(e), Math.cos(e));
      this.orientation += e * Math.min(1, dt * 6);
    } else if (dJoueur < 4) {
      const voulu = Math.atan2(joueur.x - this.pos.x, joueur.z - this.pos.z);
      let e = voulu - this.orientation;
      e = Math.atan2(Math.sin(e), Math.cos(e));
      this.orientation += e * Math.min(1, dt * 3);
    }
    this.p.racine.position.copy(this.pos);
    this.p.racine.rotation.y = this.orientation;
    this.p.animer(dt, v, true, temps);
  }
}

// ---------- animaux ----------

function membre(l, r, mat) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, l - 2 * r), 3, 6).translate(0, -l / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

/** Quadrupède simple : corps, tête, quatre pattes articulées. */
class Animal {
  constructor(espece, alea) {
    this.espece = espece;
    this.alea = alea;
    const E = {
      // les porcs gaulois, proches du sanglier, étaient hauts sur pattes et sombres
      porc: { corps: [0.9, 0.42, 0.38], patte: 0.36, couleur: ['#3a2c24', '#4a3628', '#2e2420'], tete: 0.2, vitesse: 0.7 },
      // moutons de petite taille, à toison brune (type Soay)
      mouton: { corps: [0.75, 0.42, 0.4], patte: 0.34, couleur: ['#7a5a3e', '#8e7a62', '#5e4632', '#b8a88a'], tete: 0.15, vitesse: 0.55 },
      // bovins de petite taille de l'âge du Fer
      boeuf: { corps: [1.5, 0.66, 0.6], patte: 0.6, couleur: ['#5e3e2a', '#7a5236', '#3e2c22', '#8a6a4a'], tete: 0.26, vitesse: 0.6 },
    }[espece];
    this.E = E;
    const couleur = E.couleur[Math.floor(alea() * E.couleur.length)];
    const mat = new THREE.MeshStandardMaterial({ color: couleur, roughness: espece === 'mouton' ? 1 : 0.85 });
    const sombre = new THREE.MeshStandardMaterial({ color: new THREE.Color(couleur).multiplyScalar(0.55), roughness: 0.9 });
    this.racine = new THREE.Group();
    const [lc, hc, wc] = E.corps;
    const corps = new THREE.Mesh(
      espece === 'mouton' ? new THREE.IcosahedronGeometry(0.5, 1).scale(lc, hc * 1.2, wc * 1.2) : new THREE.CapsuleGeometry(0.5, 1, 4, 10).rotateX(Math.PI / 2).scale(wc * 2, hc * 1.8, lc / 2),
      mat);
    if (espece === 'mouton') corps.rotation.y = Math.PI / 2;
    corps.position.y = E.patte + hc * 0.45;
    corps.castShadow = true;
    this.racine.add(corps);
    this.corps = corps;
    // tête
    this.cou = new THREE.Group();
    this.cou.position.set(0, E.patte + hc * 0.7, lc / 2);
    this.racine.add(this.cou);
    const tete = new THREE.Mesh(new THREE.CapsuleGeometry(E.tete * 0.7, E.tete * 1.4, 3, 8).rotateX(Math.PI / 2), espece === 'mouton' ? sombre : mat);
    tete.position.set(0, 0, E.tete * 0.9);
    tete.castShadow = true;
    this.cou.add(tete);
    if (espece === 'porc') {
      const groin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 10).rotateX(Math.PI / 2), sombre);
      groin.position.set(0, -0.02, E.tete * 2.0);
      this.cou.add(groin);
    }
    if (espece === 'boeuf') {
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.6 }));
        c.rotation.z = -s * 1.1;
        c.position.set(s * 0.17, 0.12, E.tete * 0.6);
        this.cou.add(c);
      }
    }
    for (const s of [-1, 1]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(E.tete * 0.32, 6, 4).scale(1, 0.5, 1.4), espece === 'mouton' ? sombre : mat);
      o.position.set(s * E.tete * 0.7, E.tete * 0.45, E.tete * 0.3);
      this.cou.add(o);
    }
    // pattes
    this.pattes = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * wc * 0.32, E.patte + 0.04, sz * lc * 0.36);
      pivot.add(membre(E.patte + 0.04, espece === 'boeuf' ? 0.06 : 0.04, sombre));
      this.racine.add(pivot);
      this.pattes.push(pivot);
    }
    if (espece !== 'mouton') {
      const queue = membre(espece === 'boeuf' ? 0.6 : 0.2, 0.02, sombre);
      queue.position.set(0, E.patte + hc * 0.75, -lc / 2);
      queue.rotation.x = 0.3;
      this.racine.add(queue);
      this.queue = queue;
    }
    this.phase = alea() * 10;
    this.cible = null;
    this.attente = alea() * 4;
    this.broute = 0;
    this.orientation = alea() * Math.PI * 2;
  }

  /** zone : { x, z, rot, l, w } (rectangle local) ou { x, z, rayon } (cercle). */
  definirZone(zone) {
    this.zone = zone;
    const [x, z] = this.pointZone();
    this.racine.position.set(x, hauteurSol(x, z), z);
  }

  pointZone() {
    const z = this.zone, a = this.alea;
    if (z.rayon) { const t = a() * Math.PI * 2, r = Math.sqrt(a()) * z.rayon; return [z.x + Math.cos(t) * r, z.z + Math.sin(t) * r]; }
    return versMonde(z.x, z.z, z.rot, (a() - 0.5) * (z.l - 2.2), (a() - 0.5) * (z.w - 2.2));
  }

  maj(dt, temps) {
    let v = 0;
    const p = this.racine.position;
    if (this.attente > 0) {
      this.attente -= dt;
      this.broute = Math.min(1, this.broute + dt * 1.5);
    } else {
      if (!this.cible) this.cible = this.pointZone();
      const dx = this.cible[0] - p.x, dz = this.cible[1] - p.z, d = Math.hypot(dx, dz);
      this.broute = Math.max(0, this.broute - dt * 2);
      if (d < 0.2) { this.cible = null; this.attente = 3 + this.alea() * 9; }
      else {
        const voulu = Math.atan2(dx, dz);
        let e = voulu - this.orientation;
        e = Math.atan2(Math.sin(e), Math.cos(e));
        this.orientation += e * Math.min(1, dt * 2.5);
        v = this.E.vitesse * Math.max(0, Math.cos(e));
        p.x += Math.sin(this.orientation) * v * dt;
        p.z += Math.cos(this.orientation) * v * dt;
      }
    }
    p.y = hauteurSol(p.x, p.z);
    this.racine.rotation.y = this.orientation;
    this.phase += dt * v * 7;
    const amp = Math.min(1, v * 2) * 0.45;
    this.pattes.forEach((pt, i) => { pt.rotation.x = Math.sin(this.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amp; });
    // tête baissée pour brouter, petits mouvements
    this.cou.rotation.x = this.broute * 0.85 + Math.sin(temps * 2 + this.phase) * 0.05 * this.broute;
    if (this.queue) this.queue.rotation.z = Math.sin(temps * 3 + this.phase) * 0.4;
  }
}

// ---------- ensemble ----------

export class Habitants {
  constructor(scene, renderer, monde, rendu, nombre = 18) {
    const alea = aleatoire(1789);
    this.scene = scene;
    this.passants = [];
    this.fixes = [];
    this.animaux = [];
    this.frappes = [];     // positions des coups de marteau de l'image courante
    this.groupe = new THREE.Group();
    scene.add(this.groupe);
    const croisements = reseau();

    for (let i = 0; i < nombre; i++) {
      const p = new Passant(definitionAleatoire(alea, i), renderer, alea, croisements, monde);
      this.groupe.add(p.p.racine);
      this.passants.push(p);
    }

    // forgerons au travail
    monde.forges.slice(0, 4).forEach((f, i) => {
      const def = definitionAleatoire(alea, 100 + i);
      Object.assign(def, { robe: false, cheveuxLongs: false, barbe: 'barbe', tablier: '#4a3424', manteau: null, braies: def.tunique });
      const p = new Personnage(def, renderer);
      p.action = 'marteau';
      p.outil('marteau');
      p.cycle = alea();
      // posé à 0,75 m de l'enclume, face à elle
      const [x, z] = versMonde(f.enclume.x, f.enclume.z, f.rot, 0, 0.75);
      p.racine.position.set(x, hauteurSol(x, z), z);
      p.racine.rotation.y = Math.atan2(f.enclume.x - x, f.enclume.z - z);
      monde.collisions.cercle(x, z, 0.3);
      this.groupe.add(p.racine);
      this.fixes.push({ p, enclume: f.enclume.clone().setY(f.enclume.y + 0.9) });
    });

    // marchands sur la place, qui haranguent les passants
    for (let i = 0; i < 4; i++) {
      const def = definitionAleatoire(alea, 200 + i);
      const p = new Personnage(def, renderer);
      p.action = 'parler';
      const x = PLACE.x - PLACE.lx / 2 + 8 + i * 8, z = PLACE.z + 4 - 1.2;
      p.racine.position.set(x, hauteurSol(x, z), z);
      p.racine.rotation.y = Math.PI;
      monde.collisions.cercle(x, z, 0.3);
      this.groupe.add(p.racine);
      this.fixes.push({ p });
    }

    // bétail dans les enclos, porcs en liberté entre les maisons
    for (const e of monde.enclos) {
      const espece = alea() < 0.5 ? 'mouton' : alea() < 0.6 ? 'boeuf' : 'porc';
      const n = espece === 'boeuf' ? 2 : 3 + Math.floor(alea() * 3);
      for (let k = 0; k < n; k++) this.ajouterAnimal(espece, e, alea);
    }
    const lots = monde.lots.filter(l => l.type === 'maison');
    for (let k = 0; k < 6; k++) {
      const l = lots[Math.floor(alea() * lots.length)];
      const [x, z] = versMonde(l.x, l.z, l.rot, 0, -l.w / 2 - 3);
      for (let j = 0; j < 2; j++) this.ajouterAnimal('porc', { x, z, rayon: 2.2 }, alea);
    }

    rendu?.preparerScene(this.groupe);
    this.tous = [...this.passants.map(p => p.p), ...this.fixes.map(f => f.p)];
  }

  ajouterAnimal(espece, zone, alea) {
    const a = new Animal(espece, alea);
    a.definirZone(zone);
    this.groupe.add(a.racine);
    this.animaux.push(a);
  }

  /** Les animaux et personnages lointains ne sont ni animés ni dessinés. */
  maj(dt, temps, joueur) {
    this.frappes.length = 0;
    const loin = 140;
    for (const p of this.passants) {
      const d = joueur ? Math.hypot(p.pos.x - joueur.x, p.pos.z - joueur.z) : 0;
      p.p.racine.visible = d < loin;
      p.maj(dt, temps, joueur);
    }
    for (const f of this.fixes) {
      const d = joueur ? f.p.racine.position.distanceTo(joueur) : 0;
      f.p.racine.visible = d < loin;
      f.p.animer(dt, 0, true, temps);
      if (f.p.frappe && f.enclume) this.frappes.push(f.enclume);
    }
    for (const a of this.animaux) {
      const d = joueur ? a.racine.position.distanceTo(joueur) : 0;
      a.racine.visible = d < loin;
      if (d < loin) a.maj(dt, temps);
    }
  }

  /** Empêche le joueur de traverser les passants et les animaux. */
  repousser(pos, r = 0.32) {
    const pousser = (x, z, rr) => {
      const dx = pos.x - x, dz = pos.z - z, d = Math.hypot(dx, dz), min = r + rr;
      if (d < min && d > 1e-5) { pos.x += (dx / d) * (min - d); pos.z += (dz / d) * (min - d); }
    };
    for (const p of this.passants) pousser(p.pos.x, p.pos.z, 0.3);
    for (const a of this.animaux) pousser(a.racine.position.x, a.racine.position.z, a.espece === 'boeuf' ? 0.7 : 0.45);
  }

  /** Positions pour le moteur sonore. */
  sources() {
    return { animaux: this.animaux, passants: this.passants };
  }
}
