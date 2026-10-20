// ambiance.js — ciel, soleil, brouillard et heure du jour.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class Ambiance {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

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

    this.soleil = new THREE.DirectionalLight(0xfff1dc, 3);
    this.soleil.castShadow = true;
    this.soleil.shadow.mapSize.set(2048, 2048);
    const sc = this.soleil.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
    sc.near = 1; sc.far = 400;
    this.soleil.shadow.bias = -0.0004;
    this.soleil.shadow.normalBias = 0.04;
    scene.add(this.soleil);
    scene.add(this.soleil.target);

    scene.fog = new THREE.Fog(0xc8d4dc, 600, 9500);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sceneCiel = new THREE.Scene();
    this.cielEnv = new Sky();
    this.cielEnv.scale.setScalar(1000);
    this.sceneCiel.add(this.cielEnv);
    this.envRT = null;

    this.directionSoleil = new THREE.Vector3();
    this.heure = 16;
    this.regler(16);
  }

  /** Règle l'heure (6 à 21 h) : position du soleil, couleurs, brouillard, éclairage d'ambiance. */
  regler(heure) {
    this.heure = heure;
    // trajectoire simplifiée : lever à l'est vers 6 h, coucher à l'ouest vers 20 h 30
    const t = (heure - 6) / 14.5;                                   // 0 → 1 pendant le jour
    const elevation = Math.sin(Math.PI * t) * 58 - 2;               // degrés
    const azimut = 100 + t * 160;                                   // de l'est vers l'ouest, par le sud
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimut);
    // azimut mesuré depuis le nord (−z) vers l'est (+x)
    this.directionSoleil.setFromSphericalCoords(1, phi, theta);
    this.directionSoleil.set(this.directionSoleil.x, this.directionSoleil.y, -this.directionSoleil.z);

    for (const ciel of [this.ciel, this.cielEnv]) ciel.material.uniforms.sunPosition.value.copy(this.directionSoleil);

    const jour = THREE.MathUtils.smoothstep(elevation, -4, 12);
    const doree = 1 - THREE.MathUtils.smoothstep(elevation, 4, 26);
    this.soleil.intensity = 3.2 * jour;
    this.soleil.color.setRGB(1, 0.95 - doree * 0.25, 0.86 - doree * 0.42);
    this.hemi.intensity = 0.25 + 0.75 * jour;
    this.hemi.color.setRGB(0.6 + 0.15 * jour, 0.68 + 0.15 * jour, 0.82 + 0.08 * jour);

    const brume = new THREE.Color().setRGB(0.78, 0.83, 0.86)
      .lerp(new THREE.Color(0.93, 0.74, 0.55), doree * 0.6)
      .multiplyScalar(0.18 + 0.82 * jour);
    this.scene.fog.color.copy(brume);
    this.renderer.toneMappingExposure = 0.45 + 0.3 * jour;

    // éclairage d'environnement calculé depuis le ciel
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.sceneCiel, 0, 1, 2000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.35 + 0.25 * jour;
  }

  /** L'ombre suit le joueur pour garder une bonne définition. */
  suivre(cible) {
    this.soleil.position.copy(cible).addScaledVector(this.directionSoleil, 180);
    this.soleil.target.position.copy(cible);
  }
}
