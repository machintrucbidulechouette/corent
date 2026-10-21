// terrain.js — sol du plateau (mélange herbe / terre / roche dans le shader) et paysage lointain.
import * as THREE from 'three';
import { hauteurSol, distPlateau } from './relief.js';
import { fbm, lisser } from './bruit.js';
import { rueProche, SANCTUAIRE, PLACE, THEATRE, ARTISANS } from './plan.js';
import { ajouterHook } from './rendu.js';

const COULEURS = {
  herbe: new THREE.Color('#6f7f3e'),
  herbeSeche: new THREE.Color('#9a9152'),
  herbeSombre: new THREE.Color('#4f5f2e'),
  terre: new THREE.Color('#7d6448'),
  terreBattue: new THREE.Color('#8f7556'),
  gravier: new THREE.Color('#a99a80'),
  fosse: new THREE.Color('#4a3a2c'),
  roche: new THREE.Color('#5e5853'),
  ble: new THREE.Color('#b9a45f'),
  foret: new THREE.Color('#3b4a26'),
  champ1: new THREE.Color('#8c8a48'),
  champ2: new THREE.Color('#a49656'),
  champ3: new THREE.Color('#6c7a3c'),
  eau: new THREE.Color('#5a7480'),
};

const tmp = new THREE.Color();
const poids = { terre: 0, roche: 0 };

/** Couleur et nature du sol sur le plateau. Remplit `poids` (part de terre et de roche). */
function solPlateau(x, z, pente, sortie) {
  const n = fbm(x * 0.03, z * 0.03, 3);
  sortie.copy(COULEURS.herbe).lerp(COULEURS.herbeSeche, lisser(-0.2, 0.5, n));
  sortie.lerp(COULEURS.herbeSombre, lisser(0.2, 0.7, fbm(x * 0.11 + 5, z * 0.11, 2)) * 0.4);
  let terre = 0;

  const d = distPlateau(x, z);
  const champ = fbm(Math.floor(x / 28) * 3.1, Math.floor(z / 22) * 2.7, 1);
  if (d > -70 && d < -16 && champ > 0.15) sortie.lerp(COULEURS.ble, 0.55);

  const urbain = 1 - lisser(0.75, 1.15, Math.hypot(x / 215, z / 160));
  sortie.lerp(COULEURS.terre, urbain * 0.35 * (0.6 + 0.4 * n));
  terre = Math.max(terre, urbain * 0.3 * (0.5 + n));

  const r = rueProche(x, z);
  const chaussee = 1 - lisser(-0.6, 0.8, r.d);
  sortie.lerp(COULEURS.gravier, chaussee);
  const bord = (1 - lisser(0.5, 2.5, r.d)) * lisser(-0.6, 0.5, r.d);
  sortie.lerp(COULEURS.terre, bord * 0.6);
  terre = Math.max(terre, chaussee, bord * 0.8);

  const sx = Math.abs(x - SANCTUAIRE.x), sz = Math.abs(z - SANCTUAIRE.z), h = SANCTUAIRE.cote / 2;
  const carre = Math.max(sx, sz);
  if (carre < h) { sortie.lerp(COULEURS.terreBattue, 0.75); terre = Math.max(terre, 0.85); }
  if (carre > h + 0.6 && carre < h + 3.2 && !(x > 0 && sz < 3)) { sortie.lerp(COULEURS.fosse, 0.85); terre = 1; }

  if (Math.abs(x - PLACE.x) < PLACE.lx / 2 && Math.abs(z - PLACE.z) < PLACE.lz / 2) { sortie.lerp(COULEURS.gravier, 0.6); terre = Math.max(terre, 0.9); }
  const dt = Math.hypot(x - THEATRE.x, z - THEATRE.z);
  if (dt < THEATRE.rayon + 2) { sortie.lerp(COULEURS.terreBattue, 0.6); terre = Math.max(terre, 0.8); }
  if (Math.abs(x - ARTISANS.x) < ARTISANS.hx && Math.abs(z - ARTISANS.z) < ARTISANS.hz) {
    sortie.lerp(COULEURS.fosse, 0.25 * (0.5 + n)); terre = Math.max(terre, 0.5 + n * 0.3);
  }
  const roche = lisser(0.35, 0.8, pente);
  sortie.lerp(COULEURS.roche, roche);
  poids.terre = Math.min(1, terre);
  poids.roche = roche;
  return sortie;
}

