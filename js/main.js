// main.js — point d'entrée du jeu : chargement, choix du personnage, boucle de rendu, interface.
import * as THREE from 'three';
import { creerTextures } from './textures.js';
import { creerMateriaux } from './materiaux.js';
import { creerTerrain } from './terrain.js';
import { creerVillage } from './village.js';
import { creerVegetation } from './vegetation.js';
import { Ambiance } from './ambiance.js';
import { Personnage, PERSONNAGES } from './personnage.js';
import { Joueur } from './joueur.js';
import { PointsInteret } from './poi.js';
import { Fumees } from './fumee.js';
import { Carte } from './carte.js';

const $ = (id) => document.getElementById(id);
const CLE_DECOUVERTES = 'corent-lieux-decouverts';

// ---------- état de l'interface ----------
const etat = {
  enJeu: false,
  panneau: null,      // lieu affiché
  carte: false,
  aide: true,
  lieuProche: null,
};

function lireDecouvertes() {
  try { return new Set(JSON.parse(localStorage.getItem(CLE_DECOUVERTES) || '[]')); }
  catch { return new Set(); }
}
function ecrireDecouvertes(set) {
  try { localStorage.setItem(CLE_DECOUVERTES, JSON.stringify([...set])); } catch { /* stockage indisponible */ }
}

async function etape(texte, pourcent, travail) {
  $('chargement-etape').textContent = texte;
  $('chargement-barre').style.transform = `scaleX(${pourcent / 100})`;
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));
  return travail();
}

// ---------- démarrage ----------
let renderer, scene, camera, ambiance, joueur, personnage, poi, fumees, carte, monde, textures;
const decouverts = lireDecouvertes();

async function charger() {
  const canvas = $('scene');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 14000);

  textures = await etape('Préparation des enduits, du chaume et des bardeaux', 8, () => creerTextures(renderer));
  const materiaux = creerMateriaux(textures);
  await etape('Modelage du plateau et de la plaine', 22, () => scene.add(creerTerrain(textures)));
  monde = await etape('Construction du sanctuaire, de la place et des maisons', 45, () => creerVillage(materiaux));
  scene.add(monde.groupe);
  await etape('Plantation des arbres et des herbes', 70, () => scene.add(creerVegetation(monde.collisions, monde.depart)));
  ambiance = await etape('Lever du soleil sur la Limagne', 82, () => new Ambiance(scene, renderer));
  await etape('Pose des balises de visite', 90, () => {
    poi = new PointsInteret(scene, monde.reperes, decouverts);
    fumees = new Fumees(scene, monde.foyers, textures.fumee);
    carte = new Carte(monde.lots, poi.lieux);
  });
  await etape('Compilation des matériaux', 97, () => {
    camera.position.set(monde.depart.x - 8, monde.depart.y + 5, monde.depart.z);
    camera.lookAt(monde.depart.x + 30, monde.depart.y + 2, monde.depart.z);
    renderer.compile(scene, camera);
  });

  majCompteur();
  $('chargement').hidden = true;
  $('choix').hidden = false;
  renderer.setAnimationLoop(boucle);
}

// ---------- choix du personnage ----------
function preparerChoix() {
  const liste = $('choix-liste');
  PERSONNAGES.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carte-perso';
    b.id = `perso-${p.id}`;
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.innerHTML = `
      <span class="perso-etoffe" style="--c1:${p.tunique[0]};--c2:${p.tunique[1]};--c3:${(p.manteau || p.tunique)[0]}"></span>
      <span class="perso-nom">${p.nom}</span>
      <span class="perso-role">${p.role}</span>
      <span class="perso-resume">${p.resume}</span>`;
    b.addEventListener('click', () => {
      liste.querySelectorAll('.carte-perso').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    });
    liste.appendChild(b);
  });
  $('choix-entrer').addEventListener('click', entrer);
}

