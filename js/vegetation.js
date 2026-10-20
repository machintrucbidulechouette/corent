// vegetation.js — arbres, buissons et touffes d'herbe en instances (un appel de dessin par type).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hauteurSol, distPlateau } from './relief.js';
import { aleatoire } from './bruit.js';
import { rueProche, dansReserve } from './plan.js';

function feuillage(alea, blobs) {
  const parts = [];
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.attributes.position;
    const graine = alea() * 1000;
    for (let i = 0; i < p.count; i++) {
      // même déformation pour les sommets confondus, pour ne pas ouvrir de fentes
      const h = Math.sin(p.getX(i) * 12.9898 + p.getY(i) * 78.233 + p.getZ(i) * 37.719 + graine) * 43758.5453;
      const k = 1 + ((h - Math.floor(h)) - 0.5) * 0.3;
      p.setXYZ(i, p.getX(i) * k + x, p.getY(i) * k * 0.85 + y, p.getZ(i) * k + z);
    }
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

export function creerVegetation(collisions, joueurDepart) {
  const groupe = new THREE.Group();
  const alea = aleatoire(404);

  const matTronc = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 });
  const matFeuilles = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });

  const modeles = [
    { // chêne : large couronne
      tronc: new THREE.CylinderGeometry(0.22, 0.38, 4, 7).translate(0, 2, 0),
      feuilles: feuillage(alea, [[0, 5.2, 0, 2.6], [1.6, 4.6, 0.6, 1.9], [-1.4, 4.8, -0.7, 2], [0.3, 6.3, -0.4, 1.7]]),
    },
    { // hêtre : couronne haute
      tronc: new THREE.CylinderGeometry(0.18, 0.3, 5, 7).translate(0, 2.5, 0),
      feuilles: feuillage(alea, [[0, 6, 0, 2.1], [0.4, 7.6, 0.3, 1.6], [-0.8, 5.2, 0.5, 1.5]]),
    },
    { // arbuste
      tronc: new THREE.CylinderGeometry(0.08, 0.12, 1, 5).translate(0, 0.5, 0),
      feuilles: feuillage(alea, [[0, 1.2, 0, 1.1], [0.6, 0.9, 0.3, 0.8], [-0.5, 1, -0.3, 0.75]]),
    },
  ];

  const placements = [[], [], []];
  const essayer = (x, z, type) => {
    const d = distPlateau(x, z);
    if (d < 0) {
      if (dansReserve(x, z, 4)) return false;
      if (rueProche(x, z).d < 2.5) return false;
      if (Math.hypot(x - joueurDepart.x, z - joueurDepart.z) < 10) return false;
      if (collisions.occupe(x, z, type === 2 ? 1.2 : 2.5)) return false;
    }
    placements[type].push([x, hauteurSol(x, z), z, 0.75 + alea() * 0.55, alea() * Math.PI * 2]);
    if (d < 0) collisions.cercle(x, z, type === 2 ? 0.5 : 0.45);
    return true;
  };

  // bosquets et haies en périphérie du plateau
  for (let i = 0; i < 2600; i++) {
    const a = alea() * Math.PI * 2, r = 0.55 + alea() * 0.6;
    const x = Math.cos(a) * 245 * r, z = Math.sin(a) * 185 * r;
    const d = distPlateau(x, z);
    if (d > -6 || d < -80) continue;
    if (alea() > 0.35 + 0.65 * Math.max(0, (d + 80) / 80)) continue;
    essayer(x, z, alea() < 0.45 ? 2 : alea() < 0.6 ? 0 : 1);
  }
  // quelques arbres isolés dans la ville (ombre, arbres remarquables)
  for (let i = 0; i < 90; i++) {
    const x = (alea() - 0.5) * 380, z = (alea() - 0.5) * 290;
    if (distPlateau(x, z) > -30) continue;
    essayer(x, z, alea() < 0.5 ? 2 : 0);
  }
  // forêt sur les versants
  for (let i = 0; i < 5000; i++) {
    const a = alea() * Math.PI * 2;
    const r = 1 + alea() * 0.9;
    const x = Math.cos(a) * 250 * r, z = Math.sin(a) * 190 * r;
    const d = distPlateau(x, z);
    if (d < 4 || d > 190 || Math.abs(x) > 345 || Math.abs(z) > 345) continue;
    essayer(x, z, alea() < 0.3 ? 2 : alea() < 0.5 ? 0 : 1);
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const axeY = new THREE.Vector3(0, 1, 0);
  const couleur = new THREE.Color();
  const teintes = ['#4d6a2c', '#5b7431', '#3f5a28', '#6a7a35', '#55662f'];
  modeles.forEach((mod, t) => {
    const liste = placements[t];
    if (!liste.length) return;
    const tronc = new THREE.InstancedMesh(mod.tronc, matTronc, liste.length);
    const feuilles = new THREE.InstancedMesh(mod.feuilles, matFeuilles, liste.length);
    liste.forEach(([x, y, z, e, r], i) => {
      q.setFromAxisAngle(axeY, r);
      s.set(e, e * (0.9 + alea() * 0.25), e);
      p.set(x, y - 0.15, z);
      m.compose(p, q, s);
      tronc.setMatrixAt(i, m);
      feuilles.setMatrixAt(i, m);
      couleur.set(teintes[Math.floor(alea() * teintes.length)]);
      feuilles.setColorAt(i, couleur);
    });
    for (const im of [tronc, feuilles]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      groupe.add(im);
    }
  });

  // touffes d'herbe haute
  const touffe = (() => {
    const parts = [];
    for (let k = 0; k < 3; k++) {
      const g = new THREE.PlaneGeometry(0.55, 0.45, 1, 1).translate(0, 0.22, 0).rotateY((k * Math.PI) / 3);
      parts.push(g);
    }
    const g = mergeGeometries(parts);
    // haut des brins plus clair que la base
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 0.45;
      col[i * 3] = 0.32 + t * 0.35; col[i * 3 + 1] = 0.38 + t * 0.32; col[i * 3 + 2] = 0.16 + t * 0.12;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  })();
  const matHerbe = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  const N = 26000;
  const herbe = new THREE.InstancedMesh(touffe, matHerbe, N);
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i++) {
    const x = (alea() - 0.5) * 480, z = (alea() - 0.5) * 370;
    if (distPlateau(x, z) > -3) continue;
    if (rueProche(x, z).d < 0.5) continue;
    if (dansReserve(x, z, -6)) continue;
    q.setFromAxisAngle(axeY, alea() * 6.3);
    const e = 0.6 + alea() * 0.9;
    s.set(e, e * (0.7 + alea() * 0.8), e);
    p.set(x, hauteurSol(x, z) - 0.03, z);
    m.compose(p, q, s);
    herbe.setMatrixAt(n++, m);
  }
  herbe.count = n;
  herbe.receiveShadow = true;
  herbe.computeBoundingSphere();
  groupe.add(herbe);

  return groupe;
}
