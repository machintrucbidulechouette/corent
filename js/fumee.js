// fumee.js : panaches de fumée des forges, des fours et des toits.
import * as THREE from 'three';

const PAR_SOURCE = 16;

export class Fumees {
  constructor(scene, sources, texture) {
    this.sources = sources;
    const n = sources.length * PAR_SOURCE;
    this.positions = new Float32Array(n * 3);
    this.couleurs = new Float32Array(n * 4);
    this.ages = new Float32Array(n);
    this.vies = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.vies[i] = 6 + Math.random() * 5;
      this.ages[i] = Math.random() * this.vies[i];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.couleurs, 4));
    this.materiau = new THREE.PointsMaterial({
      size: 5, map: texture, transparent: true, depthWrite: false,
      vertexColors: true, sizeAttenuation: true, fog: true,
    });
    this.points = new THREE.Points(geo, this.materiau);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.vent = new THREE.Vector2(0.5, -0.25);
  }

  maj(dt, teinte = 1) {
    const p = this.positions, c = this.couleurs;
    for (let s = 0; s < this.sources.length; s++) {
      const src = this.sources[s];
      const force = src.type === 'toit' ? 0.55 : 1;
      for (let k = 0; k < PAR_SOURCE; k++) {
        const i = s * PAR_SOURCE + k;
        this.ages[i] += dt;
        if (this.ages[i] > this.vies[i]) this.ages[i] -= this.vies[i];
        const t = this.ages[i] / this.vies[i];
        const montee = t * 14 * force;
        p[i * 3] = src.pos.x + this.vent.x * t * 9 + Math.sin(i * 1.7 + t * 4) * 0.4;
        p[i * 3 + 1] = src.pos.y + montee;
        p[i * 3 + 2] = src.pos.z + this.vent.y * t * 9 + Math.cos(i * 2.3 + t * 3) * 0.4;
        const gris = (0.55 + t * 0.3) * teinte;
        c[i * 4] = gris; c[i * 4 + 1] = gris * 0.98; c[i * 4 + 2] = gris * 0.95;
        c[i * 4 + 3] = Math.sin(Math.PI * Math.min(1, t * 1.4)) * 0.5 * force;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
