// monuments.js — le centre monumental : sanctuaire, édifice à gradins, place publique, rempart et porte.
import * as THREE from 'three';
import { boite, cylindre, toit, appentis, talus } from './geometrie.js';
import { hauteurSol } from './relief.js';
import { aleatoire } from './bruit.js';
import { SANCTUAIRE, PLACE, THEATRE, positionPorte, traceRempart } from './plan.js';
import { palissade, poteau, amphores, puits, gabaritBucrane, versMonde, tasDeBois } from './batiments.js';

/** Sanctuaire : enclos palissadé carré, galerie couverte, deux temples, autel et fosses à offrandes. */
export function sanctuaire(A, C) {
  const alea = aleatoire(80);
  const { x: cx, z: cz, cote } = SANCTUAIRE;
  const h = cote / 2;
  const sommets = [];
  const P = (x1, z1, x2, z2) => palissade(A, C, cx + x1, cz + z1, cx + x2, cz + z2, { h: 3.1, sommets });

  // palissade : la porte est au milieu du côté est
  P(-h, -h, h, -h);       // nord
  P(-h, h, -h, -h);       // ouest
  P(h, h, -h, h);         // sud
  P(h, -h, h, -2.6);      // est, partie nord
  P(h, 2.6, h, h);        // est, partie sud

  // bucranes sur un poteau sur deux, tournés vers l'extérieur
  const buc = gabaritBucrane();
  sommets.forEach(([x, y, z], i) => {
    if (i % 2) return;
    const dx = x - cx, dz = z - cz;
    const ext = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
    const [ox, oz] = [x + Math.sin(ext) * 0.16, z + Math.cos(ext) * 0.16];
    for (const g of buc) A.ajouter('os', g, ox, y - 0.1, oz, ext);
  });

  // porche d'entrée
  const yP = hauteurSol(cx + h, cz);
  for (const s of [-1, 1]) {
    A.ajouter('rouge', boite(0.4, 4.6, 0.4), cx + h, yP + 2.1, cz + s * 2.5);
    A.ajouter('rouge', boite(0.4, 4.6, 0.4), cx + h + 2.4, yP + 2.1, cz + s * 2.5);
    C.cercle(cx + h, cz + s * 2.5, 0.35);
    C.cercle(cx + h + 2.4, cz + s * 2.5, 0.35);
  }
  A.ajouter('rouge', boite(2.9, 0.3, 5.6), cx + h + 1.2, yP + 4.2, cz);
  A.ajouter('bardeaux', toit(2.6, 5.4, 1.4, { debord: 0.5, croupe: false }), cx + h + 1.2, yP + 4.35, cz);
  for (const g of buc) A.ajouter('os', g, cx + h + 2.65, yP + 3.7, cz, Math.PI / 2);

  // galerie couverte le long de la palissade (nord, ouest, sud)
  const prof = 4.2;
  const galerie = (x1, z1, x2, z2, rotToit) => {
    const l = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.round(l / 3.2);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      poteau(A, C, cx + x1 + (x2 - x1) * t, cz + z1 + (z2 - z1) * t, 2.55, 0.12, 'poutre');
    }
    const mx = cx + (x1 + x2) / 2, mz = cz + (z1 + z2) / 2;
    const y = hauteurSol(mx, mz);
    const [ox, oz] = [mx - Math.sin(rotToit) * prof / 2, mz - Math.cos(rotToit) * prof / 2];
    A.ajouter('bardeaux', appentis(l + 0.6, prof + 0.6, 3.5, 2.5), ox, y, oz, rotToit);
  };
  const g = h - prof;
  galerie(-g, -g, g, -g, 0);              // nord : le toit monte vers la palissade (−z)
  galerie(-g, g, -g, -g + 0.01, Math.PI / 2);
  galerie(g, g, -g, g, Math.PI);
  // sol de la galerie : banquettes
  for (const [x, z, rx, rz] of [[0, -h + 1, cote - 2, 0.6], [-h + 1, 0, 0.6, cote - 10], [0, h - 1, cote - 2, 0.6]]) {
    const y = hauteurSol(cx + x, cz + z);
    A.ajouter('planches', boite(rx, 0.45, rz), cx + x, y + 0.22, cz + z);
  }

  // temple principal : cella de torchis entourée d'une galerie (plan centré)
  const temple = (tx, tz, cella, gal, hc) => {
    const y = hauteurSol(cx + tx, cz + tz);
    A.ajouter('pierre', boite(gal + 1.4, 0.4, gal + 1.4, 2), cx + tx, y + 0.1, cz + tz);
    A.ajouter('torchisBlanc', boite(cella, hc + 0.5, cella, 1.5), cx + tx, y + (hc + 0.5) / 2 - 0.1, cz + tz);
    // porte de la cella à l'est
    A.ajouter('rouge', boite(0.1, 2.3, 1.4), cx + tx + cella / 2 + 0.03, y + 1.4, cz + tz);
    A.ajouter('bardeaux', toit(cella, cella, cella * 0.42, { debord: 0.45, croupe: true }), cx + tx, y + hc + 0.3, cz + tz);
    const n = Math.round(gal / 1.9);
    for (let i = 0; i <= n; i++) {
      const t = -gal / 2 + (i * gal) / n;
      for (const [px, pz] of [[t, -gal / 2], [t, gal / 2], [-gal / 2, t], [gal / 2, t]]) {
        if (Math.abs(pz) < 1.2 && px > 0) continue; // passage vers la porte
        poteau(A, C, cx + tx + px, cz + tz + pz, 2.5, 0.11, 'rouge', y + 0.3);
      }
    }
    A.ajouter('bardeaux', toit(gal, gal, gal * 0.22, { debord: 0.5, croupe: true }), cx + tx, y + 2.75, cz + tz);
    C.rectangle(cx + tx, cz + tz, cella / 2 + 0.1, cella / 2 + 0.1);
    return y;
  };
  temple(-7, -5, 6.5, 11, 4.4);
  temple(8.5, -9, 4.6, 8, 3.6);

  // autel de pierre devant le temple principal
  const ya = hauteurSol(cx + 1, cz - 5);
  A.ajouter('pierre', boite(1.6, 1.0, 1.1, 1), cx + 1.5, ya + 0.5, cz - 5);
  A.ajouter('braise', boite(0.8, 0.06, 0.5), cx + 1.5, ya + 1.02, cz - 5);
  C.rectangle(cx + 1.5, cz - 5, 0.85, 0.6);

  // fosses à offrandes : amphores brisées, ossements
  const fosses = [[-9, 9], [-3, 12], [4, 10], [10, 6], [12, 13], [-13, 3]];
  for (const [fx, fz] of fosses) {
    const y = hauteurSol(cx + fx, cz + fz);
    A.ajouter('fosse', new THREE.CircleGeometry(1.1 + alea() * 0.5, 14), cx + fx, y + 0.03, cz + fz, 0, -Math.PI / 2);
    amphores(A, null, cx + fx, cz + fz, 3 + Math.floor(alea() * 4), alea, { rayon: 0.9, couchees: 0.6, y: y - 0.25 });
  }
  // grand dépôt d'amphores près de la galerie sud
  amphores(A, C, cx - 2, cz + 17.5, 22, alea, { rayon: 2.2, couchees: 0.5 });
  amphores(A, C, cx + 15, cz + 17, 12, alea, { rayon: 1.5, couchees: 0.4 });
  // trophée : poteau orné de crânes et d'un bouclier
  const yt = hauteurSol(cx - 14, cz - 12);
  poteau(A, C, cx - 14, cz - 12, 4.2, 0.18, 'poutre');
  for (let k = 0; k < 3; k++) for (const g2 of buc) A.ajouter('os', g2, cx - 14 + Math.sin(k * 2.1) * 0.25, yt + 2.6 + k * 0.55, cz - 12 + Math.cos(k * 2.1) * 0.25, k * 2.1);
  A.ajouter('bronze', new THREE.CylinderGeometry(0.45, 0.45, 0.05, 14), cx - 14, yt + 1.8, cz - 11.78, 0, Math.PI / 2);

  return { porte: new THREE.Vector3(cx + h + 1.2, yP, cz) };
}

