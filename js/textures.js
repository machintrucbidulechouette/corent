// textures.js — textures peintes en canvas (aucun fichier image externe).
import * as THREE from 'three';
import { aleatoire, bruit2, fbm } from './bruit.js';

function toile(taille) {
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  return { c, g: c.getContext('2d') };
}

function versTexture(c, renderer, couleur = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (couleur) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Applique un bruit pixel par pixel (périodique pour que la texture se répète sans couture). */
function grainer(g, taille, force, echelle = 8) {
  const img = g.getImageData(0, 0, taille, taille);
  const d = img.data;
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const u = x / taille, v = y / taille;
      // bruit périodique : somme pondérée sur le tore
      const n = periodique(u, v, echelle) * force + (Math.random() - 0.5) * force * 0.35;
      const i = (y * taille + x) * 4;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  g.putImageData(img, 0, 0);
}

function periodique(u, v, s) {
  const a = Math.PI * 2;
  return fbm(Math.cos(a * u) * s * 0.3 + Math.sin(a * v) * 0.7, Math.sin(a * u) * s * 0.3 + Math.cos(a * v) * s * 0.3, 3);
}

/** Torchis enduit à la chaux ou teinté d'ocre. */
function torchis(renderer, base, taille = 256) {
  const { c, g } = toile(taille);
  g.fillStyle = base; g.fillRect(0, 0, taille, taille);
  grainer(g, taille, 26, 6);
  const alea = aleatoire(7);
  g.globalAlpha = 0.12;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = alea() < 0.5 ? '#5a4632' : '#ffffff';
    g.beginPath();
    g.ellipse(alea() * taille, alea() * taille, 4 + alea() * 18, 2 + alea() * 8, alea() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 0.22; g.strokeStyle = '#3d2e20'; g.lineWidth = 0.8;
  for (let i = 0; i < 9; i++) {
    let x = alea() * taille, y = alea() * taille;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (alea() - 0.5) * 18; y += alea() * 10; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  return versTexture(c, renderer);
}

/** Mur de la place : enduit ocre à bandes rouges, comme sur les restitutions de Corent. */
function enduitBandes(renderer) {
  const T = 256;
  const { c, g } = toile(T);
  // haut de la texture = haut du mur (v = 1)
  g.fillStyle = '#d4a85a'; g.fillRect(0, 0, T, T);
  const bandes = [[0.0, 0.05, '#8f3a26'], [0.2, 0.215, '#a5583a'], [0.36, 0.375, '#a5583a'],
                  [0.52, 0.535, '#a5583a'], [0.68, 0.695, '#a5583a'], [0.8, 1.0, '#8c3524']];
  for (const [a, b, col] of bandes) { g.fillStyle = col; g.fillRect(0, a * T, T, (b - a) * T); }
  // fines assises horizontales
  g.globalAlpha = 0.25; g.fillStyle = '#7b5a33';
  for (let y = 0.24; y < 0.8; y += 0.08) g.fillRect(0, y * T, T, 1);
  g.globalAlpha = 1;
  grainer(g, T, 20, 7);
  return versTexture(c, renderer);
}

/** Bardeaux de bois en rangs décalés. */
function bardeaux(renderer) {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#3c3530'; g.fillRect(0, 0, T, T);
  const alea = aleatoire(31);
  const rangs = 8, lb = T / 10;
  const h = T / rangs;
  for (let r = 0; r < rangs; r++) {
    const decal = (r % 2) * lb / 2;
    for (let x = -lb; x < T + lb; x += lb) {
      const ton = 85 + alea() * 45;
      g.fillStyle = `rgb(${ton * 1.02},${ton * 0.95},${ton * 0.88})`;
      const w = lb - 3 - alea() * 3;
      g.fillRect(x + decal + 1, r * h + 2, w, h - 3);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(x + decal + 1, r * h + h - 7, w, 5);
      // veinage
      g.strokeStyle = 'rgba(40,30,25,0.25)'; g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const vx = x + decal + 4 + alea() * (w - 8);
        g.beginPath(); g.moveTo(vx, r * h + 4); g.lineTo(vx + (alea() - 0.5) * 4, r * h + h - 8); g.stroke();
      }
    }
  }
  grainer(g, T, 14, 9);
  return versTexture(c, renderer);
}

/** Chaume : tiges de paille serrées. */
function chaume(renderer) {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#7d6436'; g.fillRect(0, 0, T, T);
  const alea = aleatoire(77);
  for (let i = 0; i < 9000; i++) {
    const x = alea() * T, y = alea() * T;
    const l = 10 + alea() * 26;
    const ton = 90 + alea() * 90;
    g.strokeStyle = `rgba(${ton + 30},${ton + 8},${ton * 0.45},0.55)`;
    g.lineWidth = 0.8 + alea();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (alea() - 0.5) * 3, y + l); g.stroke();
    if (y + l > T) { g.beginPath(); g.moveTo(x, y - T); g.lineTo(x, y - T + l); g.stroke(); }
  }
  // rangs de pose
  g.fillStyle = 'rgba(40,28,10,0.25)';
  for (let y = 0; y < T; y += T / 6) g.fillRect(0, y, T, 5);
  return versTexture(c, renderer);
}

/** Planches verticales (palissades, portes). */
function planches(renderer, base = [110, 92, 72], largeur = 6) {
  const T = 256;
  const { c, g } = toile(T);
  const alea = aleatoire(base[0]);
  const lp = T / largeur;
  for (let i = 0; i < largeur; i++) {
    const k = 0.8 + alea() * 0.35;
    g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
    g.fillRect(i * lp, 0, lp, T);
    g.strokeStyle = 'rgba(30,22,16,0.3)';
    for (let v = 0; v < 7; v++) {
      const x = i * lp + 3 + alea() * (lp - 6);
      g.lineWidth = 0.6 + alea();
      g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + (alea() - 0.5) * 6, T / 3, x + (alea() - 0.5) * 6, T * 0.66, x, T);
      g.stroke();
    }
    g.fillStyle = 'rgba(20,14,10,0.55)'; g.fillRect(i * lp, 0, 2, T);
  }
  grainer(g, T, 12, 5);
  return versTexture(c, renderer);
}

