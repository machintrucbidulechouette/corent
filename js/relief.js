// relief.js — forme du plateau de Corent et du paysage alentour.
// Repère : 1 unité = 1 mètre, x vers l'est, z vers le sud, y vers le haut.
// Le dessus du plateau est à y ≈ 0 ; la plaine de l'Allier est environ 170 m plus bas.
import { fbm, lisser } from './bruit.js';

export const DEMI_X = 245;   // demi-largeur est-ouest du plateau (m)
export const DEMI_Z = 185;   // demi-largeur nord-sud du plateau (m)
export const PLAINE = -170;  // altitude relative de la plaine

/**
 * Distance signée approximative au bord du plateau, en mètres.
 * Négative à l'intérieur, positive à l'extérieur.
 */
export function distPlateau(x, z) {
  const r = Math.hypot(x / DEMI_X, z / DEMI_Z);
  const a = Math.atan2(z, x);
  const irreg = fbm(Math.cos(a) * 1.7 + 11, Math.sin(a) * 1.7 - 4, 3) * 0.13
              + fbm(Math.cos(a) * 6 + 3, Math.sin(a) * 6 + 8, 2) * 0.03;
  return (r - (1 + irreg)) * 205;
}

/** Hauteur du sol au point (x, z). Fonction unique pour le relief proche et lointain. */
export function hauteurSol(x, z) {
  const d = distPlateau(x, z);
  // ondulations douces du sommet, aplanies au centre de la ville
  const centre = Math.hypot(x / 150, z / 115);
  let h = fbm(x * 0.008, z * 0.008, 3) * 2.2 * (0.25 + 0.75 * lisser(0.5, 1.3, centre))
        + fbm(x * 0.06, z * 0.06, 2) * 0.12;
  if (d > 0) {
    // corniche puis versant basaltique
    const t = d;
    const chute = 172 * (1 - Math.exp(-t / 32)) + 3 * lisser(0, 4, t) + fbm(x * 0.02, z * 0.02, 3) * 6 * lisser(0, 30, t);
    h -= chute;
  }
  if (d > 160) h = Math.max(h, hauteurLointain(x, z) * lisser(160, 260, d) + h * (1 - lisser(160, 260, d)));
  return h;
}

/** Relief de la plaine et des montagnes au loin (Gergovie au nord, chaîne des Puys à l'ouest). */
export function hauteurLointain(x, z) {
  let h = PLAINE + fbm(x * 0.0012, z * 0.0012, 4) * 28;
  // vallée de l'Allier, à l'est
  const riviere = Math.abs(x - 900 - Math.sin(z * 0.0016) * 260);
  h -= 14 * Math.exp(-(riviere * riviere) / (2 * 140 * 140));
  // plateau de Gergovie, au nord
  h += bosse(x, z, -700, -3200, 900, 520, 320, 6);
  // chaîne des Puys, au nord-ouest : une série de cônes
  const puys = [
    [-3600, -3800, 520, 640], [-3100, -4600, 560, 560], [-4200, -3000, 480, 520],
    [-2600, -5200, 600, 600], [-4700, -2100, 450, 480], [-3900, -5000, 820, 1060] // Puy de Dôme
  ];
  for (const [px, pz, r, hauteur] of puys) h += cone(x, z, px, pz, r, hauteur);
  // monts du Livradois, à l'est, en arrière-plan
  h += bosse(x, z, 4200, 600, 1600, 2600, 260, 3);
  return h;
}

function cone(x, z, cx, cz, r, h) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1.8 ? 0 : h * Math.pow(Math.max(0, 1 - d / 1.8), 1.6);
}

function bosse(x, z, cx, cz, rx, rz, h, plat) {
  const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
  return h * (1 - lisser(0.55, 1, d)) * (plat > 0 ? 1 : 1);
}
