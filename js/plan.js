// plan.js — plan général de l'oppidum : grands monuments, rues, rempart et lots d'habitation.
// La disposition s'inspire des restitutions publiées (sanctuaire central, place, édifice
// à gradins, quartiers denses) mais reste une interprétation libre.
import { aleatoire } from './bruit.js';
import { distPlateau } from './relief.js';

export const SANCTUAIRE = { x: 0, z: 0, cote: 50 };          // enclos d'environ 50 m de côté, entrée à l'est
export const PLACE = { x: 70, z: 4, lx: 42, lz: 36 };         // place publique enclose de murs enduits
export const THEATRE = { x: -2, z: 52, rayon: 7 };            // hémicycle d'environ 13 m, ouvert vers le nord

/** Rues : segments [x1, z1] → [x2, z2] et largeur (m). */
export const RUES = [
  { a: [-262, -36], b: [240, -36], l: 6 },    // grande voie est-ouest, depuis la porte
  { a: [38, -175], b: [38, 160], l: 5 },      // voie nord-sud entre sanctuaire et place
  { a: [-215, 100], b: [215, 100], l: 4.5 },  // voie du sud
  { a: [-210, -112], b: [210, -112], l: 4 },  // voie du nord
  { a: [-118, -165], b: [-118, 160], l: 4 },
  { a: [140, -160], b: [140, 150], l: 4 },
  { a: [-46, -36], b: [-46, 100], l: 3.5 },   // ruelle vers le quartier des artisans
  { a: [38, 36], b: [100, 36], l: 3.5 },
];

/** Zones réservées : aucune maison n'y est posée. */
export const RESERVES = [
  { x: SANCTUAIRE.x, z: SANCTUAIRE.z, hx: 36, hz: 36 },
  { x: PLACE.x, z: PLACE.z, hx: PLACE.lx / 2 + 6, hz: PLACE.lz / 2 + 6 },
  { x: THEATRE.x, z: THEATRE.z - 2, hx: THEATRE.rayon + 7, hz: THEATRE.rayon + 6 },
];

/** Quartier des artisans (forges, fours de potiers), au sud-ouest. */
export const ARTISANS = { x: -82, z: 60, hx: 34, hz: 32 };

export function distanceSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Distance au bord de la rue la plus proche (négative = sur la chaussée) et rue concernée. */
export function rueProche(x, z) {
  let meilleure = Infinity, rue = null;
  for (const r of RUES) {
    const d = distanceSegment(x, z, r.a[0], r.a[1], r.b[0], r.b[1]) - r.l / 2;
    if (d < meilleure) { meilleure = d; rue = r; }
  }
  return { d: meilleure, rue };
}

export function dansReserve(x, z, marge = 0) {
  return RESERVES.some(r => Math.abs(x - r.x) < r.hx + marge && Math.abs(z - r.z) < r.hz + marge);
}

/** Position de la porte du rempart : sur la grande voie, à 12 m du bord ouest. */
export function positionPorte() {
  const z = -36;
  let x = 0;
  while (distPlateau(x, z) < -12 && x > -400) x -= 0.5;
  return { x, z };
}

/** Tracé du rempart le long du bord ouest du plateau (liste de points). */
export function traceRempart() {
  const points = [];
  for (let deg = 128; deg <= 232; deg += 3) {
    const a = (deg * Math.PI) / 180;
    const cx = Math.cos(a), cz = Math.sin(a);
    let r = 50;
    while (distPlateau(cx * r, cz * r) < -12 && r < 400) r += 0.5;
    points.push([cx * r, cz * r]);
  }
  return points;
}

/**
 * Lots d'habitation générés à partir d'une graine.
 * Chaque lot : { x, z, rot, l, w, type } — type : maison, grenier, atelier, enclos.
 */
export function genererLots() {
  const alea = aleatoire(2026);
  const lots = [];
  const porte = positionPorte();
  for (let gx = -236; gx <= 236; gx += 14) {
    for (let gz = -176; gz <= 176; gz += 13) {
      const x = gx + (alea() - 0.5) * 5;
      const z = gz + (alea() - 0.5) * 5;
      if (distPlateau(x, z) > -22) continue;
      if (dansReserve(x, z, 2)) continue;
      if (Math.hypot(x - porte.x, z - porte.z) < 28) continue;
      const { d, rue } = rueProche(x, z);
      if (d < 4.5) continue;
      // la densité baisse loin des rues et vers les bords
      const loin = d > 38 || distPlateau(x, z) > -45;
      if (loin && alea() < 0.62) continue;

      const horizontale = Math.abs(rue.b[0] - rue.a[0]) > Math.abs(rue.b[1] - rue.a[1]);
      // la porte (côté +z local) fait face à la rue
      let rot;
      if (horizontale) rot = z < rue.a[1] ? 0 : Math.PI;
      else rot = x < rue.a[0] ? Math.PI / 2 : -Math.PI / 2;
      rot += (alea() - 0.5) * 0.12;

      const artisan = Math.abs(x - ARTISANS.x) < ARTISANS.hx && Math.abs(z - ARTISANS.z) < ARTISANS.hz;
      let type = 'maison';
      const t = alea();
      if (artisan) type = t < 0.45 ? 'atelier' : t < 0.7 ? 'four' : 'maison';
      else if (loin) type = t < 0.4 ? 'grenier' : t < 0.65 ? 'enclos' : 'maison';
      else if (t < 0.12) type = 'grenier';

      const l = type === 'grenier' ? 3.2 + alea() : 8 + alea() * 5;
      const w = type === 'grenier' ? 3 + alea() * 0.8 : 5.5 + alea() * 2.5;
      // pas de chevauchement avec la chaussée
      if (d < Math.max(l, w) / 2 + 1) continue;
      lots.push({ x, z, rot, l, w, type, graine: Math.floor(alea() * 1e9) });
    }
  }
  return lots;
}
