// main.js — point d'entrée du jeu : chargement, choix du personnage, boucle, interface, cinématiques, son.
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
import { Rendu, QUALITES, lireQualite, ecrireQualite, qualiteInferieure } from './rendu.js';
import { Herbe } from './herbe.js';
import { Nuages } from './nuages.js';
import { Habitants } from './habitants.js';
import { Cinematique } from './cinematique.js';
import { PaysageSonore, prechargerSons, surfaceSous } from './audio.js';
import { hauteurSol } from './relief.js';

const $ = (id) => document.getElementById(id);
const CLE_DECOUVERTES = 'corent-lieux-decouverts';
const CLE_NARRATION = 'corent-narration';
const CLE_REPLI = 'corent-repli-qualite';

const etat = { enJeu: false, panneau: null, carte: false, aide: true, lieuProche: null, cinema: false };

function lire(cle, defaut) { try { const v = localStorage.getItem(cle); return v === null ? defaut : v; } catch { return defaut; } }
function ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch { /* stockage indisponible */ } }
function lireDecouvertes() { try { return new Set(JSON.parse(lire(CLE_DECOUVERTES, '[]'))); } catch { return new Set(); } }

async function etape(texte, pourcent, travail) {
  $('chargement-etape').textContent = texte;
  $('chargement-barre').style.transform = `scaleX(${pourcent / 100})`;
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));
  return travail();
}

let rendu, renderer, scene, camera, ambiance, joueur, personnage, poi, fumees, carte, monde, textures;
let herbe, nuages, habitants, vegetation, cinema;
const decouverts = lireDecouvertes();
const son = new PaysageSonore();
const nomQualite = lireQualite();

async function charger() {
  prechargerSons();     // la synthèse des sons démarre en parallèle
  rendu = new Rendu($('scene'), nomQualite);
  renderer = rendu.renderer;
  const q = rendu.q;
  rendu.surErreurShader = () => {
    // un shader refusé par la carte graphique : on redescend d'un cran de qualité, une seule fois par session
    const plus_bas = qualiteInferieure(nomQualite);
    let deja = false;
    try { deja = sessionStorage.getItem(CLE_REPLI) === nomQualite; sessionStorage.setItem(CLE_REPLI, nomQualite); } catch { /* rien */ }
    if (plus_bas && !deja) { ecrireQualite(plus_bas); location.reload(); }
  };

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 14000);
  const ombres = rendu.creerOmbres(scene, camera);

  textures = await etape('Préparation des enduits, du chaume et des bardeaux', 6, () => creerTextures(renderer));
  const materiaux = creerMateriaux(textures);
  await etape('Modelage du plateau et de la plaine', 18, () => scene.add(creerTerrain(textures).groupe));
  monde = await etape('Construction du sanctuaire, de la place et des maisons', 34, () => creerVillage(materiaux));
  scene.add(monde.groupe);
  vegetation = await etape('Plantation des chênes, des hêtres et des haies', 50, () => creerVegetation(monde.collisions, monde.depart, textures, rendu));
  scene.add(vegetation.groupe);
  herbe = await etape('Semis de l’herbe', 60, () => new Herbe(scene, monde.collisions, q.herbe));
  rendu.masquesAO.push(herbe.maillage);
  ambiance = await etape('Lever du soleil sur la Limagne', 68, () => new Ambiance(scene, renderer, ombres));
  nuages = new Nuages(scene);
  rendu.masquesAO.push(nuages.maillage, ambiance.etoiles);
  habitants = await etape('Les habitants sortent de chez eux', 76, () => new Habitants(scene, renderer, monde, rendu, nomQualite === 'basse' ? 10 : 18));
  await etape('Pose des balises de visite', 84, () => {
    poi = new PointsInteret(scene, monde.reperes, decouverts);
    fumees = new Fumees(scene, monde.foyers, textures.fumee);
    rendu.masquesAO.push(fumees.points);
    carte = new Carte(monde.lots, poi.lieux);
    cinema = new Cinematique(camera, {
      racine: $('cinema'), titre: $('cinema-titre'), epoque: $('cinema-epoque'),
      sousTitre: $('cinema-sous-titre'), progression: $('cinema-progression'),
    });
    cinema.narration = lire(CLE_NARRATION, 'non') === 'oui';
  });
  await etape('Réglage des ombres et de la lumière', 92, () => {
    rendu.preparerScene(scene);
    rendu.creerPostTraitement(scene, camera);
    camera.position.set(monde.depart.x - 8, monde.depart.y + 5, monde.depart.z);
    camera.lookAt(monde.depart.x + 30, monde.depart.y + 2, monde.depart.z);
  });
  await etape('Compilation des matériaux', 97, () => renderer.compile(scene, camera));
  await etape('Composition des sons de la ville', 99, () => Promise.race([prechargerSons(), new Promise((r) => setTimeout(r, 4000))]));

  initialiserReglages();
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
  rendu.preparerScene(personnage.racine);
  joueur = new Joueur(camera, personnage, monde);
  joueur.placer(monde.depart, Math.PI / 2);
  joueur.actif = true;
  joueur.sensibilite = parseFloat($('reglage-sensibilite').value) / 10000;
  $('hud-nom').textContent = `${def.nom} · ${def.role}`;
  $('choix').hidden = true;
  $('hud').hidden = false;
  etat.enJeu = true;
  son.demarrer().then(() => majBoutonSon());
  verrouiller();
}

