// rendu.js — moteur de rendu : post-traitement (occlusion ambiante, halo, anti-crénelage),
// ombres en cascades, niveaux de qualité et replis automatiques en cas de problème de shader.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSM } from 'three/addons/csm/CSM.js';

export const QUALITES = {
  basse: { nom: 'Basse', ratio: 1, post: false, ao: false, cascades: 2, ombre: 1024, herbe: 0.35, portee: 160 },
  moyenne: { nom: 'Moyenne', ratio: 1.25, post: true, ao: false, cascades: 3, ombre: 2048, herbe: 0.65, portee: 300 },
  haute: { nom: 'Haute', ratio: 1.75, post: true, ao: true, cascades: 3, ombre: 2048, herbe: 1, portee: 450 },
};
const ORDRE = ['basse', 'moyenne', 'haute'];
const CLE_QUALITE = 'corent-qualite';

export function lireQualite() {
  try { const q = localStorage.getItem(CLE_QUALITE); if (QUALITES[q]) return q; } catch { /* rien */ }
  return 'moyenne';
}
export function ecrireQualite(q) { try { localStorage.setItem(CLE_QUALITE, q); } catch { /* rien */ } }
export function qualiteInferieure(q) { const i = ORDRE.indexOf(q); return i > 0 ? ORDRE[i - 1] : null; }

// ---------- hooks de shaders composables ----------

/**
 * Ajoute une modification de shader à un matériau. Les modifications s'enchaînent avec
 * celle des ombres en cascades, qui utilise aussi onBeforeCompile.
 */
export function ajouterHook(mat, cle, fn) {
  mat.userData.hooks = mat.userData.hooks || [];
  mat.userData.hooks.push(fn);
  mat.userData.cleShader = (mat.userData.cleShader || '') + '|' + cle;
  recomposer(mat);
}

function recomposer(mat) {
  const csm = mat.userData.hookCSM;
  const hooks = mat.userData.hooks || [];
  if (!csm && !hooks.length) {
    mat.onBeforeCompile = () => {};
    mat.customProgramCacheKey = () => '';
  } else {
    mat.onBeforeCompile = (shader, renderer) => {
      if (csm) csm(shader, renderer);
      for (const h of hooks) h(shader, renderer);
    };
    mat.customProgramCacheKey = () => (csm ? 'csm' : '') + (mat.userData.cleShader || '');
  }
  mat.needsUpdate = true;
}

// ---------- ombres ----------

/** Ombres en cascades : nettes près de la caméra, présentes loin. */
class OmbresCascades {
  constructor(scene, camera, q) {
    this.csm = new CSM({
      camera, parent: scene, cascades: q.cascades, maxFar: q.portee, mode: 'practical',
      shadowMapSize: q.ombre, shadowBias: -0.00025, lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
      lightIntensity: 3, lightNear: 1, lightFar: 1400, lightMargin: 160,
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) l.shadow.normalBias = 0.05;
    this.prepares = new WeakSet();
  }
  preparer(mat) {
    if (this.prepares.has(mat)) return;
    this.prepares.add(mat);
    const precedent = mat.onBeforeCompile;
    this.csm.setupMaterial(mat);
    mat.userData.hookCSM = mat.onBeforeCompile;
    mat.onBeforeCompile = precedent;
    recomposer(mat);
  }
  retirer(mat) {
    if (!this.prepares.has(mat)) return;
    delete mat.defines?.USE_CSM;
    delete mat.defines?.CSM_CASCADES;
    delete mat.defines?.CSM_FADE;
    mat.userData.hookCSM = null;
    recomposer(mat);
  }
  direction(dirVersSoleil) { this.csm.lightDirection.copy(dirVersSoleil).negate(); }
  intensite(i, couleur) { for (const l of this.csm.lights) { l.intensity = i; l.color.copy(couleur); } }
  maj() { this.csm.update(); }
  redimensionner() { this.csm.updateFrustums(); }
  activer(oui) { for (const l of this.csm.lights) l.visible = oui; }
}

/** Repli : une seule lumière directionnelle qui suit le joueur. */
class OmbresSimples {
  constructor(scene, q) {
    this.lumiere = new THREE.DirectionalLight(0xfff1dc, 3);
    this.lumiere.castShadow = true;
    this.lumiere.shadow.mapSize.set(q.ombre * 2, q.ombre * 2);
    const c = this.lumiere.shadow.camera;
    c.left = -60; c.right = 60; c.top = 60; c.bottom = -60; c.near = 1; c.far = 500;
    this.lumiere.shadow.bias = -0.0004;
    this.lumiere.shadow.normalBias = 0.05;
    scene.add(this.lumiere, this.lumiere.target);
    this.dir = new THREE.Vector3(0, 1, 0);
    this.cible = new THREE.Vector3();
  }
  preparer() {}
  retirer() {}
  direction(d) { this.dir.copy(d); }
  intensite(i, couleur) { this.lumiere.intensity = i; this.lumiere.color.copy(couleur); }
  suivre(p) { this.cible.copy(p); }
  maj() {
    this.lumiere.position.copy(this.cible).addScaledVector(this.dir, 220);
    this.lumiere.target.position.copy(this.cible);
  }
  redimensionner() {}
  activer(oui) { this.lumiere.visible = oui; }
}

// ---------- rendu ----------

export class Rendu {
  constructor(canvas, nomQualite) {
    this.nomQualite = nomQualite;
    this.q = QUALITES[nomQualite];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.q.post, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.q.ratio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.erreursShader = 0;
    this.surErreurShader = null;
    this.renderer.debug.onShaderError = (gl, programme, vs, fs) => {
      this.erreursShader++;
      console.warn('Shader refusé par la carte graphique :', gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(programme));
      this.surErreurShader?.(this.erreursShader);
    };
    this.masquesAO = [];
    this.composer = null;
  }

