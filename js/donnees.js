// donnees.js — contenus des points d'intérêt (textes de médiation).
// Les faits viennent des fouilles publiées sur Corent ; les détails de forme sont des restitutions.

export const LIEUX = [
  {
    id: 'porte',
    titre: 'La porte du rempart',
    epoque: 'Entrée ouest de l’oppidum',
    texte: [
      'Un oppidum est une ville fortifiée. Sur le plateau de Corent, les falaises de basalte protègent déjà la ville sur presque tout son pourtour.',
      'Ce rempart est restitué sur le modèle du murus gallicus décrit par Jules César : un parement de pierres sèches armé d’une grille de poutres, adossé à un talus de terre. Les têtes des poutres restent visibles dans le mur.',
      'Le tracé exact des fortifications de Corent reste à préciser : la porte que vous traversez est une proposition.',
    ],
    observer: 'Repérez les têtes de poutres carrées prises dans le parement de pierres.',
  },
  {
    id: 'belvedere',
    titre: 'Le belvédère',
    epoque: 'Vue vers le nord',
    texte: [
      'Le plateau domine la plaine de la Limagne et la vallée de l’Allier, à environ 600 mètres d’altitude. Cette position contrôle les routes qui relient le Massif central à la Méditerranée.',
      'Au nord se dresse le plateau de Gergovie, où Vercingétorix repoussa l’armée de César en 52 av. J.-C. Plus loin, à l’ouest, s’alignent les volcans de la chaîne des Puys, dominés par le puy de Dôme.',
    ],
    observer: 'Cherchez le plateau de Gergovie au nord et la silhouette du puy de Dôme au nord-ouest.',
  },
  {
    id: 'sanctuaire',
    titre: 'Le sanctuaire',
    epoque: 'Cœur religieux et politique',
    texte: [
      'La ville s’est organisée autour de ce sanctuaire. Un fossé et une palissade délimitent un espace sacré quadrangulaire, fermé par une galerie couverte.',
      'Des crânes de bovins ornent les poteaux. Ces trophées rappellent les sacrifices et les banquets qui réunissaient la communauté.',
      'Les archéologues y ont mis au jour une quantité exceptionnelle d’ossements d’animaux, d’armes, de monnaies et surtout de fragments d’amphores.',
    ],
    observer: 'Comptez les bucranes au-dessus de la palissade et passez sous le porche d’entrée.',
  },
  {
    id: 'temples',
    titre: 'Les temples et l’autel',
    epoque: 'Intérieur de l’enclos',
    texte: [
      'Au centre de l’enclos s’élèvent des bâtiments de culte : une salle fermée, la cella, entourée d’une galerie à poteaux.',
      'Ce plan centré annonce le fanum gallo-romain. Après la conquête, le sanctuaire de Corent sera d’ailleurs reconstruit en pierre selon ce modèle.',
      'Les divinités honorées ici ne sont pas connues avec certitude.',
    ],
    observer: 'Faites le tour de la galerie du grand temple.',
  },
  {
    id: 'fosses',
    titre: 'Les fosses à offrandes',
    epoque: 'Banquets et libations',
    texte: [
      'Le vin italien arrivait en Gaule dans des amphores de type Dressel 1. À Corent, des dizaines de milliers de fragments ont été retrouvés, souvent dans des fosses.',
      'Certaines amphores étaient brisées volontairement au cours de cérémonies : le vin était versé en offrande aux dieux, puis les tessons enfouis.',
      'Ces trouvailles montrent la richesse de la ville et ses liens étroits avec les marchands du monde méditerranéen.',
    ],
    observer: 'Comparez les amphores debout et les amphores couchées autour des fosses.',
  },
  {
    id: 'assemblee',
    titre: 'L’édifice à gradins',
    epoque: 'Lieu d’assemblée',
    texte: [
      'Près du sanctuaire, les fouilles ont révélé un édifice semi-circulaire à gradins. On l’interprète comme un lieu d’assemblée où se réunissaient les chefs et les citoyens.',
      'Chez les Arvernes, peuple puissant du centre de la Gaule, les décisions étaient débattues par une aristocratie. Ce bâtiment donne une image concrète de cette vie politique.',
    ],
    observer: 'Montez les gradins et regardez la tribune depuis le rang le plus haut.',
  },
  {
    id: 'place',
    titre: 'La place publique',
    epoque: 'Commerce et échanges',
    texte: [
      'Cet espace enclos de murs enduits accueille des boutiques sous portique et des étals. On y échange du vin, de la vaisselle, des outils, des étoffes et du bétail.',
      'Les Arvernes frappaient leur propre monnaie, en or, en argent et en bronze. Les pièces retrouvées en grand nombre à Corent témoignent d’une économie très monétarisée.',
      'Les couleurs ocre et rouge des murs reprennent les restitutions proposées pour la ville.',
    ],
    observer: 'Passez la porte à étage puis traversez la place jusqu’au puits.',
  },
  {
    id: 'maison',
    titre: 'Une maison arverne',
    epoque: 'Quartier d’habitation',
    texte: [
      'Les maisons sont construites en bois et en torchis, un mélange d’argile, de paille et de bouse appliqué sur un clayonnage de branches.',
      'Les toits sont couverts de bardeaux de bois ou de chaume. À l’intérieur, un foyer central chauffe la pièce et sert à cuisiner ; la fumée s’échappe à travers la toiture.',
      'Les maisons s’alignent le long de rues empierrées, comme dans une véritable ville.',
    ],
    observer: 'Repérez les poteaux de l’ossature dans les murs de torchis.',
  },
  {
    id: 'forge',
    titre: 'La forge',
    epoque: 'Quartier des artisans',
    texte: [
      'Les forgerons gaulois maîtrisent parfaitement le fer : outils agricoles, clous, chaînes, armes, pièces de char.',
      'Les ateliers sont regroupés dans certains quartiers de la ville, en raison du feu et du bruit. Les déchets de forge, les scories, aident les archéologues à repérer ces activités.',
    ],
    observer: 'Observez le foyer, l’enclume et le stock de barres de fer.',
  },
  {
    id: 'potier',
    titre: 'L’atelier du potier',
    epoque: 'Quartier des artisans',
    texte: [
      'Les potiers façonnent vases, jattes et pots de stockage, puis les cuisent dans des fours en argile.',
      'À côté des productions locales, les habitants de Corent utilisent aussi de la vaisselle importée d’Italie, signe de leur goût pour les manières de table méditerranéennes.',
    ],
    observer: 'Comparez la forme des pots de l’étagère avec celle des amphores.',
  },
  {
    id: 'grenier',
    titre: 'Le grenier',
    epoque: 'Réserves de la maisonnée',
    texte: [
      'Les céréales récoltées dans la plaine sont conservées dans des greniers surélevés sur poteaux, à l’abri de l’humidité et des rongeurs.',
      'Les archéologues retrouvent ces bâtiments sous la forme de quatre ou six trous de poteaux disposés en carré.',
    ],
    observer: 'Regardez sous le plancher : pourquoi le surélever ?',
  },
];
