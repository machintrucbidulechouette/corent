// textures.js : textures peintes en canvas, avec cartes de relief (normales) et de rugosité
// dérivées automatiquement. Aucun fichier image externe.
import * as THREE from 'three';
import { aleatoire, fbm } from './bruit.js';

function toile(taille) {
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  return { c, g: c.getContext('2d', { willReadFrequently: true }) };
}

let ANISO = 8;

function versTexture(c, couleur = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = couleur ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISO;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

/** Bruit périodique (la texture se répète sans couture). */
function periodique(u, v, s, oct = 3) {
  const a = Math.PI * 2;
  return fbm(Math.cos(a * u) * s * 0.3 + Math.sin(a * v) * 0.7, Math.sin(a * u) * s * 0.3 + Math.cos(a * v) * s * 0.3, oct);
}

function grainer(g, taille, force, echelle = 8) {
  const img = g.getImageData(0, 0, taille, taille);
  const d = img.data;
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const n = periodique(x / taille, y / taille, echelle) * force + (Math.random() - 0.5) * force * 0.35;
      const i = (y * taille + x) * 4;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  g.putImageData(img, 0, 0);
}

/**
 * Dérive une carte de normales et une carte de rugosité à partir de la luminance d'un canvas.
 * Les creux (joints, fentes, interstices) sont sombres, donc plus bas et plus rugueux.
 */
function derives(c, { relief = 2.5, rugBase = 0.82, rugVar = 0.18, flou = 1, inverser = false } = {}) {
  const T = c.width;
  const src = c.getContext('2d').getImageData(0, 0, T, T).data;
  let h = new Float32Array(T * T);
  for (let i = 0; i < T * T; i++) {
    const l = (0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]) / 255;
    h[i] = inverser ? 1 - l : l;
  }
  // léger flou pour adoucir le relief
  for (let p = 0; p < flou; p++) {
    const o = new Float32Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        s += h[((y + dy + T) % T) * T + ((x + dx + T) % T)];
      }
      o[y * T + x] = s / 9;
    }
    h = o;
  }
  const nc = toile(T), rc = toile(T);
  const ni = nc.g.createImageData(T, T), ri = rc.g.createImageData(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x;
    const dx = (h[y * T + ((x + 1) % T)] - h[y * T + ((x - 1 + T) % T)]) * relief;
    // v augmente vers le haut du canvas (la texture est retournée au chargement)
    const dy = (h[((y - 1 + T) % T) * T + x] - h[((y + 1) % T) * T + x]) * relief;
    const l = Math.hypot(dx, dy, 1);
    ni.data[i * 4] = (-dx / l * 0.5 + 0.5) * 255;
    ni.data[i * 4 + 1] = (-dy / l * 0.5 + 0.5) * 255;
    ni.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255;
    ni.data[i * 4 + 3] = 255;
    const r = Math.max(0, Math.min(1, rugBase + (0.5 - h[i]) * rugVar * 2)) * 255;
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = r;
    ri.data[i * 4 + 3] = 255;
  }
  nc.g.putImageData(ni, 0, 0);
  rc.g.putImageData(ri, 0, 0);
  return { normalMap: versTexture(nc.c, false), roughnessMap: versTexture(rc.c, false) };
}

function ensemble(c, options) {
  return { map: versTexture(c, true), ...derives(c, options) };
}

// ---------------- matériaux de construction ----------------

function torchis(base, graine) {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  grainer(g, T, 30, 6);
  const alea = aleatoire(graine);
  // traces de lissage à la main
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = 0.07 + alea() * 0.06;
    g.fillStyle = alea() < 0.5 ? '#4e3c2a' : '#fffaf0';
    g.beginPath();
    g.ellipse(alea() * T, alea() * T, 8 + alea() * 34, 3 + alea() * 12, alea() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // fissures de retrait
  g.globalAlpha = 0.45; g.strokeStyle = '#2e2218'; g.lineWidth = 1.1;
  for (let i = 0; i < 14; i++) {
    let x = alea() * T, y = alea() * T;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (alea() - 0.5) * 26; y += alea() * 14; g.lineTo(x, y); }
    g.stroke();
  }
  // brins de paille pris dans l'enduit
  g.globalAlpha = 0.35; g.strokeStyle = '#a88a52'; g.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    const x = alea() * T, y = alea() * T, a = alea() * Math.PI, l = 4 + alea() * 10;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
  return ensemble(c, { relief: 3, rugBase: 0.88, rugVar: 0.2 });
}