  /** Crée les ombres. Les cascades exigent l'addon CSM : en cas d'échec, on passe aux ombres simples. */
  creerOmbres(scene, camera) {
    try {
      this.ombres = new OmbresCascades(scene, camera, this.q);
      this.ombres.type = 'cascades';
    } catch (e) {
      console.warn('Ombres en cascades indisponibles, repli :', e);
      this.ombres = new OmbresSimples(scene, this.q);
      this.ombres.type = 'simples';
    }
    return this.ombres;
  }

  /** À appeler sur tout matériau standard qui doit recevoir les ombres. */
  preparerScene(objet) {
    objet.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) this.ombres.preparer(m);
    });
  }

  creerPostTraitement(scene, camera) {
    this.scene = scene; this.camera = camera;
    if (!this.q.post) { this.composer = null; return; }
    try {
      const w = window.innerWidth, h = window.innerHeight;
      const composer = new EffectComposer(this.renderer);
      composer.setPixelRatio(this.renderer.getPixelRatio());
      composer.setSize(w, h);
      composer.addPass(new RenderPass(scene, camera));
      if (this.q.ao) {
        const ao = new GTAOPass(scene, camera, w, h);
        ao.updateGtaoMaterial?.({ radius: 1.3, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
        ao.updatePdMaterial?.({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        ao.blendIntensity = 0.9;
        // le feuillage et l'herbe à transparence découpée faussent l'occlusion : on les masque pendant ce calcul
        const rendreAO = ao.render.bind(ao);
        ao.render = (...args) => {
          for (const o of this.masquesAO) { o.userData.visibleAvantAO = o.visible; o.visible = false; }
          rendreAO(...args);
          for (const o of this.masquesAO) o.visible = o.userData.visibleAvantAO;
        };
        composer.addPass(ao);
        this.ao = ao;
      }
      this.halo = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.18, 0.45, 0.92);
      composer.addPass(this.halo);
      composer.addPass(new SMAAPass(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio()));
      composer.addPass(new OutputPass());
      this.composer = composer;
    } catch (e) {
      console.warn('Post-traitement indisponible, rendu direct :', e);
      this.composer = null;
    }
  }

  rendre() {
    if (this.composer) {
      try { this.composer.render(); return; }
      catch (e) { console.warn('Post-traitement désactivé après une erreur :', e); this.composer = null; }
    }
    this.renderer.render(this.scene, this.camera);
  }

  redimensionner() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.ombres?.redimensionner();
  }
}
