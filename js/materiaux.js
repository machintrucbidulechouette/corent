// materiaux.js — palette de matériaux partagée par tous les bâtiments.
import * as THREE from 'three';

export function creerMateriaux(tx) {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...o });
  const m = {
    torchisBlanc: std({ map: tx.torchisBlanc }),
    torchisOcre: std({ map: tx.torchisOcre }),
    torchisRose: std({ map: tx.torchisRose }),
    enduitBandes: std({ map: tx.enduitBandes }),
    bardeaux: std({ map: tx.bardeaux, roughness: 0.95, side: THREE.DoubleSide }),
    chaume: std({ map: tx.chaume, roughness: 1, side: THREE.DoubleSide }),
    planches: std({ map: tx.planches }),
    poutre: std({ map: tx.planchesSombres }),
    planchesFonce: std({ map: tx.planchesSombres, color: 0xd8d0c8 }),
    rouge: std({ map: tx.planchesRouges, roughness: 0.8 }),
    murus: std({ map: tx.murus, roughness: 1 }),
    pierre: std({ color: 0x77716a, map: tx.detailSol, roughness: 1 }),
    terreCuite: std({ color: 0xb86f45, roughness: 0.75 }),
    argile: std({ color: 0x9c6c4a, map: tx.detailSol, roughness: 1 }),
    os: std({ color: 0xe8dcc4, roughness: 0.7 }),
    fer: std({ color: 0x3a3836, roughness: 0.5, metalness: 0.7 }),
    bronze: std({ color: 0xb08a3e, roughness: 0.35, metalness: 0.9 }),
    tissuRouge: std({ color: 0x9a3b2c, side: THREE.DoubleSide }),
    tissuJaune: std({ color: 0xc8a14a, side: THREE.DoubleSide }),
    tissuBleu: std({ color: 0x4c5f78, side: THREE.DoubleSide }),
    foin: std({ map: tx.chaume, color: 0xd9c38a, roughness: 1 }),
    fosse: std({ color: 0x2e2620, roughness: 1 }),
    braise: new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a14, emissiveIntensity: 2.2 }),
  };
  m.fosse.userData.sansOmbre = true;
  m.braise.userData.sansOmbre = true;
  return m;
}
