# Corent 3D — v2

Visite interactive en 3D de l'oppidum de Corent (Puy-de-Dôme), ville gauloise des Arvernes, vers 80 av. J.-C.
Le joueur incarne un habitant et se promène dans la ville : sanctuaire, hémicycle d'assemblée, place publique,
quartiers d'habitation et d'artisans, rempart. Onze lieux sont présentés par une courte séquence filmée.

Site statique en HTML, CSS et JavaScript (modules ES), avec [Three.js](https://threejs.org/) r184 chargé depuis jsDelivr.
Aucun outil de compilation. Tout est généré en code au chargement : relief, bâtiments, textures, personnages, animaux et sons.

## Nouveautés de la v2

**Rendu**
- Matériaux à relief : chaque texture peinte reçoit une carte de normales et une carte de rugosité calculées automatiquement.
- Occlusion ambiante (GTAO), léger halo (bloom), anti-crénelage SMAA.
- Ombres en cascades (CSM) : nettes près du joueur, présentes jusqu'à plusieurs centaines de mètres.
- Sol mélangé herbe / terre / roche dans le shader, sans répétition visible.
- Herbe dense calculée sur la carte graphique, qui ondule au vent.
- Arbres à feuillage en cartes de feuilles, animés par le vent. Nuages qui défilent, étoiles la nuit.
- Trois niveaux de qualité (basse, moyenne, haute) dans le menu pause. Si la carte graphique refuse un shader, le jeu redescend seul d'un cran.

**Vie**
- Une vingtaine d'habitants circulent dans les rues et s'écartent ou se tournent vers le joueur.
- Des forgerons frappent l'enclume, des marchands haranguent sur la place.
- Porcs, moutons et bœufs dans les enclos, porcs en liberté entre les maisons.

**Cinématiques**
- `E` sur une balise lance un plan de caméra propre au lieu, avec carton-titre et sous-titres.
- `E`, `Espace`, `Entrée`, `Échap` ou le bouton **Passer** l'interrompent. `R` dans le panneau la rejoue.
- Narration vocale facultative (synthèse vocale du navigateur), à activer dans la pause.

**Son**
- Paysage sonore spatialisé, sans musique : vent et rafales, bruissement des feuilles, feux, marteaux sur l'enclume, pas sur gravier, herbe, terre et bois, murmure de la foule sur la place, porcs, moutons, bœufs, chiens, corneilles, passereaux, alouette au-dessus des champs, grillons et chouette la nuit.
- `N` coupe et rétablit le son. Le volume se règle dans la pause.

**Contenu**
- L'hémicycle d'assemblée est ramené à environ 13 m de diamètre et cinq rangées de gradins, d'après le dépliant du site.
- Le sanctuaire mesure environ 50 m de côté et porte des trophées d'armes.

## Lancer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Les modules ES ne fonctionnent pas en ouvrant les fichiers directement (`file://`).

## Publier sur GitHub Pages

Pousser le contenu du dossier à la racine du dépôt, puis dans *Settings → Pages* choisir la branche `main` et le dossier `/ (root)`. Le fichier `.nojekyll` est déjà présent.

## Commandes

| Action | Touche |
| --- | --- |
| Marcher | `Z` `Q` `S` `D` (ou `W` `A` `S` `D`, ou flèches) |
| Regarder | souris (cliquer dans la scène pour capturer le pointeur) |
| Courir | `Maj` |
| Sauter | `Espace` |
| Voir un lieu (cinématique) | `E` près d'un anneau de bronze |
| Passer la cinématique | `E`, `Espace`, `Entrée` ou `Échap` |
| Revoir la cinématique | `R` dans le panneau du lieu |
| Vue 1re / 3e personne | `V` |
| Plan de la ville | `M` |
| Couper le son | `N` |
| Recul de la caméra | molette |
| Masquer l'aide | `H` |
| Pause et réglages | `Échap` |

## Son : remplacer la synthèse par de vrais enregistrements

Tous les sons sont synthétisés au chargement, ce qui évite tout fichier à télécharger. Pour plus de réalisme, vous pouvez fournir vos propres enregistrements, son par son :

1. Déposez les fichiers (`.ogg`, `.mp3` ou `.wav`) dans le dossier `audio/`.
2. Déclarez-les dans `audio/sons.json`, par exemple :

```json
{
  "vent": "vent.ogg",
  "foule": "foule.ogg",
  "feu": "feu.ogg",
  "enclume": ["enclume-1.ogg", "enclume-2.ogg", "enclume-3.ogg"],
  "cochon": ["cochon-1.ogg", "cochon-2.ogg"],
  "pas-gravier": ["pas-gravier-1.ogg", "pas-gravier-2.ogg"]
}
```

- **Boucles** (un seul fichier, joué en continu) : `vent`, `feu`, `foule`, `alouette`, `grillons`.
- **Sons ponctuels** (liste de variantes, tirées au hasard) : `enclume`, `cochon`, `mouton`, `boeuf`, `chien`, `corneille`, `passereau`, `chouette`, `pas-gravier`, `pas-herbe`, `pas-terre`, `pas-bois`.
- Tout son absent de la liste reste synthétisé. Les clés qui commencent par `_` sont ignorées.

Où trouver des enregistrements libres de droits (vérifiez la licence de chaque fichier, CC0 de préférence) :
[Freesound](https://freesound.org) (filtre « Creative Commons 0 »), [Sonniss GDC bundles](https://sonniss.com/gameaudiogdc), [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk) (licence RemArc, usage non commercial).
Cherchez par exemple *forge anvil hammer*, *pig grunt farm*, *sheep bleat*, *crowd murmur distant*, *skylark*, *crickets night field*, *wood fire crackle*, *footsteps gravel*.
Évitez les ambiances qui contiennent des bruits modernes (moteurs, cloches, avions).

## Structure

```
index.html  jeu.html  a-propos.html
audio/sons.json      enregistrements facultatifs
css/                 commun.css, site.css, jeu.css
js/
  main.js            point d'entrée : chargement, boucle, interface
  rendu.js           post-traitement, ombres en cascades, qualité, replis
  textures.js        textures peintes en canvas + cartes de normales et de rugosité
  materiaux.js       matériaux PBR partagés
  terrain.js         sol du plateau (mélange dans le shader) et paysage lointain
  herbe.js           herbe calculée sur la carte graphique
  vegetation.js      arbres en cartes de feuilles, animés par le vent
  nuages.js          couche de nuages
  ambiance.js        ciel, soleil, lune, étoiles, brouillard, heure du jour
  relief.js  plan.js  geometrie.js  batiments.js  monuments.js  village.js  collisions.js
  personnage.js      habitants modelés en code et leur animation
  habitants.js       passants, forgerons, marchands, animaux
  joueur.js          déplacements et caméras
  cinematique.js     plans de caméra par lieu, sous-titres
  sons.js            recettes de synthèse sonore (rendu hors temps réel)
  audio.js           paysage sonore spatialisé, chargement des enregistrements
  poi.js  donnees.js carte.js  fumee.js  bruit.js
```

## Repères pour modifier

- **Unités** : 1 unité = 1 mètre. `x` vers l'est, `z` vers le sud, `y` vers le haut.
- **Plans des cinématiques** : objet `RECETTES` dans `js/cinematique.js`. Chaque plan liste des points de caméra et des points visés, exprimés autour du sujet du lieu.
- **Textes des lieux** : `js/donnees.js`.
- **Niveaux de qualité** : objet `QUALITES` dans `js/rendu.js`.
- **Débogage** : ajouter `?debug` à l'adresse expose `window.__corent` dans la console.

## Avertissement historique

Le plan général s'inspire des fouilles publiées et des restitutions proposées pour Corent. Le détail des maisons, des couleurs et du rempart est une interprétation. Les sources sont listées sur la page `a-propos.html`.
