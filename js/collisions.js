// collisions.js — obstacles en 2D (vue de dessus) rangés dans une grille spatiale.
// Le joueur est un cercle ; les bâtiments sont des rectangles orientés, les poteaux des cercles.

const CELLULE = 10;

export class Collisions {
  constructor() {
    this.grille = new Map();
    this.tous = [];
  }

  _cle(i, j) { return i * 100003 + j; }

  _inserer(o, rayonEnglobant) {
    this.tous.push(o);
    const i0 = Math.floor((o.x - rayonEnglobant) / CELLULE), i1 = Math.floor((o.x + rayonEnglobant) / CELLULE);
    const j0 = Math.floor((o.z - rayonEnglobant) / CELLULE), j1 = Math.floor((o.z + rayonEnglobant) / CELLULE);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._cle(i, j);
      if (!this.grille.has(k)) this.grille.set(k, []);
      this.grille.get(k).push(o);
    }
  }

  /** Rectangle orienté : centre (x, z), demi-tailles (hx, hz), rotation autour de y. */
  rectangle(x, z, hx, hz, rot = 0, haut = null) {
    this._inserer({ type: 'r', x, z, hx, hz, c: Math.cos(rot), s: Math.sin(rot), haut }, Math.hypot(hx, hz));
  }

  /**
   * Hauteur du dessus le plus haut sur lequel on peut se tenir en (x, z),
   * parmi les obstacles « praticables » (gradins, estrades) qu'on peut gravir depuis `piedY`.
   */
  dessus(x, z, piedY, marche = 0.55) {
    const liste = this.grille.get(this._cle(Math.floor(x / CELLULE), Math.floor(z / CELLULE)));
    let h = -Infinity;
    if (!liste) return h;
    for (const o of liste) {
      if (o.type !== 'r' || o.haut === null || o.haut > piedY + marche) continue;
      const dx = x - o.x, dz = z - o.z;
      const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) <= o.hx && Math.abs(lz) <= o.hz && o.haut > h) h = o.haut;
    }
    return h;
  }

  cercle(x, z, r) {
    this._inserer({ type: 'c', x, z, r }, r);
  }

  /** Segment épais (murs, palissades). */
  segment(x1, z1, x2, z2, epaisseur) {
    const x = (x1 + x2) / 2, z = (z1 + z2) / 2;
    const l = Math.hypot(x2 - x1, z2 - z1);
    const rot = -Math.atan2(z2 - z1, x2 - x1);
    this.rectangle(x, z, l / 2, epaisseur / 2, rot);
  }

  /** Vrai si un cercle de rayon r posé en (x, z) touche un obstacle. */
  occupe(x, z, r) {
    const p = { x, z };
    this.resoudre(p, r);
    return Math.abs(p.x - x) + Math.abs(p.z - z) > 1e-4;
  }

  /** Repousse le cercle (pos.x, pos.z, r) hors des obstacles. Modifie `pos` sur place. */
  resoudre(pos, r, piedY = -Infinity, marche = 0.55) {
    for (let passe = 0; passe < 3; passe++) {
      const i = Math.floor(pos.x / CELLULE), j = Math.floor(pos.z / CELLULE);
      const liste = this.grille.get(this._cle(i, j));
      if (!liste) return;
      let bouge = false;
      for (const o of liste) {
        if (o.type === 'c') {
          const dx = pos.x - o.x, dz = pos.z - o.z;
          const d = Math.hypot(dx, dz), min = o.r + r;
          if (d < min && d > 1e-6) {
            pos.x += (dx / d) * (min - d); pos.z += (dz / d) * (min - d); bouge = true;
          }
        } else {
          if (o.haut !== null && piedY + marche >= o.haut) continue; // on peut monter dessus
          // passage dans le repère du rectangle
          const dx = pos.x - o.x, dz = pos.z - o.z;
          const lx = dx * o.c - dz * o.s;
          const lz = dx * o.s + dz * o.c;
          const px = Math.max(-o.hx, Math.min(o.hx, lx));
          const pz = Math.max(-o.hz, Math.min(o.hz, lz));
          let ex = lx - px, ez = lz - pz;
          let d = Math.hypot(ex, ez);
          let nx, nz, pousse;
          if (d > 1e-6) {
            if (d >= r) continue;
            nx = ex / d; nz = ez / d; pousse = r - d;
          } else {
            // centre à l'intérieur : sortie par le côté le plus proche
            const fx = o.hx - Math.abs(lx), fz = o.hz - Math.abs(lz);
            if (fx < fz) { nx = Math.sign(lx) || 1; nz = 0; pousse = fx + r; }
            else { nx = 0; nz = Math.sign(lz) || 1; pousse = fz + r; }
          }
          // retour au repère monde
          const wx = nx * o.c + nz * o.s;
          const wz = -nx * o.s + nz * o.c;
          pos.x += wx * pousse; pos.z += wz * pousse; bouge = true;
        }
      }
      if (!bouge) return;
    }
  }
}
