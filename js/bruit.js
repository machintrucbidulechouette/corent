// bruit.js : générateur pseudo-aléatoire et bruit 2D déterministes.
// Tout le village est généré à partir d'une graine : il est identique à chaque visite.

export function aleatoire(graine = 1) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hachage(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const lisse = (t) => t * t * (3 - 2 * t);

/** Bruit de valeur 2D, résultat dans [-1, 1]. */
export function bruit2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = lisse(xf), v = lisse(yf);
  const a = hachage(xi, yi), b = hachage(xi + 1, yi);
  const c = hachage(xi, yi + 1), d = hachage(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

/** Bruit fractal (somme d'octaves), résultat environ dans [-1, 1]. */
export function fbm(x, y, octaves = 4) {
  let somme = 0, amp = 0.5, freq = 1, norme = 0;
  for (let i = 0; i < octaves; i++) {
    somme += amp * bruit2(x * freq + i * 17.3, y * freq - i * 9.1);
    norme += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return somme / norme;
}

export const lisser = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const melanger = (a, b, t) => a + (b - a) * t;
export const borner = (x, a, b) => Math.min(b, Math.max(a, x));
