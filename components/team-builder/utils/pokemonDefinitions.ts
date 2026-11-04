// Definiciones de Pokémon especiales: legendarios, originales de Pokémon Z, etc.

// ─── Pokémon legendarios, sub-legendarios, Ultra Beasts y Paradox ────────────
// Cubre generaciones 1-9 completas.
export const LEGENDARY_IDS = new Set<number>([
  // Gen I
  144, 145, 146, 150, 151,
  // Gen II
  243, 244, 245, 249, 250, 251,
  // Gen III
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  // Gen IV
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  // Gen V
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  // Gen VI
  716, 717, 718, 719, 720, 721,
  // Gen VII (UBs)
  772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796,
  797, 798, 799, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809,
  // Gen VIII
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,
  // Gen IX (Paradox Pokémon)
  984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 996, 997,
  998, 999, 1000, 1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010,
  1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025,
  // Future legendaries (forma alternativa)
  10016, 10017, 10018, 10026, 10027, 10028, 10085, 10086, 10087, 10090,
  10116, 10117, 10118, 10119, 10120, 10121, 10155, 10156, 10157, 10158,
  10189, 10190,
]);

/**
 * Segunda capa de seguridad: slugs de legendarios conocidos.
 * Cubre formas alternativas con IDs no listados y cualquier futura variante.
 */
export const LEGENDARY_SLUG_PREFIXES = new Set([
  "mewtwo", "mew", "lugia", "ho-oh", "celebi",
  "regirock", "regice", "registeel", "latias", "latios",
  "kyogre", "groudon", "rayquaza", "jirachi", "deoxys",
  "uxie", "mesprit", "azelf", "dialga", "palkia", "heatran",
  "regigigas", "giratina", "cresselia", "phione", "manaphy",
  "darkrai", "shaymin", "arceus",
  "victini", "cobalion", "terrakion", "virizion", "tornadus",
  "thundurus", "reshiram", "zekrom", "landorus", "kyurem",
  "keldeo", "meloetta", "genesect",
  "xerneas", "yveltal", "zygarde", "diancie", "hoopa", "volcanion",
  "type-null", "silvally", "tapu-koko", "tapu-lele", "tapu-bulu", "tapu-fini",
  "cosmog", "cosmoem", "solgaleo", "lunala", "nihilego", "buzzwole",
  "pheromosa", "xurkitree", "celesteela", "kartana", "guzzlord",
  "necrozma", "magearna", "marshadow", "poipole", "naganadel",
  "stakataka", "blacephalon", "zeraora", "meltan", "melmetal",
  "zacian", "zamazenta", "eternatus", "kubfu", "urshifu",
  "zarude", "regieleki", "regidrago", "glastrier", "spectrier", "calyrex",
  "enamorus",
  "wo-chien", "chien-pao", "ting-lu", "chi-yu",
  "koraidon", "miraidon", "walking-wake", "iron-leaves",
  "gouging-fire", "raging-bolt", "iron-boulder", "iron-crown",
  "terapagos", "pecharunt", "ogerpon", "okidogi", "munkidori", "fezandipiti",
]);

// ─── Fakemon / formas originales de Pokémon Z ────────────────────────────────
export const POKEMON_Z_ORIGINALS = new Set<string>([
  // Pokémon reales con formas Z (nombre exacto del JSON, sin sufijo).
  "Pikachu", "Raichu", "Paras", "Parasect", "Cubone", "Marowak",
  "Porygon", "Porygon2", "Porygon-Z",
  "Wailmer", "Wailord", "Vibrava", "Flygon", "Bidoof", "Bibarel",
  "Kricketot", "Kricketune", "Rotom Guillotina", "Lilligant", "Yamask", "Cofagrigus",
  "Gothitelle", "Solosis", "Duosion", "Reuniclus", "Quilladin", "Chesnaught",
  "Braixen", "Delphox", "Frogadier", "Greninja", "Sirfetch'd",
  // Fakemon nuevos (exclusivos del juego)
  "Cefireon", "Royaleon", "Cherrilier", "Gourmaus", "Halcombate", "Serdupla",
  "Zanghoul", "Freyjynx", "Fobeto", "Constellar", "Luvourne", "Marolier", "Sudrasil", "Auretosk",
]);

// ─── Fakemon nuevos exclusivos ───────────────────────────────────────────────
export const Z_FAKEMON_NEW_NAMES = new Set([
  "Cefireon", "Royaleon", "Cherrilier", "Gourmaus", "Halcombate", "Serdupla",
  "Zanghoul", "Freyjynx", "Fobeto", "Constellar", "Luvourne", "Marolier", "Sudrasil", "Auretosk",
]);

// Fakemon nuevos que, dentro del lore de Pokémon Z, SÍ son legendarios.
export const Z_FAKEMON_LEGENDARY_NAMES = new Set([
  "Auretosk", // ejemplo: si hay legendarios fakemon
]);