function solLointain(x, z, y, pente, sortie) {
  const parcelle = fbm(Math.floor(x / 160) * 1.7, Math.floor(z / 120) * 2.3, 1);
  if (parcelle < -0.2) sortie.copy(COULEURS.champ1);
  else if (parcelle < 0.15) sortie.copy(COULEURS.champ3);
  else sortie.copy(COULEURS.champ2);
  const foret = fbm(x * 0.0015 + 3, z * 0.0015 - 7, 3);
  sortie.lerp(COULEURS.foret, lisser(0.05, 0.25, foret));
  sortie.lerp(COULEURS.foret, lisser(-120, 40, y) * 0.8);
  sortie.lerp(COULEURS.roche, lisser(0.55, 0.9, pente) * 0.7);
  const riviere = Math.abs(x - 900 - Math.sin(z * 0.0016) * 260);
  if (riviere < 30 && y < -175) sortie.lerp(COULEURS.eau, 0.9);
  poids.terre = 0.2; poids.roche = lisser(0.5, 0.9, pente);
  return sortie;
}

function construire(taille, segments, solFn, abaisserCentre = 0) {
  const geo = new THREE.PlaneGeometry(taille, taille, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const couleurs = new Float32Array(pos.count * 3);
  const sols = new Float32Array(pos.count * 2);
  const e = 1.2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = hauteurSol(x, z);
    if (abaisserCentre && Math.abs(x) < abaisserCentre - 1 && Math.abs(z) < abaisserCentre - 1) y -= 8;
    pos.setY(i, y);
    const dx = hauteurSol(x + e, z) - hauteurSol(x - e, z);
    const dz = hauteurSol(x, z + e) - hauteurSol(x, z - e);
    const pente = Math.min(1, Math.hypot(dx, dz) / (2 * e));
    solFn(x, z, y, pente, tmp);
    const v = 1 + fbm(x * 0.5, z * 0.5, 1) * 0.06;
    couleurs[i * 3] = tmp.r * v; couleurs[i * 3 + 1] = tmp.g * v; couleurs[i * 3 + 2] = tmp.b * v;
    sols[i * 2] = poids.terre; sols[i * 2 + 1] = poids.roche;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  geo.setAttribute('aSol', new THREE.BufferAttribute(sols, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Matériau du sol : trois textures de détail (herbe, terre, roche) mélangées selon `aSol`,
 * échantillonnées à deux échelles pour casser la répétition, multipliées par la couleur du terrain.
 */
function materiauSol(tx, repetition) {
  const herbe = tx.herbe.map.clone(); herbe.repeat.set(repetition, repetition); herbe.needsUpdate = true;
  const nHerbe = tx.herbe.normalMap.clone(); nHerbe.repeat.set(repetition, repetition); nHerbe.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: herbe, normalMap: nHerbe, roughness: 0.96, normalScale: new THREE.Vector2(1.3, 1.3) });
  const uniformes = {
    tTerre: { value: tx.terre.map }, tRoche: { value: tx.roche.map },
    nTerre: { value: tx.terre.normalMap }, nRoche: { value: tx.roche.normalMap },
  };
  ajouterHook(mat, 'sol', (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = 'attribute vec2 aSol;\nvarying vec2 vSol;\n' + shader.vertexShader.replace(
      '#include <color_vertex>', '#include <color_vertex>\n vSol = aSol;');
    const tete = `uniform sampler2D tTerre; uniform sampler2D tRoche; uniform sampler2D nTerre; uniform sampler2D nRoche;
      varying vec2 vSol;
      vec4 deuxEchelles(sampler2D t, vec2 uv) {
        return mix(texture2D(t, uv), texture2D(t, uv * 0.27 + vec2(0.37, 0.11)), 0.45);
      }
      vec4 solCouleur(vec2 uv) {
        float r = clamp(vSol.y, 0.0, 1.0);
        float te = clamp(vSol.x, 0.0, 1.0) * (1.0 - r);
        float h = 1.0 - te - r;
        return deuxEchelles(map, uv) * h + deuxEchelles(tTerre, uv) * te + deuxEchelles(tRoche, uv * 0.5) * r;
      }
      vec4 solNormale(vec2 uv) {
        float r = clamp(vSol.y, 0.0, 1.0);
        float te = clamp(vSol.x, 0.0, 1.0) * (1.0 - r);
        float h = 1.0 - te - r;
        return deuxEchelles(normalMap, uv) * h + deuxEchelles(nTerre, uv) * te + deuxEchelles(nRoche, uv * 0.5) * r;
      }
    `;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normalmap_pars_fragment>', '#include <normalmap_pars_fragment>\n' + tete)
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          diffuseColor.rgb *= solCouleur(vMapUv).rgb * 1.9;
        #endif`)
      .replace('#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )', 'solNormale( vNormalMapUv )'));
  });
  return mat;
}

export function creerTerrain(tx) {
  const groupe = new THREE.Group();
  const proche = new THREE.Mesh(construire(700, 350, (x, z, y, p, c) => solPlateau(x, z, p, c)), materiauSol(tx, 175));
  proche.receiveShadow = true;
  proche.name = 'terrain';
  groupe.add(proche);

  const matLoin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const loin = new THREE.Mesh(construire(14000, 280, solLointain, 350), matLoin);
  loin.name = 'paysage';
  groupe.add(loin);
  return { groupe, proche };
}