function enduitBandes() {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#d4a85a'; g.fillRect(0, 0, T, T);
  const bandes = [[0.0, 0.05, '#8f3a26'], [0.2, 0.215, '#a5583a'], [0.36, 0.375, '#a5583a'],
    [0.52, 0.535, '#a5583a'], [0.68, 0.695, '#a5583a'], [0.8, 1.0, '#8c3524']];
  for (const [a, b, col] of bandes) { g.fillStyle = col; g.fillRect(0, a * T, T, (b - a) * T); }
  g.globalAlpha = 0.25; g.fillStyle = '#7b5a33';
  for (let y = 0.24; y < 0.8; y += 0.08) g.fillRect(0, y * T, T, 1.5);
  g.globalAlpha = 1;
  grainer(g, T, 22, 7);
  // salissures de pied de mur (éclaboussures de boue)
  const grad = g.createLinearGradient(0, T * 0.82, 0, T);
  grad.addColorStop(0, 'rgba(60,40,25,0)'); grad.addColorStop(1, 'rgba(60,40,25,0.55)');
  g.fillStyle = grad; g.fillRect(0, T * 0.82, T, T * 0.18);
  return ensemble(c, { relief: 1.6, rugBase: 0.86, rugVar: 0.1 });
}

function bardeaux() {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#211d1a'; g.fillRect(0, 0, T, T);
  const alea = aleatoire(31);
  const rangs = 8, lb = T / 10, h = T / rangs;
  for (let r = 0; r < rangs; r++) {
    const decal = (r % 2) * lb / 2;
    for (let x = -lb; x < T + lb; x += lb) {
      const ton = 82 + alea() * 50;
      const w = lb - 3 - alea() * 4;
      // dégradé : le bas du bardeau, exposé, est plus clair et plus épais
      const gr = g.createLinearGradient(0, r * h, 0, r * h + h);
      gr.addColorStop(0, `rgb(${ton * 0.7},${ton * 0.66},${ton * 0.62})`);
      gr.addColorStop(0.85, `rgb(${ton * 1.05},${ton * 0.98},${ton * 0.9})`);
      gr.addColorStop(1, `rgb(${ton * 0.55},${ton * 0.5},${ton * 0.46})`);
      g.fillStyle = gr;
      g.fillRect(x + decal + 1, r * h + 1, w, h - 2);
      g.strokeStyle = 'rgba(30,24,20,0.3)'; g.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const vx = x + decal + 3 + alea() * (w - 6);
        g.beginPath(); g.moveTo(vx, r * h + 3); g.lineTo(vx + (alea() - 0.5) * 3, r * h + h - 4); g.stroke();
      }
      // lichen
      if (alea() < 0.15) {
        g.fillStyle = `rgba(${120 + alea() * 40},${130 + alea() * 30},90,0.35)`;
        g.beginPath(); g.arc(x + decal + alea() * w, r * h + alea() * h, 3 + alea() * 6, 0, Math.PI * 2); g.fill();
      }
    }
  }
  grainer(g, T, 14, 9);
  return ensemble(c, { relief: 4, rugBase: 0.9, rugVar: 0.12 });
}

function chaume() {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#5a4526'; g.fillRect(0, 0, T, T);
  const alea = aleatoire(77);
  for (let i = 0; i < 14000; i++) {
    const x = alea() * T, y = alea() * T;
    const l = 12 + alea() * 30;
    const ton = 80 + alea() * 100;
    g.strokeStyle = `rgba(${ton + 35},${ton + 10},${ton * 0.42},0.6)`;
    g.lineWidth = 0.7 + alea() * 1.1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (alea() - 0.5) * 3, y + l); g.stroke();
    if (y + l > T) { g.beginPath(); g.moveTo(x, y - T); g.lineTo(x, y - T + l); g.stroke(); }
  }
  g.fillStyle = 'rgba(30,20,8,0.3)';
  for (let y = 0; y < T; y += T / 6) g.fillRect(0, y, T, 6);
  // mousse et usure
  g.globalAlpha = 0.18;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = alea() < 0.5 ? '#4f5a30' : '#2c2416';
    g.beginPath(); g.ellipse(alea() * T, alea() * T, 10 + alea() * 30, 6 + alea() * 14, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  return ensemble(c, { relief: 3.5, rugBase: 0.95, rugVar: 0.08, flou: 0 });
}

