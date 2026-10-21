// materiaux.js : palette de matériaux PBR partagée par tous les bâtiments.
import * as THREE from 'three';

export function creerMateriaux(tx) {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...o });
  /** Matériau complet à partir d'un ensemble { map, normalMap, roughnessMap }. */
  const pbr = (e, o = {}, relief = 1) => std({
    map: e.map, normalMap: e.normalMap, roughnessMap: e.roughnessMap,
    normalScale: new THREE.Vector2(relief, relief), ...o,
  });
  const m = {
    torchisBlanc: pbr(tx.torchisBlanc, {}, 0.9),
    torchisOcre: pbr(tx.torchisOcre, {}, 0.9),
    torchisRose: pbr(tx.torchisRose, {}, 0.9),
    enduitBandes: pbr(tx.enduitBandes, {}, 0.7),
    bardeaux: pbr(tx.bardeaux, { side: THREE.DoubleSide }, 1.4),
    chaume: pbr(tx.chaume, { side: THREE.DoubleSide }, 1.3),
    planches: pbr(tx.planches, {}, 1),
    poutre: pbr(tx.planchesSombres, {}, 1),
    planchesFonce: pbr(tx.planchesSombres, { color: 0xd8d0c8 }, 1),
    rouge: pbr(tx.planchesRouges, {}, 0.8),
    murus: pbr(tx.murus, {}, 1.5),
    pierre: pbr(tx.roche, { color: 0xa39a90 }, 1.2),
    terreCuite: std({ color: 0xb86f45, roughness: 0.72, normalMap: tx.terre.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }),
    argile: pbr(tx.terre, { color: 0xb0805c }, 1),
    os: std({ color: 0xe8dcc4, roughness: 0.65 }),
    fer: std({ color: 0x3a3836, roughness: 0.45, metalness: 0.75 }),
    bronze: std({ color: 0xb08a3e, roughness: 0.32, metalness: 0.9 }),
    tissuRouge: std({ color: 0x9a3b2c, side: THREE.DoubleSide, roughness: 0.95 }),
    tissuJaune: std({ color: 0xc8a14a, side: THREE.DoubleSide, roughness: 0.95 }),
    tissuBleu: std({ color: 0x4c5f78, side: THREE.DoubleSide, roughness: 0.95 }),
    foin: pbr(tx.chaume, { color: 0xe6d29a }, 1),
    fosse: std({ color: 0x2a221c }),
    braise: new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a14, emissiveIntensity: 9 }),
  };
  m.fosse.userData.sansOmbre = true;
  m.braise.userData.sansOmbre = true;
  return m;
}
