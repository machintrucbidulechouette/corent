// batiments.js — constructions arvernes : maisons, greniers, ateliers, palissades, objets.
// Chaque fonction dépose ses pièces dans l'assembleur `A` et ses obstacles dans `C`.
import * as THREE from 'three';
import { boite, cylindre, toit, appentis } from './geometrie.js';
import { hauteurSol } from './relief.js';
import { aleatoire } from './bruit.js';

// ---------- gabarits réutilisés ----------

/** Amphore vinaire italique de type Dressel 1 (environ 1,1 m). */
export function gabaritAmphore() {
  const profil = [[0, 0], [0.025, 0.01], [0.04, 0.1], [0.07, 0.2], [0.14, 0.34], [0.155, 0.48],
    [0.15, 0.62], [0.12, 0.71], [0.07, 0.76], [0.058, 0.8], [0.054, 1.0], [0.07, 1.02], [0.066, 1.06], [0, 1.06]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const corps = new THREE.LatheGeometry(profil, 10);
  const anse = (cote) => {
    const g = new THREE.BoxGeometry(0.025, 0.24, 0.035);
    g.translate(cote * 0.1, 0.86, 0);
    return g;
  };
  return [corps, anse(1), anse(-1)];
}

/** Crâne de bovin (bucrane) fixé au sommet des poteaux du sanctuaire. */
export function gabaritBucrane() {
  const tete = new THREE.SphereGeometry(0.13, 8, 6);
  tete.scale(1, 0.85, 1.7);
  tete.rotateX(-1.1);
  const corne = (cote) => {
    const g = new THREE.ConeGeometry(0.035, 0.32, 6);
    g.rotateZ(-cote * 1.15);
    g.translate(cote * 0.2, 0.18, 0);
    return g;
  };
  return [tete, corne(1), corne(-1)];
}

function deposer(A, cle, gabarit, x, y, z, ry = 0, rx = 0, rz = 0, e = 1) {
  for (const g of gabarit) A.ajouter(cle, g, x, y, z, ry, rx, rz, e);
}

/** Convertit une position locale (lx, lz) d'un bâtiment orienté en coordonnées monde. */
export function versMonde(ox, oz, rot, lx, lz) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [ox + lx * c + lz * s, oz - lx * s + lz * c];
}

// ---------- éléments simples ----------

export function poteau(A, C, x, z, h, r = 0.14, cle = 'poutre', y0 = null) {
  const y = y0 ?? hauteurSol(x, z);
  A.ajouter(cle, cylindre(r * 0.92, r, h + 0.4, 7, 1), x, y + h / 2 - 0.2, z);
  if (C) C.cercle(x, z, r + 0.02);
}

/** Palissade de planches entre deux points, avec poteaux. Renvoie la liste des sommets de poteaux. */
export function palissade(A, C, x1, z1, x2, z2, { h = 3, ecart = 2.3, cle = 'planches', epaisseur = 0.22, sommets = null } = {}) {
  const l = Math.hypot(x2 - x1, z2 - z1);
  const rot = -Math.atan2(z2 - z1, x2 - x1);
  const n = Math.max(1, Math.round(l / ecart));
  const hauts = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const ax = x1 + (x2 - x1) * t0, az = z1 + (z2 - z1) * t0;
    const bx = x1 + (x2 - x1) * t1, bz = z1 + (z2 - z1) * t1;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const y = hauteurSol(mx, mz);
    A.ajouter(cle, boite(l / n + 0.02, h + 0.5, epaisseur, 1.6), mx, y + h / 2 - 0.25, mz, rot);
    const py = hauteurSol(ax, az);
    A.ajouter('poutre', cylindre(0.13, 0.15, h + 1.1, 7), ax, py + (h + 1.1) / 2 - 0.4, az);
    hauts.push([ax, py + h + 0.7, az, rot]);
  }
  hauts.push([x2, hauteurSol(x2, z2) + h + 0.7, z2, rot]);
  A.ajouter('poutre', cylindre(0.13, 0.15, h + 1.1, 7), x2, hauteurSol(x2, z2) + (h + 1.1) / 2 - 0.4, z2);
  if (C) C.segment(x1, z1, x2, z2, epaisseur + 0.25);
  if (sommets) sommets.push(...hauts);
  return hauts;
}

