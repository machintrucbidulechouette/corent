// joueur.js : déplacements, collisions et caméras (1re et 3e personne).
// Les touches sont lues par position physique (event.code) : ZQSD sur AZERTY = WASD sur QWERTY.
import * as THREE from 'three';
import { hauteurSol } from './relief.js';

const MARCHE = 2.7, COURSE = 6.2, SAUT = 5.4, GRAVITE = 18, RAYON = 0.32;
const YEUX = 1.6;

export class Joueur {
  constructor(camera, personnage, monde) {
    this.camera = camera;
    this.personnage = personnage;
    this.monde = monde;             // { collisions, limite }
    this.pos = new THREE.Vector3();
    this.vy = 0;
    this.auSol = true;
    this.lacet = 0;                 // rotation horizontale de la caméra
    this.tangage = -0.18;           // inclinaison verticale
    this.mode = '3e';
    this.distance = 4.6;
    this.touches = new Set();
    this.vitesse = 0;
    this.orientation = 0;           // direction du corps
    this.camPos = new THREE.Vector3();
    this.sensibilite = 0.0022;
    this.actif = false;
  }

  placer(v, regard = 0) {
    this.pos.copy(v);
    this.lacet = regard;
    this.orientation = regard;
    this.camPos.set(v.x - Math.sin(regard) * 5, v.y + 3, v.z - Math.cos(regard) * 5);
  }

  basculerVue() {
    this.mode = this.mode === '3e' ? '1re' : '3e';
    this.personnage.racine.visible = this.mode === '3e';
    return this.mode;
  }

  regarder(dx, dy) {
    this.lacet -= dx * this.sensibilite;
    this.tangage -= dy * this.sensibilite;
    const max = this.mode === '1re' ? 1.45 : 1.2;
    this.tangage = Math.max(-max, Math.min(this.mode === '1re' ? 1.45 : 0.55, this.tangage));
  }

  zoomer(delta) {
    if (this.mode !== '3e') return;
    this.distance = Math.max(2, Math.min(12, this.distance + delta * 0.004));
  }

  /** Hauteur sur laquelle les pieds reposent : sol naturel ou dessus d'un gradin. */
  sol(x, z, piedY) {
    return Math.max(hauteurSol(x, z), this.monde.collisions.dessus(x, z, piedY));
  }

  maj(dt) {
    const t = this.touches;
    let avant = 0, cote = 0;
    if (this.actif) {
      if (t.has('KeyW') || t.has('ArrowUp')) avant += 1;
      if (t.has('KeyS') || t.has('ArrowDown')) avant -= 1;
      if (t.has('KeyA') || t.has('ArrowLeft')) cote -= 1;
      if (t.has('KeyD') || t.has('ArrowRight')) cote += 1;
    }
    const court = t.has('ShiftLeft') || t.has('ShiftRight');
    const cible = (avant || cote) ? (court ? COURSE : MARCHE) : 0;
    // la caméra regarde vers +z quand lacet = 0
    const fx = Math.sin(this.lacet), fz = Math.cos(this.lacet);
    let dx = fx * avant - fz * cote;
    let dz = fz * avant + fx * cote;
    const n = Math.hypot(dx, dz);
    if (n > 0) { dx /= n; dz /= n; }

    this.vitesse += (cible - this.vitesse) * Math.min(1, dt * (cible > this.vitesse ? 8 : 10));
    const ancien = this.pos.clone();
    if (n > 0) {
      this.pos.x += dx * this.vitesse * dt;
      this.pos.z += dz * this.vitesse * dt;
      const voulue = Math.atan2(dx, dz);
      let ecart = voulue - this.orientation;
      ecart = Math.atan2(Math.sin(ecart), Math.cos(ecart));
      this.orientation += ecart * Math.min(1, dt * 10);
    } else if (this.mode === '1re') {
      this.orientation = this.lacet;
    }
    if (this.mode === '1re') this.orientation = this.lacet;

    // obstacles et bord du plateau
    this.monde.collisions.resoudre(this.pos, RAYON, this.pos.y);
    if (this.monde.limite(this.pos.x, this.pos.z)) { this.pos.x = ancien.x; this.pos.z = ancien.z; }

    // gravité et saut
    if (this.actif && t.has('Space') && this.auSol) { this.vy = SAUT; this.auSol = false; }
    this.vy -= GRAVITE * dt;
    this.pos.y += this.vy * dt;
    const sol = this.sol(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= sol) {
      // petites marches gravies sans saut
      this.pos.y = this.auSol && sol - this.pos.y < 0.6 ? THREE.MathUtils.lerp(this.pos.y, sol, Math.min(1, dt * 18)) : sol;
      if (this.pos.y < sol) this.pos.y = sol;
      this.vy = 0;
      this.auSol = true;
    } else if (this.pos.y - sol > 0.25) {
      this.auSol = false;
    } else if (this.vy <= 0) {
      this.pos.y = sol; this.vy = 0; this.auSol = true;   // collé au sol dans les descentes
    }

    const vh = Math.hypot(this.pos.x - ancien.x, this.pos.z - ancien.z) / Math.max(dt, 1e-4);
    this.personnage.racine.position.copy(this.pos);
    this.personnage.racine.rotation.y = this.orientation;
    return vh;
  }

  majCamera(dt) {
    const cible = new THREE.Vector3(this.pos.x, this.pos.y + YEUX, this.pos.z);
    const dir = new THREE.Vector3(
      Math.sin(this.lacet) * Math.cos(this.tangage),
      Math.sin(this.tangage),
      Math.cos(this.lacet) * Math.cos(this.tangage));
    if (this.mode === '1re') {
      this.camPos.copy(cible).addScaledVector(dir, 0.12);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(cible.clone().addScaledVector(dir, 10));
      return;
    }
    const tete = cible.clone().add(new THREE.Vector3(0, 0.15, 0));
    const voulue = tete.clone().addScaledVector(dir, -this.distance);
    // épaule droite légèrement décalée pour dégager la vue
    voulue.x += Math.cos(this.lacet) * -0.45;
    voulue.z += -Math.sin(this.lacet) * -0.45;
    const solCam = hauteurSol(voulue.x, voulue.z) + 0.4;
    if (voulue.y < solCam) voulue.y = solCam;
    this.camPos.lerp(voulue, 1 - Math.exp(-dt * 14));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(tete.x + dir.x * 4, tete.y + dir.y * 4, tete.z + dir.z * 4);
  }
}
