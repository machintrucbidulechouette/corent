# Corent 3D

Visite interactive en 3D de l'oppidum de Corent (Puy-de-Dôme), ville gauloise des Arvernes, vers 80 av. J.-C.
Le joueur incarne un habitant et se promène dans la ville : sanctuaire, édifice à gradins, place publique, quartiers d'habitation et d'artisans, rempart.

Site statique en HTML, CSS et JavaScript (modules ES), avec [Three.js](https://threejs.org/) r184 chargé depuis jsDelivr. Aucun outil de compilation, aucun modèle ni image externe : tout est généré en code au chargement.

## Lancer en local

Les modules ES ne fonctionnent pas en ouvrant les fichiers directement (`file://`). Il faut un petit serveur :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Publier sur GitHub Pages

1. Pousser le contenu de ce dossier à la racine d'un dépôt.
2. Dans *Settings → Pages*, choisir la branche `main` et le dossier `/ (root)`.
3. Le site est servi à `https://<utilisateur>.github.io/<depot>/`.

Le fichier `.nojekyll` désactive le traitement Jekyll de GitHub Pages.

## Commandes

| Action | Touche |
| --- | --- |
| Marcher | `Z` `Q` `S` `D` (ou `W` `A` `S` `D`, ou flèches) |
| Regarder | souris (cliquer dans la scène pour capturer le pointeur) |
| Courir | `Maj` |
| Sauter | `Espace` |
| Découvrir un lieu | `E` près d'un anneau de bronze |
| Vue 1re / 3e personne | `V` |
| Plan de la ville | `M` |
| Recul de la caméra | molette |
| Masquer l'aide | `H` |
| Pause et réglages | `Échap` |

Les lieux découverts sont mémorisés dans le navigateur (`localStorage`).

## Structure

```
index.html        accueil
jeu.html          la visite 3D
a-propos.html     méthode, sources, bibliographie
css/
  commun.css      couleurs, polices, composants partagés
  site.css        pages d'accueil et sources
  jeu.css         interface de jeu (HUD, panneaux, carte, pause)
js/
  main.js         point d'entrée : chargement, choix du personnage, boucle de rendu, interface
  bruit.js        aléatoire déterministe et bruit 2D
  relief.js       forme du plateau, plaine, Gergovie, chaîne des Puys
  plan.js         plan de la ville : monuments, rues, rempart, lots d'habitation
  terrain.js      maillages du sol (plateau détaillé + paysage lointain)
  textures.js     textures peintes en canvas (torchis, bardeaux, chaume, planches…)
  materiaux.js    matériaux partagés
  geometrie.js    primitives à UV métriques, toits, assembleur qui fusionne les maillages
  batiments.js    maisons, greniers, forges, fours, clôtures, amphores
  monuments.js    sanctuaire, édifice à gradins, place, rempart et porte
  village.js      assemblage de la ville
  vegetation.js   arbres, arbustes, herbe (instances)
  collisions.js   obstacles 2D en grille spatiale, gradins praticables
  personnage.js   les trois habitants jouables et leur animation
  joueur.js       déplacements, saut, caméras 1re et 3e personne
  ambiance.js     ciel, soleil, ombres, brouillard, heure du jour
  fumee.js        fumée des foyers
  poi.js          balises des lieux et détection de proximité
  donnees.js      textes des lieux
  carte.js        mini-carte et grande carte
```

## Repères pour modifier

- **Unités** : 1 unité = 1 mètre. `x` vers l'est, `z` vers le sud, `y` vers le haut. Le dessus du plateau est à `y ≈ 0`.
- **Disposition** : les constantes `SANCTUAIRE`, `PLACE`, `THEATRE`, `RUES` sont dans `js/plan.js`. Les maisons sont placées par `genererLots()` à partir d'une graine fixe : la ville est identique à chaque visite.
- **Textes des lieux** : `js/donnees.js`.
- **Personnages** : tableau `PERSONNAGES` dans `js/personnage.js`.
- **Version de Three.js** : l'import map en tête de `jeu.html`.

## Avertissement historique

Le plan général s'inspire des fouilles publiées et des restitutions proposées pour Corent. Le détail des maisons, des couleurs et du rempart est une interprétation. Les sources sont listées sur la page `a-propos.html`.