function entrer() {
  const choisi = $('choix-liste').querySelector('[aria-pressed="true"]');
  const def = PERSONNAGES.find((p) => `perso-${p.id}` === choisi.id) || PERSONNAGES[0];
  personnage = new Personnage(def, renderer);
  scene.add(personnage.racine);
  joueur = new Joueur(camera, personnage, monde);
  joueur.placer(monde.depart, Math.PI / 2);   // regard vers l'est, la ville
  joueur.actif = true;
  $('hud-nom').textContent = `${def.nom} · ${def.role}`;
  $('choix').hidden = true;
  $('hud').hidden = false;
  etat.enJeu = true;
  verrouiller();
}

// ---------- pointeur et pause ----------
function verrouiller() {
  const c = $('scene');
  try {
    const r = c.requestPointerLock?.();
    if (r && r.catch) r.catch(() => {});
  } catch { /* pointeur non disponible */ }
}

document.addEventListener('pointerlockchange', () => {
  const verrouille = document.pointerLockElement === $('scene');
  if (!etat.enJeu) return;
  if (!verrouille && !etat.panneau) ouvrirPause();
  if (verrouille) $('pause').hidden = true;
});

function ouvrirPause() {
  $('pause').hidden = false;
  $('pause-reprendre').focus();
}

$('pause-reprendre').addEventListener('click', () => { $('pause').hidden = true; verrouiller(); });
$('scene').addEventListener('click', () => { if (etat.enJeu && !etat.panneau) verrouiller(); });
$('reglage-heure').addEventListener('input', (e) => {
  const h = parseFloat(e.target.value);
  $('reglage-heure-valeur').textContent = `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  ambiance?.regler(h);
});
$('reglage-ombres').addEventListener('change', (e) => {
  renderer.shadowMap.enabled = e.target.checked;
  scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
});
$('reglage-sensibilite').addEventListener('input', (e) => { if (joueur) joueur.sensibilite = parseFloat(e.target.value) / 10000; });
$('reglage-vue').addEventListener('click', () => basculerVue());
$('reglage-reinit').addEventListener('click', () => {
  decouverts.clear();
  ecrireDecouvertes(decouverts);
  poi.actualiserCouleurs();
  majCompteur();
  $('reglage-reinit').textContent = 'Visite remise à zéro';
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === $('scene') && joueur) joueur.regarder(e.movementX, e.movementY);
});
document.addEventListener('wheel', (e) => { if (joueur && etat.enJeu) joueur.zoomer(e.deltaY); }, { passive: true });

function basculerVue() {
  if (!joueur) return;
  const mode = joueur.basculerVue();
  $('reglage-vue').textContent = mode === '3e' ? 'Passer en vue subjective' : 'Passer en vue à la 3e personne';
  toast(mode === '3e' ? 'Vue à la 3e personne' : 'Vue subjective');
}

// ---------- clavier ----------
document.addEventListener('keydown', (e) => {
  if (!etat.enJeu) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  joueur.touches.add(e.code);
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE':
      if (etat.panneau) fermerPanneau();
      else if (etat.lieuProche) ouvrirPanneau(etat.lieuProche);
      break;
    case 'KeyV': basculerVue(); break;
    case 'KeyM': basculerCarte(); break;
    case 'KeyH':
      etat.aide = !etat.aide;
      $('hud-aide').hidden = !etat.aide;
      break;
    case 'Escape':
      if (etat.panneau) fermerPanneau(false);
      if (etat.carte) basculerCarte();
      break;
  }
});
document.addEventListener('keyup', (e) => joueur?.touches.delete(e.code));
window.addEventListener('blur', () => joueur?.touches.clear());

// ---------- panneau des lieux ----------
function ouvrirPanneau(lieu) {
  etat.panneau = lieu;
  const nouveau = !decouverts.has(lieu.id);
  decouverts.add(lieu.id);
  ecrireDecouvertes(decouverts);
  poi.actualiserCouleurs();
  majCompteur();
  $('panneau-epoque').textContent = lieu.epoque;
  $('panneau-titre').textContent = lieu.titre;
  $('panneau-texte').replaceChildren(...lieu.texte.map((t) => { const p = document.createElement('p'); p.textContent = t; return p; }));
  $('panneau-observer').textContent = lieu.observer;
  $('panneau').hidden = false;
  $('invite').hidden = true;
  joueur.actif = false;
  joueur.touches.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $('panneau-fermer').focus();
  if (nouveau && decouverts.size === poi.lieux.length) toast('Vous avez découvert tous les lieux de Corent.');
}

function fermerPanneau(reverrouiller = true) {
  etat.panneau = null;
  $('panneau').hidden = true;
  joueur.actif = true;
  if (reverrouiller) verrouiller();
}
$('panneau-fermer').addEventListener('click', () => fermerPanneau());

function basculerCarte() {
  etat.carte = !etat.carte;
  $('carte-plein').hidden = !etat.carte;
  if (etat.carte) dimensionnerCarte();
}

function dimensionnerCarte() {
  const c = $('grande-carte');
  const r = c.getBoundingClientRect();
  c.width = Math.round(r.width * Math.min(devicePixelRatio, 2));
  c.height = Math.round(r.height * Math.min(devicePixelRatio, 2));
}

function majCompteur() {
  const total = poi ? poi.lieux.length : 0;
  $('hud-compteur').textContent = `${decouverts.size} / ${total}`;
  $('hud-compteur-barre').style.transform = `scaleX(${total ? decouverts.size / total : 0})`;
}

let toastMinuteur;
function toast(texte) {
  const t = $('toast');
  t.textContent = texte;
  t.hidden = false;
  clearTimeout(toastMinuteur);
  toastMinuteur = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- boussole ----------
const rail = $('boussole-rail');
(function construireBoussole() {
  const noms = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
  for (let d = -360; d <= 720; d += 15) {
    const m = document.createElement('span');
    const a = ((d % 360) + 360) % 360;
    m.className = noms[a] ? 'cap cap-nom' : 'cap';
    m.style.left = `${(d + 360) * 3}px`;
    m.textContent = noms[a] || '';
    rail.appendChild(m);
  }
})();

// ---------- boucle ----------
let precedent = performance.now();
let image = 0;
function boucle() {
  const maintenant = performance.now();
  const dt = Math.min(0.05, (maintenant - precedent) / 1000);
  precedent = maintenant;
  const temps = maintenant / 1000;
  image++;

  if (etat.enJeu && joueur) {
    const v = joueur.maj(dt);
    personnage.animer(dt, v, joueur.auSol, temps);
    joueur.majCamera(dt);
    ambiance.suivre(joueur.pos);

    const proche = poi.maj(joueur.pos, temps);
    if (proche !== etat.lieuProche) {
      etat.lieuProche = proche;
      if (proche && !etat.panneau) {
        $('invite-titre').textContent = proche.titre;
        $('invite').hidden = false;
      } else {
        $('invite').hidden = true;
      }
    }

    // cap de la caméra, en degrés depuis le nord
    const cap = (THREE.MathUtils.radToDeg(Math.atan2(Math.sin(joueur.lacet), -Math.cos(joueur.lacet))) + 360) % 360;
    rail.style.transform = `translateX(${-(cap + 360) * 3}px)`;

    if (image % 3 === 0) carte.dessinerMini(joueur.pos, joueur.orientation, decouverts);
    if (etat.carte && image % 6 === 0) carte.dessinerGrande(joueur.pos, joueur.orientation, decouverts);
  } else if (poi) {
    // écran de choix : lent travelling au-dessus de la porte
    const a = temps * 0.05;
    camera.position.set(monde.depart.x - 20 + Math.cos(a) * 6, monde.depart.y + 9, monde.depart.z + Math.sin(a) * 10);
    camera.lookAt(monde.depart.x + 40, monde.depart.y + 3, monde.depart.z);
    ambiance.suivre(monde.depart);
    poi.maj(monde.depart, temps);
  }
  fumees?.maj(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (etat.carte) dimensionnerCarte();
});

preparerChoix();
charger().catch((err) => {
  console.error(err);
  $('chargement-etape').textContent = 'Le chargement a échoué. Vérifiez que votre navigateur prend en charge WebGL 2 puis rechargez la page.';
  $('chargement').classList.add('erreur');
});