// ─── Formas y evoluciones de Pokémon Z ───────────────────────────────────────
export const Z_FORM_SPECIES = new Set(
  [
    "Pikachu", "Raichu",
    "Paras", "Parasect",
    "Cubone", "Marowak",
    "Porygon", "Porygon2", "Porygon-Z",
    "Wailmer", "Wailord",
    "Vibrava", "Flygon",
    "Bidoof", "Bibarel",
    "Kricketot", "Kricketune",
    "Lilligant",
    "Yamask", "Cofagrigus",
    "Gothitelle",
    "Solosis", "Duosion", "Reuniclus",
    "Quilladin", "Chesnaught",
    "Braixen", "Delphox",
    "Frogadier", "Greninja",
    "Sirfetch'd",
  ].map((n) => n.toLowerCase())
);

// Subconjunto que NO existe en forma estándar
export const Z_FORM_NO_STANDARD_DUPLICATE = new Set(
  ["Chesnaught", "Delphox", "Greninja"].map((n) => n.toLowerCase())
);

// Mega exclusivas de Z cuya base NO está alterada
export const Z_MEGA_ONLY_SPECIES = new Set(
  ["Entei", "Volcarona", "Florges", "Grimmsnarl"].map((n) => n.toLowerCase())
);

// Megas que son réplicas de formas oficiales
export const Z_MEGA_OFFICIAL_DUPLICATE_SPECIES = new Set(
  ["Chesnaught", "Delphox", "Greninja"].map((n) => n.toLowerCase())
);

// ─── Pre-evoluciones en Pokémon Z ────────────────────────────────────────────
export const POKEMON_Z_PRE_EVOS = new Set<number>([
  1, 2, 4, 5, 7, 8, 10, 11, 13, 14,
  16, 17, 19, 21, 23, 25, 27, 29, 30, 32,
  33, 35, 37, 39, 41, 43, 44, 46, 48, 50,
  52, 54, 56, 58, 60, 61, 63, 64, 66, 67,
  69, 70, 72, 74, 75, 77, 79, 80, 81, 84,
  86, 88, 90, 92, 93, 95, 96, 98, 100, 102,
  104, 108, 109, 111, 112, 113, 114, 116, 117, 118,
  120, 123, 127, 129, 133, 137, 138, 140, 147, 148,
  152, 153, 155, 156, 158, 159, 161, 163, 165, 167, 170,
  172, 173, 174, 175, 177, 179, 180, 183, 187, 188,
  190, 191, 194, 200, 204, 207, 209, 216, 218, 220,
  221, 223, 228, 231, 233, 236, 238, 239, 240, 246,
  247, 252, 253, 255, 256, 258, 259, 261, 263, 265,
  266, 268, 270, 271, 273, 274, 276, 278, 280, 281,
  283, 285, 287, 288, 290, 293, 294, 296, 299, 300,
  304, 305, 307, 309, 315, 316, 318, 320, 322, 325,
  328, 329, 331, 333, 339, 341, 343, 345, 347, 349,
  353, 355, 356, 361, 363, 364, 366, 367, 371, 372,
  374, 375, 387, 388, 390, 391, 393, 394, 396, 397,
  399, 401, 403, 404, 406, 408, 410, 412, 418, 420,
  422, 425, 427, 431, 433, 434, 436, 438, 439, 440,
  443, 444, 446, 447, 449, 451, 453, 456, 458, 459,
  489, 495, 496, 498, 499, 501, 502, 504, 506, 507,
  509, 511, 513, 515, 517, 519, 520, 522, 524, 525,
  527, 529, 532, 533, 535, 536, 540, 541, 543, 544,
  546, 548, 551, 552, 554, 557, 559, 562, 564, 566,
  568, 570, 572, 574, 575, 577, 578, 580, 582, 583,
  585, 588, 590, 592, 595, 597, 599, 600, 602, 603,
  605, 607, 608, 610, 611, 613, 616, 619, 622, 624,
  627, 629, 633, 634, 636, 650, 651, 653, 654, 656,
  657, 659, 661, 662, 664, 665, 667, 669, 670, 672,
  674, 677, 679, 680, 682, 684, 686, 688, 690, 692,
  694, 696, 698, 704, 705, 708, 710, 712, 714, 722,
  723, 725, 726, 728, 729, 731, 732, 734, 736, 737,
  739, 742, 744, 747, 749, 751, 753, 755, 757, 759,
  761, 762, 767, 769, 777, 781, 782, 783, 789, 790,
  803, 804, 808, 810, 811, 813, 814, 816, 817, 819,
  821, 822, 824, 825, 827, 829, 831, 833, 834, 837,
  838, 840, 841, 843, 846, 848, 850, 852, 854, 856,
  857, 859, 860, 868, 872, 878, 885, 886, 891,
  // Pokémon con nuevas evoluciones fakemon
  83, 97, 105, 124, 185, 335, 336, 337, 338, 370, 421, 701, 925,
]);
