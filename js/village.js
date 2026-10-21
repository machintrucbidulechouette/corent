// village.js — assemble toute la ville et renvoie les maillages, les obstacles et les repères utiles.
import * as THREE from 'three';
import { Assembleur } from './geometrie.js';
import { Collisions } from './collisions.js';
import { genererLots, positionPorte } from './plan.js';
import { maison, grenier, forge, fourPotier, enclos } from './batiments.js';
import { sanctuaire, theatre, place, rempart } from './monuments.js';
import { hauteurSol, distPlateau } from './relief.js';

export function creerVillage(materiaux) {
  const A = new Assembleur();
  const C = new Collisions();
  const foyers = [];          // sources de fumée et de lueur
  const enclosListe = [];     // enclos à bétail (pour les animaux)
  const forges = [];          // positions des enclumes (pour les forgerons)
  const reperes = {};         // positions utilisées par les points d'intérêt

  reperes.sanctuaire = sanctuaire(A, C);
  theatre(A, C);
  reperes.place = place(A, C);
  reperes.rempart = rempart(A, C);

  const lots = genererLots();
  let premiereForge = null, premierFour = null, maisonRepere = null, grenierRepere = null;
  for (const lot of lots) {
    switch (lot.type) {
      case 'grenier':
        grenier(A, C, lot);
        if (!grenierRepere || Math.hypot(lot.x, lot.z) < Math.hypot(grenierRepere.x, grenierRepere.z)) grenierRepere = lot;
        break;
      case 'atelier': {
        const f = forge(A, C, lot);
        foyers.push({ pos: f, type: 'forge' });
        forges.push({ enclume: f.enclume, rot: f.rot, foyer: f });
        if (!premiereForge) premiereForge = lot;
        break;
      }
      case 'four': {
        const f = fourPotier(A, C, lot);
        foyers.push({ pos: f, type: 'four' });
        if (!premierFour) premierFour = lot;
        break;
      }
      case 'enclos':
        enclosListe.push(enclos(A, C, lot));
        break;
      default: {
        maison(A, C, lot);
        // la maison de référence : la plus proche du carrefour au nord-ouest du sanctuaire
        const d = Math.hypot(lot.x + 30, lot.z + 52);
        if (!maisonRepere || d < Math.hypot(maisonRepere.x + 30, maisonRepere.z + 52)) maisonRepere = lot;
        if (lot.graine % 12 === 0) foyers.push({ pos: new THREE.Vector3(lot.x, hauteurSol(lot.x, lot.z) + 4.5, lot.z), type: 'toit' });
      }
    }
  }
  reperes.maison = maisonRepere;
  reperes.forge = premiereForge;
  reperes.four = premierFour;
  reperes.grenier = grenierRepere;

  const groupe = A.construire(materiaux);

  // point de départ : juste derrière la porte, face à l'est
  const p = positionPorte();
  const depart = new THREE.Vector3(p.x + 16, 0, p.z);
  depart.y = hauteurSol(depart.x, depart.z);

  // garde-fou : on ne peut pas sortir du plateau
  const limite = (x, z) => distPlateau(x, z) > -3;

  return { groupe, collisions: C, foyers, reperes, depart, limite, lots, enclos: enclosListe, forges };
}