/** Édifice à gradins de bois (lieu d'assemblée), ouvert vers le nord. */
export function theatre(A, C) {
  const { x: cx, z: cz } = THEATRE;
  const y0 = hauteurSol(cx, cz);
  const rangs = 9, r0 = 8.5, pas = 1.35, haut = 0.45;
  for (let k = 0; k < rangs; k++) {
    const r = r0 + k * pas + pas / 2;
    const n = Math.max(10, Math.round((Math.PI * r) / 1.7));
    const hTop = (k + 1) * haut;
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI;              // de l'est (0) à l'ouest (π), côté sud
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const rot = -a + Math.PI / 2;                      // la face avant regarde le centre
      const longueur = (Math.PI * r) / n + 0.05;
      A.ajouter('planches', boite(longueur, hTop + 0.6, pas, 1.2), x, y0 + hTop / 2 - 0.3, z, rot);
      C.rectangle(x, z, longueur / 2, pas / 2, rot, y0 + hTop);
    }
  }
  // mur de fond et galerie couverte au sommet
  const rFond = r0 + rangs * pas + 0.4;
  const nFond = 26;
  for (let i = 0; i < nFond; i++) {
    const a0 = (i / nFond) * Math.PI, a1 = ((i + 1) / nFond) * Math.PI;
    const x1 = cx + Math.cos(a0) * rFond, z1 = cz + Math.sin(a0) * rFond;
    const x2 = cx + Math.cos(a1) * rFond, z2 = cz + Math.sin(a1) * rFond;
    const l = Math.hypot(x2 - x1, z2 - z1), rot = -Math.atan2(z2 - z1, x2 - x1);
    const hMur = rangs * haut + 2.8;
    A.ajouter('planchesFonce', boite(l + 0.05, hMur, 0.3, 1.6), (x1 + x2) / 2, y0 + hMur / 2 - 0.2, (z1 + z2) / 2, rot);
    C.segment(x1, z1, x2, z2, 0.5);
    const am = (a0 + a1) / 2;
    const rp = rFond - 2.2;
    poteau(A, null, cx + Math.cos(am) * rp, cz + Math.sin(am) * rp, 2.6, 0.1, 'poutre', y0 + rangs * haut);
    A.ajouter('bardeaux', appentis(l + 0.25, 2.8, 3.1, 2.4), cx + Math.cos(am) * (rFond - 1.2), y0 + rangs * haut, cz + Math.sin(am) * (rFond - 1.2), rot);
  }
  // murs d'extrémité
  for (const s of [1, -1]) {
    const x = cx + s * (r0 + (rangs * pas) / 2);
    const hMur = rangs * haut + 0.4;
    A.ajouter('planchesFonce', boite(rangs * pas + 0.8, hMur, 0.3, 1.6), x, y0 + hMur / 2 - 0.2, cz - 0.2);
    C.rectangle(x, cz - 0.2, (rangs * pas) / 2 + 0.4, 0.25);
  }
  // tribune des orateurs, face aux gradins
  A.ajouter('planches', boite(5, 0.5, 2.6, 1.2), cx, y0 + 0.25, cz - 4.5);
  C.rectangle(cx, cz - 4.5, 2.5, 1.3, 0, y0 + 0.5);
  for (const s of [-1, 1]) poteau(A, C, cx + s * 2.3, cz - 5.6, 2.6, 0.1, 'rouge', y0 + 0.5);
  A.ajouter('tissuRouge', appentis(5.2, 2.8, 3.4, 3.0), cx, y0 + 0.2, cz - 4.5);
}