/** Clôture basse à lisses (enclos à bétail, jardins). */
export function cloture(A, C, x1, z1, x2, z2) {
  const l = Math.hypot(x2 - x1, z2 - z1);
  const rot = -Math.atan2(z2 - z1, x2 - x1);
  const n = Math.max(1, Math.round(l / 2.2));
  for (let i = 0; i <= n; i++) {
    const x = x1 + (x2 - x1) * i / n, z = z1 + (z2 - z1) * i / n;
    const y = hauteurSol(x, z);
    A.ajouter('poutre', cylindre(0.05, 0.06, 1.4, 5), x, y + 0.5, z);
  }
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, y = hauteurSol(mx, mz);
  A.ajouter('planches', boite(l, 0.07, 0.06), mx, y + 0.45, mz, rot);
  A.ajouter('planches', boite(l, 0.07, 0.06), mx, y + 0.95, mz, rot);
  if (C) C.segment(x1, z1, x2, z2, 0.2);
}

export function tasDeBois(A, C, x, z, rot) {
  const y = hauteurSol(x, z);
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 6 - r; k++) {
      const [px, pz] = versMonde(x, z, rot, (k - (5 - r) / 2) * 0.2, 0);
      A.ajouter('poutre', cylindre(0.09, 0.09, 1.1, 6), px, y + 0.09 + r * 0.17, pz, rot, Math.PI / 2);
    }
  }
  if (C) C.rectangle(x, z, 0.7, 0.6, rot);
}

export function meuleDeFoin(A, C, x, z, e = 1) {
  const y = hauteurSol(x, z);
  A.ajouter('foin', cylindre(1.2 * e, 1.3 * e, 1.6 * e, 10, 2), x, y + 0.8 * e, z);
  const cone = new THREE.ConeGeometry(1.25 * e, 1.3 * e, 10);
  A.ajouter('foin', cone, x, y + 1.6 * e + 0.62 * e, z);
  if (C) C.cercle(x, z, 1.3 * e);
}

export function amphores(A, C, x, z, n, alea, { couchees = 0.3, rayon = 1.2, y = null } = {}) {
  const gab = gabaritAmphore();
  const base = y ?? hauteurSol(x, z);
  for (let i = 0; i < n; i++) {
    const a = alea() * Math.PI * 2, d = Math.sqrt(alea()) * rayon;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (alea() < couchees) deposer(A, 'terreCuite', gab, px, base + 0.15, pz, alea() * 6, Math.PI / 2 - 0.1);
    else deposer(A, 'terreCuite', gab, px, base - 0.12, pz, alea() * 6, (alea() - 0.5) * 0.25);
  }
  if (C) C.cercle(x, z, rayon * 0.8);
}

export function puits(A, C, x, z) {
  const y = hauteurSol(x, z);
  A.ajouter('pierre', cylindre(0.95, 1.05, 0.9, 12, 1), x, y + 0.3, z);
  A.ajouter('fosse', new THREE.CircleGeometry(0.75, 12), x, y + 0.76, z, 0, -Math.PI / 2);
  for (const s of [-1, 1]) A.ajouter('poutre', boite(0.14, 2.2, 0.14), x + s * 0.95, y + 1.1, z);
  A.ajouter('poutre', cylindre(0.07, 0.07, 2.2, 6), x, y + 2.0, z, 0, 0, Math.PI / 2);
  if (C) C.cercle(x, z, 1.1);
}

// ---------- bâtiments ----------

const ENDUITS = ['torchisBlanc', 'torchisBlanc', 'torchisOcre', 'torchisOcre', 'torchisRose'];

