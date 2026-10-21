// vegetation.js — arbres et arbustes. Sur le plateau : feuillage en cartes de feuilles animées par le vent.
// Sur les versants : arbres simplifiés, vus de loin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hauteurSol, distPlateau } from './relief.js';
import { aleatoire } from './bruit.js';
import { rueProche, dansReserve } from './plan.js';
import { ajouterHook } from './rendu.js';

/** Couronne faite de petites cartes de feuilles réparties dans des volumes sphériques. */
function couronneCartes(alea, blobs, n) {
  const pos = [], nor = [], uv = [];
  // centre de la couronne pour des normales « bombées » (éclairage doux)
  const cx = blobs.reduce((s, b) => s + b[0], 0) / blobs.length;
  const cy = blobs.reduce((s, b) => s + b[1], 0) / blobs.length;
  const cz = blobs.reduce((s, b) => s + b[2], 0) / blobs.length;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  const coins = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  for (let k = 0; k < n; k++) {
    const b = blobs[Math.floor(alea() * blobs.length)];
    // point plutôt en surface du volume
    const r = b[3] * (0.55 + 0.45 * Math.cbrt(alea()));
    const th = alea() * Math.PI * 2, ph = Math.acos(2 * alea() - 1);
    const px = b[0] + r * Math.sin(ph) * Math.cos(th);
    const py = b[1] + r * Math.cos(ph) * 0.8;
    const pz = b[2] + r * Math.sin(ph) * Math.sin(th);
    const taille = 1.2 + alea() * 0.8;
    e.set(alea() * Math.PI, alea() * Math.PI * 2, alea() * Math.PI);
    q.setFromEuler(e);
    const n0 = new THREE.Vector3(px - cx, (py - cy) * 1.3 + 0.4, pz - cz).normalize();
    const u0 = Math.floor(alea() * 2) * 0.5, v0 = Math.floor(alea() * 2) * 0.5;
    const tri = [0, 1, 2, 0, 2, 3];
    for (const i of tri) {
      v.set(coins[i][0] * taille, coins[i][1] * taille, 0).applyQuaternion(q);
      pos.push(px + v.x, py + v.y, pz + v.z);
      nor.push(n0.x, n0.y, n0.z);
      uv.push(u0 + (coins[i][0] + 0.5) * 0.5, v0 + (coins[i][1] + 0.5) * 0.5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Couronne simplifiée (boules facettées) pour les arbres lointains. */
function couronneBoules(alea, blobs) {
  const parts = [];
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    const p = g.attributes.position;
    const graine = alea() * 1000;
    for (let i = 0; i < p.count; i++) {
      const h = Math.sin(p.getX(i) * 12.9898 + p.getY(i) * 78.233 + p.getZ(i) * 37.719 + graine) * 43758.5453;
      const k = 1 + ((h - Math.floor(h)) - 0.5) * 0.3;
      p.setXYZ(i, p.getX(i) * k + x, p.getY(i) * k * 0.85 + y, p.getZ(i) * k + z);
    }
    g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** Tronc avec quelques maîtresses branches. */
function tronc(h, r, branches, alea) {
  const parts = [new THREE.CylinderGeometry(r * 0.6, r, h, 8, 3).translate(0, h / 2, 0)];
  for (let i = 0; i < branches; i++) {
    const l = h * (0.35 + alea() * 0.25);
    const b = new THREE.CylinderGeometry(r * 0.2, r * 0.42, l, 6).translate(0, l / 2, 0);
    b.rotateZ(0.6 + alea() * 0.5);
    b.rotateY(alea() * Math.PI * 2);
    b.translate(0, h * (0.55 + alea() * 0.3), 0);
    parts.push(b);
  }
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
}

export function creerVegetation(collisions, joueurDepart, tx, rendu) {
  const groupe = new THREE.Group();
  const alea = aleatoire(404);
  const temps = { value: 0 };

  const ecorce = tx.planchesSombres;
  const matTronc = new THREE.MeshStandardMaterial({ map: ecorce.map, normalMap: ecorce.normalMap, roughnessMap: ecorce.roughnessMap, color: 0x9a8a7a, roughness: 1 });
  const matFeuilles = new THREE.MeshStandardMaterial({ map: tx.feuilles, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: 0xffffff });
  const matLoin = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  ajouterHook(matFeuilles, 'vent', (shader) => {
    shader.uniforms.uTemps = temps;
    shader.vertexShader = 'uniform float uTemps;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 baseI = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 baseI = vec2(0.0);
      #endif
      float hh = max(0.0, transformed.y - 2.0);
      transformed.x += sin(uTemps * 1.3 + baseI.x * 0.3 + baseI.y * 0.2 + transformed.y * 0.3) * 0.035 * hh;
      transformed.z += cos(uTemps * 1.05 + baseI.y * 0.3) * 0.025 * hh;
      transformed += normal * sin(uTemps * 6.0 + position.x * 5.0 + position.z * 7.0) * 0.035;
    `);
  });

  const proches = [
    { // chêne
      tronc: tronc(4.2, 0.36, 4, alea),
      feuilles: couronneCartes(alea, [[0, 5.4, 0, 2.6], [1.7, 4.8, 0.6, 1.9], [-1.5, 5, -0.7, 2], [0.3, 6.5, -0.4, 1.7]], 130),
    },
    { // hêtre
      tronc: tronc(5.2, 0.28, 3, alea),
      feuilles: couronneCartes(alea, [[0, 6.2, 0, 2.1], [0.4, 7.8, 0.3, 1.6], [-0.8, 5.4, 0.5, 1.5]], 105),
    },
    { // arbuste (noisetier, aubépine)
      tronc: tronc(0.9, 0.08, 2, alea),
      feuilles: couronneCartes(alea, [[0, 1.1, 0, 1.1], [0.6, 0.9, 0.3, 0.8], [-0.5, 1, -0.3, 0.75]], 45),
    },
  ];
  const lointains = [
    { tronc: new THREE.CylinderGeometry(0.22, 0.38, 4, 4).translate(0, 2, 0), feuilles: couronneBoules(alea, [[0, 5.2, 0, 2.6], [1.6, 4.6, 0.6, 1.9], [-1.4, 4.8, -0.7, 2]]) },
    { tronc: new THREE.CylinderGeometry(0.18, 0.3, 5, 4).translate(0, 2.5, 0), feuilles: couronneBoules(alea, [[0, 6, 0, 2.1], [0.4, 7.6, 0.3, 1.6]]) },
  ];

  const placementsProches = [[], [], []];
  const placementsLoin = [[], []];
  const essayer = (x, z, type) => {
    if (dansReserve(x, z, 4)) return false;
    if (rueProche(x, z).d < 2.5) return false;
    if (Math.hypot(x - joueurDepart.x, z - joueurDepart.z) < 10) return false;
    if (collisions.occupe(x, z, type === 2 ? 1.2 : 2.5)) return false;
    placementsProches[type].push([x, hauteurSol(x, z), z, 0.75 + alea() * 0.55, alea() * Math.PI * 2]);
    collisions.cercle(x, z, type === 2 ? 0.45 : 0.45);
    return true;
  };

  for (let i = 0; i < 2600; i++) {
    const a = alea() * Math.PI * 2, r = 0.55 + alea() * 0.6;
    const x = Math.cos(a) * 245 * r, z = Math.sin(a) * 185 * r;
    const d = distPlateau(x, z);
    if (d > -6 || d < -80) continue;
    if (alea() > 0.35 + 0.65 * Math.max(0, (d + 80) / 80)) continue;
    essayer(x, z, alea() < 0.45 ? 2 : alea() < 0.6 ? 0 : 1);
  }
  for (let i = 0; i < 90; i++) {
    const x = (alea() - 0.5) * 380, z = (alea() - 0.5) * 290;
    if (distPlateau(x, z) > -30) continue;
    essayer(x, z, alea() < 0.5 ? 2 : 0);
  }
  for (let i = 0; i < 5200; i++) {
    const a = alea() * Math.PI * 2, r = 1 + alea() * 0.9;
    const x = Math.cos(a) * 250 * r, z = Math.sin(a) * 190 * r;
    const d = distPlateau(x, z);
    if (d < 3 || d > 190 || Math.abs(x) > 345 || Math.abs(z) > 345) continue;
    // la lisière, visible depuis le plateau, reçoit des arbres détaillés
    if (d < 22 && alea() < 0.4) placementsProches[alea() < 0.3 ? 2 : alea() < 0.5 ? 0 : 1].push([x, hauteurSol(x, z), z, 0.8 + alea() * 0.5, alea() * 6.3]);
    else placementsLoin[alea() < 0.5 ? 0 : 1].push([x, hauteurSol(x, z), z, 0.8 + alea() * 0.6, alea() * 6.3]);
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const axeY = new THREE.Vector3(0, 1, 0);
  const couleur = new THREE.Color();
  const teintes = ['#8fae6a', '#a3b874', '#7f9c5c', '#b4b878', '#96a866'];
  const teintesLoin = ['#4d6a2c', '#5b7431', '#3f5a28', '#6a7a35', '#55662f'];
  const feuillages = [];
  const instancier = (modeles, placements, matF, palette, ombres) => {
    modeles.forEach((mod, t) => {
      const liste = placements[t];
      if (!liste.length) return;
      const tr = new THREE.InstancedMesh(mod.tronc, matTronc, liste.length);
      const fe = new THREE.InstancedMesh(mod.feuilles, matF, liste.length);
      liste.forEach(([x, y, z, e, r], i) => {
        q.setFromAxisAngle(axeY, r);
        s.set(e, e * (0.9 + alea() * 0.25), e);
        p.set(x, y - 0.15, z);
        m.compose(p, q, s);
        tr.setMatrixAt(i, m);
        fe.setMatrixAt(i, m);
        couleur.set(palette[Math.floor(alea() * palette.length)]);
        fe.setColorAt(i, couleur);
      });
      for (const im of [tr, fe]) {
        im.castShadow = ombres;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        groupe.add(im);
      }
      feuillages.push(fe);
    });
  };
  instancier(proches, placementsProches, matFeuilles, teintes, true);
  instancier(lointains, placementsLoin, matLoin, teintesLoin, false);

  // les cartes de feuilles faussent l'occlusion ambiante : elles en sont exclues
  if (rendu) rendu.masquesAO.push(...feuillages.filter(f => f.material === matFeuilles));
  return { groupe, temps };
}