/** Place publique enclose de murs enduits, avec étals et portique. */
export function place(A, C) {
  const alea = aleatoire(99);
  const { x: cx, z: cz, lx, lz } = PLACE;
  const hMur = 3.2, ep = 0.5;
  const mur = (x1, z1, x2, z2) => {
    const l = Math.hypot(x2 - x1, z2 - z1), rot = -Math.atan2(z2 - z1, x2 - x1);
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, y = hauteurSol(mx, mz);
    A.ajouter('enduitBandes', boite(l, hMur + 0.4, ep, hMur + 0.4), mx, y + hMur / 2 - 0.2, mz, rot);
    A.ajouter('poutre', boite(l + 0.1, 0.12, ep + 0.2), mx, y + hMur + 0.04, mz, rot);
    C.segment(x1, z1, x2, z2, ep + 0.1);
  };
  const X = lx / 2, Z = lz / 2;
  mur(cx - X, cz - Z, cx + X, cz - Z);
  mur(cx - X, cz + Z, cx + X, cz + Z);
  mur(cx + X, cz - Z, cx + X, cz - 2.5);
  mur(cx + X, cz + 2.5, cx + X, cz + Z);
  mur(cx - X, cz - Z, cx - X, cz - 3);
  mur(cx - X, cz + 3, cx - X, cz + Z);

  // porte monumentale côté ouest (face au sanctuaire), à étage
  const porte = (px, largeur, profondeur, hauteur) => {
    const y = hauteurSol(px, cz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      A.ajouter('rouge', boite(0.38, hauteur + 0.4, 0.38), px + sx * profondeur / 2, y + hauteur / 2 - 0.2, cz + sz * largeur / 2);
      C.cercle(px + sx * profondeur / 2, cz + sz * largeur / 2, 0.3);
    }
    A.ajouter('rouge', boite(profondeur + 0.5, 0.35, largeur + 0.5), px, y + hauteur - 1.6, cz);
    A.ajouter('planches', boite(profondeur + 0.2, 1.4, largeur + 0.2, 1.4), px, y + hauteur - 0.75, cz);
    A.ajouter('bardeaux', toit(profondeur + 0.2, largeur + 0.2, 1.5, { debord: 0.5, croupe: false }), px, y + hauteur - 0.05, cz);
    // battants ouverts
    for (const sz of [-1, 1]) A.ajouter('planches', boite(0.08, hauteur - 2, largeur / 2 - 0.1), px - profondeur / 2 + 0.2 - largeur / 4, y + (hauteur - 2) / 2, cz + sz * (largeur / 2 + 0.02), sz * 1.35);
  };
  porte(cx - X, 6, 2.6, 5.4);
  porte(cx + X, 5, 2, 4.4);

  // portique au nord, abritant des boutiques
  const prof = 4;
  for (let i = 0; i <= 10; i++) poteau(A, C, cx - X + 2 + i * (lx - 4) / 10, cz - Z + prof, 2.6, 0.12, 'rouge');
  A.ajouter('bardeaux', appentis(lx, prof + 0.6, 3.5, 2.6), cx, hauteurSol(cx, cz - Z) - 0.05, cz - Z + prof / 2 + 0.25);
  for (let i = 0; i < 5; i++) {
    const bx = cx - X + 4 + i * (lx - 8) / 4;
    A.ajouter('planches', boite(3, 0.9, 1, 1), bx, hauteurSol(bx, cz - Z + 2.5) + 0.45, cz - Z + 2.6);
    C.rectangle(bx, cz - Z + 2.6, 1.5, 0.5);
    amphores(A, null, bx + 0.6, cz - Z + 1.3, 4, alea, { rayon: 0.5, couchees: 0.1 });
  }

  // étals sous auvent de toile
  const toiles = ['tissuRouge', 'tissuJaune', 'tissuBleu'];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
    const ex = cx - X + 8 + i * 8, ez = cz + 4 + r * 8;
    const y = hauteurSol(ex, ez);
    A.ajouter('planches', boite(2.6, 0.12, 1.2), ex, y + 0.85, ez);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) A.ajouter('poutre', boite(0.08, 2.3, 0.08), ex + sx * 1.3, y + 1.1, ez + sz * 0.9);
    A.ajouter(toiles[(i + r) % 3], appentis(3, 2.2, 2.35, 2.05), ex, y, ez);
    C.rectangle(ex, ez, 1.35, 0.7);
    // marchandises : jarres, lingots, tissus
    if ((i + r) % 2) amphores(A, null, ex, ez, 2, alea, { rayon: 0.4, couchees: 1, y: y + 0.95 });
    else for (let k = 0; k < 5; k++) A.ajouter('terreCuite', new THREE.CylinderGeometry(0.12, 0.09, 0.22, 8), ex - 1 + k * 0.5, y + 1.02, ez);
  }
  puits(A, C, cx + 12, cz + Z - 7);
  amphores(A, C, cx + X - 3, cz + Z - 3, 16, alea, { rayon: 1.6, couchees: 0.35 });
  tasDeBois(A, C, cx + X - 2, cz - Z + 7, Math.PI / 2);
  return { porteOuest: new THREE.Vector3(cx - X, hauteurSol(cx - X, cz), cz) };
}

