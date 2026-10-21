// nuages.js : couche de cumulus qui défile lentement, éclairée selon la position du soleil.
import * as THREE from 'three';

export class Nuages {
  constructor(scene) {
    this.uniformes = {
      uTemps: { value: 0 },
      uSoleil: { value: new THREE.Vector3(0, 1, 0) },
      uJour: { value: 1 },
      uDoree: { value: 0 },
      uCouverture: { value: 0.48 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniformes,
      transparent: true,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vMonde;
        void main() {
          vec4 m = modelMatrix * vec4(position, 1.0);
          vMonde = m.xyz;
          gl_Position = projectionMatrix * viewMatrix * m;
        }`,
      fragmentShader: `
        uniform float uTemps; uniform vec3 uSoleil; uniform float uJour; uniform float uDoree; uniform float uCouverture;
        varying vec3 vMonde;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float b(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 6; i++) { s += a * b(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
          return s;
        }
        void main() {
          vec2 p = vMonde.xz * 0.00045 + vec2(uTemps * 0.004, uTemps * 0.0016);
          float n = fbm(p);
          float d = smoothstep(uCouverture, uCouverture + 0.22, n);
          // épaisseur apparente : le bord des nuages est plus clair, le cœur plus sombre en dessous
          float coeur = smoothstep(uCouverture + 0.1, uCouverture + 0.45, n);
          vec3 lumiere = mix(vec3(1.0), vec3(1.0, 0.72, 0.5), uDoree);
          vec3 ombre = mix(vec3(0.62, 0.66, 0.72), vec3(0.55, 0.45, 0.45), uDoree);
          vec3 c = mix(lumiere, ombre, coeur * 0.75) * (0.08 + 0.92 * uJour);
          float r = length(vMonde.xz) / 12000.0;
          float alpha = d * 0.92 * (1.0 - smoothstep(0.55, 1.0, r));
          gl_FragColor = vec4(c, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.maillage = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000, 1, 1).rotateX(-Math.PI / 2), mat);
    this.maillage.position.y = 1600;
    this.maillage.frustumCulled = false;
    this.maillage.renderOrder = -1;
    scene.add(this.maillage);
  }

  maj(temps, ambiance, centre) {
    const u = this.uniformes;
    u.uTemps.value = temps;
    u.uSoleil.value.copy(ambiance.directionSoleil);
    u.uJour.value = ambiance.jour;
    u.uDoree.value = ambiance.doree;
    this.maillage.position.x = centre.x;
    this.maillage.position.z = centre.z;
  }
}