function planches(base, largeur, graine) {
  const T = 512;
  const { c, g } = toile(T);
  const alea = aleatoire(graine);
  const lp = T / largeur;
  for (let i = 0; i < largeur; i++) {
    const k = 0.78 + alea() * 0.38;
    g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
    g.fillRect(i * lp, 0, lp, T);
    g.strokeStyle = 'rgba(30,22,16,0.32)';
    for (let v = 0; v < 12; v++) {
      const x = i * lp + 3 + alea() * (lp - 6);
      g.lineWidth = 0.6 + alea() * 1.2;
      g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + (alea() - 0.5) * 8, T / 3, x + (alea() - 0.5) * 8, T * 0.66, x, T);
      g.stroke();
    }
    // nœuds
    if (alea() < 0.6) {
      const nx = i * lp + lp / 2 + (alea() - 0.5) * lp * 0.4, ny = alea() * T;
      g.fillStyle = 'rgba(40,26,16,0.55)'; g.beginPath(); g.ellipse(nx, ny, 4, 7, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(14,10,8,0.7)'; g.fillRect(i * lp, 0, 3, T);
  }
  grainer(g, T, 14, 5);
  return ensemble(c, { relief: 3, rugBase: 0.8, rugVar: 0.18 });
}

function murus() {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#2e2a26'; g.fillRect(0, 0, T, T);
  const alea = aleatoire(5);
  const h = T / 14;
  for (let r = 0; r < 14; r++) {
    let x = -alea() * 30;
    while (x < T) {
      const w = 18 + alea() * 34;
      const ton = 92 + alea() * 55;
      const gr = g.createRadialGradient(x + w / 2, r * h + h / 2, 2, x + w / 2, r * h + h / 2, w / 1.4);
      gr.addColorStop(0, `rgb(${ton * 1.08},${ton * 1.03},${ton * 0.96})`);
      gr.addColorStop(1, `rgb(${ton * 0.72},${ton * 0.68},${ton * 0.64})`);
      g.fillStyle = gr;
      g.beginPath(); g.roundRect(x + 1.5, r * h + 1.5, w - 3, h - 3, 5); g.fill();
      x += w;
    }
  }
  for (let r = 1; r < 14; r += 4) {
    for (let x = 20; x < T; x += T / 4) {
      g.fillStyle = '#4a3626'; g.fillRect(x, r * h + 2, h * 0.95, h * 0.95);
      g.strokeStyle = 'rgba(20,12,6,0.7)'; g.lineWidth = 2;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x + h * 0.47, r * h + 2 + h * 0.47, k * 4, 0, Math.PI * 2); g.stroke(); }
    }
  }
  grainer(g, T, 18, 8);
  return ensemble(c, { relief: 5, rugBase: 0.92, rugVar: 0.1 });
}

// ---------------- sol (détails en niveaux de gris, multipliés par la couleur du terrain) ----------------

function detailHerbe() {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, T, T);
  grainer(g, T, 30, 10);
  const alea = aleatoire(12);
  for (let i = 0; i < 16000; i++) {
    const x = alea() * T, y = alea() * T, l = 4 + alea() * 10, a = -Math.PI / 2 + (alea() - 0.5) * 1.2;
    const v = 70 + alea() * 120;
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    g.lineWidth = 0.8 + alea();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return ensemble(c, { relief: 2.2, rugBase: 0.92, rugVar: 0.1 });
}

