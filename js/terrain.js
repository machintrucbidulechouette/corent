// terrain.js — maillages du sol : le plateau (détaillé) et le paysage lointain (grossier).
import * as THREE from 'three';
import { hauteurSol, distPlateau } from './relief.js';
import { fbm, lisser, melanger } from './bruit.js';
import { rueProche, SANCTUAIRE, PLACE, THEATRE, ARTISANS } from './plan.js';

const COULEURS = {
  herbe: new THREE.Color('#6f7f3e'),
  herbeSeche: new THREE.Color('#9a9152'),
  herbeSombre: new THREE.Color('#4f5f2e'),
  terre: new THREE.Color('#7d6448'),
  terreBattue: new THREE.Color('#8f7556'),
  gravier: new THREE.Color('#a99a80'),
  fosse: new THREE.Color('#4a3a2c'),
  roche: new THREE.Color('#5e5853'),
  ble: new THREE.Color('#b9a45f'),
  foret: new THREE.Color('#3b4a26'),
  champ1: new THREE.Color('#8c8a48'),
  champ2: new THREE.Color('#a49656'),
  champ3: new THREE.Color('#6c7a3c'),
  eau: new THREE.Color('#5a7480'),
};

const tmp = new THREE.Color();

/** Couleur du sol sur le plateau : rues, places, champs, herbe. */
function couleurPlateau(x, z, pente, sortie) {
  const n = fbm(x * 0.03, z * 0.03, 3);
  sortie.copy(COULEURS.herbe).lerp(COULEURS.herbeSeche, lisser(-0.2, 0.5, n));
  sortie.lerp(COULEURS.herbeSombre, lisser(0.2, 0.7, fbm(x * 0.11 + 5, z * 0.11, 2)) * 0.4);

  // champs cultivés en périphérie du plateau
  const d = distPlateau(x, z);
  const champ = fbm(Math.floor(x / 28) * 3.1, Math.floor(z / 22) * 2.7, 1);
  if (d > -70 && d < -16 && champ > 0.15) sortie.lerp(COULEURS.ble, 0.55);

  // sol piétiné autour du centre urbain
  const urbain = 1 - lisser(0.75, 1.15, Math.hypot(x / 215, z / 160));
  sortie.lerp(COULEURS.terre, urbain * 0.35 * (0.6 + 0.4 * n));

  // rues empierrées
  const r = rueProche(x, z);
  sortie.lerp(COULEURS.gravier, 1 - lisser(-0.6, 0.8, r.d));
  sortie.lerp(COULEURS.terre, (1 - lisser(0.5, 2.5, r.d)) * lisser(-0.6, 0.5, r.d) * 0.6);

  // sanctuaire : sol battu intérieur et fossé extérieur
  const sx = Math.abs(x - SANCTUAIRE.x), sz = Math.abs(z - SANCTUAIRE.z), h = SANCTUAIRE.cote / 2;
  const carre = Math.max(sx, sz);
  if (carre < h) sortie.lerp(COULEURS.terreBattue, 0.75);
  if (carre > h + 0.6 && carre < h + 3.2 && !(x > 0 && sz < 3)) sortie.lerp(COULEURS.fosse, 0.85);

  // place publique
  if (Math.abs(x - PLACE.x) < PLACE.lx / 2 && Math.abs(z - PLACE.z) < PLACE.lz / 2) sortie.lerp(COULEURS.gravier, 0.6);
  // orchestre de l'édifice à gradins
  const dt = Math.hypot(x - THEATRE.x, z - THEATRE.z);
  if (dt < THEATRE.rayon + 2) sortie.lerp(COULEURS.terreBattue, 0.6);
  // quartier des artisans : sol noirci par les foyers
  if (Math.abs(x - ARTISANS.x) < ARTISANS.hx && Math.abs(z - ARTISANS.z) < ARTISANS.hz) sortie.lerp(COULEURS.fosse, 0.25 * (0.5 + n));

  // corniche rocheuse
  sortie.lerp(COULEURS.roche, lisser(0.35, 0.8, pente));
  return sortie;
}

/** Couleur du paysage lointain : parcelles, forêts, rivière, montagnes. */
function couleurLointain(x, z, y, pente, sortie) {
  const parcelle = fbm(Math.floor(x / 160) * 1.7, Math.floor(z / 120) * 2.3, 1);
  if (parcelle < -0.2) sortie.copy(COULEURS.champ1);
  else if (parcelle < 0.15) sortie.copy(COULEURS.champ3);
  else sortie.copy(COULEURS.champ2);
  const foret = fbm(x * 0.0015 + 3, z * 0.0015 - 7, 3);
  sortie.lerp(COULEURS.foret, lisser(0.05, 0.25, foret));
  sortie.lerp(COULEURS.foret, lisser(-120, 40, y) * 0.8);       // pentes boisées
  sortie.lerp(COULEURS.roche, lisser(0.55, 0.9, pente) * 0.7);
  const riviere = Math.abs(x - 900 - Math.sin(z * 0.0016) * 260);
  if (riviere < 30 && y < -175) sortie.lerp(COULEURS.eau, 0.9);
  return sortie;
}

function construire(taille, segments, coloriage, abaisserCentre = 0) {
  const geo = new THREE.PlaneGeometry(taille, taille, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const couleurs = new Float32Array(pos.count * 3);
  const e = 1.2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = hauteurSol(x, z);
    if (abaisserCentre && Math.abs(x) < abaisserCentre - 1 && Math.abs(z) < abaisserCentre - 1) y -= 8;
    pos.setY(i, y);
    const dx = hauteurSol(x + e, z) - hauteurSol(x - e, z);
    const dz = hauteurSol(x, z + e) - hauteurSol(x, z - e);
    const pente = Math.min(1, Math.hypot(dx, dz) / (2 * e));
    coloriage(x, z, y, pente, tmp);
    // légère variation par sommet pour casser l'uniformité
    const v = 1 + (fbm(x * 0.5, z * 0.5, 1) * 0.06);
    couleurs[i * 3] = tmp.r * v; couleurs[i * 3 + 1] = tmp.g * v; couleurs[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  geo.computeVertexNormals();
  return geo;
}

export function creerTerrain(textures) {
  const groupe = new THREE.Group();

  const detail = textures.detailSol.clone();
  detail.repeat.set(140, 140);
  detail.needsUpdate = true;
  const matProche = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1 });
  const geoProche = construire(700, 350, (x, z, y, p, c) => couleurPlateau(x, z, p, c));
  const proche = new THREE.Mesh(geoProche, matProche);
  proche.receiveShadow = true;
  proche.name = 'terrain';
  groupe.add(proche);

  const detailLoin = textures.detailSol.clone();
  detailLoin.repeat.set(220, 220);
  detailLoin.needsUpdate = true;
  const matLoin = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailLoin, roughness: 1 });
  // 14 000 m de côté, mailles de 50 m : les lignes de la grille tombent sur ±350 m
  const geoLoin = construire(14000, 280, couleurLointain, 350);
  const loin = new THREE.Mesh(geoLoin, matLoin);
  loin.name = 'paysage';
  groupe.add(loin);

  return groupe;
}

export { melanger };
