// poi.js : balises des points d'intérêt et détection de proximité.
import * as THREE from 'three';
import { LIEUX } from './donnees.js';
import { hauteurSol, distPlateau } from './relief.js';
import { SANCTUAIRE, THEATRE, PLACE } from './plan.js';
import { versMonde } from './batiments.js';

const RAYON = 6.5;

function devantLot(lot, recul) {
  if (!lot) return null;
  const [x, z] = versMonde(lot.x, lot.z, lot.rot, 0, lot.w / 2 + recul);
  return [x, z];
}

/** Calcule l'emplacement de chaque lieu à partir des repères produits par le village. */
function emplacements(reperes) {
  const p = {};
  p.porte = [reperes.rempart.porte.x + 9, reperes.rempart.porte.z + 4];
  // belvédère : bord nord du plateau, dans l'axe de Gergovie
  let z = -100;
  while (distPlateau(-60, z) < -9 && z > -400) z -= 0.5;
  p.belvedere = [-60, z];
  p.sanctuaire = [reperes.sanctuaire.porte.x + 4.5, reperes.sanctuaire.porte.z + 4];
  p.temples = [SANCTUAIRE.x + 2, SANCTUAIRE.z + 2];
  p.fosses = [SANCTUAIRE.x + 1, SANCTUAIRE.z + 15];
  p.assemblee = [THEATRE.x + 1.5, THEATRE.z - 6.5];
  p.place = [reperes.place.porteOuest.x + 5, reperes.place.porteOuest.z - 4];
  p.maison = devantLot(reperes.maison, 2.2);
  p.forge = devantLot(reperes.forge, 4.5);
  p.potier = devantLot(reperes.four, 3.5);
  p.grenier = devantLot(reperes.grenier, 2.5);
  return p;
}

/** Centre de ce que montre chaque lieu (sujet des cinématiques), avec l'orientation du bâtiment. */
function sujets(reperes) {
  const lot = (l) => l && { x: l.x, z: l.z, rot: l.rot, taille: Math.max(l.l || 6, l.w || 6) };
  return {
    porte: { x: reperes.rempart.porte.x, z: reperes.rempart.porte.z, rot: Math.PI / 2, taille: 9 },
    sanctuaire: { x: SANCTUAIRE.x, z: SANCTUAIRE.z, rot: Math.PI / 2, taille: SANCTUAIRE.cote },
    temples: { x: SANCTUAIRE.x - 7, z: SANCTUAIRE.z - 5, rot: Math.PI / 2, taille: 11 },
    fosses: { x: SANCTUAIRE.x + 1, z: SANCTUAIRE.z + 11, rot: 0, taille: 16 },
    assemblee: { x: THEATRE.x, z: THEATRE.z, rot: Math.PI, taille: 13 },
    place: { x: PLACE.x, z: PLACE.z, rot: -Math.PI / 2, taille: PLACE.lx },
    maison: lot(reperes.maison),
    forge: lot(reperes.forge),
    potier: lot(reperes.four),
    grenier: lot(reperes.grenier),
  };
}

export class PointsInteret {
  constructor(scene, reperes, decouverts) {
    this.groupe = new THREE.Group();
    scene.add(this.groupe);
    this.decouverts = decouverts;   // Set d'identifiants
    const pos = emplacements(reperes);
    const suj = sujets(reperes);
    this.lieux = LIEUX.filter(l => pos[l.id]).map(l => {
      const [x, z] = pos[l.id];
      const s = suj[l.id] || { x, z, rot: 0, taille: 10 };
      return { ...l, x, z, y: hauteurSol(x, z), sujet: { ...s, y: hauteurSol(s.x, s.z) } };
    });

    const matBois = new THREE.MeshStandardMaterial({ color: 0x5b4532, roughness: 0.9 });
    const geoAnneau = new THREE.TorusGeometry(0.42, 0.06, 10, 32);
    const geoDisque = new THREE.CylinderGeometry(0.28, 0.28, 0.05, 20);
    this.balises = this.lieux.map(l => {
      const g = new THREE.Group();
      g.position.set(l.x, l.y, l.z);
      const poteau = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 7), matBois);
      poteau.position.y = 0.95;
      poteau.castShadow = true;
      g.add(poteau);
      const matDisque = new THREE.MeshStandardMaterial({ color: 0xc9953f, metalness: 0.9, roughness: 0.3, emissive: 0x6b4410, emissiveIntensity: 0.4 });
      const disque = new THREE.Mesh(geoDisque, matDisque);
      disque.rotation.x = Math.PI / 2;
      disque.position.y = 1.75;
      g.add(disque);
      const matAnneau = new THREE.MeshStandardMaterial({ color: 0xe8b450, emissive: 0xffb43c, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.35 });
      const anneau = new THREE.Mesh(geoAnneau, matAnneau);
      anneau.position.y = 3;
      g.add(anneau);
      this.groupe.add(g);
      return { lieu: l, groupe: g, anneau, matAnneau };
    });
    this.actualiserCouleurs();
  }

  actualiserCouleurs() {
    for (const b of this.balises) {
      const vu = this.decouverts.has(b.lieu.id);
      b.matAnneau.emissive.setHex(vu ? 0x8aa0a8 : 0xffb43c);
      b.matAnneau.emissiveIntensity = vu ? 0.5 : 1.6;
      b.matAnneau.color.setHex(vu ? 0xb8c4c8 : 0xe8b450);
    }
  }

  /** Anime les balises et renvoie le lieu le plus proche à portée, ou null. */
  maj(pos, temps) {
    let proche = null, dMin = RAYON;
    for (const b of this.balises) {
      b.anneau.position.y = 3 + Math.sin(temps * 1.8 + b.lieu.x) * 0.15;
      b.anneau.rotation.y = temps * 0.9;
      const d = Math.hypot(pos.x - b.lieu.x, pos.z - b.lieu.z);
      if (d < dMin) { dMin = d; proche = b.lieu; }
    }
    return proche;
  }
}