/** Maison à ossature de bois et murs de torchis. La porte s'ouvre côté +z local. */
export function maison(A, C, lot) {
  const alea = aleatoire(lot.graine);
  const { x, z, rot, l, w } = lot;
  const y = hauteurSol(x, z);
  const hm = 2.3 + alea() * 0.5;
  const ep = 0.26;
  const mur = ENDUITS[Math.floor(alea() * ENDUITS.length)];
  const L = (lx, yy, lz, geo, cle = mur, ry = 0) => A.ajouterLocal(cle, geo, x, z, rot, lx, yy, lz, ry);
  const bas = 0.6;   // enfoncement des murs dans le sol (le terrain n'est pas plat)
  const hTot = hm + bas;
  const yc = y - bas + hTot / 2;

  // murs arrière et latéraux
  L(0, yc, -w / 2, boite(l, hTot, ep, 1.5));
  L(-l / 2, yc, 0, boite(ep, hTot, w, 1.5));
  L(l / 2, yc, 0, boite(ep, hTot, w, 1.5));
  // mur de façade avec porte
  const largePorte = 1.25, hPorte = 1.85;
  const posPorte = (alea() - 0.5) * (l - 3.5);
  const gauche = posPorte - largePorte / 2 + l / 2;
  const droite = l / 2 - (posPorte + largePorte / 2);
  L(-l / 2 + gauche / 2, yc, w / 2, boite(gauche, hTot, ep, 1.5));
  L(l / 2 - droite / 2, yc, w / 2, boite(droite, hTot, ep, 1.5));
  L(posPorte, y + hPorte + (hm - hPorte) / 2, w / 2, boite(largePorte, hm - hPorte, ep, 1.5));
  // porte en planches, entrouverte
  L(posPorte - 0.25, y + hPorte / 2, w / 2 + 0.35, boite(0.06, hPorte, largePorte * 0.95, 1), 'planches', 1.2);

  // pans de bois : poteaux d'angle et intermédiaires, sablière
  const montant = (lx, lz) => L(lx, y + hm / 2 - 0.2, lz, boite(0.2, hm + 0.4, 0.2), 'poutre');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) montant(sx * l / 2, sz * w / 2);
  const nIntermediaires = Math.floor(l / 2.6);
  for (let i = 1; i < nIntermediaires; i++) {
    const lx = -l / 2 + (i * l) / nIntermediaires;
    montant(lx, -w / 2 - 0.04);
    if (Math.abs(lx - posPorte) > largePorte) montant(lx, w / 2 + 0.04);
  }
  L(0, y + hm, w / 2 + 0.05, boite(l + 0.3, 0.18, 0.18), 'poutre');
  L(0, y + hm, -w / 2 - 0.05, boite(l + 0.3, 0.18, 0.18), 'poutre');
  // soubassement sombre (éclaboussures de boue)
  L(0, y + 0.12, w / 2 + 0.02, boite(l, 0.3, 0.04), 'argile');

  // toiture
  const chaume = alea() < 0.38;
  const croupe = chaume || alea() < 0.45;
  const hToit = w * (chaume ? 0.62 : 0.5);
  L(0, y + hm, 0, toit(l, w, hToit, { debord: chaume ? 0.85 : 0.6, croupe, tuile: chaume ? 2.5 : 2 }), chaume ? 'chaume' : 'bardeaux');
  if (!croupe) {
    // pignons fermés par des planches
    L(-l / 2, y + hm + hToit / 2 - 0.05, 0, boite(0.08, hToit * 0.9, w * 0.5), 'planches');
    L(l / 2, y + hm + hToit / 2 - 0.05, 0, boite(0.08, hToit * 0.9, w * 0.5), 'planches');
  }
  if (!chaume) L(0, y + hm + hToit + 0.05, 0, boite(croupe ? Math.max(0.4, l - w) : l + 1.2, 0.14, 0.24), 'poutre');

  C.rectangle(x, z, l / 2 + 0.2, w / 2 + 0.2, rot);

  // abords
  const r = alea();
  if (r < 0.3) {
    const [px, pz] = versMonde(x, z, rot, l / 2 + 1.2, w / 2 - 1);
    tasDeBois(A, C, px, pz, rot + Math.PI / 2);
  } else if (r < 0.5) {
    const [px, pz] = versMonde(x, z, rot, -l / 2 - 0.9, w / 2 - 0.6);
    amphores(A, C, px, pz, 2 + Math.floor(alea() * 4), alea, { rayon: 0.6 });
  } else if (r < 0.62) {
    // petit enclos à l'arrière
    const p = [[-l / 2, -w / 2 - 0.3], [-l / 2, -w / 2 - 5], [l / 2, -w / 2 - 5], [l / 2, -w / 2 - 0.3]]
      .map(([a, b]) => versMonde(x, z, rot, a, b));
    for (let i = 0; i < 3; i++) cloture(A, C, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
  }
}

