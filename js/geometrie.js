// geometrie.js : primitives à UV métriques et assembleur qui fusionne les géométries par matériau.
// Fusionner des centaines de pièces en quelques maillages garde le nombre d'appels de dessin bas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Boîte dont les UV sont en mètres divisés par `tuile` (la texture ne s'étire pas). */
export function boite(lx, ly, lz, tuile = 1) {
  const g = new THREE.BoxGeometry(lx, ly, lz);
  const uv = g.attributes.uv;
  // ordre des faces : +x, -x, +y, -y, +z, -z (4 sommets chacune)
  const dims = [[lz, ly], [lz, ly], [lx, lz], [lx, lz], [lx, ly], [lx, ly]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tuile, uv.getY(i) * dims[f][1] / tuile);
    }
  }
  return g;
}

export function cylindre(rHaut, rBas, h, cotes = 8, tuile = 1) {
  const g = new THREE.CylinderGeometry(rHaut, rBas, h, cotes, 1);
  const uv = g.attributes.uv;
  const circ = Math.PI * 2 * Math.max(rHaut, rBas);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tuile, uv.getY(i) * h / tuile);
  return g;
}

/**
 * Construit une géométrie non indexée à partir de quadrilatères et triangles plans.
 * Chaque face : { p: [[x,y,z], ...3 ou 4], uv: [[u,v], ...] }.
 */
export function depuisFaces(faces) {
  const pos = [], nor = [], uvs = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (const f of faces) {
    const tris = f.p.length === 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
    a.fromArray(f.p[0]); b.fromArray(f.p[1]); c.fromArray(f.p[2]);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    for (const t of tris) {
      for (const k of t) {
        pos.push(...f.p[k]);
        nor.push(n.x, n.y, n.z);
        uvs.push(...f.uv[k]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return g;
}

/** Projette un point sur un pan de toit pour obtenir des UV métriques (u le long, v selon la pente). */
function uvPan(p, origine, axeU, axeV, tuile) {
  const d = new THREE.Vector3().fromArray(p).sub(origine);
  return [d.dot(axeU) / tuile, d.dot(axeV) / tuile];
}

/**
 * Toit à quatre pans (croupe) ou à deux pans (pignon), centré sur l'origine, base à y = 0.
 * lx : longueur (faîtage selon x), lz : profondeur, h : hauteur, debord : dépassement.
 */
export function toit(lx, lz, h, { debord = 0.6, croupe = true, tuile = 2 } = {}) {
  const X = lx / 2 + debord, Z = lz / 2 + debord;
  const faite = croupe ? Math.max(0.2, X - Z) : X;
  const A = [-X, 0, Z], B = [X, 0, Z], C = [X, 0, -Z], D = [-X, 0, -Z];
  const E = [-faite, h, 0], F = [faite, h, 0];
  const faces = [];
  const pan = (pts) => {
    const v0 = new THREE.Vector3().fromArray(pts[0]);
    const v1 = new THREE.Vector3().fromArray(pts[1]);
    const axeU = v1.clone().sub(v0).normalize();
    const n = v1.clone().sub(v0).cross(new THREE.Vector3().fromArray(pts[pts.length - 1]).sub(v0)).normalize();
    const axeV = new THREE.Vector3().crossVectors(n, axeU).normalize();
    faces.push({ p: pts, uv: pts.map(p => uvPan(p, v0, axeU, axeV, tuile)) });
  };
  pan([A, B, F, E]);   // pan sud
  pan([C, D, E, F]);   // pan nord
  if (croupe) {
    pan([B, C, F]);
    pan([D, A, E]);
  } else {
    // pignons : triangles verticaux (fermés en planches)
    faces.push({ p: [B, C, F], uv: [[0, 0], [lz / tuile, 0], [lz / 2 / tuile, h / tuile]] });
    faces.push({ p: [D, A, E], uv: [[0, 0], [lz / tuile, 0], [lz / 2 / tuile, h / tuile]] });
  }
  // sous-face pour que le toit ne paraisse pas creux vu d'en bas
  faces.push({ p: [A, D, C, B], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] });
  return depuisFaces(faces);
}

/** Toit en appentis (un seul pan), haut côté -z. */
export function appentis(lx, lz, hHaut, hBas, tuile = 2) {
  const X = lx / 2, Z = lz / 2;
  const A = [-X, hBas, Z], B = [X, hBas, Z], C = [X, hHaut, -Z], D = [-X, hHaut, -Z];
  const pente = Math.hypot(lz, hHaut - hBas);
  return depuisFaces([
    { p: [A, B, C, D], uv: [[0, 0], [lx / tuile, 0], [lx / tuile, pente / tuile], [0, pente / tuile]] },
    { p: [A, D, C, B], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  ]);
}

/** Talus : prisme à section triangulaire, longueur selon x, côté vertical en z = 0, pente vers +z. */
export function talus(lx, h, largeur, tuile = 3) {
  const X = lx / 2;
  const A = [-X, 0, 0], B = [X, 0, 0], C = [X, h, 0], D = [-X, h, 0];
  const E = [-X, 0, largeur], F = [X, 0, largeur];
  const pente = Math.hypot(h, largeur);
  return depuisFaces([
    { p: [E, F, C, D], uv: [[0, 0], [lx / tuile, 0], [lx / tuile, pente / tuile], [0, pente / tuile]] },
    { p: [B, C, F], uv: [[0, 0], [0, 1], [1, 0]] },
    { p: [A, E, D], uv: [[0, 0], [1, 0], [0, 1]] },
  ]);
}

/**
 * Assembleur : on y dépose des géométries transformées, rangées par clé de matériau,
 * puis on construit un maillage fusionné par clé.
 */
export class Assembleur {
  constructor() {
    this.lots = new Map();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3(1, 1, 1);
    this._p = new THREE.Vector3();
  }

  /** Ajoute `geo` au lot `cle`, positionné en (x, y, z) avec rotation (rx, ry, rz). */
  ajouter(cle, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, echelle = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    this._e.set(rx, ry, rz, 'YXZ');
    this._q.setFromEuler(this._e);
    this._p.set(x, y, z);
    this._s.setScalar(echelle);
    this._m.compose(this._p, this._q, this._s);
    g.applyMatrix4(this._m);
    if (!this.lots.has(cle)) this.lots.set(cle, []);
    this.lots.get(cle).push(g);
    return g;
  }

  /** Ajoute une géométrie exprimée dans un repère local (origine ox, oz, rotation rot). */
  ajouterLocal(cle, geo, ox, oz, rot, lx, y, lz, ry = 0, rx = 0, rz = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const x = ox + lx * c + lz * s;
    const z = oz - lx * s + lz * c;
    return this.ajouter(cle, geo, x, y, z, rot + ry, rx, rz);
  }

  construire(materiaux, { ombres = true } = {}) {
    const groupe = new THREE.Group();
    for (const [cle, geos] of this.lots) {
      if (!geos.length) continue;
      const fusion = mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      if (!fusion) continue;
      fusion.computeBoundingSphere();
      const mat = materiaux[cle];
      if (!mat) { console.warn('Matériau manquant :', cle); continue; }
      const m = new THREE.Mesh(fusion, mat);
      m.castShadow = ombres && !mat.userData.sansOmbre;
      m.receiveShadow = true;
      m.name = cle;
      groupe.add(m);
    }
    this.lots.clear();
    return groupe;
  }
}