function detailTerre() {
  const T = 512;
  const { c, g } = toile(T);
  g.fillStyle = '#868686'; g.fillRect(0, 0, T, T);
  grainer(g, T, 34, 12);
  const alea = aleatoire(21);
  // cailloux et gravier
  for (let i = 0; i < 2200; i++) {
    const x = alea() * T, y = alea() * T, r = 1 + Math.pow(alea(), 3) * 9;
    const v = 90 + alea() * 120;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    gr.addColorStop(0, `rgb(${v + 30},${v + 30},${v + 30})`);
    gr.addColorStop(1, `rgb(${v * 0.55},${v * 0.55},${v * 0.55})`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + alea() * 0.4), alea() * 3, 0, Math.PI * 2); g.fill();
  }
  // ornières et traces
  g.globalAlpha = 0.15; g.fillStyle = '#303030';
  for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(alea() * T, alea() * T, 20 + alea() * 50, 4 + alea() * 8, alea() * 3, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  return ensemble(c, { relief: 4, rugBase: 0.95, rugVar: 0.08 });
}

function detailRoche() {
  const T = 512;
  const { c, g } = toile(T);
  const img = g.createImageData(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const u = x / T, v = y / T;
    // basalte : bruit marbré et diaclases
    const n = periodique(u, v, 9, 4) * 0.5 + periodique(u + 0.3, v, 30, 3) * 0.25;
    const fissure = Math.abs(periodique(u * 0.7, v * 1.4 + 0.2, 6, 3));
    let l = 0.55 + n * 0.5 - (fissure < 0.04 ? 0.35 : 0);
    l = Math.max(0, Math.min(1, l)) * 255;
    const i = (y * T + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = l; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return ensemble(c, { relief: 6, rugBase: 0.9, rugVar: 0.1 });
}

// ---------------- végétation ----------------

/** Planche de feuilles détourées (chêne et hêtre), avec transparence. */
function feuilles() {
  const T = 512;
  const { c, g } = toile(T);
  g.clearRect(0, 0, T, T);
  const alea = aleatoire(88);
  for (let i = 0; i < 240; i++) {
    const x = 20 + alea() * (T - 40), y = 20 + alea() * (T - 40);
    const a = alea() * Math.PI * 2, L = 18 + alea() * 22, W = L * (0.38 + alea() * 0.12);
    const v = alea();
    const r = 40 + v * 50, gg = 70 + v * 60, b = 25 + v * 25;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.beginPath();
    // contour lobé
    g.moveTo(0, -L / 2);
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, yy = -L / 2 + t * L;
      const lobe = 1 + 0.18 * Math.sin(t * Math.PI * 6);
      g.lineTo(W / 2 * Math.sin(t * Math.PI) * lobe, yy);
    }
    for (let k = 10; k >= 0; k--) {
      const t = k / 10, yy = -L / 2 + t * L;
      const lobe = 1 + 0.18 * Math.sin(t * Math.PI * 6);
      g.lineTo(-W / 2 * Math.sin(t * Math.PI) * lobe, yy);
    }
    g.fill();
    g.strokeStyle = `rgba(${r * 0.6},${gg * 0.6},${b * 0.6},0.8)`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -L / 2); g.lineTo(0, L / 2 + 4); g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

/** Étoffe à carreaux (sagum, tuniques). */
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
  return versTexture(c, true);
}

function fumee() {
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
  ANISO = renderer.capabilities.getMaxAnisotropy();
  const sol = (e) => { e.map.colorSpace = THREE.NoColorSpace; return e; };   // détails en valeurs linéaires
  return {
    herbe: sol(detailHerbe()),
    terre: sol(detailTerre()),
    roche: sol(detailRoche()),
    torchisBlanc: torchis('#d9cdb5', 7),
    torchisOcre: torchis('#c99d5b', 8),
    torchisRose: torchis('#c98d6c', 9),
    enduitBandes: enduitBandes(),
    bardeaux: bardeaux(),
    chaume: chaume(),
    planches: planches([112, 96, 78], 6, 112),
    planchesSombres: planches([78, 66, 56], 5, 78),
    planchesRouges: planches([128, 52, 38], 4, 128),
    murus: murus(),
    feuilles: feuilles(),
    fumee: fumee(),
  };
}