/** Parement de pierres du rempart, avec têtes de poutres (murus gallicus). */
function murus(renderer) {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#4a4540'; g.fillRect(0, 0, T, T);
  const alea = aleatoire(5);
  const h = T / 14;
  for (let r = 0; r < 14; r++) {
    let x = -alea() * 30;
    while (x < T) {
      const w = 18 + alea() * 34;
      const ton = 95 + alea() * 50;
      g.fillStyle = `rgb(${ton},${ton * 0.96},${ton * 0.9})`;
      g.beginPath();
      g.roundRect(x + 1.5, r * h + 1.5, w - 3, h - 3, 4);
      g.fill();
      x += w;
    }
  }
  // têtes de poutres en quinconce
  for (let r = 1; r < 14; r += 4) {
    for (let x = (r % 8 === 1 ? 0 : 0.5) * (T / 4) + 20; x < T; x += T / 4) {
      g.fillStyle = '#5b4330'; g.fillRect(x, r * h + 2, h * 0.95, h * 0.95);
      g.strokeStyle = 'rgba(30,20,10,0.6)'; g.strokeRect(x + 3, r * h + 5, h * 0.95 - 6, h * 0.95 - 6);
    }
  }
  grainer(g, T, 18, 8);
  return versTexture(c, renderer);
}

/** Détail du sol (niveaux de gris, multiplié par la couleur des sommets du terrain). */
function detailSol(renderer) {
  const T = 512;
  const { c, g } = toile(T);
  const img = g.createImageData(T, T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const u = x / T, v = y / T;
      let n = 0.82 + periodique(u, v, 14) * 0.14 + periodique(u + 0.37, v + 0.11, 40) * 0.08;
      n += (Math.random() - 0.5) * 0.12;
      const val = Math.max(0, Math.min(255, n * 255));
      const i = (y * T + x) * 4;
      img.data[i] = val; img.data[i + 1] = val; img.data[i + 2] = val; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // petits cailloux
  const alea = aleatoire(9);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${alea() < 0.5 ? '255,255,255' : '40,40,40'},0.18)`;
    g.beginPath(); g.arc(alea() * T, alea() * T, 1 + alea() * 2.5, 0, Math.PI * 2); g.fill();
  }
  return versTexture(c, renderer, false);
}

/** Étoffe à carreaux (sagum, tuniques) ; les Gaulois portaient des tissus rayés et quadrillés. */
export function etoffe(renderer, fond, trait1, trait2) {
  const T = 128;
  const { c, g } = toile(T);
  g.fillStyle = fond; g.fillRect(0, 0, T, T);
  g.globalAlpha = 0.55;
  g.fillStyle = trait1;
  g.fillRect(0, T * 0.15, T, T * 0.1); g.fillRect(T * 0.15, 0, T * 0.1, T);
  g.fillStyle = trait2;
  g.fillRect(0, T * 0.6, T, T * 0.04); g.fillRect(T * 0.6, 0, T * 0.04, T);
  g.globalAlpha = 1;
  grainer(g, T, 16, 10);
  return versTexture(c, renderer);
}

/** Sprite doux pour la fumée. */
function fumee(renderer) {
  const T = 128;
  const { c, g } = toile(T);
  const grad = g.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, T, T);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function creerTextures(renderer) {
  return {
    torchisBlanc: torchis(renderer, '#d9cdb5'),
    torchisOcre: torchis(renderer, '#c99d5b'),
    torchisRose: torchis(renderer, '#c98d6c'),
    enduitBandes: enduitBandes(renderer),
    bardeaux: bardeaux(renderer),
    chaume: chaume(renderer),
    planches: planches(renderer, [112, 96, 78], 6),
    planchesSombres: planches(renderer, [78, 66, 56], 5),
    planchesRouges: planches(renderer, [128, 52, 38], 4),
    murus: murus(renderer),
    detailSol: detailSol(renderer),
    fumee: fumee(renderer),
  };
}

// petit utilitaire réexporté pour d'autres modules
export { bruit2 };