// ---------- pointeur et pause ----------
function verrouiller() {
  try { const r = $('scene').requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch { /* indisponible */ }
}

document.addEventListener('pointerlockchange', () => {
  const verrouille = document.pointerLockElement === $('scene');
  if (!etat.enJeu) return;
  if (!verrouille && !etat.panneau && !etat.cinema) ouvrirPause();
  if (verrouille) $('pause').hidden = true;
});

function ouvrirPause() { $('pause').hidden = false; $('pause-reprendre').focus(); }

$('pause-reprendre').addEventListener('click', () => { $('pause').hidden = true; verrouiller(); });
$('scene').addEventListener('click', () => { if (etat.enJeu && !etat.panneau && !etat.cinema) verrouiller(); });

function initialiserReglages() {
  const q = $('reglage-qualite');
  q.replaceChildren(...Object.entries(QUALITES).map(([cle, v]) => {
    const o = document.createElement('option'); o.value = cle; o.textContent = v.nom; o.selected = cle === nomQualite; return o;
  }));
  q.addEventListener('change', () => { ecrireQualite(q.value); $('reglage-qualite-note').hidden = false; });
  $('reglage-qualite-appliquer').addEventListener('click', () => location.reload());
  $('reglage-volume').value = String(Math.round(son.volume * 100));
  $('reglage-narration').checked = cinema.narration;
}

$('reglage-heure').addEventListener('input', (e) => {
  const h = parseFloat(e.target.value);
  $('reglage-heure-valeur').textContent = `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  ambiance?.regler(h);
});
$('reglage-sensibilite').addEventListener('input', (e) => { if (joueur) joueur.sensibilite = parseFloat(e.target.value) / 10000; });
$('reglage-volume').addEventListener('input', (e) => son.regler(parseFloat(e.target.value) / 100));
$('reglage-narration').addEventListener('change', (e) => { cinema.narration = e.target.checked; ecrire(CLE_NARRATION, e.target.checked ? 'oui' : 'non'); });
$('reglage-vue').addEventListener('click', () => basculerVue());
$('reglage-reinit').addEventListener('click', () => {
  decouverts.clear();
  ecrire(CLE_DECOUVERTES, '[]');
  poi.actualiserCouleurs();
  majCompteur();
  $('reglage-reinit').textContent = 'Visite remise à zéro';
});
$('hud-son').addEventListener('click', () => { son.basculerCoupure(); majBoutonSon(); });

function majBoutonSon() {
  $('hud-son').textContent = son.coupe ? 'Son coupé · N' : 'Son · N';
  $('hud-son').setAttribute('aria-pressed', son.coupe ? 'true' : 'false');
}

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === $('scene') && joueur && !etat.cinema) joueur.regarder(e.movementX, e.movementY);
});
document.addEventListener('wheel', (e) => { if (joueur && etat.enJeu && !etat.cinema) joueur.zoomer(e.deltaY); }, { passive: true });

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
  if (etat.cinema) {
    if (!e.repeat && ['KeyE', 'Space', 'Escape', 'Enter'].includes(e.code)) cinema.passer();
    return;
  }
  joueur.touches.add(e.code);
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE':
      if (etat.panneau) fermerPanneau();
      else if (etat.lieuProche) lancerCinematique(etat.lieuProche);
      break;
    case 'KeyR':
      if (etat.panneau) { const l = etat.panneau; fermerPanneau(false); lancerCinematique(l); }
      break;
    case 'KeyV': basculerVue(); break;
    case 'KeyM': basculerCarte(); break;
    case 'KeyN': son.basculerCoupure(); majBoutonSon(); toast(son.coupe ? 'Son coupé' : 'Son rétabli'); break;
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

// ---------- cinématiques ----------
function lancerCinematique(lieu) {
  etat.cinema = true;
  joueur.actif = false;
  joueur.touches.clear();
  $('invite').hidden = true;
  $('hud').classList.add('masque');
  if (etat.carte) basculerCarte();
  son.attenuer(cinema.narration);
  cinema.lancer(lieu, {
    surFin: (l) => {
      etat.cinema = false;
      $('hud').classList.remove('masque');
      son.attenuer(false);
      joueur.camPos.copy(camera.position);   // la caméra de jeu repart en douceur depuis la fin du plan
      ouvrirPanneau(l);
    },
  });
}
$('cinema-passer').addEventListener('click', () => cinema.passer());

// ---------- panneau des lieux ----------
function ouvrirPanneau(lieu) {
  etat.panneau = lieu;
  const nouveau = !decouverts.has(lieu.id);
  decouverts.add(lieu.id);
  ecrire(CLE_DECOUVERTES, JSON.stringify([...decouverts]));
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
$('panneau-revoir').addEventListener('click', () => { const l = etat.panneau; fermerPanneau(false); lancerCinematique(l); });

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
const ecoute = { position: new THREE.Vector3(), avant: new THREE.Vector3(), haut: new THREE.Vector3() };
const tmpQ = new THREE.Quaternion();

function boucle() {
  const maintenant = performance.now();
  const dt = Math.min(0.05, (maintenant - precedent) / 1000);
  precedent = maintenant;
  const temps = maintenant / 1000;
  image++;

  let centre = monde.depart;
  let pas = false, surface = 'herbe', course = false;
  if (etat.enJeu && joueur) {
    const v = joueur.maj(dt);
    habitants.repousser(joueur.pos);
    personnage.animer(dt, v, joueur.auSol, temps);
    pas = personnage.pas;
    course = v > 4;
    const surEstrade = monde.collisions.dessus(joueur.pos.x, joueur.pos.z, joueur.pos.y) > hauteurSol(joueur.pos.x, joueur.pos.z) + 0.1;
    surface = surfaceSous(joueur.pos.x, joueur.pos.z, surEstrade);
    if (etat.cinema) cinema.maj(dt);
    else joueur.majCamera(dt);
    centre = joueur.pos;

    const proche = poi.maj(joueur.pos, temps);
    if (proche !== etat.lieuProche) etat.lieuProche = proche;
    const afficher = !!proche && !etat.panneau && !etat.cinema;
    if (afficher) $('invite-titre').textContent = proche.titre;
    if ($('invite').hidden === afficher) $('invite').hidden = !afficher;

    const cap = (THREE.MathUtils.radToDeg(Math.atan2(Math.sin(joueur.lacet), -Math.cos(joueur.lacet))) + 360) % 360;
    rail.style.transform = `translateX(${-(cap + 360) * 3}px)`;
    if (image % 3 === 0) carte.dessinerMini(joueur.pos, joueur.orientation, decouverts);
    if (etat.carte && image % 6 === 0) carte.dessinerGrande(joueur.pos, joueur.orientation, decouverts);
  } else if (poi) {
    // écran de choix : lent travelling au-dessus de la porte
    const a = temps * 0.05;
    camera.position.set(monde.depart.x - 20 + Math.cos(a) * 6, monde.depart.y + 9, monde.depart.z + Math.sin(a) * 10);
    camera.lookAt(monde.depart.x + 40, monde.depart.y + 3, monde.depart.z);
    poi.maj(monde.depart, temps);
  }

  ambiance.suivre(centre);
  rendu.ombres.maj();
  const vent = son.vent ?? 1;
  herbe.maj(camera.position.distanceTo(centre) < 80 ? camera.position : centre, temps, vent);
  vegetation.temps.value = temps;
  nuages.maj(temps, ambiance, camera.position);
  habitants.maj(dt, temps, etat.enJeu ? joueur?.pos : null);
  fumees?.maj(dt);
  if (image % 120 === 0) rendu.preparerScene(scene);

  if (son.pret) {
    ecoute.position.copy(camera.position);
    camera.getWorldDirection(ecoute.avant);
    ecoute.haut.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(tmpQ));
    son.maj(ecoute, {
      dt, jour: ambiance.jour, joueur: etat.enJeu && joueur ? joueur.pos : camera.position,
      foyers: monde.foyers, frappes: habitants.frappes, animaux: habitants.animaux,
      pas: pas && !etat.cinema, surface, course,
    });
  }
  rendu.rendre();
  surveillerFluidite(dt);
}

/**
 * Mesure la fluidité pendant les 12 premières secondes de jeu. Sous 22 images par seconde,
 * on propose de baisser la qualité d'un cran (le choix est retenu pour les visites suivantes).
 */
const fluidite = { temps: 0, images: 0, fait: false };
function surveillerFluidite(dt) {
  if (fluidite.fait || !etat.enJeu || etat.cinema) return;
  fluidite.temps += dt;
  fluidite.images++;
  if (fluidite.temps < 12) return;
  fluidite.fait = true;
  const ips = fluidite.images / fluidite.temps;
  const plusBas = qualiteInferieure(nomQualite);
  if (ips < 22 && plusBas) {
    ecrireQualite(plusBas);
    $('alerte-qualite-texte').textContent = `La visite tourne à ${Math.round(ips)} images par seconde. La qualité « ${QUALITES[plusBas].nom.toLowerCase()} » sera plus fluide.`;
    $('alerte-qualite').hidden = false;
  }
}
$('alerte-qualite-appliquer').addEventListener('click', () => location.reload());
$('alerte-qualite-fermer').addEventListener('click', () => { ecrireQualite(nomQualite); $('alerte-qualite').hidden = true; });

window.addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  rendu.redimensionner();
  if (etat.carte) dimensionnerCarte();
});

// accès de débogage, uniquement avec ?debug dans l'adresse
if (new URLSearchParams(location.search).has('debug')) {
  window.__corent = {
    get joueur() { return joueur; }, get poi() { return poi; }, get monde() { return monde; },
    get ambiance() { return ambiance; }, get son() { return son; }, get rendu() { return rendu; },
    get habitants() { return habitants; }, camera: () => camera,
    arreter: () => renderer.setAnimationLoop(null), image: () => { boucle(); return document.getElementById('scene').toDataURL('image/jpeg', 0.85); }, cinema: () => cinema, lancerCinematique: (id) => lancerCinematique(poi.lieux.find((l) => l.id === id)),
  };
}

preparerChoix();
charger().catch((err) => {
  console.error(err);
  $('chargement-etape').textContent = 'Le chargement a échoué. Essayez la qualité basse ou vérifiez que votre navigateur prend en charge WebGL 2, puis rechargez la page.';
  $('chargement').classList.add('erreur');
  $('chargement-basse').hidden = false;
});
$('chargement-basse').addEventListener('click', () => { ecrireQualite('basse'); location.reload(); });