/** Grenier surélevé sur poteaux, à l'abri de l'humidité et des rongeurs. */
export function grenier(A, C, lot) {
  const alea = aleatoire(lot.graine);
  const { x, z, rot, l, w } = lot;
  const y = hauteurSol(x, z);
  const hp = 1.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [px, pz] = versMonde(x, z, rot, sx * (l / 2 - 0.15), sz * (w / 2 - 0.15));
    A.ajouter('poutre', cylindre(0.11, 0.13, hp + 0.6, 6), px, y + hp / 2 - 0.3, pz);
  }
  const L = (lx, yy, lz, geo, cle) => A.ajouterLocal(cle, geo, x, z, rot, lx, yy, lz);
  L(0, y + hp, 0, boite(l + 0.2, 0.16, w + 0.2), 'poutre');
  L(0, y + hp + 0.95, 0, boite(l - 0.1, 1.8, w - 0.1, 1.2), 'planches');
  L(0, y + hp + 1.85, 0, toit(l - 0.1, w - 0.1, w * 0.55, { debord: 0.45, croupe: true }), alea() < 0.5 ? 'chaume' : 'bardeaux');
  // échelle
  const [ex, ez] = versMonde(x, z, rot, 0, w / 2 + 0.55);
  A.ajouter('poutre', boite(0.5, 1.7, 0.06), ex, y + 0.7, ez, rot, 0.4);
  C.rectangle(x, z, l / 2 + 0.15, w / 2 + 0.15, rot);
}

/** Forge sous auvent ouvert. Renvoie la position du foyer (source de fumée et de lumière). */
export function forge(A, C, lot) {
  const alea = aleatoire(lot.graine);
  const { x, z, rot } = lot;
  const l = 7, w = 5;
  const y = hauteurSol(x, z);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
    const [px, pz] = versMonde(x, z, rot, sx * (l / 2), sz * (w / 2));
    poteau(A, C, px, pz, 2.6, 0.13, 'poutre', y);
  }
  const L = (lx, yy, lz, geo, cle, ry = 0) => A.ajouterLocal(cle, geo, x, z, rot, lx, yy, lz, ry);
  L(0, y + 2.6, 0, toit(l, w, 1.9, { debord: 0.6, croupe: false }), 'bardeaux');
  L(0, y + 1.2, -w / 2, boite(l, 2.6, 0.2, 1.5), 'torchisOcre');
  // foyer en pierres et braises
  const [fx, fz] = versMonde(x, z, rot, -1.6, -0.6);
  A.ajouter('pierre', boite(1.5, 0.7, 1.2), fx, y + 0.35, fz, rot);
  A.ajouter('braise', boite(1.0, 0.08, 0.7), fx, y + 0.72, fz, rot);
  C.rectangle(fx, fz, 0.8, 0.65, rot);
  // enclume sur billot
  const [ax, az] = versMonde(x, z, rot, 0.6, 0.2);
  A.ajouter('poutre', cylindre(0.3, 0.32, 0.7, 8), ax, y + 0.35, az);
  A.ajouter('fer', boite(0.5, 0.2, 0.22), ax, y + 0.8, az, rot);
  C.cercle(ax, az, 0.4);
  // soufflet et lingots
  const [bx, bz] = versMonde(x, z, rot, -2.8, 0.3);
  A.ajouter('argile', boite(0.6, 0.35, 0.9), bx, y + 0.2, bz, rot);
  const [lx2, lz2] = versMonde(x, z, rot, 2.2, -1.5);
  for (let i = 0; i < 6; i++) A.ajouter('fer', boite(0.5, 0.06, 0.08), lx2, y + 0.04 + i * 0.065, lz2 + (i % 2) * 0.09, rot + (i % 2) * 0.1);
  tasDeBois(A, C, ...versMonde(x, z, rot, l / 2 + 1.2, 0), rot + Math.PI / 2);
  if (alea() < 0.5) amphores(A, C, ...versMonde(x, z, rot, -l / 2 - 1, 1.5), 3, alea, { rayon: 0.5 });
  return new THREE.Vector3(fx, y + 0.8, fz);
}