/** Rempart à poutres internes (murus gallicus) sur le bord ouest, avec porte. */
export function rempart(A, C) {
  const porte = positionPorte();
  const pts = traceRempart();
  const hMur = 4.6, ep = 2.4;
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) segments.push([pts[i], pts[i + 1]]);
  // repérage des segments qui traversent l'emplacement de la porte
  const pres = (s) => Math.min(
    Math.hypot(s[0][0] - porte.x, s[0][1] - porte.z),
    Math.hypot(s[1][0] - porte.x, s[1][1] - porte.z),
    Math.hypot((s[0][0] + s[1][0]) / 2 - porte.x, (s[0][1] + s[1][1]) / 2 - porte.z)) < 9;
  const gardes = segments.filter(s => !pres(s));
  const sautes = segments.filter(pres);

  const tronçon = (x1, z1, x2, z2) => {
    const l = Math.hypot(x2 - x1, z2 - z1);
    if (l < 0.5) return;
    const rot = -Math.atan2(z2 - z1, x2 - x1);
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    const y = Math.min(hauteurSol(x1, z1), hauteurSol(x2, z2), hauteurSol(mx, mz));
    A.ajouter('murus', boite(l + 0.3, hMur + 1.5, ep, hMur + 1.5), mx, y + hMur / 2 - 0.75, mz, rot);
    // le talus et le parapet se placent du côté intérieur (vers le centre du plateau)
    const nx = Math.sin(rot), nz = Math.cos(rot);
    const vers = (nx * -mx + nz * -mz) > 0 ? 1 : -1;
    const ix = mx + nx * vers * ep / 2, iz = mz + nz * vers * ep / 2;
    A.ajouter('argile', talus(l + 0.3, hMur - 0.2, 6), ix, y, iz, rot + (vers > 0 ? 0 : Math.PI));
    const ox = mx - nx * vers * (ep / 2 - 0.15), oz = mz - nz * vers * (ep / 2 - 0.15);
    A.ajouter('planches', boite(l + 0.3, 1.3, 0.16, 1.3), ox, y + hMur + 0.6, oz, rot);
    C.segment(x1, z1, x2, z2, ep + 0.4);
    C.segment(x1 + nx * vers * 3.5, z1 + nz * vers * 3.5, x2 + nx * vers * 3.5, z2 + nz * vers * 3.5, 5);
  };
  for (const [[x1, z1], [x2, z2]] of gardes) tronçon(x1, z1, x2, z2);

  // ailes qui relient le rempart aux tours de la porte
  const largeur = 7;
  if (sautes.length) {
    const sud = sautes[0][0];                    // le tracé va du sud vers le nord
    const nord = sautes[sautes.length - 1][1];
    tronçon(sud[0], sud[1], porte.x, porte.z + largeur / 2 + 0.6);
    tronçon(porte.x, porte.z - largeur / 2 - 0.6, nord[0], nord[1]);
  }

  // porte : passage couvert entre deux tours de bois
  const y = hauteurSol(porte.x, porte.z);
  const prof = 7;
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const px = porte.x + sx * prof / 2, pz = porte.z + sz * largeur / 2;
      A.ajouter('rouge', boite(0.5, 9, 0.5), px, y + 4.1, pz);
      C.cercle(px, pz, 0.4);
    }
    A.ajouter('planches', boite(prof, 3, 0.2, 1.5), porte.x, y + 6.6, porte.z + sz * largeur / 2);
    C.segment(porte.x - prof / 2, porte.z + sz * largeur / 2, porte.x + prof / 2, porte.z + sz * largeur / 2, 0.4);
  }
  A.ajouter('rouge', boite(prof + 0.8, 0.4, largeur + 0.8), porte.x, y + 5.0, porte.z);
  A.ajouter('planches', boite(prof + 0.2, 0.18, largeur + 0.4), porte.x, y + 5.3, porte.z);
  A.ajouter('bardeaux', toit(prof + 0.2, largeur + 0.2, 2.2, { debord: 0.6, croupe: true }), porte.x, y + 8.4, porte.z);
  // vantaux ouverts contre les parois
  for (const sz of [-1, 1]) A.ajouter('planchesFonce', boite(3.2, 3.8, 0.12, 1.5), porte.x - prof / 2 + 1.7, y + 1.9, porte.z + sz * (largeur / 2 - 0.3));
  const buc = gabaritBucrane();
  for (const g of buc) A.ajouter('os', g, porte.x - prof / 2 - 0.4, y + 4.4, porte.z, -Math.PI / 2);
  return { porte: new THREE.Vector3(porte.x, y, porte.z) };
}
