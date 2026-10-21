// herbe.js : champ de brins d'herbe calculé sur la carte graphique.
// Les brins sont placés dans un carré qui suit le joueur ; leur hauteur au sol et leur densité
// sont lues dans une texture précalculée (relief + zones sans herbe : rues, bâtiments, places).
import * as THREE from 'three';
import { hauteurSol, distPlateau } from './relief.js';
import { rueProche, SANCTUAIRE, PLACE, THEATRE } from './plan.js';
import { aleatoire } from './bruit.js';
import { ajouterHook } from './rendu.js';

const EMPRISE = { x: -350, z: -350, taille: 700, res: 512 };

/** Texture : R = hauteur du sol, G = densité d'herbe (0 à 1). */
function bakerSol(collisions) {
  const { res, taille, x: x0, z: z0 } = EMPRISE;
  const data = new Uint16Array(res * res * 4);
  const pas = taille / res;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = x0 + (i + 0.5) * pas, z = z0 + (j + 0.5) * pas;
      const h = hauteurSol(x, z);
      let dens = 0;
      if (distPlateau(x, z) < -2) {
        dens = 1;
        const r = rueProche(x, z).d;
        dens *= THREE.MathUtils.smoothstep(r, -0.2, 1.6);
        const sx = Math.abs(x - SANCTUAIRE.x), sz = Math.abs(z - SANCTUAIRE.z);
        if (Math.max(sx, sz) < SANCTUAIRE.cote / 2 + 3.5) dens *= 0.18;
        if (Math.abs(x - PLACE.x) < PLACE.lx / 2 && Math.abs(z - PLACE.z) < PLACE.lz / 2) dens = 0;
        if (Math.hypot(x - THEATRE.x, z - THEATRE.z) < THEATRE.rayon + 1.5) dens *= 0.15;
        if (dens > 0 && collisions.occupe(x, z, 0.25)) dens = 0;
      }
      const k = (j * res + i) * 4;
      data[k] = THREE.DataUtils.toHalfFloat(h);
      data[k + 1] = THREE.DataUtils.toHalfFloat(dens);
      data[k + 2] = 0;
      data[k + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const t = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

function geometrieBrin() {
  // brin effilé en 5 sommets ; y va de 0 (pied) à 1 (pointe)
  const w = 0.07;
  const pos = new Float32Array([
    -w / 2, 0, 0, w / 2, 0, 0,
    -w * 0.32, 0.5, 0, w * 0.32, 0.5, 0,
    0, 1, 0,
  ]);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  return g;
}

export class Herbe {
  constructor(scene, collisions, densiteQualite = 1) {
    this.taille = 64;
    const max = Math.round(this.taille * this.taille * 22);
    const alea = aleatoire(77);
    const geo = geometrieBrin();
    const brins = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) {
      brins[i * 4] = alea() * this.taille;
      brins[i * 4 + 1] = alea() * this.taille;
      brins[i * 4 + 2] = alea();
      brins[i * 4 + 3] = alea() * Math.PI * 2;
    }
    geo.setAttribute('aBrin', new THREE.InstancedBufferAttribute(brins, 4));
    geo.instanceCount = max;
    this.max = max;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    this.uniformes = {
      tSol: { value: bakerSol(collisions) },
      uEmprise: { value: new THREE.Vector3(EMPRISE.x, EMPRISE.z, EMPRISE.taille) },
      uCentre: { value: new THREE.Vector3() },
      uTaille: { value: this.taille },
      uTemps: { value: 0 },
      uDensite: { value: 1 },
      uVent: { value: 1 },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
    const u = this.uniformes;
    ajouterHook(mat, 'herbe', (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = `
        uniform sampler2D tSol; uniform vec3 uEmprise; uniform vec3 uCentre;
        uniform float uTaille; uniform float uTemps; uniform float uDensite; uniform float uVent;
        attribute vec4 aBrin;
        varying float vHaut; varying float vTeinte;
      ` + shader.vertexShader
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif')
        .replace('#include <begin_vertex>', `
          vec2 rel = mod(aBrin.xy - uCentre.xz + uTaille * 0.5, uTaille) - uTaille * 0.5;
          vec2 wxz = uCentre.xz + rel;
          vec4 sol = texture2D(tSol, (wxz - uEmprise.xy) / uEmprise.z);
          float dist = length(rel) / (uTaille * 0.5);
          float garde = step(aBrin.z, sol.g * uDensite) * (1.0 - smoothstep(0.7, 1.0, dist));
          float h = (0.28 + fract(aBrin.z * 7.31) * 0.42) * garde;
          vec3 transformed = position;
          transformed.x *= garde * (0.8 + fract(aBrin.z * 3.7) * 0.6);
          transformed.y *= h;
          float ca = cos(aBrin.w), sa = sin(aBrin.w);
          transformed.xz = vec2(ca * transformed.x - sa * transformed.z, sa * transformed.x + ca * transformed.z);
          float rafale = sin(uTemps * 0.6 + wxz.x * 0.03) * 0.5 + 0.5;
          float vent = (sin(uTemps * 1.8 + wxz.x * 0.35 + wxz.y * 0.22) * 0.6 + sin(uTemps * 3.3 + wxz.y * 0.8) * 0.25) * (0.4 + rafale) * uVent;
          float courbe = position.y * position.y;
          transformed.x += (vent * 0.22 + 0.06) * courbe * h * 2.0;
          transformed.z += vent * 0.12 * courbe * h * 2.0;
          transformed.xz += wxz;
          transformed.y += sol.r - 0.02;
          vHaut = position.y;
          vTeinte = fract(aBrin.z * 13.7);
        `);
      shader.fragmentShader = 'varying float vHaut; varying float vTeinte;\n' + shader.fragmentShader
        .replace('#include <color_fragment>', `
          vec3 pied = vec3(0.07, 0.09, 0.03);
          vec3 pointe = mix(vec3(0.30, 0.36, 0.11), vec3(0.50, 0.46, 0.20), vTeinte * vTeinte);
          diffuseColor.rgb *= mix(pied, pointe, vHaut);
        `);
    });
    this.maillage = new THREE.Mesh(geo, mat);
    this.maillage.frustumCulled = false;
    this.maillage.receiveShadow = true;
    this.maillage.castShadow = false;
    this.maillage.name = 'herbe';
    scene.add(this.maillage);
    this.regler(densiteQualite);
  }

  regler(densite) {
    this.maillage.geometry.instanceCount = Math.round(this.max * Math.max(0.1, densite));
    this.maillage.visible = densite > 0.05;
  }

  maj(centre, temps, vent = 1) {
    this.uniformes.uCentre.value.copy(centre);
    this.uniformes.uTemps.value = temps;
    this.uniformes.uVent.value = vent;
  }
}