/** Four de potier circulaire en argile, avec poteries en attente de cuisson. */
export function fourPotier(A, C, lot) {
  const alea = aleatoire(lot.graine);
  const { x, z, rot } = lot;
  const y = hauteurSol(x, z);
  const dome = new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  A.ajouter('argile', dome, x, y - 0.1, z);
  const [ox, oz] = versMonde(x, z, rot, 0, 1.35);
  A.ajouter('fosse', boite(0.7, 0.6, 0.4), ox, y + 0.25, oz, rot);
  A.ajouter('braise', boite(0.5, 0.25, 0.1), ox, y + 0.2, oz + 0.0, rot);
  C.cercle(x, z, 1.55);
  // étagère de poteries
  const [ex, ez] = versMonde(x, z, rot, 3.2, 0);
  A.ajouter('planches', boite(2.4, 0.08, 0.6), ex, y + 0.6, ez, rot + Math.PI / 2);
  for (const sx of [-1, 1]) A.ajouter('poutre', boite(0.1, 1.2, 0.5), ...[versMonde(ex, ez, rot + Math.PI / 2, sx * 1.1, 0)].map(([a, b]) => [a, y + 0.6, b]).flat(), rot + Math.PI / 2);
  for (let i = 0; i < 7; i++) {
    const [px, pz] = versMonde(ex, ez, rot + Math.PI / 2, -1 + i * 0.33, 0);
    const pot = new THREE.LatheGeometry([[0, 0], [0.08, 0.01], [0.12, 0.1], [0.1, 0.2], [0.07, 0.24], [0.08, 0.27], [0, 0.27]].map(([a, b]) => new THREE.Vector2(a, b)), 8);
    A.ajouter('terreCuite', pot, px, y + 0.64, pz, alea() * 6);
  }
  C.rectangle(ex, ez, 0.4, 1.3, rot);
  // appentis pour l'argile
  const [sx, sz] = versMonde(x, z, rot, -3.6, -0.5);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const [px, pz] = versMonde(sx, sz, rot, a * 1.4, b * 1.2);
    poteau(A, C, px, pz, 2.1, 0.1, 'poutre', y);
  }
  A.ajouter('chaume', appentis(3.4, 3, 2.3, 1.7, 2.5), sx, y, sz, rot);
  A.ajouter('argile', new THREE.SphereGeometry(0.8, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), sx, y - 0.05, sz);
  return new THREE.Vector3(x, y + 1.6, z);
}

/** Enclos à bétail avec meule de foin. */
export function enclos(A, C, lot) {
  const alea = aleatoire(lot.graine);
  const { x, z, rot } = lot;
  const l = 10 + alea() * 4, w = 7 + alea() * 3;
  const c = [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [1.5, w / 2], [-1.5, w / 2], [-l / 2, w / 2]]
    .map(([a, b]) => versMonde(x, z, rot, a, b));
  cloture(A, C, ...c[0], ...c[1]);
  cloture(A, C, ...c[1], ...c[2]);
  cloture(A, C, ...c[2], ...c[3]);
  cloture(A, C, ...c[4], ...c[5]);
  cloture(A, C, ...c[5], ...c[0]);
  meuleDeFoin(A, C, ...versMonde(x, z, rot, l / 4, -w / 6), 0.7 + alea() * 0.3);
  const [ax, az] = versMonde(x, z, rot, -l / 3, -w / 4);
  A.ajouter('poutre', boite(1.6, 0.4, 0.5), ax, hauteurSol(ax, az) + 0.2, az, rot);
}
