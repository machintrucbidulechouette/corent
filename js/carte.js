// carte.js — mini-carte (coin de l'écran) et grande carte (touche M), dessinées depuis le plan.
import { distPlateau } from './relief.js';
import { RUES, SANCTUAIRE, PLACE, THEATRE, traceRempart, positionPorte } from './plan.js';

const ECH = 2;                   // pixels par mètre sur le fond de carte
const LX = 540, LZ = 420;        // emprise en mètres
const W = LX * ECH, H = LZ * ECH;

const C = {
  fond: '#2a241d', plateau: '#6f6a45', champs: '#857a4a', rue: '#c9b892', sanct: '#b58a52',
  palissade: '#3b2e22', place: '#c8995c', maison: '#e8dcc4', grenier: '#b8a27a', rempart: '#9a8c7a',
  atelier: '#d17a4a',
};

export class Carte {
  constructor(lots, lieux) {
    this.lieux = lieux;
    this.fond = document.createElement('canvas');
    this.fond.width = W; this.fond.height = H;
    const g = this.fond.getContext('2d');
    const vx = (x) => (x + LX / 2) * ECH, vz = (z) => (z + LZ / 2) * ECH;
    this.vx = vx; this.vz = vz;

    g.fillStyle = C.fond; g.fillRect(0, 0, W, H);
    // plateau (rendu par cellules de 4 m)
    for (let z = -LZ / 2; z < LZ / 2; z += 4) for (let x = -LX / 2; x < LX / 2; x += 4) {
      const d = distPlateau(x + 2, z + 2);
      if (d < 0) { g.fillStyle = d > -60 ? C.champs : C.plateau; g.fillRect(vx(x), vz(z), 4 * ECH + 0.5, 4 * ECH + 0.5); }
    }
    g.lineCap = 'round';
    for (const r of RUES) {
      g.strokeStyle = C.rue; g.lineWidth = r.l * ECH;
      g.beginPath(); g.moveTo(vx(r.a[0]), vz(r.a[1])); g.lineTo(vx(r.b[0]), vz(r.b[1])); g.stroke();
    }
    // rempart
    const t = traceRempart();
    g.strokeStyle = C.rempart; g.lineWidth = 3 * ECH;
    g.beginPath(); t.forEach(([x, z], i) => i ? g.lineTo(vx(x), vz(z)) : g.moveTo(vx(x), vz(z))); g.stroke();
    const p = positionPorte();
    g.fillStyle = C.rue; g.fillRect(vx(p.x) - 4 * ECH, vz(p.z) - 3.5 * ECH, 8 * ECH, 7 * ECH);
    // monuments
    const s = SANCTUAIRE.cote;
    g.fillStyle = C.sanct; g.fillRect(vx(SANCTUAIRE.x - s / 2), vz(SANCTUAIRE.z - s / 2), s * ECH, s * ECH);
    g.strokeStyle = C.palissade; g.lineWidth = 2; g.strokeRect(vx(SANCTUAIRE.x - s / 2), vz(SANCTUAIRE.z - s / 2), s * ECH, s * ECH);
    g.fillStyle = C.place; g.fillRect(vx(PLACE.x - PLACE.lx / 2), vz(PLACE.z - PLACE.lz / 2), PLACE.lx * ECH, PLACE.lz * ECH);
    g.strokeStyle = '#8c3524'; g.strokeRect(vx(PLACE.x - PLACE.lx / 2), vz(PLACE.z - PLACE.lz / 2), PLACE.lx * ECH, PLACE.lz * ECH);
    g.fillStyle = C.sanct;
    g.beginPath(); g.arc(vx(THEATRE.x), vz(THEATRE.z), THEATRE.rayon * ECH, 0, Math.PI); g.fill();
    // bâtiments
    for (const l of lots) {
      g.save();
      g.translate(vx(l.x), vz(l.z));
      g.rotate(-l.rot);
      g.fillStyle = l.type === 'grenier' ? C.grenier : l.type === 'atelier' || l.type === 'four' ? C.atelier : l.type === 'enclos' ? 'rgba(0,0,0,0)' : C.maison;
      const lx = l.type === 'atelier' ? 7 : l.type === 'four' ? 4 : l.l, lz = l.type === 'atelier' ? 5 : l.type === 'four' ? 4 : l.w;
      g.fillRect(-lx / 2 * ECH, -lz / 2 * ECH, lx * ECH, lz * ECH);
      g.restore();
    }

    this.mini = document.getElementById('minicarte');
    this.grande = document.getElementById('grande-carte');
  }

  _repere(g, x, y, angle, taille) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = '#f3e3c2'; g.strokeStyle = '#1d1814'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -taille); g.lineTo(taille * 0.65, taille * 0.75); g.lineTo(0, taille * 0.35); g.lineTo(-taille * 0.65, taille * 0.75); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  _lieux(g, tx, ty, ech, decouverts, etiquettes) {
    for (const l of this.lieux) {
      const x = tx(l.x), y = ty(l.z);
      const vu = decouverts.has(l.id);
      g.fillStyle = vu ? '#9fb0b6' : '#f0b44a';
      g.strokeStyle = '#1d1814'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 5 * ech, 0, Math.PI * 2); g.fill(); g.stroke();
      if (etiquettes) {
        g.font = `600 ${13 * ech}px "Alegreya Sans", system-ui, sans-serif`;
        g.fillStyle = '#f3e3c2'; g.strokeStyle = 'rgba(29,24,20,0.85)'; g.lineWidth = 4;
        g.strokeText(l.titre, x + 9 * ech, y + 4 * ech);
        g.fillText(l.titre, x + 9 * ech, y + 4 * ech);
      }
    }
  }

  /** Mini-carte orientée vers le nord, centrée sur le joueur. */
  dessinerMini(pos, orientation, decouverts) {
    const c = this.mini, g = c.getContext('2d');
    const T = c.width, zoom = 1.2;
    g.clearRect(0, 0, T, T);
    g.save();
    g.beginPath(); g.arc(T / 2, T / 2, T / 2 - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = C.fond; g.fillRect(0, 0, T, T);
    const sx = this.vx(pos.x), sy = this.vz(pos.z);
    g.drawImage(this.fond, sx - T / (2 * zoom), sy - T / (2 * zoom), T / zoom, T / zoom, 0, 0, T, T);
    const k = ECH * zoom;
    this._lieux(g, (x) => T / 2 + (x - pos.x) * k, (z) => T / 2 + (z - pos.z) * k, T / 200, decouverts, false);
    this._repere(g, T / 2, T / 2, Math.PI - orientation, T / 22);
    g.restore();
    g.strokeStyle = 'rgba(243,227,194,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.arc(T / 2, T / 2, T / 2 - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f3e3c2'; g.font = '700 13px "Alegreya Sans", system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('N', T / 2, 16);
    g.textAlign = 'start';
  }

  /** Grande carte : tout le plateau, lieux nommés. */
  dessinerGrande(pos, orientation, decouverts) {
    const c = this.grande, g = c.getContext('2d');
    const k = Math.min(c.width / W, c.height / H);
    const ox = (c.width - W * k) / 2, oy = (c.height - H * k) / 2;
    g.fillStyle = C.fond; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(this.fond, ox, oy, W * k, H * k);
    const tx = (x) => ox + this.vx(x) * k, ty = (z) => oy + this.vz(z) * k;
    this._lieux(g, tx, ty, Math.max(0.8, k * 1.4), decouverts, true);
    this._repere(g, tx(pos.x), ty(pos.z), Math.PI - orientation, 12);
  }
}
