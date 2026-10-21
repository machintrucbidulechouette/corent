// ambiance.js — ciel, soleil, étoiles, brouillard et heure du jour.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { aleatoire } from './bruit.js';

export class Ambiance {
  constructor(scene, renderer, ombres) {
    this.scene = scene;
    this.renderer = renderer;
    this.ombres = ombres;

    this.ciel = new Sky();
    this.ciel.scale.setScalar(10000);
    const u = this.ciel.material.uniforms;
    u.turbidity.value = 4.5;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    scene.add(this.ciel);

    this.hemi = new THREE.HemisphereLight(0xbfd4e6, 0x5a4a32, 0.9);
    scene.add(this.hemi);
    // clair de lune, sans ombre
    this.lune = new THREE.DirectionalLight(0x8fa6c8, 0);
    this.lune.position.set(-0.4, 1, 0.3);
    scene.add(this.lune);

    // étoiles
    const alea = aleatoire(3);
    const n = 2200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = alea() * Math.PI * 2, ph = Math.acos(alea() * 0.95);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 9000;
      pos[i * 3 + 1] = Math.cos(ph) * 9000;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 9000;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.matEtoiles = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.etoiles = new THREE.Points(g, this.matEtoiles);
    this.etoiles.renderOrder = -1;
    scene.add(this.etoiles);

    scene.fog = new THREE.Fog(0xc8d4dc, 600, 9500);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sceneCiel = new THREE.Scene();
    this.cielEnv = new Sky();
    this.cielEnv.scale.setScalar(1000);
    this.sceneCiel.add(this.cielEnv);
    this.envRT = null;

    this.directionSoleil = new THREE.Vector3();
    this.jour = 1;
    this.doree = 0;
    this.heure = 16;
    this.couleurSoleil = new THREE.Color();
    this.regler(16);
  }

  /** Règle l'heure (5 à 22 h) : soleil, couleurs, brouillard, étoiles, éclairage d'ambiance. */
  regler(heure) {
    this.heure = heure;
    const t = (heure - 6) / 14.5;
    const elevation = Math.sin(Math.PI * t) * 58 - 2;
    const azimut = 100 + t * 160;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimut);
    this.directionSoleil.setFromSphericalCoords(1, phi, theta);
    this.directionSoleil.z = -this.directionSoleil.z;
    for (const ciel of [this.ciel, this.cielEnv]) ciel.material.uniforms.sunPosition.value.copy(this.directionSoleil);

    const jour = THREE.MathUtils.smoothstep(elevation, -6, 10);
    const doree = 1 - THREE.MathUtils.smoothstep(elevation, 3, 24);
    this.jour = jour; this.doree = doree;
    this.couleurSoleil.setRGB(1, 0.95 - doree * 0.27, 0.86 - doree * 0.45);
    this.ombres.direction(elevation > 1 ? this.directionSoleil : new THREE.Vector3(-0.4, 1, 0.3).normalize());
    this.ombres.intensite(3.1 * jour + 0.0001, this.couleurSoleil);
    this.lune.intensity = (1 - jour) * 0.35;
    this.hemi.intensity = 0.12 + 0.78 * jour;
    this.hemi.color.setRGB(0.42 + 0.33 * jour, 0.5 + 0.33 * jour, 0.7 + 0.2 * jour);
    this.hemi.groundColor.setRGB(0.2 + 0.15 * jour, 0.17 + 0.12 * jour, 0.13 + 0.07 * jour);
    this.matEtoiles.opacity = Math.max(0, 1 - jour * 1.6);

    const brume = new THREE.Color().setRGB(0.78, 0.83, 0.86)
      .lerp(new THREE.Color(0.93, 0.72, 0.52), doree * 0.65)
      .multiplyScalar(0.06 + 0.94 * jour);
    this.scene.fog.color.copy(brume);
    this.renderer.toneMappingExposure = 0.5 + 0.28 * jour;

    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.sceneCiel, 0, 1, 2000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.12 + 0.38 * jour;
  }

  suivre(cible) {
    this.ombres.suivre?.(cible);
    this.etoiles.position.copy(cible);
  }
}
