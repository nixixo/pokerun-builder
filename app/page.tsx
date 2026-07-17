"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Move = {
  name: string;        // always the English API name (used as key internally)
  nameEs?: string;     // Spanish display name from API
  category: "Status" | "Physical" | "Special";
  type?: string | null;
  isFake?: boolean;
  hiddenPowerType?: string | null;
  // Datos extra para el tooltip informativo del movimiento (opcional: puede
  // no estar disponible si el movimiento es inventado o no se encontró).
  descriptionEs?: string | null;
  descriptionEn?: string | null;
  power?: number | null;
  accuracy?: number | null;
  pp?: number | null;
};

type BaseStats = {
  HP: number;
  ATK: number;
  DEF: number;
  "SP.ATK": number;
  "SP.DEF": number;
  SPE: number;
};

type BaseStatsInput = {
  [K in keyof BaseStats]: string;
};

type SpriteTransform = {
  x: number;   // offset in %, relative to center (clamped)
  y: number;
  zoom: number; // -100 to +100, 0 = default (fits in frame)
};

const DEFAULT_TRANSFORM: SpriteTransform = { x: 0, y: 0, zoom: 0 };

type Slot = {
  name: string;
  isFake: boolean;
  types: string[];
  sprite?: string | null;
  spriteTransform?: SpriteTransform | null;
  moves: Move[];
  stats?: BaseStats | null;
  abilities?: string[] | null;
  hiddenAbility?: string | null;
  // Movimientos que este Pokémon puede aprender realmente (nivel, tutor o
  // huevo). En modo Pokémon Z son internalNames (ej. "THUNDERBOLT"); en modo
  // estándar son slugs de PokéAPI (ej. "thunderbolt"). null/undefined = no
  // se conoce el learnset (ej. slot vacío), por lo que el filtro no aplica.
  learnableMoves?: string[] | null;
  // Método de aprendizaje de cada movimiento aprendible (clave = mismo id
  // usado en learnableMoves: internalName en modo Z, slug en modo estándar).
  // Se usa para mostrar a la derecha del movimiento si es por nivel (con el
  // nivel), por MT o por huevo.
  learnMethods?: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> | null;
  // Rol elegido manualmente por el usuario para ESTE Pokémon del equipo,
  // que reemplaza al rol calculado automáticamente por stats (getRole).
  // Se guarda el label en inglés (clave `en` de RoleDefinition) para que
  // no dependa del idioma activo. null/undefined = automático (usa stats).
  // Útil cuando el usuario piensa entrenar al Pokémon en una dirección
  // distinta a la que sugieren sus stats base (ej. un "Tanque Especial"
  // por stats que en la práctica se va a entrenar en Velocidad).
  manualRoleEn?: string | null;
};

const EMPTY_MOVE = (): Move => ({ name: "", category: "Physical", type: null });

// Nombres en inglés para las habilidades EXCLUSIVAS del fangame Pokémon Z
// (no existen en los juegos oficiales, por lo que PokéAPI nunca las va a
// tener). La clave es el nombre en español tal como aparece en
// abilities_descriptions.json (fuente: abilities.txt). Sin esta tabla,
// estas ~40 habilidades se quedaban siempre en español al cambiar a inglés,
// porque el fetch en vivo a PokéAPI no las conoce.
const CUSTOM_ABILITY_EN_NAMES: Record<string, string> = {
  "Acometida": "Onslaught",
  "Albino": "Albinism",
  "Alquimia Vil": "Vile Alchemy",
  "Aura Dorada": "Golden Aura",
  "Baba Mágica": "Magic Slime",
  "Brutalidad": "Brutality",
  "Camorrista": "Brawler",
  "Canasto": "Basket",
  "Capa Tóxica": "Toxic Layer",
  "Coleóptero": "Beetle Skin",
  "Contraguardia": "Counter Guard",
  "Coraza Ira": "Wrath Shell",
  "Cortante": "Sharp Edge",
  "Cuerpo Horneado": "Baked Body",
  "Despiertallama": "Flame Awakener",
  "Dinamo": "Dynamo",
  "Espanto": "Fright",
  "Floración": "Blooming",
  "Forma Ilusoria": "Illusory Form",
  "Gran Pesadilla": "Great Nightmare",
  "Iceberg": "Iceberg",
  "Inflamable": "Flammable",
  "Olor Porcino": "Piggy Odor",
  "Pedante": "Pedantic",
  "Penetrante": "Piercing",
  "Piel Dragontina": "Dragon Skin",
  "Piel Eléctrica": "Electric Skin",
  "Piel Helada": "Frost Skin",
  "Piel Herbácea": "Grass Skin",
  "Piel Maldita": "Cursed Skin", // alias de "Piel Tétrica": el Umbreon especial (id 92001) usa este nombre en vez del que trae abilities_descriptions.json
  "Piel Tétrica": "Cursed Skin",
  "Poder Gélido": "Icy Power",
  "Poder Sabio": "Wise Power",
  "Presencia Rara": "Rare Presence",
  "Realeza": "Royalty",
  "Relampagueo": "Lightning Flash",
  "Silvano": "Sylvan",
  "Sobrecarga": "Overload",
  "Termoconversión": "Thermal Conversion",
  "Tintineo": "Jingle",
  "Toque Mágico": "Magic Touch",
  "Transportarroca": "Rock Bearer",
  "Voz de Valquiria": "Valkyrie Voice",
};

// ─── Icono de Pokéball (SVG inline, sin dependencias externas) ──────────────
const PokeballIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <defs>
      <clipPath id="pokeball-top-clip">
        <rect x="0" y="0" width="40" height="19" />
      </clipPath>
      <clipPath id="pokeball-bottom-clip">
        <rect x="0" y="21" width="40" height="19" />
      </clipPath>
    </defs>
    <circle cx="20" cy="20" r="18" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
    <g clipPath="url(#pokeball-top-clip)">
      <circle cx="20" cy="20" r="18" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
    </g>
    <g clipPath="url(#pokeball-bottom-clip)">
      <circle cx="20" cy="20" r="18" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
    </g>
    <rect x="1" y="18.5" width="38" height="3" fill="#0f172a" />
    <circle cx="20" cy="20" r="6.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="2.2" />
    <circle cx="20" cy="20" r="3" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.6" />
  </svg>
);

// ─── Banderas de idioma (SVG inline, sin depender de emoji del sistema) ─────
const FlagES = ({ className = "h-3.5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 3 2" className={className} aria-hidden="true">
    <rect width="3" height="2" y="0" fill="#AA151B" />
    <rect width="3" height="1" y="0.5" fill="#F1BF00" />
  </svg>
);

const FlagGB = ({ className = "h-3.5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
    <clipPath id="flag-gb-clip">
      <rect width="60" height="30" />
    </clipPath>
    <g clipPath="url(#flag-gb-clip)">
      <rect width="60" height="30" fill="#00247d" />
      <path d="M0,0 60,30 M60,0 0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 60,30 M60,0 0,30" stroke="#cf142b" strokeWidth="2" />
      <path d="M30,0 30,30 M0,15 60,15" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 30,30 M0,15 60,15" stroke="#cf142b" strokeWidth="6" />
    </g>
  </svg>
);

const EMPTY_SLOT = (): Slot => ({
  name: "",
  isFake: false,
  types: ["", ""],
  sprite: null,
  moves: [EMPTY_MOVE(), EMPTY_MOVE(), EMPTY_MOVE(), EMPTY_MOVE()],
  stats: null,
  abilities: null,
  hiddenAbility: null,
  learnableMoves: null,
  learnMethods: null,
  manualRoleEn: null,
});

const EMPTY_STAT_INPUT: BaseStatsInput = {
  HP: "",
  ATK: "",
  DEF: "",
  "SP.ATK": "",
  "SP.DEF": "",
  SPE: "",
};

const STORAGE_KEY = "pokerun-builder-team";
const SAVED_TEAMS_KEY = "pokerun-builder-saved-teams";
const VIEW_MODE_KEY = "pokerun-builder-view-mode";
const POKEDEX_KEY = "pokerun-builder-active-pokedex";
const FAKEMON_MODE_KEY = "pokerun-builder-fakemon-mode";
const ONLY_LEARNABLE_MOVES_KEY = "pokerun-builder-only-learnable-moves";
const MOVE_FILTER_ONLY_Z_KEY = "pokerun-builder-move-filter-only-z";
const REC_FILTER_MOVE_ONLY_Z_KEY = "pokerun-builder-rec-move-filter-only-z";
const REC_ABILITY_MODAL_ONLY_Z_KEY = "pokerun-builder-rec-ability-modal-only-z";
const ITEMS_ONLY_Z_KEY = "pokerun-builder-items-only-z";
const ITEMS_ONLY_COMBAT_KEY = "pokerun-builder-items-only-combat";
const MAX_PLANTILLAS = 5;

// ─── Pokedex selector ────────────────────────────────────────────────────────
type PokedexId = "standard" | "pokemon-z";

const POKEDEX_OPTIONS: { id: PokedexId; label: string; emoji: string }[] = [
  { id: "standard", label: "Pokedex", emoji: "🔵" },
  { id: "pokemon-z", label: "Pokémon Z", emoji: "⚡" },
];

// Mapa de tipos en español (JSON de Pokémon Z) → slug de PokéAPI en inglés
const TYPE_ES_TO_API: Record<string, string> = {
  "Normal": "normal", "Fuego": "fire", "Agua": "water", "Eléctrico": "electric",
  "Electrico": "electric", "Planta": "grass", "Hielo": "ice", "Lucha": "fighting",
  "Veneno": "poison", "Tierra": "ground", "Volador": "flying", "Psíquico": "psychic",
  "Psiquico": "psychic", "Bicho": "bug", "Roca": "rock", "Fantasma": "ghost",
  "Dragón": "dragon", "Dragon": "dragon", "Siniestro": "dark", "Acero": "steel",
  "Hada": "fairy",
};

// Lookup insensible a mayúsculas/espacios: algunas entradas del JSON de
// Pokémon Z traen el tipo con capitalización distinta (ej. "HADA" en vez de
// "Hada") o espacios extra, lo que hacía fallar el lookup exacto de
// TYPE_ES_TO_API y dejaba el tipo mal mapeado (ej. Xerneas quedando con
// "hada" en vez de "fairy", rompiendo el filtro de tipo silenciosamente).
const TYPE_ES_TO_API_NORMALIZED: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_ES_TO_API).map(([k, v]) => [k.trim().toLowerCase(), v])
);
const normalizeTypeToApi = (t: string): string => {
  const key = t.trim().toLowerCase();
  return TYPE_ES_TO_API_NORMALIZED[key] ?? key;
};

// Especies cuya entrada en pokemon_z_completo.json tiene stats/habilidades
// realmente alteradas respecto a los juegos oficiales (según el documento
// "Formas y nuevas evoluciones" de Pokémon Z), y por lo tanto tiene sentido
// ofrecer también su forma "estándar" (PokéAPI) como opción separada en el
// buscador. El resto de la PokédPokedexex Z (~990 especies) es una copia 1:1 de los
// stats oficiales, así que para esas no se duplica nada (se sigue mostrando
// una sola entrada, como antes).
//
// NOTA: Entei, Volcarona, Florges y Grimmsnarl NO van acá aunque tengan mega
// exclusiva: su entrada base es 1:1 igual a la oficial (solo cambia su Mega),
// así que su nombre no debe llevar sufijo " Z" — solo "Mega X Z". Ver
// Z_MEGA_ONLY_SPECIES más abajo.
const Z_FORM_SPECIES = new Set(
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

// Subconjunto de Z_FORM_SPECIES cuya forma "estándar" (PokéAPI, sin alterar)
// NO existe realmente en Pokémon Z (el hackrom reemplaza por completo esa
// etapa evolutiva), así que no tiene sentido ofrecerla como resultado
// duplicado en el buscador. Sus entradas del JSON Z siguen mostrando el
// sufijo " Z" con normalidad (no se tocó Z_FORM_SPECIES ni getZDisplayName).
const Z_FORM_NO_STANDARD_DUPLICATE = new Set(
  ["Chesnaught", "Delphox", "Greninja"].map((n) => n.toLowerCase())
);

// Las 4 especies con mega exclusiva de Z cuya entrada base NO está alterada
// (es 1:1 igual a los stats oficiales). El JSON les pone `formLabel: "Z"` en
// la entrada base por error/consistencia interna, pero no debe traducirse en
// un sufijo " Z" visible: solo su Mega lleva sufijo ("Mega Entei Z", etc.).
const Z_MEGA_ONLY_SPECIES = new Set(
  ["Entei", "Volcarona", "Florges", "Grimmsnarl"].map((n) => n.toLowerCase())
);

// Caso inverso a Z_MEGA_ONLY_SPECIES: especies cuya entrada BASE sí es
// original de Pokémon Z (stats/habilidad alterados, están en
// POKEMON_Z_ORIGINALS), pero cuya Mega puntual es una réplica de la Mega
// oficial de PokéAPI (no contenido exclusivo del fangame). Se usa en el
// filtro "solo originales" para no contar esas Megas como originales aunque
// su especie base sí lo sea.
const Z_MEGA_OFFICIAL_DUPLICATE_SPECIES = new Set(
  ["Chesnaught", "Delphox", "Greninja"].map((n) => n.toLowerCase())
);

// ─── Formas regionales / alternas de PokéAPI ────────────────────────────────
// Mapeo general (no exclusivo de Pokémon Z) para cuando la contraparte
// "estándar" de una especie no es su forma base de Kanto/nacional, sino una
// variante regional/alterna específica (ej. Raichu → Raichu-Alola). Útil en
// cualquier punto de la app que busque el slug oficial de PokéAPI a partir
// de un nombre de especie: en vez de asumir siempre `nombre.toLowerCase()`,
// se consulta este mapeo primero. Clave: nombre de especie en minúsculas tal
// como aparece en el JSON de Pokémon Z. Valor: { slug, display } de la forma
// de PokéAPI que se debe usar en su lugar.
// Para agregar un nuevo caso (otra especie con forma regional/alterna),
// simplemente se agrega una entrada más acá; no hace falta tocar nada más.
// (Definido debajo de formatForDisplay porque depende de ella.)

// Calcula el nombre a mostrar para una entrada del JSON Pokémon Z, centralizando
// las reglas de Z_FORM_SPECIES y Z_MEGA_ONLY_SPECIES para no repetir esta
// lógica en cada punto del código que arma un displayName.
const getZDisplayName = (p: any): string => {
  const baseName: string = p?.name ?? p?.internalName ?? "";
  const key = baseName.toLowerCase();
  const id: number = p?.id ?? 0;

  // NOTA: los rangos viejos de Megas curadas Z (90001-90008), Mega Lucario Z
  // (90078) y Megas oficiales con delta de stats (90059-90077) fueron
  // migrados al bloque nuevo 91000+ (fuente única de verdad, ver
  // Z_MEGA_SPRITE_SUFFIX más abajo) y ya no existen en el JSON — se quitó el
  // chequeo por esos IDs porque era código muerto. Las entradas 91000+ ya
  // traen su nombre final armado (ej. "Mega Gengar") en el propio JSON, así
  // que caen bien en el fallback "Resto de la Pokedex" de más abajo.

  // Gigamax curados Z (90009–90025): sin sufijo Z, solo "Gigamax <nombre>"
  if (id >= 90009 && id <= 90025) return `Gigamax ${baseName}`;

  // Formas regionales / renombradas Z (90026–90058): nombre tal cual del JSON,
  // sin sufijo Z ("Raichu Alola", "Wugtrio", etc.)
  if (id >= 90026 && id <= 90058) return baseName;

  // Resto de la Pokedex (IDs normales). No dependemos de formLabel porque
  // el JSON lo pone mal en varios casos (ej. entradas base con formLabel "Z").
  if (Z_MEGA_ONLY_SPECIES.has(key)) return baseName;
  if (Z_FORM_SPECIES.has(key)) return `${baseName} Z`;
  return baseName;
};


// Las 8 entradas "Mega" del JSON Pokémon Z (id 90001-90008) traen el campo
// `sprite` apuntando al archivo BASE de su especie (bug del JSON fuente: ej.
// Delphox Mega trae "655.png" en vez de "655_1.png"). El sprite real de cada
// Mega vive en el mismo bucket pero con un sufijo "_N" sobre el dexId,
// confirmado manualmente en la página de Fakedex (cada especie tiene un
// número de formas previas distinto, así que el sufijo no es uniforme):
//   Raichu  → _2   (Forma 1 = Raichu Alola, Forma 2 = Mega Z)
//   Entei   → _1
//   Volcarona → _3 (Formas 1 y 2 son las Paradojas pasado/futuro, no son Mega)
//   Chesnaught → _1 (Forma 2 es la Mega oficial, vía PokéAPI aparte)
//   Delphox → _1    (Forma 2 es la Mega oficial, vía PokéAPI aparte)
//   Greninja → _2   (Forma 1 es Greninja Z oscuro, Forma 3 Ash-Greninja, Forma 4 Mega oficial)
//   Florges → _1
//   Grimmsnarl → _1
const Z_MEGA_SPRITE_SUFFIX: Record<number, string> = {
  // ─── Formas no-mega/no-primal: SIN CAMBIOS (sus ids se mantienen igual en
  // el JSON limpio, no se tocaron en la limpieza de mega/primigenias) ──────
  // 90009-90025: Gigamax
  90009: "_1", // Butterfree
  90010: "_1", // Machamp
  90011: "_1", // Kingler
  90012: "_1", // Lapras
  90013: "_1", // Garbodor
  90014: "_1", // Corviknight
  90015: "_1", // Orbeetle
  90016: "_1", // Drednaw
  90017: "_1", // Coalossal
  90018: "_1", // Flapple
  90019: "_1", // Appletun
  90020: "_1", // Sandaconda
  90021: "_1", // Toxtricity
  90022: "_1", // Centiskorch
  90023: "_1", // Hatterene
  90024: "_1", // Alcremie
  90025: "_1", // Copperajah
  // 90026-90058: Formas regionales / renombradas
  90026: "_1", // Raticate Alola
  90027: "_1", // Raichu Alola
  90028: "_1", // Sandslash Alola
  90029: "_1", // Ninetales Alola
  90030: "_1", // Persian Alola
  90031: "_1", // Golem Alola
  90032: "_1", // Muk Alola
  90033: "_1", // Exeggutor Alola
  90034: "_1", // Marowak Alola
  90035: "_1", // Rapidash Galar
  90036: "_1", // Slowbro Galar
  90037: "_1", // Weezing Galar
  90038: "_1", // Slowking Galar
  90039: "_1", // Darmanitan Galar
  90040: "_1", // Stunfisk Galar
  90041: "_1", // Arcanine Hisui
  90042: "_1", // Electrode Hisui
  90043: "_1", // Typhlosion Hisui
  90044: "_1", // Samurott Hisui
  90045: "_1", // Lilligant Hisui
  90046: "_1", // Zoroark Hisui
  90047: "_1", // Braviary Hisui
  90048: "_1", // Goodra Hisui
  90049: "_1", // Avalugg Hisui
  90050: "_1", // Decidueye Hisui
  90051: "_1", // Tauros Paldea
  90052: "_1", // Wugtrio (Dugtrio)
  90053: "_1", // Toedscruel (Tentacruel)
  90054: "_1", // Colmilargo (Donphan)
  90055: "_1", // Pelarena (Magnezone)
  90056: "_1", // Reptalada (Volcarona)
  90057: "_1", // Ferrosaco (Delibird)
  90058: "_1", // Ferropalmas (Hariyama)
  // 90079-90107, 90109, 90113-90116, 90120-90124: otras formas alternativas
  // (no son mega ni primigenia, se conservan igual que antes)
  90079: "_1", // Sneasel Hisui
  90159: "_1", // Voltorb Hisui
  90080: "_1", // Rotom Heat
  90081: "_2", // Rotom Wash
  90082: "_3", // Rotom Frost
  90083: "_4", // Rotom Fan
  90084: "_5", // Rotom Mow
  90085: "_1", // Zygarde 10
  90086: "_2", // Zygarde Complete
  90087: "_2", // Kyurem Black
  90088: "_1", // Kyurem White
  90089: "_1", // Necrozma Dusk Mane
  90090: "_2", // Necrozma Dawn Wings
  90091: "_3", // Necrozma Ultra
  90092: "_1", // Melmetal Gmax
  90094: "_1", // Furfrou (Corazón)
  90095: "_2", // Furfrou (Estrella)
  90096: "_3", // Furfrou (Rombo)
  90097: "_4", // Furfrou (Señorita)
  90098: "_5", // Furfrou (Dama)
  90099: "_6", // Furfrou (Caballero)
  90100: "_7", // Furfrou (Aristócrata)
  90101: "_8", // Furfrou (Kabuki)
  90102: "_9", // Furfrou (Faraón)
  90103: "_6", // Rotom Guillotina
  90104: "_1", // Deoxys Ataque
  90105: "_2", // Deoxys Defensa
  90106: "_3", // Deoxys Velocidad
  90107: "_1", // Meloetta Canto
  90109: "_1", // Hoopa Trastocado
  90113: "_1", // Articuno Galar
  90114: "_1", // Zapdos Galar
  90115: "_1", // Moltres Galar
  90116: "_1", // Urshifu Fluido (Agua)
  90120: "_1", // Tornadus Tótem
  90121: "_1", // Thundurus Tótem
  90122: "_1", // Calyrex Jinete Glacial (Hielo)
  90123: "_2", // Calyrex Jinete Espectral (Fantasma)
  90124: "_1", // Enamorus Tótem
  // ─── Tanda 2 (nuevas, sufijo = índice de form del .rb) ─────────────────
  90160: "_1", // Castform Soleado
  90161: "_2", // Castform Lluvioso
  90162: "_3", // Castform Nevado
  90163: "_4", // Castform Rocoso
  90164: "_1", // Wormadam (Tronco Arena)
  90165: "_2", // Wormadam (Tronco Basura)
  90166: "_1", // Lycanroc Nocturno
  90167: "_2", // Lycanroc Crepuscular
  90168: "_1", // Pumpkaboo Normal
  90169: "_1", // Pumpkaboo Grande (sin arte propio en el servidor, reusa el de Normal)
  90170: "_1", // Pumpkaboo Extragrande (sin arte propio en el servidor, reusa el de Normal)
  90171: "_1", // Gourgeist Normal
  90172: "_1", // Gourgeist Grande (sin arte propio en el servidor, reusa el de Normal)
  90173: "_1", // Gourgeist Extragrande (sin arte propio en el servidor, reusa el de Normal)
  // ─── Tanda 3 (nuevas, sufijo = índice de form del .rb) ─────────────────
  90174: "_3", // Gengar (Escarcha)
  90175: "_5", // Mewtwo (Origen)
  90176: "_1", // Pikachu Amarillo

  // ─── ELIMINADAS de este mapping (ya no existen en el JSON limpio): ──────
  // 90001-90008: Megas Z viejas -> ver equivalentes 91000+ abajo
  // 90059-90078: Megas Gen3-ish viejas -> ver equivalentes 91000+ abajo
  //   90063 Mega Gengar, 90071 Mega Mawile, 90074 Mega Banette,
  //   90077 Mega Audino: SIN reemplazo en el bloque nuevo (91000+), el
  //   parser del .rb no generó mega para estas 4 especies. Quedan fuera
  //   del JSON y de este mapping hasta que se agreguen (si corresponde).
  // 90093 Zygarde Mega: SIN reemplazo en el bloque nuevo, fuera del JSON.
  // 90108,90110-90112,90119: Megas Legends Z-A -> ver 91000+ abajo
  // 90117 Kyogre Primigenio -> ver 91073 abajo
  // 90118 Groudon Primigenio: SIN reemplazo con sufijo _PRIMAL; el .rb
  //   generó GROUDON_MEGA (91062) en su lugar, no GROUDON_PRIMAL. Revisar
  //   si esto es intencional en el script oficial o un cambio de criterio.
  // 90125-90158: Megas curadas Z viejas -> ver equivalentes 91000+ abajo

  // ─── Megas/Primigenias NUEVAS (91000+), fuente única de verdad ──────────
  // Sufijo heredado del mapping viejo cuando la especie tenía un único
  // valor conocido (o cuando el número de variante _F<N> coincide
  // exactamente con el sufijo viejo, ej. _2 -> _F2). El resto son
  // placeholder "_1" SIN CONFIRMAR — falta verificar a mano en Fakedex,
  // igual que en el mapping original.
  91000: "_1", // Mega Abomasnow (sin dato previo, no estaba en el mapping viejo)
  91001: "_1", // Mega Absol F1 (sin confirmar)
  91002: "_2", // Mega Absol F2 (heredado de 90148, sufijo numérico coincide)
  91003: "_1", // Mega Aerodactyl (sin dato previo)
  91004: "_1", // Mega Aggron (sin dato previo)
  91005: "_1", // Mega Alakazam (sin dato previo)
  91006: "_1", // Mega Alcremie (sin dato previo)
  91007: "_1", // Mega Altaria (heredado de 90073)
  91008: "_1", // Mega Ampharos (sin dato previo)
  91009: "_1", // Mega Appletun (sin dato previo)
  91010: "_1", // Mega Barbaracle (heredado de 90142)
  91011: "_1", // Mega Baxcalibur (heredado de 90157)
  91012: "_1", // Mega Beedrill (sin dato previo)
  91013: "_1", // Mega Blastoise (heredado de 90062)
  91014: "_1", // Mega Blaziken (heredado de 90067)
  91015: "_1", // Mega Butterfree (sin dato previo)
  91016: "_1", // Mega Camerupt (heredado de 90072)
  91017: "_1", // Mega Centiskorch (sin dato previo)
  91018: "_1", // Mega Chandelure (heredado de 90138)
  91019: "_1", // Mega Charizard X (heredado de 90060)
  91020: "_2", // Mega Charizard Y (heredado de 90061)
  91021: "_1", // Mega Chesnaught F1 (heredado de 90004, variante sin confirmar cuál)
  91022: "_2", // Mega Chesnaught F2 (sin confirmar)
  91023: "_1", // Mega Chimecho (heredado de 90147)
  91024: "_1", // Mega Cinderace (sin dato previo)
  91025: "_1", // Mega Clefable (heredado de 90125)
  91026: "_1", // Mega Coalossal (sin dato previo)
  91027: "_1", // Mega Copperajah (sin dato previo)
  91028: "_1", // Mega Corviknight (sin dato previo)
  91029: "_1", // Mega Crabominable (heredado de 90153)
  91030: "_1", // Mega Darkrai (heredado de 90110)
  91031: "_1", // Mega Delphox F1 (heredado de 90005, variante sin confirmar cuál)
  91032: "_2", // Mega Delphox F2 (sin confirmar)
  91033: "_1", // Mega Diancie (heredado de 90108)
  91034: "_1", // Mega Dragalge (heredado de 90143)
  91035: "_1", // Mega Dragonite (heredado de 90128)
  91036: "_1", // Mega Drampa (heredado de 90145)
  91037: "_1", // Mega Drednaw (sin dato previo)
  91038: "_1", // Mega Duraludon (sin dato previo)
  91039: "_1", // Mega Eelektross (heredado de 90137)
  91040: "_1", // Mega Emboar (heredado de 90133)
  91041: "_1", // Mega Entei (heredado de 90002)
  91042: "_1", // Mega Excadrill (heredado de 90134)
  91043: "_1", // Mega Falinks (heredado de 90146)
  91044: "_1", // Mega Feraligatr (heredado de 90130)
  91045: "_1", // Mega Flapple (sin dato previo)
  91046: "_1", // Mega Floette (heredado de 90140)
  91047: "_1", // Mega Florges (heredado de 90007)
  91048: "_1", // Mega Froslass (heredado de 90132)
  91049: "_1", // Mega Gallade (heredado de 90076)
  91050: "_1", // Mega Garbodor (sin dato previo)
  91051: "_1", // Mega Garchomp F1 (heredado de 90150, variante sin confirmar cuál)
  91052: "_2", // Mega Garchomp F2 (heredado de 90150, sufijo numérico coincide)
  91053: "_1", // Mega Gardevoir (heredado de 90069)
  91054: "_1", // Mega Glalie (heredado de 90075)
  91055: "_1", // Mega Glimmora (heredado de 90156)
  91056: "_1", // Mega Golisopod (heredado de 90154)
  91057: "_1", // Mega Golurk (heredado de 90151)
  91058: "_2", // Mega Greninja F2 (heredado de 90006, sufijo numérico coincide)
  91059: "_3", // Mega Greninja F3 (sin confirmar)
  91060: "_4", // Mega Greninja F4 (sin confirmar)
  91061: "_1", // Mega Grimmsnarl (heredado de 90008)
  91062: "_1", // Mega Groudon (heredado de 90118 aunque internalName era PRIMAL, no MEGA; revisar)
  91063: "_1", // Mega Gyarados (sin dato previo)
  91064: "_1", // Mega Hatterene (sin dato previo)
  91065: "_1", // Mega Hawlucha (heredado de 90144)
  91066: "_1", // Mega Heatran (heredado de 90119)
  91067: "_1", // Mega Heracross (sin dato previo)
  91068: "_1", // Mega Houndoom (sin dato previo)
  91069: "_1", // Mega Hydrapple (sin dato previo)
  91070: "_1", // Mega Inteleon (sin dato previo)
  91071: "_1", // Mega Kangaskhan (heredado de 90064)
  91072: "_1", // Mega Kingler (sin dato previo)
  91073: "_1", // Reversión Primigenia de Kyogre (heredado de 90117)
  91074: "_1", // Mega Lapras (sin dato previo)
  91075: "_1", // Mega Lopunny (sin dato previo)
  91076: "_1", // Mega Lucario F1 (sin confirmar)
  91077: "_2", // Mega Lucario F2 (heredado de 90078, sufijo numérico coincide)
  91078: "_1", // Mega Machamp (sin dato previo)
  91079: "_1", // Mega Magearna (heredado de 90111)
  91080: "_1", // Mega Malamar (heredado de 90141)
  91081: "_1", // Mega Manectric (sin dato previo)
  91082: "_1", // Mega Medicham (sin dato previo)
  91083: "_1", // Mega Meganium (heredado de 90129)
  91084: "_1", // Mega Meowstic (heredado de 90152)
  91085: "_1", // Mega Metagross (sin dato previo)
  91086: "_1", // Mega Orbeetle (sin dato previo)
  91087: "_1", // Mega Pidgeot (sin dato previo)
  91088: "_1", // Mega Pinsir (sin dato previo)
  91089: "_1", // Mega Pyroar (heredado de 90139)
  91090: "_2", // Mega Raichu F2 (heredado de 90001, sufijo numérico coincide)
  91091: "_1", // Mega Rayquaza (sin dato previo)
  91092: "_1", // Mega Rillaboom (sin dato previo)
  91093: "_1", // Mega Sableye (heredado de 90070)
  91094: "_1", // Mega Salamence (sin dato previo)
  91095: "_1", // Mega Sandaconda (sin dato previo)
  91096: "_1", // Mega Sceptile (heredado de 90066)
  91097: "_1", // Mega Scizor (sin dato previo)
  91098: "_1", // Mega Scolipede (heredado de 90135)
  91099: "_1", // Mega Scovillain (heredado de 90155)
  91100: "_1", // Mega Scrafty (heredado de 90136)
  91101: "_1", // Mega Sharpedo (sin dato previo)
  91102: "_1", // Mega Skarmory (heredado de 90131)
  91103: "_2", // Mega Slowbro F2 (sin confirmar; no había F1 en el bloque nuevo)
  91104: "_1", // Mega Staraptor (heredado de 90149)
  91105: "_1", // Mega Starmie (heredado de 90127)
  91106: "_1", // Mega Steelix (heredado de 90065)
  91107: "_1", // Mega Swampert (heredado de 90068)
  91108: "_1", // Mega Tatsugiri (heredado de 90158)
  91109: "_1", // Mega Toxtricity (sin dato previo)
  91110: "_1", // Mega Tyranitar F1 (sin confirmar)
  91111: "_2", // Mega Tyranitar F2 (sin confirmar)
  91112: "_1", // Mega Venusaur (heredado de 90059)
  91113: "_1", // Mega Victreebel (heredado de 90126)
  91114: "_3", // Mega Volcarona (heredado de 90003)
  91115: "_1", // Mega Zeraora (heredado de 90112)
  // ─── Megas nuevas de Tanda 2/3 (sin dato previo en Fakedex, placeholder
  // según orden de form en el .rb — VERIFICAR A MANO) ─────────────────────
  91116: "_1", // Mega Zygarde (sin dato previo)
  91117: "_1", // Mega Gengar (sin dato previo)
  91118: "_2", // Mega Pikachu (sin dato previo; form 2 en el .rb)
  // ─── Formas sin dexId propio en el JSON (usan Z_MISSING_DEXID de abajo
  // para saber a qué especie base corresponde su sprite) ──────────────────
  90177: "_1", // Sawsbuck Primavera
  90178: "_1", // Sawsbuck Otoño
  90179: "_1", // Sawsbuck Invierno
  90180: "_1", // Lugia Oscuro
  90181: "_1", // Missingno Forma 1
  90182: "_1", // Missingno Forma 2
  // 90183 Shaymin Cielo: NO lleva sufijo — no existe sprite propio, usa el
  // mismo sprite base que Shaymin Normal (ver getZSpriteUrl más abajo).
  92001: "_1", // Umbreon (Piel Maldita)
};

// Dex id real de las entradas de arriba que el JSON no trae con `dexId`
// (ver comentario en Z_MEGA_SPRITE_SUFFIX). Sin esto, getZSpriteUrl caería
// de vuelta al id fake (90177, 92001, etc.) para armar la URL.
const Z_MISSING_DEXID: Record<number, number> = {
  90177: 586, // Sawsbuck
  90178: 586, // Sawsbuck
  90179: 586, // Sawsbuck
  90180: 249, // Lugia
  90181: 908, // Missingno
  90182: 908, // Missingno
  90183: 492, // Shaymin
  92001: 197, // Umbreon
};

// Algunos sprites, aun después del auto-recorte por bounding box, quedan con
// más margen "vacío" dentro de su propio arte que el resto (ej. efectos con
// alpha bajo —como el fuego de Mega Delphox Z— que no llegan al umbral de
// recorte de 10 y dejan colchón alrededor). Para esos casos puntuales se
// aplica un factor de zoom extra sobre el tamaño ya calculado, en vez de
// tocar el umbral general (que afectaría a todos los demás sprites).
const Z_SPRITE_ZOOM_OVERRIDES: Record<number, number> = {
  90005: 1.4, // Mega Delphox Z: se ve notablemente más chico que el resto
};

// Resuelve la URL real del sprite Battlers para una entrada del JSON Pokémon Z,
// corrigiendo el caso especial de las 8 Megas (ver Z_MEGA_SPRITE_SUFFIX arriba).
// Para el resto de entradas (incluidas las normales y las "Z" de Z_FORM_SPECIES)
// usa simplemente dexId/id con padding de 3 dígitos, como siempre.
const getZSpriteUrl = (p: any): string => {
  const base = "https://minio-p0ogk8cks8sc0k0coksoccco.195.200.15.5.sslip.io/fakedex/z/sprites/Battlers";
  const suffix = Z_MEGA_SPRITE_SUFFIX[p?.id];
  if (suffix) {
    // Z_MISSING_DEXID cubre el caso de que sigas usando una versión vieja del
    // JSON sin `dexId` para estas 8 entradas; si ya actualizaste el JSON
    // (recomendado), `p.dexId` alcanza y este fallback nunca se usa.
    const dexId = p.dexId ?? Z_MISSING_DEXID[p?.id] ?? p.id;
    return `${base}/${String(dexId).padStart(3, "0")}${suffix}.png`;
  }
  // Formas sin sufijo propio (ej. Shaymin Cielo) que ya traen `dexId` en el
  // JSON: usan el mismo sprite base que su especie (sin sufijo _N), en vez
  // de reconstruir la URL con su id fake (90183 → 404).
  if (p?.dexId !== undefined && p?.dexId !== null) {
    return `${base}/${String(p.dexId).padStart(3, "0")}.png`;
  }
  // Formas sin `dexId` en el JSON (versiones viejas del JSON, antes de
  // agregarlo): usamos directamente el campo `sprite` que ya viene armado
  // bien desde el JSON.
  if (typeof p?.sprite === "string" && p.sprite) {
    return p.sprite;
  }
  return `${base}/${String(p?.id ?? 0).padStart(3, "0")}.png`;
};

type SavedTeam = {
  id: number;
  name: string;
  team: Slot[];
  savedAt: string;
};

// ─── Sistema de roles por puntuación ponderada (Opción A + B + D) ───────────

type RoleDefinition = {
  es: string;
  en: string;
  color: string;
  // Weighted formula: each stat key → weight (must sum to 1.0)
  weights: Partial<Record<keyof BaseStats, number>>;
  // Descripción de por qué un Pokémon recibe este rol (qué stats lo definen).
  // Se muestra en el tooltip al pasar el cursor sobre la etiqueta del rol.
  descEs: string;
  descEn: string;
};

const ROLES: RoleDefinition[] = [
  { es: "Físico Veloz",      en: "Fast Physical",   color: "#ea580c",
    weights: { ATK: 0.5,  SPE: 0.5 },
    descEs: "Ataque y Velocidad altos: golpea fuerte y antes que el rival.",
    descEn: "High Attack and Speed: hits hard and moves before the opponent." },
  { es: "Especial Veloz",    en: "Fast Special",    color: "#9333ea",
    weights: { "SP.ATK": 0.5, SPE: 0.5 },
    descEs: "Ataque Especial y Velocidad altos: arrasa con movimientos especiales antes que el rival actúe.",
    descEn: "High Sp. Atk and Speed: sweeps with special moves before the opponent acts." },
  { es: "Mixto Veloz",          en: "Fast Mixed",       color: "#c026d3",
    weights: { ATK: 0.3, "SP.ATK": 0.3, SPE: 0.4 },
    descEs: "Ataque y Ataque Especial equilibrados, con buena Velocidad: amenaza por ambos lados ofensivos.",
    descEn: "Balanced Attack and Sp. Atk with good Speed: threatens from both offensive sides." },
  { es: "Muro Físico",           en: "Physical Wall",           color: "#0369a1",
    weights: { HP: 0.4,  DEF: 0.45, SPE: 0.15 },
    descEs: "HP y Defensa altos: aguanta ataques físicos durante muchos turnos.",
    descEn: "High HP and Defense: tanks physical attacks for many turns." },
  { es: "Muro Especial",            en: "Special Wall",             color: "#1d4ed8",
    weights: { HP: 0.4,  "SP.DEF": 0.45, SPE: 0.15 },
    descEs: "HP y Defensa Especial altos: aguanta ataques especiales durante muchos turnos.",
    descEn: "High HP and Sp. Def: tanks special attacks for many turns." },
  { es: "Muralla Total",         en: "Full Wall",              color: "#1e40af",
    weights: { HP: 0.35, DEF: 0.325, "SP.DEF": 0.325 },
    descEs: "HP, Defensa y Defensa Especial altos por igual: resiste prácticamente cualquier tipo de ataque.",
    descEn: "High HP, Defense, and Sp. Def in equal measure: resists almost any kind of attack." },
  { es: "Tanque Físico",     en: "Physical Tank", color: "#b45309",
    weights: { HP: 0.35, ATK: 0.4,  DEF: 0.25 },
    descEs: "HP y Ataque altos con Defensa de apoyo: aguanta golpes mientras sigue golpeando fuerte.",
    descEn: "High HP and Attack with supporting Defense: tanks hits while still hitting hard." },
  { es: "Tanque Especial",   en: "Special Tank",  color: "#7c3aed",
    weights: { HP: 0.35, "SP.ATK": 0.4, "SP.DEF": 0.25 },
    descEs: "HP y Ataque Especial altos con Defensa Especial de apoyo: aguanta golpes especiales mientras ataca.",
    descEn: "High HP and Sp. Atk with supporting Sp. Def: tanks special hits while still attacking." },
  { es: "Defensor Veloz",             en: "Fast Defender",            color: "#0e7490",
    weights: { DEF: 0.45, SPE: 0.4, HP: 0.15 },
    descEs: "Defensa y Velocidad altas: bloquea ataques físicos y aún así actúa primero.",
    descEn: "High Defense and Speed: blocks physical attacks and still acts first." },
  { es: "Defensor Especial",    en: "Special Defender",    color: "#0891b2",
    weights: { "SP.DEF": 0.45, SPE: 0.4, HP: 0.15 },
    descEs: "Defensa Especial y Velocidad altas: bloquea ataques especiales y aún así actúa primero.",
    descEn: "High Sp. Def and Speed: blocks special attacks and still acts first." },
  { es: "Físico Resistente", en: "Tough Physical",  color: "#dc2626",
    weights: { ATK: 0.45, "SP.DEF": 0.3, HP: 0.25 },
    descEs: "Ataque alto con buena Defensa Especial y HP: golpea fuerte sin ser frágil ante ataques especiales.",
    descEn: "High Attack with good Sp. Def and HP: hits hard without being fragile to special attacks." },
  { es: "Especial Resistente", en: "Tough Special", color: "#4338ca",
    weights: { "SP.ATK": 0.35, DEF: 0.35, HP: 0.3 },
    descEs: "Ataque Especial y Defensa repartidos con HP de apoyo: ataca por la vía especial mientras bloquea golpes físicos.",
    descEn: "Sp. Atk and Defense spread with supporting HP: attacks specially while blocking physical hits." },
];

// Speed tiers (Opción D)
const getSpeedTier = (spe: number, lang: Lang): { label: string; color: string } => {
  if (spe <= 30)  return { label: lang === "es" ? "Trick Room" : "Trick Room",  color: "#7c3aed" };
  if (spe <= 50)  return { label: lang === "es" ? "Muy lento"  : "Very slow",   color: "#6b7280" };
  if (spe <= 70)  return { label: lang === "es" ? "Lento"      : "Slow",        color: "#78716c" };
  if (spe <= 90)  return { label: lang === "es" ? "Medio"      : "Mid speed",   color: "#ca8a04" };
  if (spe <= 110) return { label: lang === "es" ? "Rápido"     : "Fast",        color: "#16a34a" };
  return               { label: lang === "es" ? "Muy rápido" : "Very fast",   color: "#0891b2" };
};

// Bulk metrics (Opción B)
const getBulk = (stats: BaseStats) => ({
  physical:  Math.round((stats.HP * stats.DEF)        / 100),
  special:   Math.round((stats.HP * stats["SP.DEF"])  / 100),
  offensive: Math.round((Math.max(stats.ATK, stats["SP.ATK"]) * stats.SPE) / 100),
});

// Rol especial para Pokémon con estadísticas parejas (ej. Mew, Arceus).
// A diferencia de los roles de arriba (combinación lineal de pesos), este
// rol mide explícitamente qué tan parejas están las 6 stats entre sí, para
// no depender del orden de ROLES ni de un desempate arbitrario.
const BALANCED_ROLE: RoleDefinition = {
  es: "Todoterreno Puro", en: "Pure All-Rounder", color: "#059669",
  weights: {}, // no aplica: se calcula con getBalanceScore, no con pesos lineales
  descEs: "Todas las estadísticas parejas: no destaca en un área específica, pero no tiene puntos débiles.",
  descEn: "All stats evenly matched: no specific standout area, but no weak points either.",
};

// score = promedio_normalizado × factor_de_balance
// - promedio_normalizado: qué tan poderoso es en general (promedio de las 6 stats / 255)
// - factor_de_balance: qué tan parejas están entre sí (1 si spread=0, 0 si spread>=25)
// Divisor 25 = criterio estricto: solo casos casi perfectos (Mew, Arceus) califican.
const getBalanceScore = (stats: BaseStats): number => {
  const values = [stats.HP, stats.ATK, stats.DEF, stats["SP.ATK"], stats["SP.DEF"], stats.SPE];
  const avg = values.reduce((a, b) => a + b, 0) / 6;
  const spread = Math.max(...values) - Math.min(...values);

  const normAvg = Math.min(avg / 255, 1);
  const balanceFactor = Math.max(0, 1 - spread / 25);

  return Math.round(normAvg * balanceFactor * 100);
};

// Score a Pokémon against each role formula, return all scores 0–100
const scoreAllRoles = (stats: BaseStats): { role: RoleDefinition; score: number }[] => {
  // Normalize each stat to 0–1 using realistic max of 255
  const norm = (v: number) => Math.min(v / 255, 1);
  const linearScores = ROLES.map((role) => {
    const score = Object.entries(role.weights).reduce((acc, [key, w]) => {
      return acc + norm(stats[key as keyof BaseStats]) * (w ?? 0);
    }, 0);
    return { role, score: Math.round(score * 100) };
  });
  const balancedScore = { role: BALANCED_ROLE, score: getBalanceScore(stats) };
  return [...linearScores, balancedScore];
};

const getRole = (stats: BaseStats, lang: Lang = "es"): { label: string; color: string } | null => {
  const scores = scoreAllRoles(stats);
  // Nota: con spread=0 (Mew, Arceus), el score de "Todoterreno Puro" queda
  // matemáticamente empatado con cualquier rol lineal (ambos dan el promedio
  // de las stats). Por eso el desempate usa >= en vez de >: como scoreAllRoles
  // agrega el rol de balance al FINAL del array, en un empate exacto gana el
  // último evaluado, que es justamente el rol de balance.
  const best = scores.reduce((a, b) => (b.score >= a.score ? b : a));
  if (best.score < 20) return null;
  return { label: best.role[lang], color: best.role.color };
};

// Igual que getRole, pero respeta el rol manual elegido por el usuario para
// ESE Pokémon del equipo (slot.manualRoleEn), si existe. Se usa en todos los
// cálculos agregados del equipo (resumen de roles, redundancia, rol que le
// falta al equipo, recomendaciones) para que un cambio manual de rol se
// refleje en TODA la app, no solo en la tarjeta del Pokémon.
const getEffectiveRole = (
  slot: { stats?: BaseStats | null; manualRoleEn?: string | null },
  lang: Lang = "es"
): { label: string; color: string } | null => {
  if (slot.manualRoleEn) {
    const roleDef = [...ROLES, BALANCED_ROLE].find((r) => r.en === slot.manualRoleEn);
    if (roleDef) return { label: roleDef[lang], color: roleDef.color };
  }
  if (!slot.stats) return null;
  return getRole(slot.stats, lang);
};

// ─── Filtro de rol por stats núcleo ────────────────────────────────────────────
// Cada rol define las stats mínimas que un Pokémon DEBE tener para calificar.
// Reemplaza el sistema de margen/ranking, que fallaba con stats comprimidas.
// Ejemplo: Tanque Defensivo requiere DEF >= 80 y HP >= 70; Rotom (DEF:77, HP:50)
// no pasa. Luvourne (SP.DEF:95, SPE:97) si pasa Defensor Especial Veloz.

type RoleCoreRequirement = {
  stat: keyof BaseStats;
  min: number;
};

type RoleCoreFilter = {
  required: RoleCoreRequirement[];
};

const ROLE_CORE_FILTERS: Record<string, RoleCoreFilter> = {
  "Atacante Físico Veloz":        { required: [{ stat: "ATK",    min: 85 }, { stat: "SPE",    min: 85 }] },
  "Atacante Especial Veloz":      { required: [{ stat: "SP.ATK", min: 85 }, { stat: "SPE",    min: 85 }] },
  "Atacante Versátil":            { required: [{ stat: "ATK",    min: 75 }, { stat: "SP.ATK", min: 75 }, { stat: "SPE", min: 80 }] },
  "Tanque Defensivo":             { required: [{ stat: "DEF",    min: 80 }, { stat: "HP",     min: 70 }] },
  "Tanque Especial":              { required: [{ stat: "SP.DEF", min: 80 }, { stat: "HP",     min: 70 }] },
  "Muralla Resistente":           { required: [{ stat: "HP",     min: 80 }, { stat: "DEF",    min: 75 }, { stat: "SP.DEF", min: 75 }] },
  "Tanque Físico Agresivo":       { required: [{ stat: "HP",     min: 75 }, { stat: "ATK",    min: 85 }, { stat: "DEF",    min: 65 }] },
  "Tanque Especial Agresivo":     { required: [{ stat: "HP",     min: 75 }, { stat: "SP.ATK", min: 85 }, { stat: "SP.DEF", min: 65 }] },
  "Defensor Veloz":               { required: [{ stat: "DEF",    min: 80 }, { stat: "SPE",    min: 85 }] },
  "Defensor Especial Veloz":      { required: [{ stat: "SP.DEF", min: 80 }, { stat: "SPE",    min: 85 }] },
  "Atacante Físico Resistente":   { required: [{ stat: "ATK",    min: 90 }, { stat: "SP.DEF", min: 70 }, { stat: "HP", min: 65 }] },
  "Atacante Especial Resistente": { required: [{ stat: "SP.ATK", min: 90 }, { stat: "DEF",    min: 70 }, { stat: "HP", min: 65 }] },
};

type RoleMatchResult = {
  passes: boolean;
  score: number;      // score del rol pedido (0–100), para debug
  topScore: number;   // score del rol #1 del Pokémon, para debug
  reason: "exact" | "margin" | "minimum" | "partial" | "fail";
};

// Devuelve el ranking (1 = más alta) de cada stat DENTRO del propio Pokémon.
// Ej: si SP.ATK es la stat más alta de sus 6 stats, statRank(stats, "SP.ATK") === 1.
const statRank = (stats: BaseStats, stat: keyof BaseStats): number => {
  const sorted = (Object.keys(stats) as (keyof BaseStats)[])
    .sort((a, b) => stats[b] - stats[a]);
  return sorted.indexOf(stat) + 1; // 1-indexed
};

// Cuántas stats como máximo pueden estar "por delante" de la stat núcleo
// dentro del propio Pokémon para que el rol siga siendo válido.
// TOP_N=3 significa: la stat núcleo debe estar entre las 3 más altas de sus 6 stats.
const ROLE_CORE_TOP_N = 3;

const matchesRole = (stats: BaseStats, roleLabel: string): RoleMatchResult => {
  // Score sigue calculándose para el debug panel y getRole()
  // Desempate: en un empate exacto de score (ej. Mew/Arceus con spread=0),
  // BALANCED_ROLE ("Todoterreno Puro") queda matemáticamente empatado con
  // CUALQUIER rol lineal (ver comentario junto a getRole). Array.sort es
  // estable, y como scoreAllRoles agrega BALANCED_ROLE al final del array,
  // un sort plano por score dejaría a Todoterreno Puro último entre los
  // empatados — haciendo que "entryIdx === 0" (el check de abajo) NUNCA se
  // cumpla para Mew/Arceus, aunque getRole() sí los detecte correctamente
  // como Todoterreno Puro. Este comparador prioriza BALANCED_ROLE en los
  // empates, igual que getRole, para que ambas funciones coincidan.
  const scores = scoreAllRoles(stats).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aBal = a.role.es === BALANCED_ROLE.es;
    const bBal = b.role.es === BALANCED_ROLE.es;
    if (aBal && !bBal) return -1;
    if (bBal && !aBal) return 1;
    return 0;
  });
  const topScore = scores[0].score;
  const entryIdx = scores.findIndex((s) => s.role.es === roleLabel || s.role.en === roleLabel);
  const score = entryIdx >= 0 ? scores[entryIdx].score : 0;

  // Buscar el filtro de stats núcleo para este rol
  const roleDef = ROLES.find((r) => r.es === roleLabel || r.en === roleLabel);
  const filter = roleDef ? (ROLE_CORE_FILTERS[roleDef.es] ?? null) : null;

  if (!filter) {
    // Sin filtro definido: fallback conservador (solo pasa si es rol #1)
    const passes = entryIdx === 0;
    return { passes, score, topScore, reason: passes ? "exact" : "fail" };
  }

  // (A) El Pokémon debe cumplir TODOS los umbrales absolutos del rol
  //     (evita stats genuinamente bajas, ej. Rotom con DEF:77 para Tanque Defensivo).
  const passesAbsolute = filter.required.every((req) => stats[req.stat] >= req.min);
  if (!passesAbsolute) return { passes: false, score, topScore, reason: "fail" };

  // (B) Cada stat núcleo debe estar entre el top-N de las 6 stats DEL PROPIO
  //     Pokémon (evita stats "altas pero secundarias", ej. Luvourne con DEF:85
  //     que es solo su 4ta stat, muy por detrás de SP.ATK:120).
  // NOTA: antes esto era una exclusión dura (passes: false), lo que dejaba
  // afuera del todo a Pokémon con stats muy altas EN GENERAL (ej. Xerneas:
  // ATK y SP.ATK tan altos que le "roban" el top-3 a SP.DEF, aunque SP.DEF
  // en términos absolutos sea perfectamente buena). Ahora en vez de excluirlo,
  // pasa igual pero como "partial": aparece en la lista, compite por el
  // bonus de rol más bajo de todos, y así queda relegado al final en vez
  // de desaparecer directamente.
  const passesRelative = filter.required.every(
    (req) => statRank(stats, req.stat) <= ROLE_CORE_TOP_N
  );
  if (!passesRelative) return { passes: true, score, topScore, reason: "partial" };

  const reason = entryIdx === 0 ? "exact" : score >= 28 ? "margin" : "minimum";
  return { passes: true, score, topScore, reason };
};

// Devuelve la descripción ("por qué es este rol") a partir de su label
// (en cualquiera de los dos idiomas), para mostrarla en el tooltip de hover.
const getRoleDescription = (label: string, lang: Lang): string | null => {
  const role = [...ROLES, BALANCED_ROLE].find((r) => r.es === label || r.en === label);
  if (!role) return null;
  return lang === "es" ? role.descEs : role.descEn;
};

// ─── Proxy de rol basado en tipos ────────────────────────────────────────────
// Para candidatos sin stats, estima el rol más probable a partir de los tipos.
// Se usa para filtrar recomendaciones: descarta candidatos cuyo perfil de tipo
// sugiera un rol completamente opuesto al que el equipo necesita.
// No es un sustituto del cálculo real con stats; solo excluye los casos más obvios.
const TYPE_ROLE_AFFINITY: Record<string, string[]> = {
  // Tipos ofensivos físicos
  fighting:  ["Fast Physical Attacker", "Aggressive Physical Tank", "Tough Physical Attacker", "All-Around Physical"],
  rock:      ["Fast Physical Attacker", "Aggressive Physical Tank", "Defensive Tank"],
  ground:    ["Fast Physical Attacker", "Aggressive Physical Tank", "Defensive Tank"],
  normal:    ["Fast Physical Attacker", "Tough Physical Attacker", "All-Around Physical"],
  dragon:    ["Fast Physical Attacker", "Fast Special Attacker", "Versatile Attacker"],
  // Tipos ofensivos especiales
  fire:      ["Fast Special Attacker", "Aggressive Special Tank", "All-Around Special"],
  electric:  ["Fast Special Attacker", "Fast Special Defender", "Tough Special Attacker"],
  ice:       ["Fast Special Attacker", "Aggressive Special Tank"],
  psychic:   ["Fast Special Attacker", "Aggressive Special Tank", "Special Tank"],
  water:     ["Fast Special Attacker", "All-Around Special", "Resilient Pivot"],
  grass:     ["Fast Special Attacker", "All-Around Special", "Special Tank"],
  // Tipos defensivos
  steel:     ["Defensive Tank", "Sturdy Wall", "Resilient Pivot"],
  fairy:     ["Special Tank", "Sturdy Wall", "Resilient Pivot"],
  ghost:     ["Special Tank", "Fast Defender", "Fast Special Defender"],
  dark:      ["Fast Physical Attacker", "Fast Defender", "Tough Physical Attacker"],
  poison:    ["Defensive Tank", "Special Tank", "Resilient Pivot"],
  bug:       ["Fast Physical Attacker", "Fast Defender"],
  flying:    ["Fast Physical Attacker", "Fast Defender", "Versatile Attacker"],
};

// Muro total (todos los walls): solo tipos genuinamente defensivos
const FULL_WALL_TYPES = new Set(["steel", "fairy", "rock", "poison"]);

/**
 * Devuelve true si el candidato (por tipos) es plausiblemente compatible
 * con el rol requerido. Se usa para dar un bonus de puntuación, NO para filtrar.
 */
const typeMatchesRole = (types: string[], roleLabelEn: string): boolean => {
  if (!roleLabelEn) return true;
  // Construir set de roles afines a los tipos del candidato
  const affinities = new Set<string>();
  types.forEach((ty) => {
    (TYPE_ROLE_AFFINITY[ty] ?? []).forEach((r) => affinities.add(r));
  });
  if (affinities.size === 0) return true; // sin afinidades: tipo nuevo, no excluir
  // Verificar si el rol requerido está en las afinidades
  return affinities.has(roleLabelEn);
};

const STAT_NAMES_I18N: Record<Lang, Record<keyof BaseStats, string>> = {
  es: { HP: "HP", ATK: "Ataque", DEF: "Defensa", "SP.ATK": "Ataque Esp.", "SP.DEF": "Defensa Esp.", SPE: "Velocidad" },
  en: { HP: "HP", ATK: "Attack", DEF: "Defense", "SP.ATK": "Sp. Atk",    "SP.DEF": "Sp. Def",      SPE: "Speed"    },
};

const STAT_ORDER: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];

// ─── Pokémon recomendados: dataset dinámico (TODOS los Pokémon del Builder) ────
// Importante: ya NO existe ninguna lista fija/curada de candidatos.
// `AvailablePokemon` representa exactamente la misma fuente de Pokémon que el
// Builder usa en sus buscadores (PokéAPI), cargada una vez y cacheada en memoria.
// Si PokéAPI añade un Pokémon nuevo, aparecerá automáticamente aquí también,
// sin tocar ninguna lista manual.

type AvailablePokemon = {
  slug: string;            // PokéAPI slug (clave interna + usado para el sprite)
  name: string;            // nombre display (igual al del JSON; usado para filtros por nombre)
  id: number;               // national dex ID (también usado para el sprite)
  dexId?: number;           // dexId real del JSON Z (distinto de id para las 8 entradas Mega,
                             // cuyo id es 90001-90008); usado por getZSpriteUrl para resolver
                             // el sprite correcto.
  types: [string] | [string, string];
  stats?: BaseStats | null; // stats base reales (cuando están disponibles) — se usan
                             // para calcular el rol real con el mismo helper `getRole`
                             // que usa el equipo. Si no están disponibles, el rol
                             // real del candidato simplemente no se muestra/filtra.
  isFinalEvo: boolean;      // true si es última evolución (o no evoluciona). Calculado
                             // dinámicamente desde la API — nunca desde lista manual.
  sprite?: string | null;   // URL o dataURL de sprite (usado en modo Pokémon Z)
  formLabel?: string | null; // SOLO Pokémon Z: campo crudo del JSON ("Mega", "Gmax",
                              // "Regional", "Battle", "Cosmética", "Z", o ausente).
                              // Es el campo más confiable para clasificar Megas/Gigamax
                              // en Pokémon Z — mucho más preciso que adivinar por rango
                              // de ID o por substring del nombre (ver auditoría del
                              // JSON completo: "Meganium"/"Yanmega" contienen "mega"
                              // en el nombre sin ser Megaevoluciones, por ejemplo).
  abilities?: string[] | null;   // habilidades normales (no oculta)
  hiddenAbility?: string | null; // habilidad oculta, si tiene
  learnableMoveNames?: string[] | null; // Todos los movimientos que puede aprender el
                                         // candidato, usados por el filtro "por movimiento"
                                         // de recomendaciones. En modo Z son internalNames
                                         // (nivel + MT + tutor + huevo); en modo estándar son
                                         // slugs de PokéAPI (todos los métodos que devuelve
                                         // el endpoint /pokemon, sin distinguir el método).
};

// Rangos de ID por generación (Pokedex nacional)
const GEN_RANGES: { gen: number; label: string; min: number; max: number }[] = [
  { gen: 1, label: "Gen I",   min: 1,    max: 151  },
  { gen: 2, label: "Gen II",  min: 152,  max: 251  },
  { gen: 3, label: "Gen III", min: 252,  max: 386  },
  { gen: 4, label: "Gen IV",  min: 387,  max: 493  },
  { gen: 5, label: "Gen V",   min: 494,  max: 649  },
  { gen: 6, label: "Gen VI",  min: 650,  max: 721  },
  { gen: 7, label: "Gen VII", min: 722,  max: 809  },
  { gen: 8, label: "Gen VIII",min: 810,  max: 905  },
  { gen: 9, label: "Gen IX",  min: 906,  max: 1025 },
];

// ─── IDs de legendarios, sub-legendarios, Ultra Beasts y Paradox ─────────────
// Cubre generaciones 1-9 completas.
const LEGENDARY_IDS = new Set<number>([
  // Gen 1
  144, 145, 146, 150, 151,
  // Gen 2
  243, 244, 245, 249, 250, 251,
  // Gen 3
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  // Gen 4
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  // Gen 5
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  // Gen 6
  716, 717, 718, 719, 720, 721,
  // Gen 7 (incluyendo Ultra Beasts)
  772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796,
  797, 798, 799, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809,
  // Gen 8
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,
  // Gen 9 (Paradox, Treasures of Ruin, Terapagos, Pecharunt)
  984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 996, 997,
  998, 999, 1000, 1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010,
  1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025,
  // Formas alternativas de legendarios (IDs > 10000 en PokéAPI)
  10016, // Kyurem-Black
  10017, // Kyurem-White
  10018, // Kyurem (forma base alternativa)
  10026, // Mewtwo-Mega-X
  10027, // Mewtwo-Mega-Y
  10028, // Lugia (forma alternativa)
  10085, // Shaymin-Sky
  10086, // Zygarde-10-Power-Construct
  10087, // Zygarde-50-Power-Construct
  10090, // Hoopa-Unbound
  10116, // Necrozma-Dusk-Mane
  10117, // Necrozma-Dawn-Wings
  10118, // Zygarde-10
  10119, // Zygarde-50 (otro slug)
  10120, // Zygarde-Complete
  10121, // Zygarde-Complete (Power Construct)
  10155, // Necrozma-Ultra
  10156, // Calyrex-Ice-Rider
  10157, // Calyrex-Shadow-Rider
  10158, // Eternatus-Eternamax
  10189, // Koraidon-Apex-Build (y variantes)
  10190, // Miraidon-Apex-Drive (y variantes)
]);

// Segunda capa de seguridad: slugs de legendarios conocidos.
// Cubre formas alternativas con IDs no listados y cualquier futura variante.
const LEGENDARY_SLUG_PREFIXES = new Set([
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

/** ¿Es legendario, sub-legendario, Ultra Beast o Paradox?
 *  Capa 0a: los "Fakemon nuevos" de Pokémon Z (ver POKEMON_Z_ORIGINALS) no
 *  tienen dex id real — el JSON les asigna un id propio/secuencial que
 *  puede coincidir por casualidad con el rango de un legendario real
 *  (ej. Halcombate cayendo en 888-898 o 984-1025). La mayoría no son
 *  legendarios por diseño, así que se descartan antes de mirar el id.
 *  Capa 0b: excepción — algunos fakemon SÍ son legendarios por diseño
 *  (ver Z_FAKEMON_LEGENDARY_NAMES, ej. Auretosk) y deben contar como tales
 *  aunque no tengan un id real de PokéAPI.
 *  Capa 1: comprueba el ID numérico (incluye formas alternativas > 10000).
 *  Capa 2: comprueba que el slug empiece por algún prefijo legendario conocido,
 *           cubriendo formas alternativas que la PokéAPI pueda añadir en el futuro. */
const Z_FAKEMON_NEW_NAMES = new Set([
  "Cefireon", "Royaleon", "Cherrilier", "Gourmaus", "Halcombate", "Serdupla",
  "Zanghoul", "Freyjynx", "Fobeto", "Constellar", "Luvourne", "Marolier", "Sudrasil", "Auretosk",
]);
// Fakemon nuevos que, dentro del lore de Pokémon Z, SÍ son legendarios.
// Se comprueban antes que la exclusión general de Z_FAKEMON_NEW_NAMES.
const Z_FAKEMON_LEGENDARY_NAMES = new Set([
  "Auretosk",
]);
const isLegendary = (pokemon: AvailablePokemon): boolean => {
  if (Z_FAKEMON_LEGENDARY_NAMES.has(pokemon.name)) return true;
  if (Z_FAKEMON_NEW_NAMES.has(pokemon.name)) return false;
  // OJO: para las entradas Mega/Gigamax de Pokémon Z, `id` es un id curado
  // de la fakedex (90000+) que no dice nada de la especie real — hay que
  // mirar `dexId` (el id nacional real que sí trae el JSON para esas
  // entradas) o si no, el `id` normal se sigue comprobando igual.
  if (LEGENDARY_IDS.has(pokemon.dexId ?? pokemon.id)) return true;
  if (LEGENDARY_IDS.has(pokemon.id)) return true;
  // Igual que con el id: el slug de una Mega/Gigamax trae un prefijo/sufijo
  // ("mega-zygarde", "zygarde-mega", "zygarde-gmax"...) que rompe el
  // startsWith de abajo. Se limpia antes de comparar contra los prefijos.
  const baseSlug = pokemon.slug
    .replace(/^mega-/, "")
    .replace(/-mega(-[xy])?$/, "")
    .replace(/-gmax$/, "");
  return [...LEGENDARY_SLUG_PREFIXES].some((prefix) =>
    baseSlug.startsWith(prefix)
  );
};

// ─── Color de tipo para movimientos ─────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  normal: "#a8a878", fire: "#f08030", water: "#6890f0", electric: "#f8d030",
  grass: "#78c850", ice: "#98d8d8", fighting: "#c03028", poison: "#a040a0",
  ground: "#e0c068", flying: "#a890f0", psychic: "#f85888", bug: "#a8b820",
  rock: "#b8a038", ghost: "#705898", dragon: "#7038f8", dark: "#705848",
  steel: "#b8b8d0", fairy: "#ee99ac",
};

// Compute defensive multipliers for a Pokémon type combo against every attacking type
const computeDefensiveProfile = (
  pokemonTypes: string[],
  typeRelations: Record<string, any>
): Record<string, number> => {
  const result: Record<string, number> = {};
  Object.keys(typeRelations).forEach((atkType) => {
    const rel = typeRelations[atkType];
    if (!rel) { result[atkType] = 1; return; }
    let mult = 1;
    pokemonTypes.forEach((defType) => {
      if (rel.double_damage_to?.some((t: any) => t.name === defType)) mult *= 2;
      if (rel.half_damage_to?.some((t: any) => t.name === defType)) mult *= 0.5;
      if (rel.no_damage_to?.some((t: any) => t.name === defType)) mult *= 0;
    });
    result[atkType] = mult;
  });
  return result;
};

// Perfil defensivo agregado de un equipo: para cada tipo atacante, cuántos
// Pokémon del equipo son débiles (≥2×), resistentes (≤0.5×, >0) o inmunes (0×).
type TeamDefenseProfile = Record<string, { weak: number; resist: number; immune: number; maxMult: number }>;

const computeTeamDefenseProfile = (
  teamTypesList: string[][], // un array de tipos por cada miembro del equipo (incluyendo al candidato si se simula)
  typeRelations: Record<string, any>
): TeamDefenseProfile => {
  const profile: TeamDefenseProfile = {};
  Object.keys(typeRelations).forEach((atkType) => {
    const rel = typeRelations[atkType];
    if (!rel) return;
    const doubleTo = new Set(rel.double_damage_to?.map((t: any) => t.name) ?? []);
    const halfTo = new Set(rel.half_damage_to?.map((t: any) => t.name) ?? []);
    const noTo = new Set(rel.no_damage_to?.map((t: any) => t.name) ?? []);
    let weak = 0, resist = 0, immune = 0, maxMult = 0;
    teamTypesList.forEach((pokeTypes) => {
      const types = pokeTypes.filter(Boolean);
      if (!types.length) return;
      let mult = 1;
      types.forEach((def) => {
        if (noTo.has(def)) mult *= 0;
        else if (doubleTo.has(def)) mult *= 2;
        else if (halfTo.has(def)) mult *= 0.5;
      });
      if (mult === 0) immune++;
      else if (mult >= 2) { weak++; maxMult = Math.max(maxMult, mult); }
      else if (mult <= 0.5) resist++;
    });
    profile[atkType] = { weak, resist, immune, maxMult };
  });
  return profile;
};

// ─── Motor de puntuación de candidatos ──────────────────────────────────────
// Simula cómo cambiaría el perfil defensivo del equipo si se añadiera cada
// Pokémon candidato, y le asigna una puntuación siguiendo, en este orden de
// prioridad:
//   1) Reducir las debilidades más graves del equipo (×3, ×4...).
//   2) Evitar crear nuevas debilidades críticas.
//   3) Aumentar resistencias e inmunidades.
//   4) Mejorar el equilibrio general del equipo.
// No siempre es posible cumplir las cuatro a la vez, así que cada prioridad
// pesa más que la suma de todas las de menor prioridad (pesos en cascada).
type CandidateScoreResult = {
  score: number;
  priority1: number;        // reducir debilidades graves existentes
  priority2: number;        // penalización por nuevas debilidades críticas
  priority3: number;        // resistencias / inmunidades nuevas
  priority4: number;        // equilibrio general
  reduces: string[];        // tipos cuya debilidad de equipo se reduce o elimina
  immunities: string[];     // tipos a los que el candidato es inmune (0×) y el equipo era débil
  newResistances: string[]; // tipos donde el candidato aporta una resistencia nueva al equipo
  criticalAdds: string[];   // tipos donde se crea o empeora una debilidad crítica
  addsWeakness: string[];   // tipos donde el candidato es débil pero sin llegar a ser crítico
};

const scorePokemonCandidate = (
  team: { types: string[] }[],
  candidateTypes: string[],
  typeRelations: Record<string, any>
): CandidateScoreResult => {
  const currentTypesList = team.map((s) => s.types).filter((tt) => tt.filter(Boolean).length > 0);
  const beforeProfile = computeTeamDefenseProfile(currentTypesList, typeRelations);
  const afterProfile = computeTeamDefenseProfile([...currentTypesList, candidateTypes], typeRelations);
  const candidateProfile = computeDefensiveProfile(candidateTypes, typeRelations);

  const reduces: string[] = [];
  const immunities: string[] = [];
  const newResistances: string[] = [];
  const criticalAdds: string[] = [];
  const addsWeakness: string[] = [];

  let priority1 = 0; // reducir debilidades graves existentes (peso más alto)
  let priority2 = 0; // penalización por nuevas debilidades críticas
  let priority3 = 0; // resistencias / inmunidades nuevas
  let priority4 = 0; // equilibrio general (resto de matices)

  Object.keys(typeRelations).forEach((atkType) => {
    const before = beforeProfile[atkType] ?? { weak: 0, resist: 0, immune: 0, maxMult: 0 };
    const candidateMult = candidateProfile[atkType] ?? 1;
    const teamWasWeak = before.weak > 0;
    const teamWasSeverelyWeak = before.weak >= 2 || before.maxMult >= 4; // "debilidad grave" del equipo

    // ── Prioridad 1: reducir las debilidades más graves ──────────────────
    if (teamWasWeak && candidateMult === 0) {
      immunities.push(atkType);
      reduces.push(atkType);
      priority1 += (teamWasSeverelyWeak ? 3 : 1.6) * before.weak;
    } else if (teamWasWeak && candidateMult <= 0.5) {
      reduces.push(atkType);
      priority1 += (teamWasSeverelyWeak ? 2 : 1) * before.weak;
    }

    // ── Prioridad 2: evitar generar/empeorar debilidades críticas ────────
    // Una debilidad se considera crítica para el equipo cuando, tras añadir
    // al candidato, hay 2+ Pokémon débiles a ese tipo, o el candidato es
    // ×4 (debilidad doble) frente a un tipo, o una debilidad ×2 existente
    // del equipo se convierte en ×4 al incorporar este Pokémon.
    // Fix: también penalizar cuando tras añadir al candidato hay ≥3 miembros
    // débiles al mismo tipo (triple debilidad de equipo = crítico absoluto).
    if (candidateMult >= 2) {
      const afterWeak = afterProfile[atkType]?.weak ?? 0;
      const becomesCritical =
        candidateMult >= 4 ||
        afterWeak >= 2;
      const becomesAbsoluteCritical = afterWeak >= 3;
      if (becomesAbsoluteCritical) {
        criticalAdds.push(atkType);
        priority2 -= 20; // penalización máxima: triple debilidad de equipo
      } else if (becomesCritical) {
        criticalAdds.push(atkType);
        priority2 -= candidateMult >= 4 ? 10 : 6;
      } else {
        addsWeakness.push(atkType);
        priority2 -= 0.8;
      }
    }

    // ── Prioridad 3: aumentar resistencias e inmunidades ──────────────────
    // Mejora: rendimientos decrecientes según cuántos miembros del equipo
    // YA resisten ese tipo (before.resist). Resistir un tipo que nadie
    // cubre todavía vale su puntaje completo; resistir un tipo que ya tiene
    // 2-3 resistentes en el equipo aporta cada vez menos (la cobertura
    // real ya está resuelta, es redundancia, no progreso).
    if (!teamWasWeak) {
      const depthFactor = 1 / (1 + before.resist);
      if (candidateMult === 0) {
        newResistances.push(atkType);
        priority3 += 1.2 * depthFactor;
      } else if (candidateMult <= 0.5) {
        newResistances.push(atkType);
        priority3 += 0.6 * depthFactor;
      }
    }
  });

  // ── Prioridad 4: equilibrio general ─────────────────────────────────────
  // Pequeño ajuste por el número neto de tipos resueltos vs. número de tipos
  // de los que el candidato es débil en general (mejora la robustez global,
  // no solo frente a las debilidades actuales del equipo).
  const candidateWeakCount = Object.values(candidateProfile).filter((m) => m >= 2).length;
  const candidateResistCount = Object.values(candidateProfile).filter((m) => m <= 0.5).length;
  priority4 += (candidateResistCount - candidateWeakCount) * 0.1;

  // Pesos en cascada: cada prioridad domina sobre la suma de las siguientes.
  const score = priority1 * 1000 + priority2 * 100 + priority3 * 10 + priority4;

  return { score, priority1, priority2, priority3, priority4, reduces, immunities, newResistances, criticalAdds, addsWeakness };
};




// Devuelve todos los tipos atacantes frente a los que el Pokémon es débil (×2 o más)
const getCandidateWeaknesses = (
  pokemonTypes: string[],
  typeRelations: Record<string, any>
): string[] => {
  const types = pokemonTypes.filter(Boolean);
  if (!types.length || !Object.keys(typeRelations).length) return [];
  return Object.keys(typeRelations).filter((atkType) => {
    const rel = typeRelations[atkType];
    if (!rel) return false;
    const doubleTo = new Set(rel.double_damage_to?.map((t: any) => t.name) ?? []);
    const halfTo   = new Set(rel.half_damage_to?.map((t: any) => t.name) ?? []);
    const noTo     = new Set(rel.no_damage_to?.map((t: any) => t.name) ?? []);
    let mult = 1;
    types.forEach((def) => {
      if (noTo.has(def)) mult *= 0;
      else if (doubleTo.has(def)) mult *= 2;
      else if (halfTo.has(def)) mult *= 0.5;
    });
    return mult >= 2;
  });
};
const isValidMove = (value: any): value is Move =>
  value && typeof value.name === "string" && typeof value.category === "string" && (value.type === null || typeof value.type === "string");
const isValidSlot = (value: any): value is Slot =>
  value &&
  typeof value.name === "string" &&
  typeof value.isFake === "boolean" &&
  Array.isArray(value.types) &&
  value.types.length === 2 &&
  value.types.every((t: any) => typeof t === "string") &&
  (value.sprite === null || typeof value.sprite === "string") &&
  Array.isArray(value.moves) &&
  value.moves.length === 4 &&
  value.moves.every(isValidMove);

// ─── Internacionalización ───────────────────────────────────────────────────

type Lang = "es" | "en";

/** Nombres de tipo en español (clave = nombre interno de la API en inglés) */
const TYPE_NAMES_ES: Record<string, string> = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico",
  grass: "Planta", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
  ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
  rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
  steel: "Acero", fairy: "Hada",
};

/** Nombres de tipo en inglés (capitalizado) */
const TYPE_NAMES_EN: Record<string, string> = {
  normal: "Normal", fire: "Fire", water: "Water", electric: "Electric",
  grass: "Grass", ice: "Ice", fighting: "Fighting", poison: "Poison",
  ground: "Ground", flying: "Flying", psychic: "Psychic", bug: "Bug",
  rock: "Rock", ghost: "Ghost", dragon: "Dragon", dark: "Dark",
  steel: "Steel", fairy: "Fairy",
};

const getTypeName = (apiKey: string, lang: Lang): string =>
  (lang === "es" ? TYPE_NAMES_ES[apiKey] : TYPE_NAMES_EN[apiKey]) ?? apiKey;

const getMoveName = (move: Move, lang: Lang): string => {
  if (move.isFake) return move.name;
  if (lang === "es" && move.nameEs) return move.nameEs;
  return move.name;
};

/** Todas las strings de la UI */
const UI: Record<Lang, Record<string, string>> = {
  es: {
    // Header
    appTitle: "PokeRun Builder",
    appSubtitle: "Arma tu equipo, analízalo y encuentra sus puntos débiles.",
    statSlots: "6 slots", statMoves: "4 por slot", statAnalysis: "En tiempo real",
    labelSlots: "Equipos", labelMoves: "Movimientos", labelAnalysis: "Análisis",
    guideTypes: "Tipo", guideAbilities: "Habilidad", guideMoves: "Movimientos",
    guideTeamSection: "En esta sección arma tu equipo de hasta 6 Pokémon. Busca cada Pokémon por su nombre, elige sus movimientos y revisa sus tipos y habilidades. La información de debilidades y recomendaciones más abajo se actualiza automáticamente a medida que completas tu equipo.",
    guideDefenseSection: "Aquí se muestra cómo le va a tu equipo defensivamente según los tipos de cada Pokémon. Las debilidades son los tipos de ataque que le hacen más daño a tu equipo, y las resistencias son los tipos frente a los que tu equipo aguanta mejor. Úsalo para detectar puntos flacos antes de que te sorprendan en batalla.",
    guideCoverageSection: "Aquí se muestra qué tan bien atacan los movimientos de tu equipo a los demás tipos. Si algún tipo aparece sin cobertura, significa que ningún Pokémon de tu equipo tiene un movimiento eficaz contra él, y conviene agregar uno que lo cubra.",
    guideRecommendedSection: "Esta lista sugiere Pokémon que podrían complementar bien a tu equipo actual, tomando en cuenta sus tipos, sus debilidades y lo que le falta cubrir. Puedes usar los filtros de abajo para acotar la búsqueda por tipo, habilidad, generación o estadística más alta.",
    guideReplaceSection: "Aquí se muestra qué Pokémon de tu equipo aporta menos en este momento, considerando su cobertura de tipos, si repite algo que ya cubre otro miembro y sus debilidades compartidas. Es una guía útil si estás pensando en cambiar a alguno por otro más útil para el equipo.",
    // Equipo
    myTeam: "Mi Equipo", saveTemplates: "Plantillas", clearTeam: "Limpiar equipo",
    onlyLearnableMoves: "Solo aprendibles", onlyLearnableMovesTitle: "Si está activo, el buscador de movimientos solo sugiere los que cada Pokémon puede aprender de verdad (nivel, tutor o huevo), en vez de todos los movimientos existentes.",
    moveBadgeLevelPrefix: "Nv.", moveBadgeMt: "MT", moveBadgeTutor: "Tutor", moveBadgeEgg: "Huevo",
    fakemonModeLabel: "Fakemon",
    dragHandle: "arrastrar", noSprite: "Sin sprite", noTypes: "Sin tipos",
    searchPokemon: "Buscar Pokémon por nombre", searchFakemon: "Nombre de Fakemon",
    btnSearch: "Buscar", checkFakemon: "Fakemon", btnConfigure: "Configurar",
    fakemonConfigured: "Fakemon configurado", noTypesSet: "Sin tipos definidos",
    // Movimientos
    attackSlot: "Ataque", moveInvented: "Inventado", movePlaceholder: "Movimiento",
    fakeMovePlaceholder: "Nombre del movimiento",
    fakeTypeLabel: "Tipo inventado", hpTypeLabel: "Tipo Poder Oculto",
    catPhysical: "Físico", catSpecial: "Especial", catStatus: "Estado",
    // Análisis
    weaknesses: "Debilidades", strengths: "Resistencias",
    superEffective: "Superefectivo contra",
    atkSuggTitle: "💡 Sugerencias de tipo de ataque",
    atkSuggCovers: "cubre", atkSuggUncovered: "tipo(s) sin cobertura",
    atkSuggAlso: "también es eficaz contra:",
    coverageTitle: "Cobertura ofensiva",
    coverageTypesCovered: "Tipos cubiertos superefectivamente",
    coverageOf: "tipos",
    balanceSugg: "Sugerencias de balance", balancedTeam: "Equipo bien equilibrado",
    suggWeaknessPrefix: "Tu equipo tiene", suggWeaknessSuffix: "debilidad a",
    suggUncoveredPrefix: "Sin cobertura superefectiva contra",
    recommendedPokemon: "Pokémon recomendados",
    recReduces: "Reduce la presión frente a",
    recImmune: "Inmune a",
    recAdds: "Añade debilidad a",
    recNoNewCritical: "Sin nuevas debilidades importantes",
    recAddsResistances: "Aporta nuevas resistencias",
    loadingRecommendations: "Buscando el mejor encaje para tu equipo…",
    loadPokemon: "Añade Pokémon para ver sugerencias",
    // Filtros de recomendaciones
    recFilterTitle: "Filtros",
    recFilterType: "Filtrar por tipo",
    recFilterGen: "Generación",
    recFilterGenAll: "Todas",
    recFilterDiscard: "Descartar",
    recFilterDiscarded: "descartados",
    recFilterReset: "Limpiar filtros",
    recFilterNoResults: "Sin resultados con estos filtros",
    statsBalance: "Balance de stats",
    loadStats: "Añade al menos 3 Pokémon para ver el análisis de estadísticas",
    statLevelHigh: "ALTO", statLevelMid: "MEDIO", statLevelLow: "BAJO",
    redundantRoles: "⚠️ Roles repetidos",
    redundantDesc: "con el mismo perfil", redundantNote: "— el equipo tiene demasiada concentración en un mismo rol",
    roleSuggTitle: "Roles que le faltan al equipo",
    roleExisting: "Ya tienes", roleExistingMid: "con este rol, pero el equipo aún flojea en",
    roleNew: "Hueco crítico", roleNewAlt: "Hueco", roleNewEnd: "— podrías añadir un",
    rolesBelowBest: "por debajo", teamRoles: "Roles del equipo",
    basedOn: "Calculado con", basedOnEnd: "Pokémon con estadísticas", balancedOk: "✅ ¡Buen trabajo! Tu equipo tiene stats y roles bien balanceados.",
    // Summary + nuevos filtros de recomendaciones
    summaryTitle: "Pokémon ideal para completar el equipo",
    bestSingle: "Mejor tipo individual", bestDual: "✨ Mejor doble tipo",
    summaryResists: "resiste:", summaryCovers: "cubre:",
    recFilterFinalEvo: "Solo últimas evoluciones",
    recFilterLegendary: "Mostrar legendarios",
    recFilterOnlyOriginals: "originales",
    recFilterNoDupTypes: "Evitar tipos repetidos",
    recFilterMatchRole: "Mostrar solo Pokémon del rol recomendado",
    recFilterPrioritizeCoverage: "Priorizar cobertura de tipos",
    recFilterSortStatTitle: "Ordenar por stat más alta",
    recFilterSortStatNone: "Sin ordenar",
    recFilterMinStatsTitle: "Mínimos por stat",
    recFilterMinStatsNote: "Deja vacío lo que no quieras filtrar",
    recRealRole: "Rol",
    recRole: "Rol recomendado",
    recWhyTitle: "Por qué se recomienda",
    recNewImmunities: "Inmunidades nuevas",
    recNewResistances: "Resistencias nuevas",
    recNewWeaknesses: "Debilidades que cubre",
    recCandidateWeaknesses: "Débil a",
    // Plantillas
    templateTitle: "💾 Plantillas guardadas", templateSubtitle: "Guarda y carga distintos equipos",
    templateClose: "Cerrar", templateEmpty: "No hay plantillas guardadas aún",
    templateLoad: "Cargar", templateOverwrite: "Sobreescribir", templateDelete: "Borrar",
    templateSaveBtn: "+ Guardar equipo actual como nueva plantilla",
    templateNamePlaceholder: "Plantilla", templateSave: "Guardar", templateCancel: "✕",
    templateMaxReached: "Máximo", templateMaxEnd: "plantillas. Borra una para guardar otra.",
    templateEmptyTeam: "Equipo vacío", templatePokemon: "Pokémon",
    // Fakemon config
    configTitle: "Configurar Fakemon", configSubtitle: "Selecciona hasta 2 tipos y define stats opcionales.",
    configClose: "Cerrar", configImage: "Imagen", configSearchSprite: "Buscar sprite de Pokémon",
    configOrUpload: "O subir imagen", configChooseFile: "Elegir archivo",
    configRemoveImg: "Quitar imagen", configSearchPlaceholder: "Ej: Charizard",
    configTypes: "Tipos", configTypesNote: "Máximo 2 tipos. Si no defines tipos, el Fakemon no aportará debilidades ni resistencias.",
    configStats: "Stats (opcional)", configStatsNote: "Si no ingresas stats, este Fakemon no contribuirá al análisis de stats.",
    configHide: "Ocultar", configShow: "Mostrar",
    configCancel: "Cancelar", configSave: "Guardar",
    liveBadge: "En vivo",
    // Puntuación del equipo
    teamScore: "Puntuación",
    teamScoreTitle: "Puntuación del equipo",
    teamScoreNoData: "Añade Pokémon con tipos para calcular la puntuación",
    teamScoreOffense: "Cobertura ofensiva",
    teamScoreOffenseDesc: "Qué porcentaje de tipos puede golpear tu equipo de forma superefectiva.",
    teamScoreDefense: "Solidez defensiva",
    teamScoreDefenseDesc: "Qué tan expuesto está tu equipo a debilidades compartidas por varios Pokémon a la vez.",
    teamScoreStats: "Balance de stats",
    teamScoreStatsDesc: "Si las estadísticas promedio del equipo están repartidas o tienen huecos importantes.",
    teamScoreRoles: "Diversidad de roles",
    teamScoreRolesDesc: "Si el equipo cubre roles variados o se repite demasiado el mismo perfil.",
    teamScoreNotEnoughData: "datos insuficientes",
    teamScoreGradeS: "Excelente", teamScoreGradeA: "Muy bueno", teamScoreGradeB: "Bueno",
    teamScoreGradeC: "Mejorable", teamScoreGradeD: "Débil",
    // Modo de vista
    modeSimple: "Sencillo",
    modeAdvanced: "Avanzado",
    modeSimpleDesc: "Lo esencial para armar tu equipo",
    modeAdvancedDesc: "Todos los detalles y herramientas de análisis",
    advancedOnlyNote: "Disponible en modo avanzado",
    // Sprite editor
    editorTitle: "Ajustar encuadre",
    editorSubtitle: "Arrastra para reencuadrar · usa el zoom para escalar",
    editorZoom: "Zoom",
    editorReset: "Restablecer",
    editorSave: "Aplicar",
    editorCancel: "Cancelar",
    editorEditFrame: "✎ Ajustar encuadre",
  },
  en: {
    appTitle: "PokeRun Builder",
    appSubtitle: "Build your team, analyze, and find its weak spots.",
    statSlots: "6 slots", statMoves: "4 per slot", statAnalysis: "Real-time",
    labelSlots: "Team slots", labelMoves: "Moves", labelAnalysis: "Analysis",
    guideTypes: "Type", guideAbilities: "Ability", guideMoves: "Moves",
    guideTeamSection: "In this section you build your team of up to 6 Pokémon. Search for each Pokémon by name, choose its moves, and review its types and abilities. The weaknesses and recommendations below update automatically as you complete your team.",
    guideDefenseSection: "Here you can see how your team holds up defensively based on each Pokémon's types. Weaknesses are the attack types that deal the most damage to your team, and resistances are the types your team handles best. Use it to spot weak points before they surprise you in battle.",
    guideCoverageSection: "Here you can see how well your team's moves hit the other types. If a type shows up with no coverage, it means no Pokémon on your team has an effective move against it, and you may want to add one that does.",
    guideRecommendedSection: "This list suggests Pokémon that could complement your current team well, based on their types, weaknesses, and what your team still needs to cover. You can use the filters below to narrow the search by type, ability, generation, or highest stat.",
    guideReplaceSection: "Here you can see which Pokémon on your team is contributing the least right now, based on its type coverage, whether it repeats coverage another member already provides, and shared weaknesses. It's a useful guide if you're thinking about swapping one out for something more useful.",
    myTeam: "My Team", saveTemplates: "Templates", clearTeam: "Clear team",
    onlyLearnableMoves: "Learnable only", onlyLearnableMovesTitle: "When on, the move search only suggests moves each Pokémon can actually learn (level-up, tutor, or egg), instead of every move that exists.",
    moveBadgeLevelPrefix: "Lv.", moveBadgeMt: "TM", moveBadgeTutor: "Tutor", moveBadgeEgg: "Egg",
    fakemonModeLabel: "Fakemon mode",
    dragHandle: "drag", noSprite: "No sprite", noTypes: "No types",
    searchPokemon: "Search Pokémon by name", searchFakemon: "Fakemon name",
    btnSearch: "Search", checkFakemon: "Fakemon", btnConfigure: "Configure",
    fakemonConfigured: "Fakemon configured", noTypesSet: "No types set",
    attackSlot: "Move", moveInvented: "Custom", movePlaceholder: "Move name",
    fakeMovePlaceholder: "Move name",
    fakeTypeLabel: "Custom type", hpTypeLabel: "Hidden Power type",
    catPhysical: "Physical", catSpecial: "Special", catStatus: "Status",
    weaknesses: "Weaknesses", strengths: "Resistances",
    superEffective: "Super effective against",
    atkSuggTitle: "💡 Attack type suggestions",
    atkSuggCovers: "covers", atkSuggUncovered: "uncovered type(s):",
    atkSuggAlso: "also effective against:",
    coverageTitle: "Offensive Coverage",
    coverageTypesCovered: "Types covered super-effectively",
    coverageOf: "types",
    balanceSugg: "Balance suggestions", balancedTeam: "Well-balanced team",
    suggWeaknessPrefix: "Your team has", suggWeaknessSuffix: "weakness to",
    suggUncoveredPrefix: "No super-effective coverage against",
    recommendedPokemon: "Recommended Pokémon",
    recReduces: "Reduces pressure from",
    recImmune: "Immune to",
    recAdds: "Adds weakness to",
    recNoNewCritical: "No new major weaknesses",
    recAddsResistances: "Adds new resistances",
    loadingRecommendations: "Finding the best fit for your team…",
    loadPokemon: "Add Pokémon to see suggestions",
    // Recommendation filters
    recFilterTitle: "Filters",
    recFilterType: "Filter by type",
    recFilterGen: "Generation",
    recFilterGenAll: "All",
    recFilterDiscard: "Discard",
    recFilterDiscarded: "discarded",
    recFilterReset: "Clear filters",
    recFilterNoResults: "No results with these filters",
    statsBalance: "Stats balance",
    loadStats: "Add at least 3 Pokémon to see the stats breakdown",
    statLevelHigh: "HIGH", statLevelMid: "MID", statLevelLow: "LOW",
    redundantRoles: "⚠️ Overlapping roles",
    redundantDesc: "with the same profile", redundantNote: "— your team is leaning too hard on one role",
    roleSuggTitle: "Missing roles in your team",
    roleExisting: "You already have", roleExistingMid: "with this role, but the team is still weak in",
    roleNew: "Critical gap", roleNewAlt: "Gap", roleNewEnd: "— consider adding a",
    rolesBelowBest: "behind", teamRoles: "Team roles",
    basedOn: "Calculated from", basedOnEnd: "Pokémon with stats", balancedOk: "✅ Great job! Your team has well-balanced stats and roles.",
    summaryTitle: "Ideal Pokémon to complete the team",
    bestSingle: "Best single type", bestDual: "✨ Best dual type",
    summaryResists: "resists:", summaryCovers: "covers:",
    recFilterFinalEvo: "Final evolutions only",
    recFilterLegendary: "Show legendaries",
    recFilterOnlyOriginals: "originals",
    recFilterNoDupTypes: "Avoid type duplicates",
    recFilterMatchRole: "Show only Pokémon with the recommended role",
    recFilterPrioritizeCoverage: "Prioritize type coverage",
    recFilterSortStatTitle: "Sort by highest stat",
    recFilterSortStatNone: "No sorting",
    recFilterMinStatsTitle: "Minimums per stat",
    recFilterMinStatsNote: "Leave empty what you don't want to filter",
    recRealRole: "Role",
    recRole: "Recommended role",
    recWhyTitle: "Why recommended",
    recNewImmunities: "New immunities",
    recNewResistances: "New resistances",
    recNewWeaknesses: "Weaknesses covered",
    recCandidateWeaknesses: "Weak to",
    templateTitle: "💾 Saved templates", templateSubtitle: "Save and load different teams",
    templateClose: "Close", templateEmpty: "No templates saved yet",
    templateLoad: "Load", templateOverwrite: "Overwrite", templateDelete: "Delete",
    templateSaveBtn: "+ Save current team as new template",
    templateNamePlaceholder: "Template", templateSave: "Save", templateCancel: "✕",
    templateMaxReached: "Maximum", templateMaxEnd: "templates. Delete one to save another.",
    templateEmptyTeam: "Empty team", templatePokemon: "Pokémon",
    configTitle: "Configure Fakemon", configSubtitle: "Select up to 2 types and define optional stats.",
    configClose: "Close", configImage: "Image", configSearchSprite: "Search Pokémon sprite",
    configOrUpload: "Or upload image", configChooseFile: "Choose file",
    configRemoveImg: "Remove image", configSearchPlaceholder: "e.g. Charizard",
    configTypes: "Types", configTypesNote: "Max 2 types. Without types, Fakemon won't contribute weaknesses or resistances.",
    configStats: "Stats (optional)", configStatsNote: "Without stats, this Fakemon won't contribute to stats analysis.",
    configHide: "Hide", configShow: "Show",
    configCancel: "Cancel", configSave: "Save",
    liveBadge: "Live",
    // Team score
    teamScore: "Score",
    teamScoreTitle: "Team score",
    teamScoreNoData: "Add Pokémon with types to calculate the score",
    teamScoreOffense: "Offensive coverage",
    teamScoreOffenseDesc: "What percentage of types your team can hit super-effectively.",
    teamScoreDefense: "Defensive soundness",
    teamScoreDefenseDesc: "How exposed your team is to weaknesses shared by several Pokémon at once.",
    teamScoreStats: "Stat balance",
    teamScoreStatsDesc: "Whether the team's average stats are well spread out or have major gaps.",
    teamScoreRoles: "Role diversity",
    teamScoreRolesDesc: "Whether the team covers varied roles or repeats the same profile too much.",
    teamScoreNotEnoughData: "not enough data",
    teamScoreGradeS: "Excellent", teamScoreGradeA: "Very good", teamScoreGradeB: "Good",
    teamScoreGradeC: "Needs work", teamScoreGradeD: "Weak",
    // View mode
    modeSimple: "Simple",
    modeAdvanced: "Advanced",
    modeSimpleDesc: "The essentials to build your team",
    modeAdvancedDesc: "All the details and analysis tools",
    advancedOnlyNote: "Available in advanced mode",
    // Sprite editor
    editorTitle: "Adjust framing",
    editorSubtitle: "Drag to reframe · use zoom to scale",
    editorZoom: "Zoom",
    editorReset: "Reset",
    editorSave: "Apply",
    editorCancel: "Cancel",
    editorEditFrame: "✎ Adjust frame",
  },
};

// ────────────────────────────────────────────────────────────────────────────

// Convert spaces to hyphens for API queries
const formatForAPI = (name: string): string => name.toLowerCase().replace(/\s+/g, "-");

// A partir del array `moves` que devuelve PokéAPI, arma un mapa
// { slugDeMovimiento: { type, level } } indicando cómo lo aprende el
// Pokémon: por nivel (con el nivel), por MT/MO ("machine"), por tutor o por
// huevo. Cuando un movimiento tiene varias formas de aprenderse (distintos
// juegos/generaciones), se prioriza nivel > MT > tutor > huevo.
const buildLearnMethodsFromApi = (
  moves: any
): Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> => {
  const result: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> = {};
  if (!Array.isArray(moves)) return result;
  const priority = (m: string) => (m === "level-up" ? 0 : m === "machine" ? 1 : m === "tutor" ? 2 : m === "egg" ? 3 : 4);
  moves.forEach((mv: any) => {
    const mname = mv?.move?.name;
    if (!mname) return;
    const details = Array.isArray(mv.version_group_details) ? mv.version_group_details : [];
    let best: any = null;
    details.forEach((d: any) => {
      const method = d?.move_learn_method?.name;
      if (!best || priority(method) < priority(best?.move_learn_method?.name)) best = d;
    });
    if (!best) return;
    const method = best.move_learn_method?.name;
    if (method === "level-up") result[mname] = { type: "level", level: best.level_learned_at || undefined };
    else if (method === "machine") result[mname] = { type: "mt" };
    else if (method === "tutor") result[mname] = { type: "tutor" };
    else if (method === "egg") result[mname] = { type: "egg" };
  });
  return result;
};

// Convert hyphens to spaces and capitalize each word
const formatForDisplay = (name: string): string =>
  name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// ─── Formas regionales / alternas de PokéAPI ────────────────────────────────
// Mapeo general (no exclusivo de Pokémon Z) para cuando la contraparte
// "estándar" de una especie no es su forma base de Kanto/nacional, sino una
// variante regional/alterna específica (ej. Raichu → Raichu-Alola). Útil en
// cualquier punto de la app que busque el slug oficial de PokéAPI a partir
// de un nombre de especie: en vez de asumir siempre `nombre.toLowerCase()`,
// se consulta este mapeo primero. Clave: nombre de especie en minúsculas tal
// como aparece en el JSON de Pokémon Z. Valor: { slug, display } de la forma
// de PokéAPI que se debe usar en su lugar.
// Para agregar un nuevo caso (otra especie con forma regional/alterna),
// simplemente se agrega una entrada más acá; no hace falta tocar nada más.
const REGIONAL_FORM_OVERRIDE: Record<string, { slug: string; display: string }> = {
  raichu: { slug: "raichu-alola", display: "Raichu Alola" },
};

// Dado el nombre "plano" de una especie (sin sufijos " Z"/"Mega"), devuelve
// el slug de PokéAPI y el nombre a mostrar que corresponden a su forma
// "estándar" relevante: la regional/alterna si está en REGIONAL_FORM_OVERRIDE,
// o si no, la forma base normal (slug = nombre con guiones).
const getStandardForm = (speciesName: string): { slug: string; display: string } => {
  const key = speciesName.toLowerCase();
  if (REGIONAL_FORM_OVERRIDE[key]) return REGIONAL_FORM_OVERRIDE[key];
  const slug = speciesName.toLowerCase().replace(/\s+/g, "-");
  return { slug, display: formatForDisplay(slug) };
};

const normalizeMoveSearch = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ─── Sprite transform helpers ────────────────────────────────────────────────

// Igual que Z_SPRITE_ZOOM_OVERRIDES (arriba, usado en las tarjetas de
// recomendación por id), pero para los slots del equipo: ahí no se guarda
// el id del Pokémon Z en el Slot (solo name/sprite/spriteTransform), así
// que el override puntual se resuelve por el nombre final ya formateado
// (getZDisplayName es determinístico y no depende del idioma para estos
// casos: "Mega <especie> Z"). Mismo caso, mismo factor, ahora también con
// offset de posición (x/y en %, mismo sistema que SpriteTransform) para
// recentrar el arte cuando el zoom extra descentra el sprite dentro del
// frame (ej. el fuego de Mega Delphox Z queda desplazado tras el zoom).
type ZSlotSpriteOverride = { zoom?: number; x?: number; y?: number };
const Z_SLOT_SPRITE_ZOOM_OVERRIDES: Record<string, ZSlotSpriteOverride> = {
  "Mega Delphox Z": { zoom: 1.6, x: -7, y: -20 },
  "Tornadus Tótem": { x: 20 },
};

/** Convert a SpriteTransform into CSS object-position + scale values.
 *  frameSize = the rendered frame size in px (e.g. 112 for w-28 h-28).
 *  override = ajuste puntual adicional (ver Z_SLOT_SPRITE_ZOOM_OVERRIDES):
 *  zoom se multiplica sobre el scale del usuario, x/y (en %) se suman a su
 *  pan manual — ninguno de los dos pisa lo que el usuario guardó.
 */
function buildSpriteStyle(transform: SpriteTransform | null | undefined, override?: ZSlotSpriteOverride): React.CSSProperties {
  const tx = transform ?? DEFAULT_TRANSFORM;
  // zoom: 0 → scale 1.0, +100 → scale 2.0, -100 → scale 0.5
  const scale = (tx.zoom >= 0 ? 1 + tx.zoom / 100 : 1 + tx.zoom / 200) * (override?.zoom ?? 1);
  const posX = tx.x + (override?.x ?? 0);
  const posY = tx.y + (override?.y ?? 0);
  return {
    transform: `translate(${posX}%, ${posY}%) scale(${scale})`,
    transformOrigin: "center center",
  };
}

/** <img> que evita el "parpadeo" de sprites:
 *  - Mientras la imagen (src) no haya terminado de cargar, muestra el
 *    placeholder (Pokéball) en vez de una imagen vieja o sin estilo aplicar.
 *  - Precarga la imagen real oculta (display:none) y, recién en su onLoad,
 *    la muestra ya con el style/transform puesto — así nunca se ve "cruda"
 *    (sin recortar/redimensionar) un instante antes de ajustarse.
 *  - Si `src` cambia (nuevo Pokémon), se resetea el estado de "cargado" para
 *    no seguir mostrando el sprite anterior mientras llega el nuevo.
 */
function SpriteImg({
  src,
  alt,
  className,
  style,
  onError,
  placeholderClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: () => void;
  placeholderClassName?: string;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  useEffect(() => {
    setLoadedSrc(null);
  }, [src]);

  if (!src) {
    return <PokeballIcon className={placeholderClassName ?? "h-5 w-5 opacity-40"} />;
  }

  const isReady = loadedSrc === src;

  return (
    <>
      {isReady ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={className} style={style} onError={onError} />
      ) : (
        <PokeballIcon className={placeholderClassName ?? "h-5 w-5 opacity-40"} />
      )}
      {!isReady && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          style={{ display: "none" }}
          onLoad={() => setLoadedSrc(src)}
          onError={onError}
        />
      )}
    </>
  );
}

/** Dropdown "teletransportado" al final del <body> vía portal, posicionado con
 *  `position: fixed` calculando las coordenadas del elemento ancla en cada
 *  apertura/scroll/resize. Se usa para listas desplegables (como las
 *  sugerencias de movimientos) que de otro modo podrían quedar recortadas o
 *  tapadas por contenedores padres con su propio stacking context / overflow
 *  (tarjetas con blur, paneles con scroll, etc.) — al vivir fuera de esos
 *  contenedores, siempre se pinta por encima de todo el contenido normal.
 */
function AnchoredDropdown({
  anchorEl,
  open,
  children,
}: {
  anchorEl: HTMLElement | null;
  open: boolean;
  children: React.ReactNode;
}) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setRect(null);
      return;
    }
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      setRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    update();
    const onScroll = (e: Event) => {
      // Si el scroll ocurre DENTRO del propio dropdown (ej. arrastrando su
      // scrollbar interno), no hay que reposicionarlo: el ancla (el input)
      // no se movió. Antes esto disparaba un setRect por cada pixel
      // scrolleado, forzando renders de más y, en la práctica, "peleando"
      // con el drag del scrollbar y haciéndolo saltar de vuelta arriba.
      const target = e.target as Node | null;
      if (portalRef.current && target && portalRef.current.contains(target)) return;
      update();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorEl]);

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <div ref={portalRef} data-move-dropdown="true" style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 9999 }}>
      {children}
    </div>,
    document.body
  );
}

// ─── Sprite Editor Modal ─────────────────────────────────────────────────────

type SpriteEditorProps = {
  src: string;
  initialTransform: SpriteTransform;
  lang: Lang;
  onSave: (t: SpriteTransform) => void;
  onCancel: () => void;
};

function SpriteEditorModal({ src, initialTransform, lang, onSave, onCancel }: SpriteEditorProps) {
  const t = UI[lang];
  const FRAME = 160; // px – preview frame size
  const [transform, setTransform] = useState<SpriteTransform>(initialTransform);
  const dragging = useRef(false);
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Compute scale from zoom
  const getScale = (zoom: number) =>
    zoom >= 0 ? 1 + zoom / 100 : 1 + zoom / 200;

  // Clamp the translation so the image never shows empty space inside the frame.
  // The image renders at FRAME×FRAME with object-contain, so visually it may have
  // internal whitespace — we allow free pan since uploaded sprites vary in aspect.
  // For proper clamping we clamp based on how much the image "overflows" the frame.
  const clamp = (tx: number, ty: number, zoom: number): { x: number; y: number } => {
    const scale = getScale(zoom);
    // Maximum shift in px before the frame edge goes out of image bounds
    // image is FRAME×FRAME rendered; at scale S the "extra" pixels on each side = (FRAME*(S-1))/2
    const extra = (FRAME * (scale - 1)) / 2;
    const maxPxX = Math.max(extra, 0);
    const maxPxY = Math.max(extra, 0);
    // Convert from % to px (tx is % of FRAME)
    const pxX = (tx / 100) * FRAME;
    const pxY = (ty / 100) * FRAME;
    const clampedPxX = Math.min(maxPxX, Math.max(-maxPxX, pxX));
    const clampedPxY = Math.min(maxPxY, Math.max(-maxPxY, pxY));
    return { x: (clampedPxX / FRAME) * 100, y: (clampedPxY / FRAME) * 100 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform((prev) => {
      const rawX = prev.x + (dx / FRAME) * 100;
      const rawY = prev.y + (dy / FRAME) * 100;
      const { x, y } = clamp(rawX, rawY, prev.zoom);
      return { ...prev, x, y };
    });
  };

  const onPointerUp = () => { dragging.current = false; };

  const onZoomChange = (zoom: number) => {
    setTransform((prev) => {
      const { x, y } = clamp(prev.x, prev.y, zoom);
      return { x, y, zoom };
    });
  };

  const reset = () => setTransform(DEFAULT_TRANSFORM);

  const scale = getScale(transform.zoom);
  const imgStyle: React.CSSProperties = {
    width: `${FRAME}px`,
    height: `${FRAME}px`,
    objectFit: "contain",
    transform: `translate(${transform.x}%, ${transform.y}%) scale(${scale})`,
    transformOrigin: "center center",
    userSelect: "none",
    pointerEvents: "none",
    transition: dragging.current ? "none" : "transform 0.1s",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-950/98 p-6 shadow-2xl shadow-black/70 flex flex-col gap-5">
        {/* Header */}
        <div>
          <h4 className="text-base font-semibold text-slate-100">{t.editorTitle}</h4>
          <p className="mt-0.5 text-xs text-slate-500">{t.editorSubtitle}</p>
        </div>

        {/* Preview frame */}
        <div className="flex justify-center">
          <div
            ref={frameRef}
            style={{ width: FRAME, height: FRAME, overflow: "hidden", borderRadius: 12, background: "#031421", cursor: dragging.current ? "grabbing" : "grab", border: "1px solid #1e3a5f", userSelect: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={src} alt="sprite preview" style={imgStyle} draggable={false} />
          </div>
        </div>

        {/* Zoom control */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.editorZoom}</span>
            <span className="font-mono tabular-nums text-slate-300">
              {transform.zoom > 0 ? "+" : ""}{transform.zoom}%
            </span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={transform.zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="w-full accent-sky-500 h-2 rounded-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>−100%</span>
            <span>0</span>
            <span>+100%</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            {t.editorReset}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              {t.editorCancel}
            </button>
            <button
              type="button"
              onClick={() => onSave(transform)}
              className="rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 transition"
            >
              {t.editorSave}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tooltip flotante con posicionamiento inteligente ──────────────────────
// Se renderiza vía portal directamente en <body> y usa position: fixed con
// coordenadas calculadas a partir del elemento que lo activa. Esto evita que
// quede recortado por contenedores con overflow:hidden/auto y permite que se
// muestre siempre por encima del resto de la interfaz. Ajusta automáticamente
// su posición (arriba/abajo/izquierda/derecha) según el espacio disponible.
type TooltipPlacement = "top" | "bottom" | "left" | "right";

function FloatingTooltip({
  content,
  children,
  preferredPlacement = "top",
  className = "",
  tooltipClassName = "",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  preferredPlacement?: TooltipPlacement;
  className?: string;
  tooltipClassName?: string;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: TooltipPlacement }>({
    top: 0,
    left: 0,
    placement: preferredPlacement,
  });

  const computePosition = () => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tr = trigger.getBoundingClientRect();
    const tt = tooltip.getBoundingClientRect();

    const space = {
      top: tr.top,
      bottom: vh - tr.bottom,
      left: tr.left,
      right: vw - tr.right,
    };

    // Orden de preferencia: la solicitada primero, luego el resto por espacio disponible.
    const order: TooltipPlacement[] = [
      preferredPlacement,
      ...(["top", "bottom", "left", "right"] as TooltipPlacement[]).filter((p) => p !== preferredPlacement),
    ];

    let placement = order.find((p) => {
      if (p === "top") return space.top >= tt.height + margin;
      if (p === "bottom") return space.bottom >= tt.height + margin;
      if (p === "left") return space.left >= tt.width + margin;
      return space.right >= tt.width + margin;
    });

    // Si no hay espacio perfecto en ninguna dirección, usamos la que tenga más espacio disponible.
    if (!placement) {
      placement = (Object.entries(space).sort((a, b) => b[1] - a[1])[0][0] as TooltipPlacement);
    }

    let top = 0;
    let left = 0;

    if (placement === "top" || placement === "bottom") {
      top = placement === "top" ? tr.top - tt.height - margin : tr.bottom + margin;
      left = tr.left + tr.width / 2 - tt.width / 2;
      left = Math.min(Math.max(left, margin), vw - tt.width - margin);
    } else {
      left = placement === "left" ? tr.left - tt.width - margin : tr.right + margin;
      top = tr.top + tr.height / 2 - tt.height / 2;
      top = Math.min(Math.max(top, margin), vh - tt.height - margin);
    }

    setCoords({ top, left, placement });
  };

  useLayoutEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    computePosition();
    // Pequeño frame extra para asegurar medidas correctas tras el primer render.
    const raf = requestAnimationFrame(() => {
      computePosition();
      setReady(true);
    });
    const onScrollOrResize = () => computePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleOutside = (e: Event) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener("touchstart", handleOutside);
    return () => document.removeEventListener("touchstart", handleOutside);
  }, [visible]);

  const offsetClass =
    coords.placement === "top" ? "translate-y-1" :
    coords.placement === "bottom" ? "-translate-y-1" :
    coords.placement === "left" ? "translate-x-1" : "-translate-x-1";

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible((v) => !v)}
    >
      {children}
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
            className={`pointer-events-none transition-all duration-150 ease-out ${ready ? "opacity-100 translate-x-0 translate-y-0" : `opacity-0 ${offsetClass}`} ${tooltipClassName}`}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── Sección colapsable reutilizable ────────────────────────────────────────
// Envuelve cualquier panel principal con una cabecera que incluye un botón
// de expandir/contraer. El contenido se anima con una transición suave de
// max-height; la cabecera permanece siempre visible.
type CollapsibleSectionProps = {
  title: React.ReactNode;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode; // controles extra en la cabecera (ej. botones de Mi Equipo)
  guide?: React.ReactNode; // texto guía (modo sencillo) explicando para qué sirve la sección
  defaultOpen?: boolean;
  storageKey?: string; // si se define, persiste el estado abierto/cerrado en localStorage
  as?: "section" | "div";
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

function CollapsibleSection({
  title,
  icon,
  headerExtra,
  guide,
  defaultOpen = true,
  storageKey,
  as = "section",
  className = "",
  headerClassName = "",
  bodyClassName = "",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState<boolean>(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = window.localStorage.getItem(`pokerun-collapse-${storageKey}`);
      if (saved !== null) return saved === "1";
    }
    return defaultOpen;
  });
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<string>(open ? "none" : "0px");
  const firstRender = useRef(true);

  // Recalcula la altura objetivo cuando cambia el contenido o el estado abierto/cerrado
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (open) {
      const target = el.scrollHeight;
      setMaxHeight(`${target}px`);
      // Tras la transición, liberamos a "none" para que el contenido pueda
      // crecer libremente (tooltips, listas dinámicas, etc.) sin recortarse.
      const timeout = setTimeout(() => setMaxHeight("none"), 320);
      return () => clearTimeout(timeout);
    } else {
      // Si veníamos de "none", primero fijamos la altura actual antes de animar a 0
      if (maxHeight === "none") {
        setMaxHeight(`${el.scrollHeight}px`);
        requestAnimationFrame(() => setMaxHeight("0px"));
      } else {
        setMaxHeight("0px");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, children]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(`pokerun-collapse-${storageKey}`, open ? "1" : "0");
    }
  }, [open, storageKey]);

  const Wrapper = as;

  return (
    <Wrapper className={className}>
      <div className={`flex items-center justify-between gap-2 flex-wrap ${headerClassName}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 sm:gap-3 text-left flex-1 min-w-0 group focus:outline-none"
        >
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition-transform duration-300 group-hover:text-slate-200"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▸
          </span>
          {icon}
          <span className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-semibold tracking-tight text-slate-100 min-w-0">
            {title}
          </span>
        </button>
        {headerExtra && <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">{headerExtra}</div>}
      </div>
      <div
        style={{
          maxHeight,
          overflow: maxHeight === "none" ? "visible" : "hidden",
          transition: "max-height 300ms ease",
        }}
      >
        <div ref={contentRef} className={bodyClassName}>
          {guide && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-700/50 bg-sky-950/40 px-4 py-3 text-[14px] sm:text-[15px] leading-relaxed text-sky-200">
              <span className="shrink-0 text-xl leading-none">💡</span>
              <span>{guide}</span>
            </div>
          )}
          {children}
        </div>
      </div>
    </Wrapper>
  );
}

// Normaliza cualquier variante de apóstrofe (curly ’ ‘ ´ vs recto ') a uno solo,
// para que las comparaciones exactas de nombre (ej. "Sirfetch'd") no fallen
// silenciosamente según qué apóstrofe use el JSON de origen.
const normalizeApostrophe = (s: string): string => s.replace(/[\u2018\u2019\u02BC\u00B4]/g, "'");

// getZDisplayName le agrega el sufijo " Z" a toda especie listada en
// Z_FORM_SPECIES (ej. "Chesnaught" -> "Chesnaught Z"), pero POKEMON_Z_ORIGINALS
// guarda los nombres SIN ese sufijo. Sin esto, el filtro "solo originales"
// nunca hacía match con ninguno de ellos (Wailmer Z, Chesnaught Z, Rotom Z...),
// aunque estuvieran bien escritos en la lista.
const stripZSuffix = (s: string): string => s.replace(/\s+Z$/, "");

// Igual que stripZSuffix, pero además saca el prefijo "Mega "/"Gigamax " para
// poder comparar Megas/Gigamax de Pokémon Z (ej. "Mega Delphox Z",
// "Gigamax Raichu") contra POKEMON_Z_ORIGINALS, que solo guarda el nombre de
// la especie base. Sin esto, el filtro "solo originales" excluía SIEMPRE las
// Megas/Gigamax (incluso las de especies originales), pisando por completo
// al switch "Mostrar Megas"/"Mostrar Gigamax" cuando ambos estaban activos.
const stripZFormPrefixSuffix = (s: string): string =>
  stripZSuffix(s).replace(/^(Mega|Gigamax)\s+/i, "");

// ─── Fakemon / formas originales de Pokémon Z ────────────────────────────────
const POKEMON_Z_ORIGINALS = new Set<string>([
  // Pokémon reales con formas Z (nombre exacto del JSON, sin sufijo).
  // Solo se incluyen las etapas que EFECTIVAMENTE tienen stats/habilidad
  // alterada por Pokémon Z (según la tabla de datos del juego) — las
  // pre-evoluciones sin cambios (Farfetch'd, Chespin, Fennekin, Froakie,
  // Petilil, Gothorita) quedan afuera a propósito, ya que no tienen nada
  // "Z" en sí mismas hasta que evolucionan.
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

// ─── Pre-evoluciones en la Pokedex Z ─────────────────────────────────────────
// IDs (Pokedex nacional) de pokémon que tienen una evolución también presente
// en el JSON de Pokémon Z. Generado cruzando los IDs del JSON con las cadenas
// de evolución canónicas de PokéAPI. Los fakemon (id >= 899) no están aquí
// porque siempre se tratan como última evolución.
const POKEMON_Z_PRE_EVOS = new Set<number>([
  1, 2, 4, 5, 7, 8, 10, 11, 13, 14,
  16, 17, 19, 21, 23, 25, 27, 29, 30, 32,
  33, 35, 37, 39, 41, 43, 44, 46, 48, 50,
  52, 54, 56, 58, 60, 61, 63, 64, 66, 67,
  69, 70, 72, 74, 75, 77, 79, 80, 81, 84,
  86, 88, 90, 92, 93, 95, 96, 98, 100, 102,
  104, 108, 109, 111, 112, 113, 114, 116, 117, 118,
  120, 123, 127, 129, 133, 137, 138, 140, 147, 148,
  // Gen II (faltaban en el rango 149–171, causaba que Bayleef/Quilava/etc.
  // aparecieran como "última evolución" siendo en realidad pre-evos):
  // 152=Chikorita→154, 153=Bayleef→154, 155=Cyndaquil→157, 156=Quilava→157,
  // 158=Totodile→160, 159=Croconaw→160, 161=Sentret→162, 163=Hoothoot→164,
  // 165=Ledyba→166, 167=Spinarak→168, 170=Chinchou→171
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
  // Pokémon que en Z ganan una nueva evolución (fakemon) inexistente en el dex estándar:
  // 83=Farfetch'd→Sirfetch'd Z, 97=Hypno→Fobeto, 105=Marowak(Z)→Marolier,
  // 124=Jynx→Freyjynx, 185=Sudowoodo→Sudrasil, 335=Zangoose→Zanghoul,
  // 336=Seviper→Serdupla, 337=Lunatone→Constellar, 338=Solrock→Constellar,
  // 370=Luvdisc→Luvourne, 421=Cherrim→Cherrilier, 701=Hawlucha→Halcombate,
  // 925=Maushold→Gourmaus
  83, 97, 105, 124, 185, 335, 336, 337, 338, 370, 421, 701, 925,
]); // 402 pre-evoluciones


// ─── Card de "¿Quién conviene reemplazar?" ───────────────────────────────
// Definida FUERA del componente principal (a diferencia de antes, que se
// declaraba dentro de una IIFE en cada render) para que React la trate como
// el mismo tipo de componente entre renders. Antes, al recrearse en cada
// render, React remontaba todo el árbol de tarjetas ocultas y el botón
// "quitar" de los Pokémon dentro del desplegable "ver resto del equipo"
// podía perder su handler / quedar apuntando a un nodo ya desmontado.
function ContributionCard({
  entry,
  rank,
  highlight,
  lang,
  tn,
  badgeClass,
  onRemove,
}: {
  entry: {
    idx: number;
    slot: Slot;
    bst: number;
    uniqueResistTypes: string[];
    redundantResistTypes: string[];
    dragWeaknessTypes: string[];
  };
  rank: number;
  highlight: boolean;
  lang: "es" | "en";
  tn: (apiKey: string) => string;
  badgeClass: (t: string) => string;
  onRemove: (idx: number) => void;
}) {
  const { idx, slot, uniqueResistTypes, redundantResistTypes, dragWeaknessTypes, bst } = entry;
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2 h-full ${
        highlight ? "border-red-500/40 bg-red-950/20" : "border-slate-700/60 bg-slate-900/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono text-slate-500">#{rank + 1}</span>
          <span className="text-base font-semibold text-slate-100">{slot.name}</span>
          {slot.types.filter(Boolean).map((ty) => (
            <span key={ty} className={`${badgeClass(ty)} text-xs`}>{tn(ty)}</span>
          ))}
          {highlight && (
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">
              {lang === "es" ? "Menos aporta" : "Least valuable"}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-100 ring-1 ring-slate-600">
          {lang === "es" ? "Stats totales" : "Total stats"}: <span className="text-amber-300">{bst || "—"}</span>
        </span>
      </div>
      <div className="text-xs text-slate-300 leading-relaxed space-y-1 flex-1">
        {uniqueResistTypes.length > 0 && (
          <div>
            {lang === "es" ? "✅ Único que resiste: " : "✅ Only one resisting: "}
            {uniqueResistTypes.map((ty) => (
              <span key={ty} className={`${badgeClass(ty)} text-xs mx-0.5`}>{tn(ty)}</span>
            ))}
          </div>
        )}
        {dragWeaknessTypes.length > 0 && (
          <div>
            {lang === "es" ? "⚠️ Comparte debilidad de equipo a: " : "⚠️ Shares team weakness to: "}
            {dragWeaknessTypes.map((ty) => (
              <span key={ty} className={`${badgeClass(ty)} text-xs mx-0.5`}>{tn(ty)}</span>
            ))}
          </div>
        )}
        {redundantResistTypes.length > 0 && (
          <div>
            {lang === "es" ? "♻️ Resistencias ya cubiertas por otro miembro: " : "♻️ Resistances already covered by another member: "}
            {redundantResistTypes.map((ty) => (
              <span key={ty} className={`${badgeClass(ty)} text-xs mx-0.5`}>{tn(ty)}</span>
            ))}
          </div>
        )}
        {uniqueResistTypes.length === 0 && dragWeaknessTypes.length === 0 && redundantResistTypes.length === 0 && (
          <div>{lang === "es" ? "Sin resistencias/debilidades relevantes detectadas." : "No relevant resistances/weaknesses detected."}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="self-start inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/50 hover:border-red-400/60 hover:text-red-200 transition-colors"
      >
        <span aria-hidden="true">🗑️</span>
        {lang === "es" ? "Quitar" : "Remove"}
      </button>
    </div>
  );
}

// ─── Modal de filtros de movimientos (Pokémon Z / moves.json) ──────────────
// Ventana que se abre dentro de la misma página (via createPortal) para
// filtrar el dex completo de movimientos por categoría (físico/especial/
// estado) y tipo, buscar por nombre, y ver cómo lo aprende el Pokémon del
// slot activo (nivel / MT / tutor / huevo) antes de seleccionarlo.
type MoveFilterEntry = {
  internalName: string;
  name: string;
  nameEn: string;
  category: "Physical" | "Special" | "Status";
  type: string | null;
  hackrom: boolean;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  descriptionEs: string;
  descriptionEn: string;
};

function MoveFilterModal({
  moves,
  lang,
  search,
  onSearchChange,
  categories,
  onToggleCategory,
  types,
  onToggleType,
  onlyZOriginals,
  onToggleOnlyZOriginals,
  showOnlyZFilter,
  onClearFilters,
  learnMethods,
  onlyLearnable,
  learnableSet,
  badgeClass,
  tn,
  onSelect,
  onClose,
  sortPower,
  onSortPowerChange,
}: {
  moves: MoveFilterEntry[];
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  categories: Set<string>;
  onToggleCategory: (c: string) => void;
  types: Set<string>;
  onToggleType: (ty: string) => void;
  onlyZOriginals: boolean;
  onToggleOnlyZOriginals: () => void;
  showOnlyZFilter: boolean;
  onClearFilters: () => void;
  learnMethods: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> | null | undefined;
  onlyLearnable: boolean;
  learnableSet: Set<string> | null;
  badgeClass: (t: string) => string;
  tn: (apiKey: string) => string;
  onSelect: (move: MoveFilterEntry) => void;
  onClose: () => void;
  // Orden por potencia: ahora vive en el estado del padre (por Pokémon) para
  // que se recuerde entre aperturas del modal, en vez de resetearse cada vez.
  sortPower: "asc" | "desc" | null;
  onSortPowerChange: (v: "asc" | "desc" | null) => void;
}) {
  const allTypesList = Object.keys(TYPE_COLORS);
  const catLabel = (c: string) =>
    c === "Physical" ? (lang === "es" ? "Físico" : "Physical")
    : c === "Special" ? (lang === "es" ? "Especial" : "Special")
    : (lang === "es" ? "Estado" : "Status");

  // Mismo ícono SVG (espada/destello/remolino) que se usa en las tarjetas de
  // ataque del equipo, para que la categoría se identifique de un vistazo
  // sin tener que leer el texto "Físico/Especial/Estado".
  const CategoryIcon = ({ cat, size = 16 }: { cat: string; size?: number }) => {
    if (cat === "Physical") return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="8.5" fill="#C03028" stroke="#7f1010" strokeWidth="1"/>
        <path d="M5 13L9 5L13 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="9" cy="5" r="1.5" fill="white"/>
      </svg>
    );
    if (cat === "Special") return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="8.5" fill="#6890F0" stroke="#1e3a8a" strokeWidth="1"/>
        <path d="M9 4L10.2 7.5H14L11 9.8L12.2 13.2L9 11L5.8 13.2L7 9.8L4 7.5H7.8L9 4Z" fill="white"/>
      </svg>
    );
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="8.5" fill="#705898" stroke="#3b1e6b" strokeWidth="1"/>
        <circle cx="9" cy="9" r="3.5" fill="white" opacity="0.9"/>
        <circle cx="9" cy="9" r="1.5" fill="#705898"/>
      </svg>
    );
  };

  const learnBadgeFor = (mv: MoveFilterEntry): string | null => {
    const info = learnMethods?.[mv.internalName];
    if (!info) return null;
    if (info.type === "level") return info.level ? `${lang === "es" ? "Nv." : "Lv."} ${info.level}` : (lang === "es" ? "Nivel" : "Level");
    if (info.type === "mt") return "MT";
    if (info.type === "tutor") return lang === "es" ? "Tutor" : "Tutor";
    if (info.type === "egg") return lang === "es" ? "Huevo" : "Egg";
    return null;
  };

  const normalized = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = useMemo(() => {
    const q = normalized(search.trim());
    return moves
      .filter((mv) => {
        if (onlyLearnable && learnableSet && !learnableSet.has(mv.internalName)) return false;
        if (categories.size > 0 && !categories.has(mv.category)) return false;
        if (types.size > 0 && (!mv.type || !types.has(mv.type))) return false;
        if (onlyZOriginals && showOnlyZFilter && !mv.hackrom) return false;
        if (q.length > 0) {
          const hay =
            normalized(mv.name).includes(q) ||
            normalized(mv.nameEn).includes(q) ||
            normalized(mv.internalName).includes(q);
          if (!hay) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Si el usuario activó el orden por potencia, manda por sobre todo lo demás.
        if (sortPower) {
          const pa = a.power ?? 0;
          const pb = b.power ?? 0;
          if (pa !== pb) return sortPower === "asc" ? pa - pb : pb - pa;
          const nameA = lang === "es" ? a.name : a.nameEn;
          const nameB = lang === "es" ? b.name : b.nameEn;
          return nameA.localeCompare(nameB);
        }
        // Aprendibles primero (por nivel, MT, tutor, huevo), luego alfabético
        const rank = (mv: MoveFilterEntry) => {
          const info = learnMethods?.[mv.internalName];
          if (!info) return 4;
          if (info.type === "level") return 0;
          if (info.type === "mt") return 1;
          if (info.type === "tutor") return 2;
          return 3;
        };
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 0) {
          const la = learnMethods?.[a.internalName]?.level ?? 0;
          const lb = learnMethods?.[b.internalName]?.level ?? 0;
          if (la !== lb) return la - lb;
        }
        const nameA = lang === "es" ? a.name : a.nameEn;
        const nameB = lang === "es" ? b.name : b.nameEn;
        return nameA.localeCompare(nameB);
      });
  }, [moves, search, categories, types, onlyZOriginals, showOnlyZFilter, onlyLearnable, learnableSet, learnMethods, lang, sortPower]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-black/70 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-5xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-100">
              {lang === "es" ? "Filtrar movimientos" : "Filter moves"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {lang === "es"
                ? "Busca por categoría, tipo o nombre y selecciona el movimiento."
                : "Search by category, type or name and pick the move."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            {lang === "es" ? "Cerrar" : "Close"}
          </button>
        </div>

        {/* Filtros de categoría y tipo, en la misma fila, en dos columnas */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Filtro por categoría */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              {lang === "es" ? "Categoría" : "Category"}
            </div>
            <div className="flex flex-col gap-1.5">
              {["Physical", "Special", "Status"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onToggleCategory(c)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    categories.has(c)
                      ? "border-sky-500 bg-sky-600/30 text-sky-200"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <CategoryIcon cat={c} size={20} />
                  {catLabel(c)}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por tipo */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              {lang === "es" ? "Tipo" : "Type"}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {allTypesList.map((ty) => (
                <button
                  key={ty}
                  type="button"
                  onClick={() => onToggleType(ty)}
                  className={`${badgeClass(ty)} type-picker-badge min-h-8 w-full px-2 py-1 transition ${
                    types.has(ty) ? "ring-2 ring-white/70 opacity-100" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {tn(ty)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {filtered.length} {lang === "es" ? "resultados" : "results"}
          </span>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {showOnlyZFilter && (
              <label
                className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  onlyZOriginals
                    ? "border-amber-500 bg-amber-950/40 text-amber-300"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={onlyZOriginals}
                  onChange={onToggleOnlyZOriginals}
                  className="h-3.5 w-3.5 rounded accent-amber-500"
                />
                {lang === "es" ? "Solo originales Z" : "Only Z originals"}
              </label>
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={lang === "es" ? "Buscar movimiento…" : "Search move…"}
              className="w-full max-w-[220px] rounded-lg border border-blue-800/40 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() =>
                onSortPowerChange(sortPower === null ? "asc" : sortPower === "asc" ? "desc" : null)
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                sortPower
                  ? "border-orange-500 bg-orange-600/20 text-orange-300"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
              }`}
              title={lang === "es" ? "Ordenar por potencia" : "Sort by power"}
            >
              <span aria-hidden>{sortPower === "asc" ? "🔼" : sortPower === "desc" ? "🔽" : "↕️"}</span>
              {lang === "es" ? "Potencia" : "Power"}
            </button>
            <button
              type="button"
              onClick={() => { onClearFilters(); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-800/50 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-500 hover:bg-rose-900/40 hover:text-rose-200"
            >
              <span aria-hidden>🧹</span>
              {lang === "es" ? "Limpiar filtros" : "Clear filters"}
            </button>
          </div>
        </div>

        {/* Lista de resultados */}
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Sin resultados." : "No results."}
            </div>
          ) : (
            filtered.map((mv, mvIdx) => {
              const label = lang === "es" ? mv.name : mv.nameEn;
              const badge = learnBadgeFor(mv);
              const powerText = mv.power && mv.power > 0 ? String(mv.power) : "—";
              const accText = mv.accuracy && mv.accuracy > 0 ? `${mv.accuracy}%` : "—";
              const ppText = mv.pp !== null && mv.pp !== undefined ? String(mv.pp) : "—";
              const description = (lang === "es" ? mv.descriptionEs : mv.descriptionEn) || (lang === "es" ? mv.descriptionEn : mv.descriptionEs) || "";
              return (
                <button
                  key={`${mv.internalName}__${mvIdx}`}
                  type="button"
                  onClick={() => onSelect(mv)}
                  className="flex w-full items-stretch gap-2 border-b border-slate-800/60 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-slate-800/80"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className="grid w-full min-w-0 items-center gap-2"
                      style={{ gridTemplateColumns: "minmax(0,1fr) 246px" }}
                    >
                      <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                        <span className="shrink-0" title={catLabel(mv.category)}>
                          <CategoryIcon cat={mv.category} size={22} />
                        </span>
                        {mv.type && (
                          <span className={`${badgeClass(mv.type)} shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold`}>
                            {tn(mv.type)}
                          </span>
                        )}
                        <span className="truncate font-medium text-slate-100">{label}</span>
                        {mv.hackrom && (
                          <span
                            title={lang === "es" ? "Movimiento exclusivo de Pokémon Z" : "Pokémon Z exclusive move"}
                            className="shrink-0 rounded-full border border-amber-500/50 bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300"
                          >
                            {lang === "es" ? "Original Z" : "Z Original"}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="flex flex-1 items-center justify-center whitespace-nowrap rounded-md border border-orange-700/40 bg-orange-950/40 px-1.5 py-0.5 text-[11px] font-bold text-orange-300">
                          {lang === "es" ? "Pot." : "Pow."} {powerText}
                        </span>
                        <span className="flex flex-1 items-center justify-center whitespace-nowrap rounded-md border border-emerald-700/40 bg-emerald-950/40 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">
                          {lang === "es" ? "Prec." : "Acc."} {accText}
                        </span>
                        <span className="flex flex-1 items-center justify-center whitespace-nowrap rounded-md border border-sky-700/40 bg-sky-950/40 px-1.5 py-0.5 text-[11px] font-bold text-sky-300">
                          PP {ppText}
                        </span>
                      </span>
                    </span>
                    {description && (
                      <span className="truncate text-[11px] text-slate-500">{description}</span>
                    )}
                  </span>
                  {badge && (
                    <span className="flex w-16 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-slate-950/80 px-1 text-center text-[12px] font-semibold leading-tight text-emerald-300">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Modal de exploración de habilidades — versión simplificada del
// MoveFilterModal: solo busca por nombre y muestra la descripción de cada
// habilidad. Solo se usa con datos de Pokémon Z (única pokédex con
// descripciones locales precargadas).
function AbilityFilterModal({
  abilities,
  lang,
  search,
  onSearchChange,
  descSearch,
  onDescSearchChange,
  onlyZOriginals,
  onToggleOnlyZOriginals,
  onSelect,
  onClose,
}: {
  abilities: { value: string; name: string; description: string; isOriginal?: boolean }[];
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  descSearch: string;
  onDescSearchChange: (v: string) => void;
  onlyZOriginals: boolean;
  onToggleOnlyZOriginals: () => void;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const normalized = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Ícono de lupa reutilizado en ambos inputs del modal (mismo estilo que el
  // botón de buscar Pokémon).
  const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
      <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="2" />
      <path d="M13.6 13.6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const filtered = useMemo(() => {
    const qName = normalized(search.trim());
    const qDesc = normalized(descSearch.trim());
    return abilities
      .filter((ab) => qName.length === 0 || normalized(ab.name).includes(qName))
      .filter((ab) => qDesc.length === 0 || normalized(ab.description).includes(qDesc))
      .filter((ab) => !onlyZOriginals || !!ab.isOriginal)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [abilities, search, descSearch, onlyZOriginals]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-black/70 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-100">
              {lang === "es" ? "Filtrar habilidades" : "Filter abilities"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {lang === "es"
                ? "Busca por nombre y selecciona la habilidad."
                : "Search by name and pick the ability."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            {lang === "es" ? "Cerrar" : "Close"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {filtered.length} {lang === "es" ? "resultados" : "results"}
          </span>
          <div className="relative w-full max-w-[260px]">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={lang === "es" ? "Buscar por nombre…" : "Search by name…"}
              className="w-full rounded-lg border border-blue-800/40 bg-slate-900/70 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
          </div>
        </div>

        {/* Buscador por descripción: filtra habilidades cuyo texto descriptivo
            contenga lo escrito (ej. "quita el sueño"), independiente del
            buscador por nombre de arriba. */}
        <div className="mt-2 relative">
          <SearchIcon />
          <input
            type="text"
            value={descSearch}
            onChange={(e) => onDescSearchChange(e.target.value)}
            placeholder={lang === "es" ? "Buscar por descripción…" : "Search by description…"}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
          />
        </div>

        <div className="mt-2 flex justify-end">
          <label
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              onlyZOriginals
                ? "border-amber-500 bg-amber-950/40 text-amber-300"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={onlyZOriginals}
              onChange={onToggleOnlyZOriginals}
              className="h-3.5 w-3.5 rounded accent-amber-500"
            />
            {lang === "es" ? "Solo originales Z" : "Only Z originals"}
          </label>
        </div>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Sin resultados." : "No results."}
            </div>
          ) : (
            filtered.map((ab) => (
              <button
                key={ab.value}
                type="button"
                onClick={() => onSelect(ab.value)}
                className="flex w-full flex-col gap-1 border-b border-slate-800/60 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-slate-800/80"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{ab.name}</span>
                  {ab.isOriginal && (
                    <span
                      title={lang === "es" ? "Habilidad exclusiva de Pokémon Z" : "Pokémon Z exclusive ability"}
                      className="shrink-0 rounded-full border border-amber-500/50 bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300"
                    >
                      {lang === "es" ? "Original Z" : "Z Original"}
                    </span>
                  )}
                </span>
                {ab.description && (
                  <span className="text-[11px] text-slate-500">{ab.description}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Modal de búsqueda de objetos de Pokémon Z: busca por nombre o por
// descripción y permite filtrar solo los objetos originales del hackrom
// (hackrom: true en items_pokemon_z.json). Es de solo consulta (no asigna
// nada a ningún Pokémon), por eso no recibe onSelect.
function ItemsBrowserModal({
  items,
  combatUseful,
  lang,
  search,
  onSearchChange,
  onlyZOriginals,
  onToggleOnlyZOriginals,
  onlyCombat,
  onToggleOnlyCombat,
  onClose,
}: {
  items: { id: number; internalName: string; name: string; namePlural: string; description: string; hackrom: boolean; sprite?: string | null }[];
  combatUseful: Record<string, boolean>;
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  onlyZOriginals: boolean;
  onToggleOnlyZOriginals: () => void;
  onlyCombat: boolean;
  onToggleOnlyCombat: () => void;
  onClose: () => void;
}) {
  const normalized = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
      <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="2" />
      <path d="M13.6 13.6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const filtered = useMemo(() => {
    const q = normalized(search.trim());
    return items
      .filter((it) => !onlyZOriginals || it.hackrom)
      .filter((it) => !onlyCombat || combatUseful[String(it.id)])
      .filter((it) => q.length === 0 || normalized(it.name).includes(q) || normalized(it.description ?? "").includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, onlyZOriginals, onlyCombat, combatUseful]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-black/70 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-100">
              {lang === "es" ? "Objetos" : "Items"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {lang === "es"
                ? "Busca por nombre o por descripción."
                : "Search by name or description."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            {lang === "es" ? "Cerrar" : "Close"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {filtered.length} {lang === "es" ? "resultados" : "results"}
          </span>
          <div className="relative w-full max-w-[300px]">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={lang === "es" ? "Buscar por nombre o descripción…" : "Search by name or description…"}
              className="w-full rounded-lg border border-blue-800/40 bg-slate-900/70 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <label
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              onlyCombat
                ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={onlyCombat}
              onChange={onToggleOnlyCombat}
              className="h-3.5 w-3.5 rounded accent-emerald-500"
            />
            {lang === "es" ? "⚔ Solo objetos de combate" : "⚔ Only battle items"}
          </label>
          <label
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              onlyZOriginals
                ? "border-amber-500 bg-amber-950/40 text-amber-300"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={onlyZOriginals}
              onChange={onToggleOnlyZOriginals}
              className="h-3.5 w-3.5 rounded accent-amber-500"
            />
            {lang === "es" ? "Solo originales Z" : "Only Z originals"}
          </label>
        </div>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Cargando objetos…" : "Loading items…"}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Sin resultados." : "No results."}
            </div>
          ) : (
            filtered.map((it) => (
              <div
                key={it.id}
                className="flex w-full items-start gap-3 border-b border-slate-800/60 px-3 py-2.5 text-left text-sm last:border-b-0"
              >
                <div className="w-9 h-9 shrink-0 bg-[#031421] rounded-lg overflow-hidden flex items-center justify-center">
                  <SpriteImg
                    src={it.sprite ?? null}
                    alt={it.name}
                    className="w-7 h-7 object-contain"
                    placeholderClassName="h-5 w-5 opacity-40"
                  />
                </div>
                <div className="flex flex-1 min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">{it.name}</span>
                    {it.hackrom && (
                      <span
                        title={lang === "es" ? "Objeto exclusivo de Pokémon Z" : "Pokémon Z exclusive item"}
                        className="shrink-0 rounded-full border border-amber-500/50 bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300"
                      >
                        {lang === "es" ? "Original Z" : "Z Original"}
                      </span>
                    )}
                    {combatUseful[String(it.id)] && (
                      <span
                        title={lang === "es" ? "Útil en combate" : "Useful in battle"}
                        className="shrink-0 rounded-full border border-emerald-500/50 bg-emerald-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300"
                      >
                        {lang === "es" ? "⚔ Combate" : "⚔ Battle"}
                      </span>
                    )}
                  </span>
                  {it.description && (
                    <span className="text-[11px] text-slate-500">{it.description}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const [activePokedex, setActivePokedex] = useState<PokedexId>("standard");
  const [pokedexDropdownOpen, setPokedexDropdownOpen] = useState(false);
  const pokedexDropdownRef = useRef<HTMLDivElement>(null);
  const [pokemonZData, setPokemonZData] = useState<any[]>([]);
  const [movesZData, setMovesZData] = useState<any[]>([]);
  // Catálogo de objetos de Pokémon Z (items_pokemon_z.json), para el
  // buscador de objetos del header. Se carga una sola vez al montar,
  // independiente de la pokédex activa.
  const [itemsData, setItemsData] = useState<
    { id: number; internalName: string; name: string; namePlural: string; description: string; hackrom: boolean; sprite?: string | null }[]
  >([]);
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [itemsSearch, setItemsSearch] = useState("");
  const [itemsOnlyZ, setItemsOnlyZ] = useState(false);
  const [itemsOnlyCombat, setItemsOnlyCombat] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ITEMS_ONLY_Z_KEY);
      if (saved === "1" || saved === "0") setItemsOnlyZ(saved === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(ITEMS_ONLY_Z_KEY, itemsOnlyZ ? "1" : "0");
    } catch {}
  }, [itemsOnlyZ]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ITEMS_ONLY_COMBAT_KEY);
      if (saved === "1" || saved === "0") setItemsOnlyCombat(saved === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(ITEMS_ONLY_COMBAT_KEY, itemsOnlyCombat ? "1" : "0");
    } catch {}
  }, [itemsOnlyCombat]);
  useEffect(() => {
    if (itemsData.length > 0) return;
    fetch("/items_pokemon_z.json")
      .then((r) => r.json())
      .then((data) => setItemsData(data))
      .catch((err) => console.error("[PokeRun] Error loading items_pokemon_z.json:", err));
  }, [itemsData.length]);
  // Objetos con efecto real en combate (choice items, potenciadores de tipo,
  // objetos defensivos, gemas, tablas, etc). Mapa id -> true. Cargado desde
  // un archivo aparte para no tener que tocar items_pokemon_z.json.
  const [itemsCombatUseful, setItemsCombatUseful] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (Object.keys(itemsCombatUseful).length > 0) return;
    fetch("/items_combat_useful.json")
      .then((r) => r.json())
      .then((data) => setItemsCombatUseful(data))
      .catch((err) => console.error("[PokeRun] Error loading items_combat_useful.json:", err));
  }, [itemsCombatUseful]);
  const [movesStandardData, setMovesStandardData] = useState<any[]>([]);
  const [abilitiesStandardData, setAbilitiesStandardData] = useState<{ slug: string; nameEs: string; nameEn: string; descriptionEs: string; descriptionEn: string }[]>([]);
  const [abilitiesZDescData, setAbilitiesZDescData] = useState<Record<string, { nameEn: string | null; nameEnDisplay?: string; description: string; descriptionEn?: string; customAbility?: boolean }>>({});
  // Mapa "NOMBREENSINGUIONES" (ej. "WATERABSORB", tal como viene en nameEn)
  // → nombre legible en inglés (ej. "Water Absorb"), construido una sola vez
  // a partir del listado oficial de PokéAPI. abilities_descriptions.json NO
  // trae un campo "nameEnDisplay" utilizable, así que sin este mapa el
  // nombre de la habilidad se quedaba siempre en español aunque la
  // descripción sí cambiara de idioma.
  const [abilityEnDisplayNames, setAbilityEnDisplayNames] = useState<Record<string, string>>({});
  // Nombre de una habilidad Z según el idioma activo: en español se muestra
  // tal cual viene del JSON (clave del registro); en inglés se busca el
  // nombre legible, ya sea en el propio JSON (nameEnDisplay, si algún día
  // se agrega) o en el mapa derivado de PokéAPI (abilityEnDisplayNames), y
  // si ninguno está disponible cae al nombre en español como último recurso.
  const getAbilityDisplayName = (esName: string): string => {
    if (lang === "es") return esName;
    const entry = abilitiesZDescData[esName];
    if (entry?.nameEnDisplay) return entry.nameEnDisplay;
    if (CUSTOM_ABILITY_EN_NAMES[esName]) return CUSTOM_ABILITY_EN_NAMES[esName];
    const nameEn = entry?.nameEn;
    if (nameEn && abilityEnDisplayNames[nameEn]) return abilityEnDisplayNames[nameEn];
    return esName;
  };
  // Cache de sprites recortados para las tarjetas de recomendación en modo Z
  // key = id del Pokémon Z (string), value = dataURL del primer frame
  const [zSpritesCache, setZSpritesCache] = useState<Record<string, string>>({});
  // Tamaño natural (px) de cada sprite Z una vez que carga, para escalar dinámicamente
  const [zSpriteNaturalSizes, setZSpriteNaturalSizes] = useState<Record<string, number>>({});
  // Cache de sprites Z con bounding box recortado (sin transparencia vacía alrededor)
  // Generado en el onLoad del <img> a partir de zSpritesCache
  const [zSpritesTrimmed, setZSpritesTrimmed] = useState<Record<string, string>>({});
  const t = UI[lang];
  const tn = (apiKey: string) => getTypeName(apiKey, lang);
  // Modo de vista: "simple" para usuarios casuales (oculta detalle técnico),
  // "advanced" muestra absolutamente todo (comportamiento original de la app).
  // Se persiste en localStorage para recordar la preferencia entre visitas.
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple");
  const isAdvanced = viewMode === "advanced";
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "advanced" || saved === "simple") setViewMode(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {}
  }, [viewMode]);
  // Restaurar la Pokedex seleccionada. Se valida contra POKEDEX_OPTIONS para
  // que, si en el futuro se agrega/quita una Pokedex, un valor guardado
  // obsoleto no deje la app en un estado inválido (cae de vuelta a "standard").
  // El useEffect de más abajo (carga de pokemon_z_completo.json / moves_z_completo.json)
  // depende de `activePokedex`, así que en cuanto se restaura aquí, ese efecto
  // se dispara solo y carga los datos correctos — no queda "seleccionada" la Z
  // mostrando datos de la estándar.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(POKEDEX_KEY);
      if (saved && POKEDEX_OPTIONS.some((p) => p.id === saved)) {
        setActivePokedex(saved as PokedexId);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(POKEDEX_KEY, activePokedex);
    } catch {}
  }, [activePokedex]);
  // Interruptor maestro: muestra/oculta los checks de "Fakemon" (por Pokémon)
  // y "Movimiento inventado" (por ataque) en toda la sección Mi Equipo, para
  // no saturar visualmente cuando no se están usando fakemon. Se persiste en
  // localStorage para recordar la preferencia entre visitas.
  const [fakemonModeOn, setFakemonModeOn] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FAKEMON_MODE_KEY);
      if (saved === "1" || saved === "0") setFakemonModeOn(saved === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(FAKEMON_MODE_KEY, fakemonModeOn ? "1" : "0");
    } catch {}
  }, [fakemonModeOn]);
  const [team, setTeam] = useState<Slot[]>(() => Array.from({ length: 6 }, EMPTY_SLOT));
  const [allTypes, setAllTypes] = useState<string[]>([]);
  const [typeRelations, setTypeRelations] = useState<Record<string, any>>({});
  const [loadingRelations, setLoadingRelations] = useState(false);
  const statLabels: [keyof BaseStats, string][] = [
    ["HP", "HP"],
    ["ATK", "ATK"],
    ["DEF", "DEF"],
    ["SP.ATK", "SP.ATK"],
    ["SP.DEF", "SP.DEF"],
    ["SPE", "SPE"],
  ];
  const getStatColor = (value: number) => {
    const ratio = Math.min(Math.max(value / 255, 0), 1);
    return `hsl(${Math.round(ratio * 120)}, 78%, 52%)`;
  };
  const [pokemonList, setPokemonList] = useState<string[]>([]);
  const [moveList, setMoveList] = useState<string[]>([]);
  // Dataset dinámico de TODOS los Pokémon disponibles en el Builder (id + tipos).
  // Sustituye la antigua lista fija de candidatos: se carga una sola vez desde
  // PokéAPI (igual fuente que alimenta `pokemonList`) y se usa para analizar
  // absolutamente todos los Pokémon al generar recomendaciones.
  const [allPokemonData, setAllPokemonData] = useState<AvailablePokemon[]>([]);
  const [loadingAllPokemonData, setLoadingAllPokemonData] = useState(false);
  // Set de national dex IDs (species id) que SÍ tienen una evolución posterior,
  // calculado dinámicamente desde PokéAPI/GraphQL en la misma carga de arriba.
  // Se reutiliza también para la Pokédex Z (mismos IDs nacionales para especies
  // reales), reemplazando la vieja lista fija POKEMON_Z_PRE_EVOS que estaba
  // incompleta (ej: le faltaban Golbat #42 y Murkrow #198).
  const [speciesWithEvolution, setSpeciesWithEvolution] = useState<Set<number>>(new Set());
  // ─── Estados de filtros para recomendaciones ────────────────────────────────
  const [recDiscarded, setRecDiscarded] = useState<Set<string>>(new Set());
  const [expandedRec, setExpandedRec] = useState<Set<string>>(new Set());
  const [recFilterTypes, setRecFilterTypes] = useState<string[]>([]); // tipos incluidos (vacío = todos)
  const [recFilterType2, setRecFilterType2] = useState<string>(""); // segundo tipo para filtro dual
  const [recFilterAbility, setRecFilterAbility] = useState<string>(""); // texto libre: filtra por habilidad (normal u oculta)
  const [recFilterAbilityOpen, setRecFilterAbilityOpen] = useState(false); // dropdown de sugerencias abierto
  const [recFilterAbilitySelectedIdx, setRecFilterAbilitySelectedIdx] = useState(-1); // índice resaltado (flechas ↑↓)
  const [recAbilityModalOpen, setRecAbilityModalOpen] = useState(false); // modal "estilo movimientos" para explorar habilidades con descripción
  const [recAbilityModalSearch, setRecAbilityModalSearch] = useState("");
  const [recAbilityModalDescSearch, setRecAbilityModalDescSearch] = useState(""); // texto libre: filtra habilidades por su descripción
  const [recFilterGen, setRecFilterGen] = useState<number | null>(null); // null = todas las gens
  // Filtro por movimiento (solo Pokémon Z): hasta 4 movimientos a la vez;
  // el candidato debe poder aprenderlos TODOS (AND), no basta con uno solo.
  // Se guardan como internalName (clave del JSON de movimientos Z).
  const [recFilterMoves, setRecFilterMoves] = useState<string[]>([]);
  const [recFilterMoveModalOpen, setRecFilterMoveModalOpen] = useState(false);
  const [recFilterMoveSearch, setRecFilterMoveSearch] = useState<string>("");
  const [recFilterMoveCategories, setRecFilterMoveCategories] = useState<Set<string>>(new Set());
  const [recFilterMoveTypes, setRecFilterMoveTypes] = useState<Set<string>>(new Set());
  const [recFilterMoveOnlyZ, setRecFilterMoveOnlyZ] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REC_FILTER_MOVE_ONLY_Z_KEY);
      if (saved === "1" || saved === "0") setRecFilterMoveOnlyZ(saved === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(REC_FILTER_MOVE_ONLY_Z_KEY, recFilterMoveOnlyZ ? "1" : "0");
    } catch {}
  }, [recFilterMoveOnlyZ]);
  const [recAbilityModalOnlyZ, setRecAbilityModalOnlyZ] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REC_ABILITY_MODAL_ONLY_Z_KEY);
      if (saved === "1" || saved === "0") setRecAbilityModalOnlyZ(saved === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(REC_ABILITY_MODAL_ONLY_Z_KEY, recAbilityModalOnlyZ ? "1" : "0");
    } catch {}
  }, [recAbilityModalOnlyZ]);
  const [recFilterMoveSortPower, setRecFilterMoveSortPower] = useState<"asc" | "desc" | null>(null);
  const [recShowFilters, setRecShowFilters] = useState(false);
  const [recFilterFinalEvo, setRecFilterFinalEvo] = useState(true);   // solo últimas evoluciones
  const [recFilterLegendary, setRecFilterLegendary] = useState(false); // ocultar legendarios por defecto
  const [recFilterOnlyOriginals, setRecFilterOnlyOriginals] = useState(false); // solo originales de Pokémon Z
  const [recFilterNoDupTypes, setRecFilterNoDupTypes] = useState(true); // evitar duplicados de tipo
  const [recFilterMatchRole, setRecFilterMatchRole] = useState(false); // solo Pokémon cuyo rol REAL coincida con el recomendado
  const [recFilterPrioritizeCoverage, setRecFilterPrioritizeCoverage] = useState(true); // priorizar cobertura de debilidades en el scoring
  const [recFilterRoleManual, setRecFilterRoleManual] = useState<string | null>(null); // filtro manual de rol (null = cualquier rol)
  // Filtro: ordenar por la stat más alta (excluyente entre sí, solo 1 activa).
  // Cuando está activa, esa misma stat se deshabilita en recFilterMinStats.
  const [recFilterSortStat, setRecFilterSortStat] = useState<keyof BaseStats | null>(null);
  // Filtro: mínimos por stat (varios a la vez, AND entre los que tengan valor).
  // Vacío ("") = esa stat no se filtra.
  const [recFilterMinStats, setRecFilterMinStats] = useState<BaseStatsInput>(EMPTY_STAT_INPUT);
  // Selecciona/deselecciona la stat de ordenamiento. Al activar una, se limpia
  // su valor en el filtro de mínimos (quedan mutuamente excluyentes).
  const toggleRecFilterSortStat = (key: keyof BaseStats) => {
    setRecFilterSortStat((prev) => {
      const next = prev === key ? null : key;
      if (next) {
        setRecFilterMinStats((prevMin) => ({ ...prevMin, [key]: "" }));
      }
      return next;
    });
  };
  // Dex normal: las Megas están excluidas por defecto (comportamiento previo);
  // este switch permite incluirlas explícitamente.
  const [recFilterShowMega, setRecFilterShowMega] = useState(false);
  // Igual que recFilterShowMega, pero para Gigamax (dex estándar).
  const [recFilterShowGmax, setRecFilterShowGmax] = useState(false);
  // Dex Pokémon Z: Megas y Gigamax SÍ se mostraban antes sin control alguno;
  // estos switches arrancan en `true` para no cambiar el comportamiento
  // existente, pero permiten excluirlas si se desea.
  const [recFilterZShowMega, setRecFilterZShowMega] = useState(true);
  const [recFilterZShowGmax, setRecFilterZShowGmax] = useState(true);
  const [showRestContribution, setShowRestContribution] = useState(false); // expandir el resto del ranking de "quién conviene reemplazar"
  const [toast, setToast] = useState<string | null>(null); // notificación flotante estilo la página (reemplaza los alert() feos del navegador)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  };
  // es_lower → en_slug  e.g. "lanzallamas" → "flamethrower"
  const [moveEsMap, setMoveEsMap] = useState<Record<string, string>>({});
  // reverse: en_slug → spanish display name  e.g. "flamethrower" → "Lanzallamas"
  const [moveEsDisplay, setMoveEsDisplay] = useState<Record<string, string>>({});
  const [pokemonSearch, setPokemonSearch] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  // Borrador del input de nombre de Pokémon del equipo: mientras el usuario
  // está escribiendo/editando, el texto vive acá (no en slot.name), para que
  // cosas que dependen del nombre YA CONFIRMADO (ej. Z_SLOT_SPRITE_ZOOM_OVERRIDES,
  // el ajuste de sprite de "Mega Delphox Z") no se rompan a mitad de tipeo.
  // null = no está editando (se muestra slot.name tal cual).
  const [pokemonInputDraft, setPokemonInputDraft] = useState<(string | null)[]>(() => Array.from({ length: 6 }, () => null));
  // URLs de sprite que fallaron al cargar (404, CORS, etc.) — se trackea por
  // URL (no por índice de slot) para que, si el usuario cambia de Pokémon en
  // ese mismo slot, la nueva URL no herede el estado de "falló" del anterior.
  const [failedSpriteUrls, setFailedSpriteUrls] = useState<Set<string>>(new Set());
  const markSpriteFailed = (url: string) =>
    setFailedSpriteUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  const [pokemonResults, setPokemonResults] = useState<string[][]>(() => Array.from({ length: 6 }, () => []));
  const [pokemonOpen, setPokemonOpen] = useState<boolean[]>(() => Array.from({ length: 6 }, () => false));
  const [pokemonSelectedIdx, setPokemonSelectedIdx] = useState<number[]>(() => Array.from({ length: 6 }, () => -1));
  // moveInputDraft: what the user is currently TYPING in each move input (independent of m.name/m.nameEs)
  // null = not editing (show translated name from move data)
  const [moveInputDraft, setMoveInputDraft] = useState<(string | null)[][]>(
    () => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => null))
  );
  const [moveResults, setMoveResults] = useState<string[][][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => [])));
  const [moveOpen, setMoveOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const [moveSelectedIdx, setMoveSelectedIdx] = useState<number[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => -1)));
  // ── Drag & drop simple de movimientos (reordenar los 4 ataques de un mismo
  // Pokémon). A diferencia del drag&drop de Pokémon del equipo (que sigue el
  // puntero con una tarjeta fantasma), este usa el drag&drop nativo de HTML5:
  // mucho más simple porque solo reordena un array corto (4 elementos) dentro
  // del mismo slot, sin necesitar sprite fantasma ni cálculos de posición.
  const [dragMoveFrom, setDragMoveFrom] = useState<{ slotIdx: number; moveIdx: number } | null>(null);
  const [moveDragOverIdx, setMoveDragOverIdx] = useState<{ slotIdx: number; moveIdx: number } | null>(null);
  // ── Modal de filtros de movimientos (Pokémon Z) ──────────────────────────
  // Se abre con el botón "Filtros" junto al buscador de cada movimiento.
  // target: qué slot/movimiento va a recibir el movimiento seleccionado.
  const [moveFilterTarget, setMoveFilterTarget] = useState<{ slotIdx: number; moveIdx: number } | null>(null);
  // Los filtros ahora se guardan POR POKÉMON (un set de filtros por cada uno
  // de los 6 slots del equipo), no globales. Así el Pokémon 1 puede tener
  // filtrado "Físico + Fuego" mientras el Pokémon 2 tiene otro filtro distinto,
  // y no se pisan entre sí. El orden por potencia también se guarda acá por
  // la misma razón (antes vivía como estado local del modal y se perdía cada
  // vez que se cerraba).
  const [moveFilterSearch, setMoveFilterSearch] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  const [moveFilterCategories, setMoveFilterCategories] = useState<Set<string>[]>(() => Array.from({ length: 6 }, () => new Set<string>()));
  const [moveFilterTypes, setMoveFilterTypes] = useState<Set<string>[]>(() => Array.from({ length: 6 }, () => new Set<string>()));
  const [moveFilterOnlyZ, setMoveFilterOnlyZ] = useState(false);
  // Índice del slot cuyo selector de rol manual está abierto (null = ninguno).
  const [roleSelectOpenIdx, setRoleSelectOpenIdx] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MOVE_FILTER_ONLY_Z_KEY);
      if (saved === "1" || saved === "0") setMoveFilterOnlyZ(saved === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(MOVE_FILTER_ONLY_Z_KEY, moveFilterOnlyZ ? "1" : "0");
    } catch {}
  }, [moveFilterOnlyZ]);
  const [moveFilterSortPower, setMoveFilterSortPower] = useState<("asc" | "desc" | null)[]>(() => Array.from({ length: 6 }, () => null));
  const [configSlotIndex, setConfigSlotIndex] = useState<number | null>(null);
  const [configDraftTypes, setConfigDraftTypes] = useState<string[]>([]);
  const [configDraftStats, setConfigDraftStats] = useState<BaseStatsInput>(EMPTY_STAT_INPUT);
  const [configStatsVisible, setConfigStatsVisible] = useState(false);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [plantillaDraftName, setPlantillaDraftName] = useState("");
  // Cuando está activo, el autocompletado de movimientos solo sugiere
  // movimientos que el Pokémon del slot puede aprender realmente (nivel,
  // tutor o huevo) en vez de la lista completa de movimientos existentes.
  // Se persiste en localStorage para recordar la preferencia entre visitas.
  const [onlyLearnableMoves, setOnlyLearnableMoves] = useState(true);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ONLY_LEARNABLE_MOVES_KEY);
      if (saved === "1" || saved === "0") setOnlyLearnableMoves(saved === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(ONLY_LEARNABLE_MOVES_KEY, onlyLearnableMoves ? "1" : "0");
    } catch {}
  }, [onlyLearnableMoves]);
  const [savingNew, setSavingNew] = useState(false);
  const [configDraftSprite, setConfigDraftSprite] = useState<string | null>(null);
  const [fakeSpriteSearch, setFakeSpriteSearch] = useState("");
  const [fakeSpriteLoading, setFakeSpriteLoading] = useState(false);
  const [fakeSpriteResults, setFakeSpriteResults] = useState<string[]>([]);
  const [fakeSpriteOpen, setFakeSpriteOpen] = useState(false);
  const [fakeSpriteSelectedIdx, setFakeSpriteSelectedIdx] = useState(-1);
  // ── Sprite editor state ──────────────────────────────────────────────────
  const [spriteEditorOpen, setSpriteEditorOpen] = useState(false);
  const [spriteEditorSrc, setSpriteEditorSrc] = useState<string | null>(null);
  // draft transform while editor is open
  const [editorTransform, setEditorTransform] = useState<SpriteTransform>(DEFAULT_TRANSFORM);
  // persisted transform for the config draft (saved on Apply)
  const [configDraftTransform, setConfigDraftTransform] = useState<SpriteTransform>(DEFAULT_TRANSFORM);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Tarjetas compactas: por defecto colapsadas (solo sprite + nombre) para
  // aligerar el render; se expanden individualmente al hacer click.
  const [slotCollapsed, setSlotCollapsed] = useState<boolean[]>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("pokerun-slot-collapsed-v2");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === 6) return parsed;
        } catch {}
      }
    }
    return Array.from({ length: 6 }, () => false);
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("pokerun-slot-collapsed-v2", JSON.stringify(slotCollapsed));
    }
  }, [slotCollapsed]);
  const toggleSlotCollapsed = (idx: number) => {
    captureSlotRects();
    setSlotCollapsed((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };
  // Roles expandidos dentro de "Aptitud por rol": clave `${idx}:${role.en}`.
  // Reemplaza el tooltip de hover (poco usable en mobile) por un desplegable
  // que se abre/cierra al tocar, mostrando descripción corta + stats clave.
  const [openRoleKeys, setOpenRoleKeys] = useState<Set<string>>(new Set());
  const toggleRoleOpen = (key: string) => {
    setOpenRoleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // Desplegable de descripciones de roles en el filtro "Filtrar por rol"
  // (recomendados de equipo), para no tener que adivinar qué significa cada
  // etiqueta de rol.
  const [roleFilterLegendOpen, setRoleFilterLegendOpen] = useState(false);
  // Drag & drop unificado (mouse + touch) via Pointer Events, con tarjeta
  // fantasma flotante siguiendo el cursor/dedo y animación FLIP al reordenar.
  const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number } | null>(null);
  const dragGhostSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dragGrabOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const teamCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const moveInputWrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pokemonInputWrapRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prevSlotRects = useRef<Map<number, DOMRect>>(new Map());

  // Captura la posición actual de cada tarjeta antes de reordenar el array,
  // para poder animar (FLIP) desde la posición vieja a la nueva después del
  // re-render.
  const captureSlotRects = () => {
    const map = new Map<number, DOMRect>();
    teamCardRefs.current.forEach((el, idx) => {
      if (el) map.set(idx, el.getBoundingClientRect());
    });
    prevSlotRects.current = map;
  };

  // Nodo del fantasma de drag, movido directamente por DOM (sin pasar por
  // React state) para que seguir al cursor/dedo no dispare re-renders del
  // árbol completo en cada pixel — eso era la causa del lag.
  const dragGhostEl = useRef<HTMLDivElement | null>(null);
  const dragRafId = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  const startSlotDrag = (idx: number, clientX: number, clientY: number, target: HTMLElement) => {
    setDragFromIdx(idx);
    setDragPointerPos({ x: clientX, y: clientY });
    const card = target.closest("[data-slot-idx]") as HTMLElement | null;
    const rect = card?.getBoundingClientRect();
    if (rect) {
      dragGhostSize.current = { w: rect.width, h: rect.height };
      dragGrabOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    }
  };

  // Encuentra la tarjeta cuyo centro está más cerca del cursor/dedo. Esto
  // hace que soltar sea mucho más tolerante: ya no hace falta acertar en un
  // punto exacto, con estar "cerca" de una tarjeta alcanza.
  const findNearestSlot = (clientX: number, clientY: number): number | null => {
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    teamCardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  };

  useEffect(() => {
    if (dragFromIdx === null) return;

    let pendingX = 0;
    let pendingY = 0;

    const applyFrame = () => {
      dragRafId.current = null;
      // Mueve el fantasma directo por DOM: nada de setState aquí.
      if (dragGhostEl.current) {
        dragGhostEl.current.style.transform = `translate(${pendingX - dragGrabOffset.current.x}px, ${pendingY - dragGrabOffset.current.y}px) rotate(-2deg) scale(1.03)`;
      }
      const overIdx = findNearestSlot(pendingX, pendingY);
      if (overIdx !== null && overIdx !== dragOverIdxRef.current) {
        dragOverIdxRef.current = overIdx;
        setDragOverIdx(overIdx);
      }
    };

    const handleMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (dragRafId.current === null) {
        dragRafId.current = requestAnimationFrame(applyFrame);
      }
    };
    const finishDrag = () => {
      if (dragRafId.current !== null) {
        cancelAnimationFrame(dragRafId.current);
        dragRafId.current = null;
      }
      setDragFromIdx((fromIdx) => {
        const overIdx = dragOverIdxRef.current;
        if (fromIdx !== null && overIdx !== null && fromIdx !== overIdx) {
          captureSlotRects();
          swapSlots(fromIdx, overIdx);
        }
        return null;
      });
      dragOverIdxRef.current = null;
      setDragOverIdx(null);
      setDragPointerPos(null);
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      if (dragRafId.current !== null) cancelAnimationFrame(dragRafId.current);
    };
  }, [dragFromIdx]);

  // Animación FLIP: cuando `team` cambia por un swap, cada tarjeta "salta"
  // desde su posición anterior hasta la nueva con una transición suave.
  useLayoutEffect(() => {
    const prevRects = prevSlotRects.current;
    if (prevRects.size === 0) return;
    teamCardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const prev = prevRects.get(idx);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (dx || dy) {
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 0.28s cubic-bezier(0.22,0.9,0.3,1)";
          el.style.transform = "";
        });
      }
    });
    prevSlotRects.current = new Map();
  }, [team]);
  // Stat tooltip open state per slot (tap on mobile, hover on desktop)
  const [statsTooltipOpen, setStatsTooltipOpen] = useState<boolean[]>(() => Array(6).fill(false));
  // Timeouts para cerrar el tooltip de stats con un pequeño margen de gracia:
  // así, al mover el mouse desde el ícono ⓘ hacia el propio tooltip (hay un
  // pequeño espacio/gap entre ambos), no se cierra de golpe antes de llegar.
  // Se cancela si el mouse vuelve a entrar (al ícono o al tooltip) a tiempo.
  const statsTooltipCloseTimers = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({});
  const openStatsTooltip = (idx: number) => {
    if (statsTooltipCloseTimers.current[idx]) {
      clearTimeout(statsTooltipCloseTimers.current[idx]);
      statsTooltipCloseTimers.current[idx] = undefined;
    }
    setStatsTooltipOpen((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };
  const scheduleCloseStatsTooltip = (idx: number) => {
    if (statsTooltipCloseTimers.current[idx]) clearTimeout(statsTooltipCloseTimers.current[idx]);
    statsTooltipCloseTimers.current[idx] = setTimeout(() => {
      setStatsTooltipOpen((prev) => prev.map((v, i) => (i === idx ? false : v)));
    }, 180);
  };
  // Type picker open state per slot and move.
  const [hpTypeOpen, setHpTypeOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const [fakeTypeOpen, setFakeTypeOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const toggleHpType = (si: number, mi: number) =>
    setHpTypeOpen((prev) => prev.map((arr, i) => i === si ? arr.map((v, j) => j === mi ? !v : v) : arr));
  const toggleFakeType = (si: number, mi: number) =>
    setFakeTypeOpen((prev) => prev.map((arr, i) => i === si ? arr.map((v, j) => j === mi ? !v : v) : arr));
  const rootRef = useRef<HTMLDivElement | null>(null);

  const openFakemonConfig = (idx: number) => {
    const slot = team[idx];
    setConfigSlotIndex(idx);
    setConfigDraftTypes(slot.types.filter(Boolean));
    setConfigDraftSprite(slot.sprite ?? null);
    setConfigDraftTransform(slot.spriteTransform ?? DEFAULT_TRANSFORM);
    setFakeSpriteSearch("");
    setConfigDraftStats({
      HP: slot.stats?.HP ? String(slot.stats.HP) : "",
      ATK: slot.stats?.ATK ? String(slot.stats.ATK) : "",
      DEF: slot.stats?.DEF ? String(slot.stats.DEF) : "",
      "SP.ATK": slot.stats?.["SP.ATK"] ? String(slot.stats["SP.ATK"]) : "",
      "SP.DEF": slot.stats?.["SP.DEF"] ? String(slot.stats["SP.DEF"]) : "",
      SPE: slot.stats?.SPE ? String(slot.stats.SPE) : "",
    });
    setConfigStatsVisible(Boolean(slot.stats));
  };

  const closeFakemonConfig = () => {
    setConfigSlotIndex(null);
    setConfigDraftTypes([]);
    setConfigDraftStats(EMPTY_STAT_INPUT);
    setConfigStatsVisible(false);
    setConfigDraftSprite(null);
    setConfigDraftTransform(DEFAULT_TRANSFORM);
    setFakeSpriteSearch("");
  };

  const toggleConfigType = (type: string) => {
    setConfigDraftTypes((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      if (prev.length >= 2) return prev;
      return [...prev, type];
    });
  };

  const updateDraftStat = (key: keyof BaseStats, value: string) => {
    setConfigDraftStats((prev) => ({ ...prev, [key]: value }));
  };

  const saveFakemonConfig = () => {
    if (configSlotIndex === null) return;

    const parsed: Partial<BaseStats> = {};
    let hasStats = false;
    (Object.keys(configDraftStats) as Array<keyof BaseStats>).forEach((key) => {
      const text = configDraftStats[key].trim();
      const value = text === "" ? null : Math.max(1, Math.min(255, Number(text)));
      if (value !== null && !Number.isNaN(value)) {
        parsed[key] = value;
        hasStats = true;
      }
    });

    const nextTypes: [string, string] = [configDraftTypes[0] || "", configDraftTypes[1] || ""];
    updateSlot(configSlotIndex, {
      types: nextTypes,
      sprite: configDraftSprite,
      spriteTransform: configDraftSprite ? configDraftTransform : null,
      stats: hasStats ? ({
        HP: parsed.HP ?? 1,
        ATK: parsed.ATK ?? 1,
        DEF: parsed.DEF ?? 1,
        "SP.ATK": parsed["SP.ATK"] ?? 1,
        "SP.DEF": parsed["SP.DEF"] ?? 1,
        SPE: parsed.SPE ?? 1,
      } as BaseStats) : null,
    });
    closeFakemonConfig();
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load Pokémon Z data when that Pokedex is selected
  useEffect(() => {
    if (activePokedex !== "pokemon-z") return;
    if (pokemonZData.length === 0) {
      fetch("/pokemon_z_completo.json")
        .then((r) => r.json())
        .then((data) => setPokemonZData(data))
        .catch((err) => console.error("[PokeRun] Error loading Pokémon Z data:", err));
    }
    if (movesZData.length === 0) {
      // moves.json: dex completo de movimientos del hackrom (731 movimientos).
      // Normalizamos cada entrada a la forma { internalName, name, nameEn,
      // category, type, hackrom, descriptionEs, descriptionEn } para que todo
      // el código existente (búsqueda, sugerencias, learnMethods) siga
      // funcionando igual que antes, y además quede disponible para el nuevo
      // modal de filtros.
      fetch("/moves.json")
        .then((r) => r.json())
        .then((data: any[]) => {
          const normalized = data.map((mv) => {
            const nameEs = typeof mv.name === "string" ? mv.name : mv.name?.es;
            const nameEn = typeof mv.name === "string" ? mv.name : (mv.name?.en ?? nameEs);
            return {
              internalName: mv.internal_name,
              name: nameEs,
              nameEn,
              category: mv.category,
              type: typeof mv.type === "string" ? mv.type.toLowerCase() : null,
              hackrom: !!mv.hackrom,
              power: typeof mv.power === "number" ? mv.power : null,
              accuracy: typeof mv.accuracy === "number" ? mv.accuracy : null,
              pp: typeof mv.pp === "number" ? mv.pp : null,
              descriptionEs: mv.description?.es ?? "",
              descriptionEn: mv.description?.en ?? "",
            };
          });
          // Deduplicar por internalName: el JSON del hackrom a veces trae la
          // misma entrada repetida (ej. "Sable Místico"), y como el modal usa
          // internalName como key de React, dos filas con la misma key hacen
          // que React reutilice mal el nodo del DOM entre ellas — se ve como
          // que esa fila "se bugea" (muestra datos de la otra) cada vez que
          // el orden de la lista cambia al tocar un filtro. Nos quedamos con
          // la primera aparición de cada internalName.
          const seenInternalNames = new Set<string>();
          const deduped = normalized.filter((mv) => {
            if (!mv.internalName || seenInternalNames.has(mv.internalName)) return false;
            seenInternalNames.add(mv.internalName);
            return true;
          });
          setMovesZData(deduped);
        })
        .catch((err) => console.error("[PokeRun] Error loading moves.json:", err));
    }
    if (Object.keys(abilitiesZDescData).length === 0) {
      fetch("/abilities_descriptions.json")
        .then((r) => r.json())
        .then((data) => setAbilitiesZDescData(data))
        .catch((err) => console.error("[PokeRun] Error loading abilities Z descriptions:", err));
    }
  }, [activePokedex, pokemonZData.length, movesZData.length, abilitiesZDescData]);

  // Carga (una sola vez, al montar) el listado completo de habilidades de
  // PokéAPI para construir el mapa "NOMBREENSINGUIONES" → "Nombre Legible"
  // (ej. "WATERABSORB" → "Water Absorb"). PokéAPI devuelve el slug con
  // guiones (ej. "water-absorb"); nameEn en abilities_descriptions.json es
  // ese mismo slug sin guiones y en mayúsculas, así que basta con quitar los
  // guiones del slug para usarlo como clave del mapa.
  useEffect(() => {
    if (Object.keys(abilityEnDisplayNames).length > 0) return;
    fetch("https://pokeapi.co/api/v2/ability?limit=400")
      .then((r) => r.json())
      .then((data: { results: { name: string }[] }) => {
        const map: Record<string, string> = {};
        for (const { name: slug } of data.results) {
          const key = slug.replace(/-/g, "").toUpperCase();
          const display = slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          map[key] = display;
        }
        setAbilityEnDisplayNames(map);
      })
      .catch((err) => console.error("[PokeRun] Error loading ability display names:", err));
  }, [abilityEnDisplayNames]);

  // Precargar sprites Z recortados en background cuando los datos estén listos
  // Se hace en lotes para no bloquear el hilo principal
  useEffect(() => {
    if (activePokedex !== "pokemon-z" || pokemonZData.length === 0) return;
    const BATCH = 20;
    let cancelled = false;

    const loadOne = async (p: any) => {
      const key = String(p.id);
      if (zSpritesCache[key]) return;
      const url = getZSpriteUrl(p);
      const cropped = await cropFirstFrame(url);
      if (!cancelled) setZSpritesCache((prev) => ({ ...prev, [key]: cropped }));
    };

    const loadBatch = async (startIdx: number) => {
      if (cancelled) return;
      const slice = pokemonZData.slice(startIdx, startIdx + BATCH);
      await Promise.all(slice.map(loadOne));
      if (!cancelled && startIdx + BATCH < pokemonZData.length) {
        setTimeout(() => loadBatch(startIdx + BATCH), 30);
      }
    };

    loadBatch(0);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePokedex, pokemonZData]);


  // ── Equipo guardado por Pokédex ─────────────────────────────────────────
  // Cada Pokédex (estándar / Z) guarda su propio equipo bajo una key distinta
  // en localStorage, para que al cambiar de dex el equipo se "vacíe" en
  // pantalla (porque son Pokémon distintos) sin perder lo que ya se armó:
  // si se vuelve a la dex anterior, el equipo aparece tal cual se dejó.
  const justSwitchedDexRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    justSwitchedDexRef.current = true;
    try {
      let raw = localStorage.getItem(`${STORAGE_KEY}-${activePokedex}`);
      // Migración: equipos guardados antes de este cambio usaban una sola key
      // sin distinguir dex. Si es la dex estándar y no hay nada bajo la key
      // nueva, se recupera lo que hubiera bajo la key vieja.
      if (!raw && activePokedex === "standard") {
        raw = localStorage.getItem(STORAGE_KEY);
      }
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === 6 && parsed.every(isValidSlot)) {
        setTeam(parsed);
      } else {
        setTeam(Array.from({ length: 6 }, EMPTY_SLOT));
      }
    } catch {
      setTeam(Array.from({ length: 6 }, EMPTY_SLOT));
    }
  }, [activePokedex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (justSwitchedDexRef.current) {
      // Este disparo es consecuencia de haber cambiado de dex (el equipo en
      // memoria todavía es el de la dex anterior); no lo guardamos para no
      // pisar el equipo recién cargado de la nueva dex.
      justSwitchedDexRef.current = false;
      return;
    }
    localStorage.setItem(`${STORAGE_KEY}-${activePokedex}`, JSON.stringify(team));
  }, [team, activePokedex]);

  // When lang changes, fetch missing translations for moves that don't have them yet
  useEffect(() => {
    team.forEach((slot, slotIdx) => {
      slot.moves.forEach((m, moveIdx) => {
        if (!m.name || m.isFake) return;
        if (/hidden.?power|poder.?oculto/i.test(m.name)) return;
        // If switching to ES and no Spanish name stored, or switching to EN and name looks Spanish → re-fetch
        const needsFetch = lang === "es" ? !m.nameEs : false;
        if (needsFetch) {
          fetchMove(m.name, slotIdx, moveIdx);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Load saved plantillas from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SAVED_TEAMS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSavedTeams(parsed);
    } catch { /* ignore */ }
  }, []);

  const persistSavedTeams = (teams: SavedTeam[]) => {
    setSavedTeams(teams);
    if (typeof window !== "undefined") {
      localStorage.setItem(SAVED_TEAMS_KEY, JSON.stringify(teams));
    }
  };

  const saveCurrentTeam = () => {
    const name = plantillaDraftName.trim() || `Plantilla ${savedTeams.length + 1}`;
    const newEntry: SavedTeam = {
      id: Date.now(),
      name,
      team: JSON.parse(JSON.stringify(team)),
      savedAt: new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
    persistSavedTeams([...savedTeams, newEntry]);
    setPlantillaDraftName("");
    setSavingNew(false);
  };

  const loadSavedTeam = (saved: SavedTeam) => {
    setTeam(saved.team);
    setShowPlantillas(false);
  };

  const deleteSavedTeam = (id: number) => {
    persistSavedTeams(savedTeams.filter((t) => t.id !== id));
  };

  const overwriteSavedTeam = (id: number) => {
    persistSavedTeams(
      savedTeams.map((t) =>
        t.id === id
          ? { ...t, team: JSON.parse(JSON.stringify(team)), savedAt: new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
          : t
      )
    );
  };

  useEffect(() => {
    // Dataset completo de movimientos de la Pokédex estándar (nombre, tipo,
    // categoría, potencia, precisión, PP) para alimentar el mismo modal de
    // filtros que ya existe para la dex Z, ahora también en modo normal.
    // Se carga una sola vez, independiente de la dex activa.
    if (movesStandardData.length > 0) return;
    const gqlVariants = [
      {
        url: "https://beta.pokeapi.co/graphql/v1beta",
        query: `{ pokemon_v2_move(limit: 2000) { name power pp accuracy pokemon_v2_movedamageclass { name } pokemon_v2_type { name } pokemon_v2_movenames(where: { pokemon_v2_language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        movesKey: "pokemon_v2_move",
        damageClassKey: "pokemon_v2_movedamageclass",
        typeKey: "pokemon_v2_type",
        namesKey: "pokemon_v2_movenames",
      },
      {
        url: "https://graphql.pokeapi.co/v1beta2",
        query: `{ move(limit: 2000) { name power pp accuracy damage_class: pokemon_v2_movedamageclass { name } type: pokemon_v2_type { name } move_names: pokemon_v2_movenames(where: { language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        movesKey: "move",
        damageClassKey: "damage_class",
        typeKey: "type",
        namesKey: "move_names",
      },
    ];

    (async () => {
      for (const { url, query, movesKey, damageClassKey, typeKey, namesKey } of gqlVariants) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          if (!r.ok) continue;
          const data = await r.json();
          if (data.errors) continue;
          const rows = data?.data?.[movesKey] ?? [];
          if (rows.length === 0) continue;
          const cleanFlavor = (txt: string) => txt.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
          const normalized = rows.map((m: any) => {
            const dcName: string | undefined = m[damageClassKey]?.name;
            const category: "Physical" | "Special" | "Status" =
              dcName === "special" ? "Special" : dcName === "status" ? "Status" : "Physical";
            const esRaw: string | undefined = m[namesKey]?.[0]?.name;
            const nameEn = formatForDisplay(m.name);
            const descEsRaw: string | undefined = m.descEs?.[0]?.flavor_text;
            const descEnRaw: string | undefined = m.descEn?.[0]?.flavor_text;
            return {
              internalName: m.name, // slug en inglés (ej. "flamethrower"), usado para seleccionar/buscar
              name: esRaw ? esRaw.charAt(0).toUpperCase() + esRaw.slice(1) : nameEn,
              nameEn,
              category,
              type: m[typeKey]?.name ?? null,
              hackrom: false,
              power: typeof m.power === "number" ? m.power : null,
              accuracy: typeof m.accuracy === "number" ? m.accuracy : null,
              pp: typeof m.pp === "number" ? m.pp : null,
              descriptionEs: descEsRaw ? cleanFlavor(descEsRaw) : "",
              descriptionEn: descEnRaw ? cleanFlavor(descEnRaw) : "",
            };
          });
          console.log(`[PokeRun] Standard moves dataset loaded: ${normalized.length}`);
          setMovesStandardData(normalized);
          return;
        } catch {
          continue;
        }
      }
      console.warn("[PokeRun] Could not load standard moves dataset (filter modal disabled for standard dex)");
    })();
  }, []);

  useEffect(() => {
    // Dataset de TODAS las habilidades de la Pokédex estándar (nombre ES/EN +
    // descripción ES/EN), para alimentar el mismo modal "explorar habilidades"
    // que ya existe para Pokémon Z, ahora también en modo normal. Se carga
    // una sola vez, independiente de la dex activa.
    if (abilitiesStandardData.length > 0) return;
    const gqlVariants = [
      {
        url: "https://beta.pokeapi.co/graphql/v1beta",
        query: `{ pokemon_v2_ability(limit: 500) { name pokemon_v2_abilitynames(where: { pokemon_v2_language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        abilitiesKey: "pokemon_v2_ability",
        namesKey: "pokemon_v2_abilitynames",
      },
      {
        url: "https://graphql.pokeapi.co/v1beta2",
        query: `{ ability(limit: 500) { name ability_names: pokemon_v2_abilitynames(where: { language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        abilitiesKey: "ability",
        namesKey: "ability_names",
      },
    ];

    (async () => {
      for (const { url, query, abilitiesKey, namesKey } of gqlVariants) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          if (!r.ok) continue;
          const data = await r.json();
          if (data.errors) continue;
          const rows = data?.data?.[abilitiesKey] ?? [];
          if (rows.length === 0) continue;
          const cleanFlavor = (txt: string) => txt.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
          const normalized = rows.map((a: any) => {
            const esRaw: string | undefined = a[namesKey]?.[0]?.name;
            const nameEn = formatForDisplay(a.name);
            const descEsRaw: string | undefined = a.descEs?.[0]?.flavor_text;
            const descEnRaw: string | undefined = a.descEn?.[0]?.flavor_text;
            return {
              slug: a.name, // slug en inglés (ej. "chlorophyll"), usado para filtrar/seleccionar
              nameEs: esRaw ? esRaw.charAt(0).toUpperCase() + esRaw.slice(1) : nameEn,
              nameEn,
              descriptionEs: descEsRaw ? cleanFlavor(descEsRaw) : "",
              descriptionEn: descEnRaw ? cleanFlavor(descEnRaw) : "",
            };
          });
          console.log(`[PokeRun] Standard abilities dataset loaded: ${normalized.length}`);
          setAbilitiesStandardData(normalized);
          return;
        } catch {
          continue;
        }
      }
      console.warn("[PokeRun] Could not load standard abilities dataset (browse modal disabled for standard dex)");
    })();
  }, []);

  useEffect(() => {
    // fetch types list
    fetch("https://pokeapi.co/api/v2/type?limit=100")
      .then((r) => r.json())
      .then((data) => {
        const names = data.results.map((t: any) => t.name).filter((n: string) => n !== "shadow" && n !== "unknown" && n !== "stellar");
        setAllTypes(names);
      })
      .catch(() => setAllTypes([]));
  }, []);

  // Fetch all type relations (once) when types list ready
  useEffect(() => {
    if (allTypes.length === 0) return;
    setLoadingRelations(true);
    Promise.all(
      allTypes.map((t) => fetch(`https://pokeapi.co/api/v2/type/${t}`).then((r) => r.json()).catch(() => null))
    ).then((arr) => {
      const map: Record<string, any> = {};
      arr.forEach((data: any) => {
        if (!data) return;
        map[data.name] = data.damage_relations;
      });
      setTypeRelations(map);
      setLoadingRelations(false);
    });
  }, [allTypes]);

  useEffect(() => {
    // REST: all slugs for autocomplete
    Promise.all([
      fetch("https://pokeapi.co/api/v2/pokemon?limit=100000").then((r) => r.json()).then((d) => d.results.map((x: any) => x.name)).catch(() => []),
      fetch("https://pokeapi.co/api/v2/move?limit=100000").then((r) => r.json()).then((d) => d.results.map((x: any) => x.name)).catch(() => []),
    ]).then(([pokemons, moves]) => {
      setPokemonList(pokemons || []);
      setMoveList(moves || []);
    });

    // Dataset dinámico de TODOS los Pokémon (id + tipos + stats) — base del motor
    // de recomendaciones. Se intenta vía GraphQL (una sola consulta masiva,
    // limitada a la Pokedex nacional para evitar formas regionales/mega/gmax
    // que distorsionarían el análisis); si falla, se recurre a REST por lotes
    // sobre los primeros Pokémon de `pokemonList` como red de seguridad.
    // Las stats base se incluyen para poder calcular el ROL REAL de cada
    // candidato reutilizando exactamente el mismo helper `getRole` que usa
    // el equipo (ver sección "Sistema de roles" más arriba). Si por algún
    // motivo no llegan stats para un Pokémon puntual, simplemente no se le
    // calcula rol real (queda `null`) en vez de inventar uno.
    const STAT_NAME_TO_KEY: Record<string, keyof BaseStats> = {
      hp: "HP",
      attack: "ATK",
      defense: "DEF",
      "special-attack": "SP.ATK",
      "special-defense": "SP.DEF",
      speed: "SPE",
    };
    const buildStatsFromList = (statRows: any[], nameKey: string, statNameKey: string): BaseStats | null => {
      if (!Array.isArray(statRows) || statRows.length === 0) return null;
      const stats: Partial<BaseStats> = {};
      statRows.forEach((row: any) => {
        const apiName = row?.[statNameKey]?.name as string | undefined;
        const key = apiName ? STAT_NAME_TO_KEY[apiName] : undefined;
        if (key) stats[key] = row.base_stat ?? row[nameKey] ?? 0;
      });
      if (Object.keys(stats).length !== 6) return null; // incompleto: no inventar valores
      return stats as BaseStats;
    };

    const loadAllPokemonData = async () => {
      setLoadingAllPokemonData(true);
      const gqlVariants = [
        {
          url: "https://beta.pokeapi.co/graphql/v1beta",
          query: `{ pokemon_v2_pokemon(where: { pokemon_v2_pokemonspecy: { generation_id: { _lte: 9 } } }, limit: 2000) { id name is_default pokemon_v2_pokemontypes { pokemon_v2_type { name } } pokemon_v2_pokemonstats { base_stat pokemon_v2_stat { name } } pokemon_v2_pokemonspecy { evolves_from_species_id id } pokemon_v2_pokemonabilities { is_hidden pokemon_v2_ability { name } } pokemon_v2_pokemonmoves(distinct_on: move_id) { pokemon_v2_move { name } } } }`,
          rowsKey: "pokemon_v2_pokemon",
          typesKey: "pokemon_v2_pokemontypes",
          typeNameKey: "pokemon_v2_type",
          statsKey: "pokemon_v2_pokemonstats",
          statNameKey: "pokemon_v2_stat",
          abilitiesKey: "pokemon_v2_pokemonabilities",
          abilityNameKey: "pokemon_v2_ability",
          movesKey: "pokemon_v2_pokemonmoves",
          moveNameKey: "pokemon_v2_move",
        },
        {
          url: "https://graphql.pokeapi.co/v1beta2",
          query: `{ pokemon(limit: 2000) { id name is_default pokemontypes: pokemon_v2_pokemontypes { type: pokemon_v2_type { name } } pokemonstats: pokemon_v2_pokemonstats { base_stat stat: pokemon_v2_stat { name } } species: pokemon_v2_pokemonspecy { evolves_from_species_id id } pokemonabilities: pokemon_v2_pokemonabilities { is_hidden ability: pokemon_v2_ability { name } } pokemonmoves: pokemon_v2_pokemonmoves(distinct_on: move_id) { move: pokemon_v2_move { name } } } }`,
          rowsKey: "pokemon",
          typesKey: "pokemontypes",
          typeNameKey: "type",
          statsKey: "pokemonstats",
          statNameKey: "stat",
          abilitiesKey: "pokemonabilities",
          abilityNameKey: "ability",
          movesKey: "pokemonmoves",
          moveNameKey: "move",
        },
      ];

      // Formas que no son elegibles en un equipo "normal" y distorsionarían
      // el análisis si se incluyeran como candidatos (gigamax, primigenias,
      // totem, formas de evento/cap...). Se excluyen por nombre; formas
      // regionales y alternativas con uso competitivo real (rotom-wash,
      // landorus-therian, etc.) SÍ se conservan.
      // NOTA: "mega" se sacó de este patrón — antes se excluía siempre acá
      // mismo (a nivel de fetch, sin forma de revertirlo); ahora se sigue
      // trayendo del fetch pero se filtra reactivamente más abajo según el
      // switch "Mostrar Megas" (recFilterShowMega), para que el usuario
      // pueda decidir si aparecen o no sin necesitar un nuevo fetch.
      // Lo mismo aplica ahora a "gmax"/"gigantamax": se sigue trayendo del
      // fetch pero se filtra reactivamente según el switch "Mostrar Gigamax"
      // (recFilterShowGmax).
      const EXCLUDED_FORM_PATTERN = /-(primal|totem|cap|starter|eternamax)\b/i;

      for (const { url, query, rowsKey, typesKey, typeNameKey, statsKey, statNameKey, abilitiesKey, abilityNameKey, movesKey, moveNameKey } of gqlVariants) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          if (!r.ok) continue;
          const data = await r.json();
          if (data.errors) continue;
          const rows = data?.data?.[rowsKey] ?? [];
          if (rows.length === 0) continue;
          // Calculamos isFinalEvo dinámicamente desde la API:
          // Un Pokémon NO es última evolución si algún otro en el dataset
          // tiene `evolves_from_species_id` igual a su species id.
          const speciesIdsThatEvolveFrom = new Set<number>(
            rows
              .map((row: any) => {
                const sp = row.pokemon_v2_pokemonspecy ?? row.species;
                return sp?.evolves_from_species_id ?? null;
              })
              .filter((id: any) => id !== null)
          );
          const parsed: AvailablePokemon[] = rows
            .filter((row: any) => !EXCLUDED_FORM_PATTERN.test(row.name))
            .map((row: any) => {
              const types = (row[typesKey] ?? [])
                .map((pt: any) => pt[typeNameKey]?.name)
                .filter(Boolean);
              if (types.length === 0) return null;
              const stats = buildStatsFromList(row[statsKey] ?? [], "base_stat", statNameKey);
              const abilityRows: any[] = row[abilitiesKey] ?? [];
              const abilities = abilityRows
                .filter((ar: any) => !ar?.is_hidden)
                .map((ar: any) => ar?.[abilityNameKey]?.name)
                .filter(Boolean);
              const hiddenAbility = abilityRows.find((ar: any) => ar?.is_hidden)?.[abilityNameKey]?.name ?? null;
              const moveRows: any[] = row[movesKey] ?? [];
              const learnableMoveNames = Array.from(
                new Set(moveRows.map((mr: any) => mr?.[moveNameKey]?.name).filter(Boolean))
              );
              const sp = row.pokemon_v2_pokemonspecy ?? row.species;
              const speciesId: number | null = sp?.id ?? null;
              // Es última evolución si ningún otro Pokémon evoluciona desde su species id
              const isFinalEvo = speciesId === null || !speciesIdsThatEvolveFrom.has(speciesId);
              return {
                slug: row.name,
                name: row.name,
                id: row.id,
                types: (types.length === 1 ? [types[0]] : [types[0], types[1]]) as [string] | [string, string],
                stats,
                isFinalEvo,
                abilities: abilities.length > 0 ? abilities : null,
                hiddenAbility,
                learnableMoveNames: learnableMoveNames.length > 0 ? learnableMoveNames : null,
              };
            })
            .filter(Boolean) as AvailablePokemon[];
          if (parsed.length === 0) continue;
          console.log(`[PokeRun] Dataset de recomendaciones cargado vía GraphQL: ${parsed.length} Pokémon`);
          setAllPokemonData(parsed);
          setSpeciesWithEvolution(speciesIdsThatEvolveFrom);
          setLoadingAllPokemonData(false);
          return;
        } catch { continue; }
      }

      // Ambas variantes de GraphQL fallaron — fallback REST por lotes sobre
      // la Pokedex nacional (#1–1025), evitando saturar la API pública.
      // Paso 1: cargamos todos los pokemon + species en paralelo para poder
      // calcular isFinalEvo dinámicamente (sin lista manual).
      console.warn("[PokeRun] GraphQL no disponible, usando fallback REST para el dataset de recomendaciones");
      const chunkSize = 25;
      const maxId = 1025;

      // Recopilamos datos crudos de pokemon y species juntos
      type RawRest = { slug: string; id: number; types: string[]; stats: BaseStats | null; speciesId: number | null; evolvesFromSpeciesId: number | null; abilities: string[]; hiddenAbility: string | null; learnableMoveNames: string[] };
      const rawList: RawRest[] = [];

      for (let start = 1; start <= maxId; start += chunkSize) {
        const ids = Array.from({ length: Math.min(chunkSize, maxId - start + 1) }, (_, i) => start + i);
        await Promise.all(
          ids.map(async (id) => {
            try {
              const [rPoke, rSpec] = await Promise.all([
                fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
                fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
              ]);
              if (!rPoke.ok) return;
              const d = await rPoke.json();
              const types = d.types.map((t: any) => t.type.name);
              if (types.length === 0) return;
              const stats = buildStatsFromList(d.stats ?? [], "base_stat", "stat");
              const abilityRows: any[] = d.abilities ?? [];
              const abilities = abilityRows
                .filter((ar: any) => !ar?.is_hidden)
                .map((ar: any) => ar?.ability?.name)
                .filter(Boolean);
              const hiddenAbility = abilityRows.find((ar: any) => ar?.is_hidden)?.ability?.name ?? null;
              const learnableMoveNames = Array.isArray(d.moves)
                ? Array.from(new Set(d.moves.map((mv: any) => mv?.move?.name).filter(Boolean)))
                : [];
              let evolvesFromSpeciesId: number | null = null;
              let speciesId: number | null = null;
              if (rSpec.ok) {
                const sp = await rSpec.json();
                speciesId = sp.id ?? null;
                evolvesFromSpeciesId = sp.evolves_from_species?.url
                  ? parseInt(sp.evolves_from_species.url.split("/").filter(Boolean).pop() ?? "0", 10) || null
                  : null;
              }
              rawList.push({ slug: d.name, id: d.id, types, stats, speciesId, evolvesFromSpeciesId, abilities, hiddenAbility, learnableMoveNames });
            } catch { /* skip */ }
          })
        );
      }

      // Paso 2: calculamos isFinalEvo — un Pokémon NO es última evo si algún
      // otro en el dataset tiene evolvesFromSpeciesId === su speciesId.
      const speciesIdsThatEvolveFrom = new Set<number>(
        rawList.map((p) => p.evolvesFromSpeciesId).filter((id): id is number => id !== null)
      );
      const parsed: AvailablePokemon[] = rawList.map((p) => ({
        slug: p.slug,
        name: p.slug,
        id: p.id,
        types: (p.types.length === 1 ? [p.types[0]] : [p.types[0], p.types[1]]) as [string] | [string, string],
        stats: p.stats,
        isFinalEvo: p.speciesId === null || !speciesIdsThatEvolveFrom.has(p.speciesId),
        abilities: p.abilities.length > 0 ? p.abilities : null,
        hiddenAbility: p.hiddenAbility,
        learnableMoveNames: p.learnableMoveNames.length > 0 ? p.learnableMoveNames : null,
      }));

      console.log(`[PokeRun] Fallback REST: ${parsed.length} Pokémon cargados para recomendaciones`);
      setAllPokemonData(parsed);
      setSpeciesWithEvolution(speciesIdsThatEvolveFrom);
      setLoadingAllPokemonData(false);
    };
    loadAllPokemonData();

    // Load Spanish move names — tries two GraphQL variants, then REST fallback
    const loadEsNames = async () => {
      const gqlVariants = [
        {
          url: "https://beta.pokeapi.co/graphql/v1beta",
          query: `{ pokemon_v2_move(limit: 2000) { name pokemon_v2_movenames(where: { pokemon_v2_language: { name: { _eq: "es" } } }) { name } } }`,
          movesKey: "pokemon_v2_move",
          namesKey: "pokemon_v2_movenames",
        },
        {
          url: "https://graphql.pokeapi.co/v1beta2",
          query: `{ move(limit: 2000) { name move_names(where: { language: { name: { _eq: "es" } } }) { name } } }`,
          movesKey: "move",
          namesKey: "move_names",
        },
      ];

      for (const { url, query, movesKey, namesKey } of gqlVariants) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          if (!r.ok) continue;
          const data = await r.json();
          if (data.errors) continue;
          const moves = data?.data?.[movesKey] ?? [];
          if (moves.length === 0) continue;
          const esToEn: Record<string, string> = {};
          const enToEs: Record<string, string> = {};
          moves.forEach((m: any) => {
            const esRaw: string | undefined = m[namesKey]?.[0]?.name;
            if (esRaw) {
              esToEn[esRaw.toLowerCase()] = m.name;
              enToEs[m.name] = esRaw.charAt(0).toUpperCase() + esRaw.slice(1);
            }
          });
          if (Object.keys(esToEn).length === 0) continue;
          console.log(`[PokeRun] ES moves loaded via GraphQL: ${Object.keys(esToEn).length}`);
          setMoveEsMap(esToEn);
          setMoveEsDisplay(enToEs);
          return;
        } catch { continue; }
      }

      // Both GraphQL failed — batch load via REST for common moves
      console.warn("[PokeRun] GraphQL unavailable, using REST fallback for ES move names");
      const commonMoves = [
        "flamethrower","fire-blast","thunderbolt","thunder","surf","hydro-pump",
        "ice-beam","blizzard","psychic","shadow-ball","earthquake","stone-edge",
        "close-combat","poison-jab","iron-tail","iron-head","crunch","dark-pulse",
        "dragon-claw","outrage","dragon-pulse","flare-blitz","brave-bird","bullet-seed",
        "energy-ball","focus-blast","aura-sphere","flash-cannon","power-gem","bug-buzz",
        "x-scissor","aerial-ace","acrobatics","giga-drain","petal-blizzard","moonblast",
        "play-rough","dazzling-gleam","boomburst","hyper-voice","sludge-bomb","sludge-wave",
        "gunk-shot","leech-life","u-turn","volt-switch","flip-turn","rapid-spin",
        "recover","roost","soft-boiled","slack-off","moonlight","morning-sun",
        "protect","substitute","wish","heal-bell","aromatherapy",
        "stealth-rock","spikes","toxic-spikes","sticky-web","defog","trick-room",
        "sunny-day","rain-dance","sandstorm","hail","tailwind",
        "swords-dance","nasty-plot","calm-mind","quiver-dance","shell-smash","dragon-dance",
        "bulk-up","coil","agility","rock-polish",
        "thunder-punch","fire-punch","ice-punch","drain-punch","mach-punch",
        "bullet-punch","sucker-punch","extreme-speed","aqua-jet","shadow-sneak","quick-attack",
        "knock-off","low-kick","superpower","high-horsepower","stomping-tantrum",
        "lava-plume","heat-wave","scorching-sands","muddy-water",
        "freeze-dry","scald","strength-sap","shore-up","body-press","scale-shot",
        "expanding-force","rising-voltage","meteor-beam","glacial-lance","astral-barrage",
        "collision-course","electro-drift","rage-fist","armor-cannon","bitter-blade",
        "hidden-power","water-gun","tackle","scratch","pound","growl","leer","tail-whip",
        "vine-whip","razor-leaf","sleep-powder","stun-spore","poison-powder","fire-spin",
        "wing-attack","swift","slam","hyper-beam","toxic","double-team","reflect","light-screen",
        "rest","rock-slide","thunderwave","confuse-ray","mean-look","attract","return",
        "frustration","earthquake","dig","magnitude","rock-tomb","bullet-seed","aerial-ace",
        "spark","volt-tackle","overheat","leaf-storm","draco-meteor","eruption","water-spout",
        "spacial-rend","roar-of-time","seed-flare","shadow-force","judgment","crush-grip",
        "cross-poison","night-slash","air-slash","leaf-blade","cross-chop","vital-throw",
        "payback","assurance","foul-play","feint-attack","pursuit","bite","hyper-fang",
        "fire-fang","ice-fang","thunder-fang","psycho-cut","zen-headbutt","head-smash",
        "wood-hammer","aqua-tail","waterfall","dive","whirlpool","bind","wrap","constrict",
        "rollout","ice-ball","sparkling-aria","clanging-scales","core-enforcer",
      ];
      const esToEn: Record<string, string> = {};
      const enToEs: Record<string, string> = {};
      const chunkSize = 15;
      for (let i = 0; i < commonMoves.length; i += chunkSize) {
        const chunk = commonMoves.slice(i, i + chunkSize).filter(Boolean);
        await Promise.all(chunk.map(async (slug) => {
          try {
            const r = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
            if (!r.ok) return;
            const d = await r.json();
            const esRaw = d.names?.find((n: any) => n.language.name === "es")?.name;
            if (esRaw) {
              esToEn[esRaw.toLowerCase()] = slug;
              enToEs[slug] = esRaw.charAt(0).toUpperCase() + esRaw.slice(1);
            }
          } catch { /* skip */ }
        }));
      }
      console.log(`[PokeRun] REST fallback: ${Object.keys(esToEn).length} ES move names loaded`);
      setMoveEsMap(esToEn);
      setMoveEsDisplay(enToEs);
    };
    loadEsNames();
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      // El dropdown de movimientos se renderiza vía createPortal en
      // document.body (para poder posicionarse "fixed" y escapar overflows),
      // así que queda fuera de rootRef. Sin este chequeo, cualquier mousedown
      // ahí adentro —incluido arrastrar su propio scrollbar— se detectaba
      // como "click afuera" y cerraba el dropdown al instante.
      if ((target as HTMLElement)?.closest?.("[data-move-dropdown]")) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setPokemonOpen((prev) => prev.map(() => false));
        setMoveOpen((prev) => prev.map((arr) => arr.map(() => false)));
      }
      if (pokedexDropdownRef.current && !pokedexDropdownRef.current.contains(target)) {
        setPokedexDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    setTeam((t) =>
      t.map((s, i) => {
        if (i !== idx) return s;
        if (patch.name !== undefined && patch.name.trim() === "") {
          return EMPTY_SLOT();
        }
        return { ...s, ...patch };
      })
    );
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    pokemonSearch.forEach((query, idx) => {
      const isFake = team[idx]?.isFake;
      if (query.trim().length >= 2 && !isFake) {
        const timer = setTimeout(() => {
          let filtered: string[];
          if (activePokedex === "pokemon-z" && pokemonZData.length > 0) {
            // Buscar en el JSON de Pokémon Z por nombre crudo O por el label
            // ya formateado (ej. "Gigamax", "Mega", "Alola"), para que el
            // buscador devuelva resultados tanto al escribir "Butterfree" como
            // al escribir "Gigamax".
            const matches = pokemonZData.filter((p: any) => {
              const label = getZDisplayName(p).toLowerCase();
              return (
                label.includes(query.toLowerCase()) ||
                p.name?.toLowerCase().includes(query.toLowerCase())
              );
            });
            // Solo las especies con una forma Z realmente distinta (lista
            // curada Z_FORM_SPECIES) se etiquetan con el sufijo " Z" y reciben
            // su contraparte "estándar" vía PokéAPI. Las 4 especies "solo
            // mega" (Z_MEGA_ONLY_SPECIES) muestran su entrada base sin
            // sufijo, ya que es 1:1 igual a la oficial; solo su Mega lleva
            // sufijo " Z". El resto de la Pokedex Z (copia 1:1 de stats
            // oficiales, sin mega) se muestra igual que antes: una sola
            // entrada, sin sufijo. getZDisplayName centraliza estas reglas,
            // incluyendo el caso especial de Raichu → "Raichu Alola".
            const zMatches = matches.map((p: any) => {
              const label = getZDisplayName(p);
              return `${label}#z:${p.id}`;
            });
            // Para las especies de la lista curada (forma Z realmente
            // alterada), además ofrecemos su forma "estándar" (Pokedex
            // normal) buscada en vivo contra PokéAPI. Las 4 especies "solo
            // mega" (Z_MEGA_ONLY_SPECIES) NO entran acá: su entrada base del
            // JSON Z ya es 1:1 igual a la oficial, así que pedirla de nuevo
            // a PokéAPI generaría una entrada duplicada con el mismo nombre.
            // Si esa forma estándar todavía no existe en PokéAPI, simplemente
            // no se agrega (sin romper nada).
            const stdBaseNames = new Set(
              matches
                .filter((p: any) => Z_FORM_SPECIES.has(p.name?.toLowerCase() ?? ""))
                .filter((p: any) => !Z_FORM_NO_STANDARD_DUPLICATE.has(p.name?.toLowerCase() ?? ""))
                .map((p: any) => p.name?.toLowerCase())
                .filter(Boolean)
            );
            const stdMegaBaseNames = new Set(
              matches
                .filter((p: any) => p.formLabel === "Mega")
                .map((p: any) => p.name?.toLowerCase())
                .filter(Boolean)
            );
            const stdMatches: string[] = [];
            stdBaseNames.forEach((baseName: any) => {
              // getStandardForm resuelve el slug/nombre correctos de PokéAPI,
              // usando REGIONAL_FORM_OVERRIDE cuando la especie tiene una
              // forma regional/alterna como contraparte "estándar" relevante
              // (ej. Raichu → Raichu-Alola) en vez de su forma base nacional.
              const { slug, display } = getStandardForm(baseName);
              if (!pokemonList.includes(slug)) return; // no existe esa forma en PokéAPI
              stdMatches.push(`${display}#std:${slug}`);
            });
            stdMegaBaseNames.forEach((baseName: any) => {
              const slug = baseName.replace(/\s+/g, "-");
              const display = formatForDisplay(slug);
              // Algunas especies tienen una sola mega oficial ("-mega"), otras
              // tienen mega dual ("-mega-x" / "-mega-y", ej. Raichu, Charizard).
              // Probamos los 3 sufijos posibles y agregamos los que existan
              // realmente en PokéAPI.
              ["-mega", "-mega-x", "-mega-y"].forEach((suffix) => {
                const megaSlug = `${slug}${suffix}`;
                if (pokemonList.includes(megaSlug)) {
                  const suffixLabel = suffix === "-mega" ? "" : suffix.endsWith("x") ? " X" : " Y";
                  stdMatches.push(`Mega ${display}${suffixLabel}#std:${megaSlug}`);
                }
              });
            });
            filtered = [...zMatches, ...stdMatches].slice(0, 12);
          } else {
            filtered = pokemonList
              .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8);
          }
          setPokemonResults((prev) => prev.map((list, i) => (i === idx ? filtered : list)));
          setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? true : open)));
        }, 300);
        timers.push(timer);
      } else {
        setPokemonResults((prev) => prev.map((list, i) => (i === idx ? [] : list)));
        setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
      }
    });
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [pokemonSearch, pokemonList, team, activePokedex, pokemonZData]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    moveInputDraft.forEach((slotDrafts, idx) => {
      // Si el filtro "solo movimientos aprendibles" está activo, restringimos
      // las sugerencias de este slot al learnset real del Pokémon elegido
      // (null = sin learnset conocido todavía → no se filtra, para no dejar
      // el buscador vacío mientras carga o si el slot está vacío).
      const learnableSet =
        onlyLearnableMoves && team[idx]?.learnableMoves
          ? new Set(team[idx]!.learnableMoves as string[])
          : null;

      slotDrafts.forEach((draft, mi) => {
        // Caso especial: si "solo aprendibles" está activo y el campo está
        // vacío (recién enfocado, sin escribir nada todavía), mostramos de
        // una vez la lista completa y ordenada del learnset, sin esperar a
        // que el usuario escriba algo.
        if (draft !== null && draft.trim().length === 0 && learnableSet) {
          const lm = team[idx]?.learnMethods || {};
          // Orden: nivel (ascendente) → MT → tutor → huevo → sin dato conocido.
          const rank = (key: string) => {
            const info = lm[key];
            if (!info) return 4;
            if (info.type === "level") return 0;
            if (info.type === "mt") return 1;
            if (info.type === "tutor") return 2;
            if (info.type === "egg") return 3;
            return 4;
          };
          const compareByLearnMethod = (keyA: string, keyB: string, labelA: string, labelB: string) => {
            const ra = rank(keyA);
            const rb = rank(keyB);
            if (ra !== rb) return ra - rb;
            if (ra === 0) {
              const la = lm[keyA]?.level ?? 0;
              const lb = lm[keyB]?.level ?? 0;
              if (la !== lb) return la - lb;
            }
            return labelA.localeCompare(labelB);
          };
          let fullList: string[];
          if (activePokedex === "pokemon-z" && movesZData.length > 0) {
            fullList = movesZData
              .filter((m: any) => learnableSet.has(m.internalName))
              .sort((a: any, b: any) => compareByLearnMethod(a.internalName, b.internalName, a.name ?? "", b.name ?? ""))
              .map((m: any) => m.name as string);
          } else {
            fullList = moveList
              .filter((enSlug) => learnableSet.has(enSlug))
              .sort((a, b) => {
                const la = lang === "es" ? (moveEsDisplay[a] ?? a) : a;
                const lb = lang === "es" ? (moveEsDisplay[b] ?? b) : b;
                return compareByLearnMethod(a, b, la, lb);
              });
          }
          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? fullList : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? fullList.length > 0 : o) : s));
          return;
        }
        // Only search when there's an active draft
        if (draft === null || draft.trim().length < 2) {
          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? [] : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s));
          return;
        }
        const timer = setTimeout(() => {
          const query = normalizeMoveSearch(draft);
          let merged: string[];

          if (activePokedex === "pokemon-z" && movesZData.length > 0) {
            // En modo Z: buscar por nombre español o internalName en el JSON Z
            merged = movesZData
              .filter((m: any) => {
                const matchesQuery =
                  normalizeMoveSearch(m.name ?? "").includes(query) ||
                  normalizeMoveSearch(m.internalName ?? "").includes(query);
                if (!matchesQuery) return false;
                if (learnableSet && !learnableSet.has(m.internalName)) return false;
                return true;
              })
              .map((m: any) => m.name)
              .slice(0, 8);
          } else {
            const matches = moveList.filter((enSlug) => {
              const en = normalizeMoveSearch(enSlug.replace(/-/g, " "));
              const es = normalizeMoveSearch(moveEsDisplay[enSlug] ?? "");
              const matchesQuery = en.includes(query) || es.includes(query);
              if (!matchesQuery) return false;
              if (learnableSet && !learnableSet.has(enSlug)) return false;
              return true;
            });
            merged = matches.slice(0, 8);
          }

          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? merged : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? merged.length > 0 : o) : s));
        }, 250);
        timers.push(timer);
      });
    });
    return () => timers.forEach(clearTimeout);
  }, [moveInputDraft, moveList, moveEsDisplay, activePokedex, movesZData, onlyLearnableMoves, team, lang]);

  // Dado el nombre mostrado en una sugerencia del buscador de movimientos
  // (slug en inglés en modo estándar, nombre en español en modo Pokémon Z),
  // resuelve la etiqueta a mostrar a la derecha: "Nv. X" (nivel), "MT",
  // "Tutor" o "Huevo". Devuelve null si no se conoce el método.
  const getMoveLearnBadge = (slotIdx: number, name: string): string | null => {
    const slot = team[slotIdx];
    const lm = slot?.learnMethods;
    if (!lm) return null;
    let key = name;
    if (activePokedex === "pokemon-z" && movesZData.length > 0) {
      const zm = movesZData.find((m: any) => m.name === name || m.internalName === name);
      if (zm?.internalName) key = zm.internalName;
    }
    const info = lm[key];
    if (!info) return null;
    if (info.type === "level") return info.level ? `${t.moveBadgeLevelPrefix} ${info.level}` : t.moveBadgeLevelPrefix;
    if (info.type === "mt") return t.moveBadgeMt;
    if (info.type === "tutor") return t.moveBadgeTutor;
    if (info.type === "egg") return t.moveBadgeEgg;
    return null;
  };

  const updateMove = (slotIdx: number, moveIdx: number, patch: Partial<Move>) => {
    setTeam((t) =>
      t.map((s, i) => {
        if (i !== slotIdx) return s;
        const moves = s.moves.map((m, j) => {
          if (j !== moveIdx) return m;
          // Only reset to EMPTY_MOVE when explicitly clearing the name on a real (non-fake) move
          if (patch.name !== undefined && patch.name.trim() === "" && !m.isFake && patch.isFake === undefined) {
            return EMPTY_MOVE();
          }
          // When toggling isFake off, preserve the name but clear API-derived fields
          if (patch.isFake === false) {
            return { ...m, isFake: false, type: null, category: "Physical" as Move["category"] };
          }
          // When toggling isFake on, just set the flag (keep existing name/type)
          if (patch.isFake === true) {
            return { ...m, isFake: true };
          }
          // Name update from autocomplete: also bring type + category + nameEs from patch
          if (patch.name !== undefined) {
            return {
              ...m,
              name: patch.name,
              type: patch.type ?? m.type ?? null,
              category: patch.category ?? m.category,
              // Preserve nameEs from patch if provided, else keep existing
              nameEs: patch.nameEs !== undefined ? patch.nameEs : m.nameEs,
              // Datos para el tooltip de descripción: si vienen en el patch los
              // tomamos, si no, mantenemos los que ya tenía el movimiento.
              descriptionEs: patch.descriptionEs !== undefined ? patch.descriptionEs : m.descriptionEs,
              descriptionEn: patch.descriptionEn !== undefined ? patch.descriptionEn : m.descriptionEn,
              power: patch.power !== undefined ? patch.power : m.power,
              accuracy: patch.accuracy !== undefined ? patch.accuracy : m.accuracy,
              pp: patch.pp !== undefined ? patch.pp : m.pp,
            };
          }
          // Generic partial update (hiddenPowerType, category, type, etc.)
          return { ...m, ...patch };
        });
        return { ...s, moves };
      })
    );
  };

  // Intercambia dos movimientos dentro del mismo Pokémon (drag & drop simple).
  // También resetea el estado de UI por-movimiento (draft de búsqueda, dropdown
  // abierto, índice seleccionado, etc.) de ese slot para evitar que quede
  // desalineado con su nueva posición.
  const swapMoves = (slotIdx: number, fromMoveIdx: number, toMoveIdx: number) => {
    if (fromMoveIdx === toMoveIdx) return;
    setTeam((t) =>
      t.map((s, i) => {
        if (i !== slotIdx) return s;
        const moves = [...s.moves];
        const tmp = moves[fromMoveIdx];
        moves[fromMoveIdx] = moves[toMoveIdx];
        moves[toMoveIdx] = tmp;
        return { ...s, moves };
      })
    );
    const resetRow4 = <TVal,>(fill: TVal) => Array.from({ length: 4 }, () => fill);
    setMoveInputDraft((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4(null) : row)));
    setMoveResults((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4([] as string[]) : row)));
    setMoveOpen((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4(false) : row)));
    setMoveSelectedIdx((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4(-1) : row)));
  };

  // Fija (o borra, con null) el rol elegido a mano para un Pokémon puntual
  // del equipo, que reemplaza al rol calculado automáticamente por stats en
  // TODOS los cálculos del equipo (resumen de roles, redundancia, rol que
  // le falta al equipo, recomendaciones), no solo en su propia tarjeta.
  const setSlotManualRole = (slotIdx: number, roleEn: string | null) => {
    setTeam((t) => t.map((s, i) => (i === slotIdx ? { ...s, manualRoleEn: roleEn } : s)));
  };

  const swapSlots = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setTeam((t) => {
      const next = [...t];
      const tmp = next[fromIdx];
      next[fromIdx] = next[toIdx];
      next[toIdx] = tmp;
      return next;
    });
  };

  const selectPokemonSuggestion = (idx: number, name: string) => {
    setPokemonSearch((prev) => prev.map((value, i) => (i === idx ? "" : value)));
    setPokemonInputDraft((prev) => prev.map((value, i) => (i === idx ? null : value)));
    setPokemonResults((prev) => prev.map((list, i) => (i === idx ? [] : list)));
    setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
    setPokemonSelectedIdx((prev) => prev.map((sel, i) => (i === idx ? -1 : sel)));
    // `name` puede venir codificado como "Label#id" (formas/megas Z). Guardamos
    // el label limpio de inmediato para evitar parpadeo; fetchPokemon resuelve
    // la forma exacta por id y confirma el nombre final al terminar.
    const hashIdx = name.lastIndexOf("#");
    const displayLabel = hashIdx >= 0 ? name.slice(0, hashIdx) : name;
    // Limpiamos el sprite y su transform de inmediato: si no lo hacemos, el
    // sprite del Pokémon ANTERIOR se queda visible mientras fetchPokemon (que
    // es async) trae el nuevo, dando la sensación de que "el cambio de imagen
    // se mantiene un poco". Con esto se ve la Pokéball de placeholder en su
    // lugar hasta que el sprite nuevo esté listo.
    updateSlot(idx, { name: displayLabel, isFake: false, sprite: null, spriteTransform: null });
    fetchPokemon(name, idx);
  };

  // Agrega un candidato de "Pokémon recomendados" directo al primer slot
  // vacío del equipo (si hay lugar). Reutiliza el mismo pipeline de fetch
  // que usa el buscador normal (selectPokemonSuggestion → fetchPokemon),
  // así el sprite/stats/tipos quedan idénticos a como si lo hubieras
  // buscado a mano.
  const addCandidateToTeam = (candidate: AvailablePokemon) => {
    const emptyIdx = team.findIndex((s) => s.name.trim() === "");
    if (emptyIdx === -1) {
      showToast(
        lang === "es"
          ? "Tu equipo ya está completo (6/6). Elimina alguno primero."
          : "Your team is already full (6/6). Remove one first."
      );
      return;
    }
    const encodedName =
      activePokedex === "pokemon-z" && pokemonZData.length > 0
        ? `${candidate.name}#z:${candidate.id}`
        : candidate.slug;
    selectPokemonSuggestion(emptyIdx, encodedName);
    // Ya no tiene sentido seguir recomendándolo una vez que está en el equipo
    setRecDiscarded((prev) => new Set([...prev, candidate.slug]));
  };

  const selectMoveSuggestion = (slotIdx: number, moveIdx: number, name: string) => {
    // Clear the draft (back to display mode)
    setMoveInputDraft((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((d, mi) => mi === moveIdx ? null : d) : s)
    );
    setMoveResults((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((l, mi) => mi === moveIdx ? [] : l) : s)
    );
    setMoveOpen((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((o, mi) => mi === moveIdx ? false : o) : s)
    );
    setMoveSelectedIdx((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((sel, mi) => mi === moveIdx ? -1 : sel) : s)
    );
    updateMove(slotIdx, moveIdx, { name });
    fetchMove(name, slotIdx, moveIdx);
  };

  // ── Handlers del modal de filtros de movimientos ──────────────────────────
  const openMoveFilter = (slotIdx: number, moveIdx: number) => {
    setMoveFilterTarget({ slotIdx, moveIdx });
  };
  const closeMoveFilter = () => setMoveFilterTarget(null);
  const toggleMoveFilterCategory = (c: string) => {
    const slotIdx = moveFilterTarget?.slotIdx;
    if (slotIdx == null) return;
    setMoveFilterCategories((prev) =>
      prev.map((set, i) => {
        if (i !== slotIdx) return set;
        const next = new Set(set);
        if (next.has(c)) next.delete(c); else next.add(c);
        return next;
      })
    );
  };
  const toggleMoveFilterType = (ty: string) => {
    const slotIdx = moveFilterTarget?.slotIdx;
    if (slotIdx == null) return;
    setMoveFilterTypes((prev) =>
      prev.map((set, i) => {
        if (i !== slotIdx) return set;
        const next = new Set(set);
        if (next.has(ty)) next.delete(ty); else next.add(ty);
        return next;
      })
    );
  };
  const toggleMoveFilterOnlyZ = () => {
    setMoveFilterOnlyZ((v) => !v);
  };
  const clearMoveFilters = () => {
    const slotIdx = moveFilterTarget?.slotIdx;
    if (slotIdx == null) return;
    setMoveFilterSearch((prev) => prev.map((v, i) => (i === slotIdx ? "" : v)));
    setMoveFilterCategories((prev) => prev.map((v, i) => (i === slotIdx ? new Set<string>() : v)));
    setMoveFilterTypes((prev) => prev.map((v, i) => (i === slotIdx ? new Set<string>() : v)));
    setMoveFilterSortPower((prev) => prev.map((v, i) => (i === slotIdx ? null : v)));
  };
  const selectMoveFromFilter = (mv: { name: string; internalName?: string }) => {
    if (!moveFilterTarget) return;
    selectMoveSuggestion(moveFilterTarget.slotIdx, moveFilterTarget.moveIdx, mv.internalName ?? mv.name);
    setMoveFilterTarget(null);
  };

  // Recorta el primer frame de un spritesheet horizontal.
  // El alto del sprite = ancho de un frame (siempre cuadrado).
  // Devuelve una dataURL del frame recortado, o la URL original si falla.
  const cropFirstFrame = (url: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const size = img.naturalHeight; // alto = tamaño del frame cuadrado
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(url); return; }
          ctx.drawImage(img, 0, 0, size, size, 0, 0, size, size);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(url); // CORS u otro error: usar URL original
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });

  const fetchPokemon = async (name: string, idx: number) => {
    if (!name) return;

    // ── Pokémon Z: usar datos del JSON local ─────────────────────────────────
    if (activePokedex === "pokemon-z" && pokemonZData.length > 0) {
      // El selector codifica la forma exacta como "Label#z:id" (entradas del
      // JSON local de Pokémon Z, ej. "Mega Delphox Z#z:90005") o como
      // "Label#std:slug" (formas estándar/oficiales buscadas en PokéAPI, ej.
      // "Mega Delphox#std:delphox-mega"). Si no viene codificado así (flujos
      // viejos), caemos al match por nombre dentro del JSON local.
      const hashIdx = name.lastIndexOf("#");
      const encoded = hashIdx >= 0 ? name.slice(hashIdx + 1) : "";
      const needle = (hashIdx >= 0 ? name.slice(0, hashIdx) : name).toLowerCase().trim();

      // Forma estándar/oficial (Pokedex normal o su Mega real) vía PokéAPI,
      // aunque estemos en modo Pokémon Z.
      if (encoded.startsWith("std:")) {
        const slug = encoded.slice(4);
        try {
          const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
          if (!r.ok) throw new Error("not found");
          const data = await r.json();
          const types = data.types.map((t: any) => t.type.name);
          const sprite = data.sprites.front_default || data.sprites.other?.["official-artwork"]?.front_default || null;
          const stats: BaseStats = {
            HP: data.stats.find((s: any) => s.stat.name === "hp")?.base_stat ?? 0,
            ATK: data.stats.find((s: any) => s.stat.name === "attack")?.base_stat ?? 0,
            DEF: data.stats.find((s: any) => s.stat.name === "defense")?.base_stat ?? 0,
            "SP.ATK": data.stats.find((s: any) => s.stat.name === "special-attack")?.base_stat ?? 0,
            "SP.DEF": data.stats.find((s: any) => s.stat.name === "special-defense")?.base_stat ?? 0,
            SPE: data.stats.find((s: any) => s.stat.name === "speed")?.base_stat ?? 0,
          };
          const isMega = /-mega(-x|-y)?$/.test(slug);
          const baseSlug = isMega ? slug.replace(/-mega(-x|-y)?$/, "") : slug;
          const xyMatch = slug.match(/-mega-(x|y)$/);
          const megaSuffix = xyMatch ? ` ${xyMatch[1].toUpperCase()}` : "";
          const displayName = isMega ? `Mega ${formatForDisplay(baseSlug)}${megaSuffix}` : formatForDisplay(baseSlug);
          const learnableMoves: string[] = Array.isArray(data.moves)
            ? Array.from(new Set(data.moves.map((mv: any) => mv?.move?.name).filter(Boolean)))
            : [];
          const learnMethods = buildLearnMethodsFromApi(data.moves);
          updateSlot(idx, { name: displayName, types, sprite, stats, abilities: null, hiddenAbility: null, learnableMoves, learnMethods });
        } catch (e) {
          alert("Pokémon no encontrado: " + name);
        }
        return;
      }

      const encodedId = encoded.startsWith("z:") ? parseInt(encoded.slice(2), 10) : NaN;

      // Buscamos primero por id (comparando como número en ambos lados, ya
      // que algunos JSON pueden traer el id como string) y, si no aparece
      // nada (id inconsistente o ausente), caemos a buscar por nombre en vez
      // de seguir de largo hacia el fetch estándar de la API con un nombre
      // codificado (p.ej. "Pikachu#z:25") que ahí sí fallaría siempre. Esto
      // evita que el sprite quede sin cargar al agregar un Pokémon desde el
      // botón "+" de recomendados.
      const zEntry =
        (!isNaN(encodedId)
          ? pokemonZData.find((p: any) => Number(p.id) === encodedId)
          : undefined) ??
        pokemonZData.find(
          (p: any) =>
            p.name?.toLowerCase() === needle ||
            p.internalName?.toLowerCase() === needle ||
            formatForDisplay(p.name ?? "").toLowerCase() === needle ||
            getZDisplayName(p).toLowerCase() === needle
        );
      if (zEntry) {
        // Tipos del JSON vienen en español → convertir a slugs de API
        const types = (zEntry.types as string[])
          .map((t) => normalizeTypeToApi(t))
          .filter(Boolean)
          .slice(0, 2);
        const stats: BaseStats = zEntry.stats ?? null;
        // Corregir URL: usar id con padding de 3 dígitos (001.png en vez de 1.png),
        // salvo las 8 entradas Mega Z (id 90001-90008), cuyo sprite real tiene un
        // sufijo "_N" distinto del dexId base (ver Z_MEGA_SPRITE_SUFFIX).
        const rawSprite = getZSpriteUrl(zEntry);
        // Recortar primer frame del spritesheet
        const sprite = rawSprite ? await cropFirstFrame(rawSprite) : null;
        // Nombre final centralizado en getZDisplayName: Z_FORM_SPECIES lleva
        // sufijo " Z", Z_MEGA_ONLY_SPECIES no, Megas llevan "Mega X Z", y
        // Raichu base se muestra como "Raichu Alola" (ver definición arriba).
        const displayName = getZDisplayName(zEntry);
        const abilities: string[] | null = Array.isArray(zEntry.abilities) && zEntry.abilities.length > 0 ? zEntry.abilities : null;
        const hiddenAbility: string | null = zEntry.hiddenAbility ?? null;
        // Learnset real: movimientos por nivel + tutor + huevo, como
        // internalNames (ej. "THUNDERBOLT"), para poder filtrar el
        // autocompletado contra movesZData (que también trae internalName).
        const learnableMoves: string[] = Array.from(new Set([
          ...(Array.isArray(zEntry.moves) ? zEntry.moves.map((mv: any) => mv?.move).filter(Boolean) : []),
          ...(Array.isArray(zEntry.tutorMoves) ? zEntry.tutorMoves : []),
          ...(Array.isArray(zEntry.eggMoves) ? zEntry.eggMoves : []),
          ...(Array.isArray(zEntry.tmMoves) ? zEntry.tmMoves : []),
        ]));
        const learnMethods: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> = {};
        if (Array.isArray(zEntry.moves)) {
          zEntry.moves.forEach((mv: any) => {
            const mname = mv?.move;
            if (!mname) return;
            const rawLevel = mv?.level ?? mv?.lvl;
            const lvl = typeof rawLevel === "number" ? rawLevel : (typeof rawLevel === "string" ? parseInt(rawLevel, 10) : undefined);
            learnMethods[mname] = { type: "level", level: Number.isFinite(lvl) ? lvl : undefined };
          });
        }
        // Movimientos por MT: vienen en el arreglo "tmMoves" del JSON.
        (zEntry.tmMoves ?? []).forEach?.((mname: string) => {
          if (mname && !learnMethods[mname]) learnMethods[mname] = { type: "mt" };
        });
        (zEntry.tutorMoves ?? []).forEach?.((mname: string) => {
          if (mname && !learnMethods[mname]) learnMethods[mname] = { type: "tutor" };
        });
        (zEntry.eggMoves ?? []).forEach?.((mname: string) => {
          if (mname && !learnMethods[mname]) learnMethods[mname] = { type: "egg" };
        });
        updateSlot(idx, { name: displayName, types, sprite, stats, abilities, hiddenAbility, learnableMoves, learnMethods });
        return;
      }
      // Si no está en el JSON Z, cae al fetch normal de la API
    }

    // ── Estándar: PokéAPI ────────────────────────────────────────────────────
    try {
      const apiName = formatForAPI(name);
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
      if (!r.ok) throw new Error("not found");
      const data = await r.json();
      const types = data.types.map((t: any) => t.type.name);
      const sprite = data.sprites.front_default || data.sprites.other?.['official-artwork']?.front_default || null;
      const stats: BaseStats = {
        HP: data.stats.find((s: any) => s.stat.name === "hp")?.base_stat ?? 0,
        ATK: data.stats.find((s: any) => s.stat.name === "attack")?.base_stat ?? 0,
        DEF: data.stats.find((s: any) => s.stat.name === "defense")?.base_stat ?? 0,
        "SP.ATK": data.stats.find((s: any) => s.stat.name === "special-attack")?.base_stat ?? 0,
        "SP.DEF": data.stats.find((s: any) => s.stat.name === "special-defense")?.base_stat ?? 0,
        SPE: data.stats.find((s: any) => s.stat.name === "speed")?.base_stat ?? 0,
      };
      const learnableMoves: string[] = Array.isArray(data.moves)
        ? Array.from(new Set(data.moves.map((mv: any) => mv?.move?.name).filter(Boolean)))
        : [];
      const learnMethods = buildLearnMethodsFromApi(data.moves);
      updateSlot(idx, { name: formatForDisplay(data.name), types, sprite, stats, abilities: null, hiddenAbility: null, learnableMoves, learnMethods });
    } catch (e) {
      alert("Pokémon no encontrado: " + name);
    }
  };

  const fetchMove = async (moveName: string, slotIdx: number, moveIdx: number) => {
    if (!moveName) return;
    // Skip API fetch for fake moves or Hidden Power (no real data needed)
    const isHiddenPower = /hidden.?power|poder.?oculto/i.test(moveName);
    if (isHiddenPower) {
      updateMove(slotIdx, moveIdx, { name: moveName, category: "Special", type: "normal" });
      return;
    }

    // ── Pokémon Z: buscar en el JSON de movimientos ──────────────────────────
    if (activePokedex === "pokemon-z" && movesZData.length > 0) {
      const needle = moveName.toLowerCase().trim();
      const zMove = movesZData.find(
        (m: any) =>
          m.internalName?.toLowerCase() === needle ||
          m.name?.toLowerCase() === needle ||
          // también buscar por slug estilo API (guiones → sin espacios)
          m.internalName?.toLowerCase().replace(/_/g, "") === needle.replace(/[-\s]/g, "")
      );
      if (zMove) {
        const category: Move["category"] =
          zMove.category === "Special" ? "Special" :
          zMove.category === "Status"  ? "Status"  : "Physical";
        updateMove(slotIdx, moveIdx, {
          type: zMove.type ?? null,
          category,
          name: zMove.name,       // nombre en español del juego Z
          nameEs: zMove.name,
          descriptionEs: zMove.descriptionEs ?? null,
          descriptionEn: zMove.descriptionEn ?? null,
          power: zMove.power ?? null,
          accuracy: zMove.accuracy ?? null,
          pp: zMove.pp ?? null,
        });
        return;
      }
      // Si no está en el JSON Z, cae al fetch normal de la API
    }

    // ── Estándar: PokéAPI ────────────────────────────────────────────────────
    try {
      const apiName = formatForAPI(moveName);
      const r = await fetch(`https://pokeapi.co/api/v2/move/${apiName}`);
      if (!r.ok) throw new Error("move not found");
      const data = await r.json();
      const mType = data.type.name;
      const category = data.damage_class?.name?.toLowerCase() === "status" ? "Status" : data.damage_class?.name?.toLowerCase() === "special" ? "Special" : "Physical";
      // Try to get Spanish name, fallback to formatted English
      const esName = data.names?.find((n: any) => n.language.name === "es")?.name ?? null;
      const enName = formatForDisplay(data.name);
      // Descripción ("flavor text"): tomamos la entrada más reciente disponible
      // para cada idioma (el array trae una por versión de juego).
      const flavorEntries: any[] = Array.isArray(data.flavor_text_entries) ? data.flavor_text_entries : [];
      const cleanFlavor = (txt: string) => txt.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
      const descEs = [...flavorEntries].reverse().find((f) => f.language?.name === "es")?.flavor_text;
      const descEn = [...flavorEntries].reverse().find((f) => f.language?.name === "en")?.flavor_text;
      // Store both so we can switch language without re-fetching
      updateMove(slotIdx, moveIdx, {
        type: mType,
        category,
        name: enName,
        nameEs: esName ?? enName,
        descriptionEs: descEs ? cleanFlavor(descEs) : null,
        descriptionEn: descEn ? cleanFlavor(descEn) : null,
        power: typeof data.power === "number" ? data.power : null,
        accuracy: typeof data.accuracy === "number" ? data.accuracy : null,
        pp: typeof data.pp === "number" ? data.pp : null,
      });
    } catch (e) {
      // ignore, leave type null
    }
  };

  // Analysis: weaknesses & strengths
  const analysis = useMemo(() => {
    const attackingTypes = Object.keys(typeRelations);
    const weaknessesCount: Record<string, number> = {};
    const strengthsCount: Record<string, number> = {};
    // Por cada tipo atacante, qué índices del equipo (0-5) son débiles/resisten.
    // Esto permite detectar, para un miembro dado, si es EL ÚNICO que cubre
    // algo (crítico, no reemplazable) o si su cobertura es redundante
    // (ya la aporta otro miembro también) — base del sistema de "quién
    // conviene reemplazar".
    const weakMemberIdx: Record<string, number[]> = {};
    const resistMemberIdx: Record<string, number[]> = {};

    if (!attackingTypes.length) return { weaknesses: weaknessesCount, strengths: strengthsCount, weakMemberIdx, resistMemberIdx };

    // For each attacking type, compute how many Pokémon are >=2 multiplier (weak) or <=0.5 (resistant)
    attackingTypes.forEach((atk) => {
      const rel = typeRelations[atk];
      if (!rel) return;
      const doubleTo = new Set(rel.double_damage_to.map((t: any) => t.name));
      const halfTo = new Set(rel.half_damage_to.map((t: any) => t.name));
      const noTo = new Set(rel.no_damage_to.map((t: any) => t.name));

      let weak = 0;
      let resist = 0;
      team.forEach((poke, idx) => {
        const pokeTypes = poke.types.filter(Boolean);
        if (!pokeTypes.length) return;
        let mult = 1;
        pokeTypes.forEach((def) => {
          if (noTo.has(def)) mult *= 0;
          else if (doubleTo.has(def)) mult *= 2;
          else if (halfTo.has(def)) mult *= 0.5;
        });
        if (mult >= 2) { weak++; (weakMemberIdx[atk] ??= []).push(idx); }
        if (mult <= 0.5 && mult > 0) { resist++; (resistMemberIdx[atk] ??= []).push(idx); }
      });

      if (weak > 0) weaknessesCount[atk] = weak;
      if (resist > 0) strengthsCount[atk] = resist;
    });

    return { weaknesses: weaknessesCount, strengths: strengthsCount, weakMemberIdx, resistMemberIdx };
  }, [team, typeRelations]);

  // ─── Tipos recomendados para agregar (sección "Tipos") ────────────────────
  // Sugiere qué tipo(s) le convendría tener al PRÓXIMO Pokémon del equipo,
  // basado únicamente en el panorama de tipos actual (no en stats ni rol):
  //   1. Se EXCLUYEN tipos que sean débiles a una debilidad ya compartida por
  //      el equipo (≥2 miembros débiles a ese tipo), para no empeorarla.
  //      Ej.: si Fuego y Eléctrico ya dejan al equipo con 2 miembros débiles
  //      a Tierra, no se sugiere Veneno (débil a Tierra), porque subiría esa
  //      debilidad a 3.
  //   2. Se premia que el tipo candidato RESISTA tipos donde el equipo tiene
  //      poca o ninguna resistencia (0 o 1 miembro resistente), y más aún si
  //      resiste una debilidad compartida existente del equipo.
  const typeAddSuggestions = useMemo(() => {
    const attackingTypes = Object.keys(typeRelations);
    if (!attackingTypes.length) return [];
    const hasTeam = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!hasTeam) return [];

    const currentWeak = analysis.weaknesses;
    const currentResist = analysis.strengths;

    const scored = attackingTypes
      .map((candidateType) => {
        const rel = typeRelations[candidateType];
        if (!rel) return null;
        const candidateWeakTo = new Set((rel.double_damage_from ?? []).map((x: any) => x.name));
        const candidateResists = new Set([
          ...(rel.half_damage_from ?? []).map((x: any) => x.name),
          ...(rel.no_damage_from ?? []).map((x: any) => x.name),
        ]);

        // (1) Filtro duro: ¿este tipo es débil a alguna debilidad compartida
        // (≥2 miembros) que ya tiene el equipo? Si sí, queda descartado.
        const worsensTypes = Object.entries(currentWeak)
          .filter(([t, count]) => count >= 2 && candidateWeakTo.has(t))
          .map(([t]) => t);
        if (worsensTypes.length > 0) return null;

        // (2) Bonus: resiste tipos donde el equipo tiene poca/ninguna resistencia.
        const addsResistTypes: string[] = [];
        let resistBonus = 0;
        attackingTypes.forEach((t) => {
          if (!candidateResists.has(t)) return;
          const existingResistCount = currentResist[t] ?? 0;
          if (existingResistCount <= 1) {
            addsResistTypes.push(t);
            resistBonus += existingResistCount === 0 ? 3 : 1.5;
          }
        });

        // (3) Bonus extra: resiste una debilidad compartida actual del equipo
        // (soluciona un problema real, no solo "cubre un hueco menor").
        const coversWeaknessTypes: string[] = [];
        let coversBonus = 0;
        Object.entries(currentWeak).forEach(([t, count]) => {
          if (candidateResists.has(t)) {
            coversWeaknessTypes.push(t);
            coversBonus += count * 2;
          }
        });

        // (4) Penalización leve por fragilidad general (cuántos tipos lo debilitan).
        const fragilityPenalty = candidateWeakTo.size * 0.5;

        const score = resistBonus + coversBonus - fragilityPenalty;
        if (score <= 0) return null;

        return { type: candidateType, score, addsResistTypes, coversWeaknessTypes };
      })
      .filter((x): x is { type: string; score: number; addsResistTypes: string[]; coversWeaknessTypes: string[] } => x !== null);

    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [team, analysis, typeRelations]);

  // Offense coverage
  const coverage = useMemo(() => {
    const canHitSupereffective: Record<string, number> = {};
    const canHitReduced: Record<string, number> = {};
    Object.keys(typeRelations).forEach((t) => {
      canHitSupereffective[t] = 0;
      canHitReduced[t] = 0;
    });

    team.forEach((slot) => {
      slot.moves.forEach((m) => {
        if (!m.name || m.category === "Status") return;
        // For Hidden Power, use the chosen hiddenPowerType; otherwise use m.type
        const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
        const effectiveType = isHP ? (m.hiddenPowerType ?? null) : m.type;
        if (!effectiveType) return;
        const rel = typeRelations[effectiveType];
        if (!rel) return;
        rel.double_damage_to.forEach((d: any) => (canHitSupereffective[d.name]++));
        rel.half_damage_to.forEach((d: any) => (canHitReduced[d.name]++));
        rel.no_damage_to.forEach((d: any) => (canHitReduced[d.name]++));
      });
    });

    const supCount = Object.values(canHitSupereffective).filter((v) => v > 0).length;
    const redCount = Object.values(canHitReduced).filter((v) => v > 0).length;
    return { supCount, redCount, canHitSupereffective, canHitReduced };
  }, [team, typeRelations]);

  // ─── Sistema de "aporte al equipo" (quién conviene reemplazar) ───────────
  // Para cada miembro del equipo calcula qué tanto aporta de verdad, en vez
  // de asumir que "todos aportan igual". Se basa en 3 cosas objetivas,
  // reutilizando los mismos datos de analysis (weakMemberIdx/resistMemberIdx)
  // que ya se calculan para el resto de la UI, más el mismo esquema de
  // bstBonus que ya usamos en las recomendaciones (stats totales):
  //
  //   1. uniqueResistances: tipos donde ESTE es el ÚNICO miembro que resiste.
  //      Perderlo deja al equipo totalmente expuesto a ese tipo — es lo más
  //      valioso que puede aportar un Pokémon, y pesa fuerte a favor de
  //      mantenerlo.
  //   2. weaknessDrag: tipos donde el equipo YA es débil compartido (2+
  //      miembros débiles) y este es uno de ellos. Si me deshago de él y
  //      pongo algo que no sea débil a eso, esa debilidad compartida mejora.
  //      Pesa en contra.
  //   3. redundantResistances: tipos que resiste pero que 2+ miembros más
  //      también resisten — cobertura "de sobra", no se pierde nada
  //      relevante si se va. Pesa levemente en contra.
  //   4. bst (stats totales): a igual redundancia/drag, preferimos conservar
  //      al más fuerte en términos brutos.
  //
  // El resultado es un "valor de permanencia" por miembro: cuanto MÁS bajo,
  // más conviene reemplazarlo. Se ordena de menor a mayor (peor primero).
  const teamContribution = useMemo(() => {
    if (!Object.keys(typeRelations).length) return [];
    // No sugerir a quién reemplazar con menos de 3 Pokémon cargados: con tan
    // pocos miembros cualquier comparación de "aporte" es poco significativa
    // (casi siempre el equipo entero terminaría siendo "único" en algo).
    const filledSlotsCount = team.filter(
      (s) => s.name.trim() !== "" && s.types.filter(Boolean).length > 0
    ).length;
    if (filledSlotsCount < 3) return [];
    const { weakMemberIdx, resistMemberIdx, weaknesses: teamWeaknesses } = analysis;

    return team
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot }) => slot.name.trim() !== "" && slot.types.filter(Boolean).length > 0)
      .map(({ slot, idx }) => {
        const uniqueResistTypes: string[] = [];
        const redundantResistTypes: string[] = [];
        const dragWeaknessTypes: string[] = [];

        Object.entries(resistMemberIdx).forEach(([atkType, members]) => {
          if (!members.includes(idx)) return;
          if (members.length === 1) uniqueResistTypes.push(atkType);
          else redundantResistTypes.push(atkType);
        });
        Object.entries(weakMemberIdx).forEach(([atkType, members]) => {
          if (!members.includes(idx)) return;
          if ((teamWeaknesses[atkType] ?? 0) >= 2) dragWeaknessTypes.push(atkType);
        });

        const bst = slot.stats
          ? Object.values(slot.stats).reduce((sum: number, v: number) => sum + v, 0)
          : 0;
        const bstBonus = Math.max(0, Math.min(80, ((bst - 300) / (720 - 300)) * 80));

        // Ponderación: cubrir algo único vale mucho más que el resto —
        // preferimos avisar "ojo, es el único que te tapa X" antes que
        // sugerir sacarlo solo porque tiene stats bajas.
        const value =
          uniqueResistTypes.length * 30 -
          dragWeaknessTypes.length * 15 -
          redundantResistTypes.length * 5 +
          bstBonus * 0.5;

        return {
          idx,
          slot,
          bst,
          uniqueResistTypes,
          redundantResistTypes,
          dragWeaknessTypes,
          value,
        };
      })
      .sort((a, b) => a.value - b.value); // peor aporte primero
  }, [team, typeRelations, analysis]);

  // Attack type suggestions: find which move type covers the most uncovered types
  const attackSuggestions = useMemo(() => {
    if (!Object.keys(typeRelations).length) return [];
    const uncovered = Object.entries(coverage.canHitSupereffective)
      .filter(([_, v]) => v === 0)
      .map(([t]) => t);
    if (uncovered.length === 0) return [];

    const uncoveredSet = new Set(uncovered);
    // For each possible attacking type, count how many uncovered types it hits super-effectively
    const scores: Array<{ atkType: string; covers: string[]; score: number }> = [];
    Object.keys(typeRelations).forEach((atkType) => {
      const rel = typeRelations[atkType];
      if (!rel) return;
      const covers = rel.double_damage_to
        .map((d: any) => d.name)
        .filter((t: string) => uncoveredSet.has(t));
      if (covers.length > 0) scores.push({ atkType, covers, score: covers.length });
    });
    // Sort by coverage count desc, deduplicate by coverage set to avoid near-identical suggestions
    scores.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    return scores
      .filter((s) => { const key = s.covers.slice().sort().join(","); if (seen.has(key)) return false; seen.add(key); return true; })
      .slice(0, 3);
  }, [coverage, typeRelations]);

  // Tipos con MENOR cobertura (distinto de "sin cobertura", que ya son 0×):
  // toma el conteo mínimo mayor a 0 entre los tipos que sí golpeamos, junta
  // todos los tipos empatados en ese mínimo, y calcula qué 1 o 2 tipos de
  // ataque cubrirían la mayor cantidad posible de esos tipos débiles.
  const weakCoverageSuggestion = useMemo(() => {
    if (!Object.keys(typeRelations).length) return null;
    const nonZeroEntries = Object.entries(coverage.canHitSupereffective).filter(([, v]) => v > 0);
    if (nonZeroEntries.length === 0) return null;
    const minCount = Math.min(...nonZeroEntries.map(([, v]) => v));
    const weakTypes = nonZeroEntries.filter(([, v]) => v === minCount).map(([ty]) => ty);

    // Para cada tipo de ataque candidato, qué tipos débiles cubriría si lo agregamos
    const atkCoverage: Record<string, string[]> = {};
    Object.keys(typeRelations).forEach((atkType) => {
      const rel = typeRelations[atkType];
      if (!rel) return;
      const covers = rel.double_damage_to.map((d: any) => d.name).filter((ty: string) => weakTypes.includes(ty));
      if (covers.length > 0) atkCoverage[atkType] = covers;
    });
    const candidates = Object.keys(atkCoverage);
    if (candidates.length === 0) return { minCount, weakTypes, bestTypes: [] as { atkType: string; covered: string[] }[] };

    if (weakTypes.length === 1) {
      // Con un solo tipo débil, cualquier tipo de ataque que lo cubra sirve;
      // mostramos todos los candidatos (empatados, todos cubren ese único tipo).
      const sorted = candidates.slice().sort();
      return {
        minCount,
        weakTypes,
        bestTypes: sorted.map((ty) => ({ atkType: ty, covered: atkCoverage[ty] })),
      };
    }

    // Con 2+ tipos débiles: NO buscamos la mejor combinación conjunta, sino
    // el/los tipo(s) de ataque que, CADA UNO POR SU CUENTA, cubran la mayor
    // cantidad de tipos débiles. Si hay un empate (ej. 2 tipos que cubren 2
    // cada uno), se recomiendan ambos por separado.
    const maxSingle = Math.max(...candidates.map((ty) => atkCoverage[ty].length));
    const bestTypes = candidates
      .filter((ty) => atkCoverage[ty].length === maxSingle)
      .sort()
      .map((ty) => ({ atkType: ty, covered: atkCoverage[ty] }));
    return { minCount, weakTypes, bestTypes };
  }, [coverage, typeRelations]);

  // Feature 1: movimientos ofensivos repetidos por tipo. A partir de 3
  // movimientos del mismo tipo de ataque en el equipo, el/los adicionales ya
  // no suman cobertura nueva (pegan a los mismos tipos que el primero), así
  // que vale la pena marcarlo como posible desperdicio de un moveslot.
  const moveTypeRedundancy = useMemo(() => {
    const byType: Record<string, string[]> = {};
    const countByType: Record<string, number> = {};
    team.forEach((slot) => {
      slot.moves.forEach((m) => {
        if (!m.name || m.category === "Status") return;
        const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
        const effectiveType = isHP ? (m.hiddenPowerType ?? null) : m.type;
        if (!effectiveType) return;
        countByType[effectiveType] = (countByType[effectiveType] ?? 0) + 1;
        const names = (byType[effectiveType] ??= []);
        const pokemonName = slot.name || "?";
        if (!names.includes(pokemonName)) names.push(pokemonName);
      });
    });
    return Object.entries(countByType)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([atkType, count]) => ({ atkType, count, pokemonNames: byType[atkType] }));
  }, [team]);

  // Debilidades compartidas del equipo (fusiona lo que antes estaban eran dos
  // cosas separadas: el resumen "debilidad más compartida" acá en Tipos, y la
  // mitad defensiva de "Sugerencias de balance" en otra tarjeta aparte).
  // Para cada tipo al que 2+ Pokémon del equipo son débiles: cuántos son,
  // quiénes, y qué tipo(s) lo resisten como sugerencia de arreglo — todo en
  // un solo lugar en vez de repetido con distinto estilo en dos tarjetas.
  const sharedWeaknesses = useMemo(() => {
    const entries = Object.entries(analysis.weaknesses).filter(([, c]) => c >= 3);
    if (entries.length === 0) return [];
    return entries
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([weakType, count]) => {
        const names = (analysis.weakMemberIdx[weakType] || []).map((idx) => team[idx]?.name).filter(Boolean);
        const rel = typeRelations[weakType];
        const resistantTypes = rel
          ? allTypes.filter((ty) => {
              const halfTo = new Set(rel.half_damage_to.map((x: any) => x.name));
              const noTo = new Set(rel.no_damage_to.map((x: any) => x.name));
              return halfTo.has(ty) || noTo.has(ty);
            }).slice(0, 3)
          : [];
        return { weakType, count, names, resistantTypes };
      });
  }, [analysis, team, typeRelations, allTypes]);


  // Pokémon recommendados: análisis 100% dinámico sobre TODOS los Pokémon
  // disponibles en el Builder (allPokemonData), sin ninguna lista fija.
  // Para cada uno se simula cómo cambiaría el perfil defensivo del equipo,
  // se puntúa según las prioridades del motor de scoring, y se muestran
  // únicamente los mejores candidatos pasando todos los filtros activos.

  // Candidatos activos según la Pokedex seleccionada.
  // En modo Z: convierte pokemonZData al mismo formato AvailablePokemon.
  // En modo estándar: usa allPokemonData cargado desde PokéAPI/GraphQL.
  const activeCandidates = useMemo((): AvailablePokemon[] => {
    if (activePokedex === "pokemon-z" && pokemonZData.length > 0) {
      return pokemonZData.map((p: any) => {
        const displayName = getZDisplayName(p);
        return {
          slug: displayName.toLowerCase().replace(/\s+/g, "-"),
          name: displayName,
          id: p.id ?? 0,
          dexId: p.dexId ?? p.id ?? 0,
          types: ((p.types as string[]) ?? [])
            .map((t) => normalizeTypeToApi(t))
            .filter(Boolean)
            .slice(0, 2) as [string] | [string, string],
          stats: p.stats ?? null,
          // fakemon/megas (id >= 899) siempre cuentan como evolución final.
          // Para especies reales: combinamos el set dinámico de PokéAPI
          // (speciesWithEvolution, evoluciones "oficiales") CON la lista
          // estática POKEMON_Z_PRE_EVOS. Antes, una vez terminaba el fetch
          // dinámico, este pisaba por completo a la lista estática — y como
          // PokéAPI real no sabe que, por ejemplo, Marowak(Z) evoluciona a
          // Marolier (evolución exclusiva de Pokémon Z), Marowak quedaba mal
          // marcado como "última evolución". Ahora un Pokémon NO es evolución
          // final si CUALQUIERA de las dos fuentes dice que evoluciona.
          isFinalEvo:
            p.id >= 899 ||
            !(speciesWithEvolution.has(p.id) || POKEMON_Z_PRE_EVOS.has(p.id)),
          formLabel: p.formLabel ?? null,
          abilities: Array.isArray(p.abilities) && p.abilities.length > 0 ? p.abilities : null,
          hiddenAbility: p.hiddenAbility ?? null,
          // Learnset completo (nivel + MT + tutor + huevo), como internalNames,
          // igual que el que se calcula al elegir un Pokémon para el equipo
          // (ver fetchPokemon), pero acá se precalcula para TODOS los
          // candidatos para poder filtrar recomendaciones por movimiento.
          learnableMoveNames: Array.from(new Set([
            ...(Array.isArray(p.moves) ? p.moves.map((mv: any) => mv?.move).filter(Boolean) : []),
            ...(Array.isArray(p.tutorMoves) ? p.tutorMoves : []),
            ...(Array.isArray(p.eggMoves) ? p.eggMoves : []),
            ...(Array.isArray(p.tmMoves) ? p.tmMoves : []),
          ])),
        };
      });
    }
    return allPokemonData;
  }, [activePokedex, pokemonZData, allPokemonData, speciesWithEvolution]);

  // Lista de nombres de habilidad únicos entre todos los candidatos activos,
  // usada para las sugerencias del autocompletado del filtro por habilidad.
  // En modo Z se muestran tal cual (ya en español); en modo estándar se
  // formatean desde el slug de PokéAPI (ej. "water-absorb" → "Water Absorb").
  const allAbilityNamesForFilter = useMemo(() => {
    const set = new Set<string>();
    activeCandidates.forEach((c) => {
      (c.abilities ?? []).forEach((ab) => set.add(activePokedex === "pokemon-z" ? ab : formatForDisplay(ab)));
      if (c.hiddenAbility) set.add(activePokedex === "pokemon-z" ? c.hiddenAbility : formatForDisplay(c.hiddenAbility));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeCandidates, activePokedex]);

  // Lista para el modal "estilo movimientos": nombre + descripción de cada
  // habilidad de Pokémon Z. Solo tiene sentido en esa pokédex porque es la
  // única con descripciones locales precargadas.
  const abilitiesStandardBySlug = useMemo(() => {
    const map = new Map<string, { nameEs: string; nameEn: string; descriptionEs: string; descriptionEn: string }>();
    abilitiesStandardData.forEach((a) => map.set(a.slug, a));
    return map;
  }, [abilitiesStandardData]);

  // Etiqueta a mostrar para una habilidad de la dex estándar: nombre en
  // español si ya cargó el dataset (y el idioma activo es ES), si no cae al
  // nombre formateado desde el slug en inglés (ej. "Water Absorb").
  const getStdAbilityLabel = (slug: string): string => {
    const entry = abilitiesStandardBySlug.get(slug);
    if (entry) return lang === "es" ? entry.nameEs : entry.nameEn;
    return formatForDisplay(slug);
  };
  const getStdAbilityDescription = (slug: string): string => {
    const entry = abilitiesStandardBySlug.get(slug);
    if (!entry) return "";
    return (lang === "es" ? entry.descriptionEs : entry.descriptionEn) || (lang === "es" ? entry.descriptionEn : entry.descriptionEs) || "";
  };

  const abilityModalEntries = useMemo(() => {
    if (activePokedex === "pokemon-z") {
      return Object.entries(abilitiesZDescData).map(([esName, data]) => ({
        // Guardamos el nombre en español (esName) como valor real seleccionable,
        // ya que recFilterAbility/el resto del filtro trabaja con ese formato;
        // solo la etiqueta visible cambia según el idioma.
        value: esName,
        name: lang === "es" ? esName : getAbilityDisplayName(esName),
        description: (lang === "es" ? data.description : (data.descriptionEn ?? data.description)) ?? "",
        isOriginal: !!data.customAbility,
      }));
    }
    // Dex estándar: el valor seleccionable es el slug en inglés de PokéAPI
    // (ej. "chlorophyll"), igual formato que usa el resto del filtro.
    return abilitiesStandardData.map((a) => ({
      value: a.slug,
      name: lang === "es" ? a.nameEs : a.nameEn,
      description: (lang === "es" ? a.descriptionEs : a.descriptionEn) || (lang === "es" ? a.descriptionEn : a.descriptionEs) || "",
    }));
  }, [abilitiesZDescData, abilitiesStandardData, activePokedex, lang]);

  const recFilterAbilitySuggestions = useMemo(() => {
    const q = normalizeApostrophe(recFilterAbility.trim().toLowerCase());
    if (q.length < 2) return [];
    return allAbilityNamesForFilter
      .filter((ab) => ab.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allAbilityNamesForFilter, recFilterAbility]);

  const pokemonRecommendations = useMemo(() => {
    if (!Object.keys(typeRelations).length) return [];
    if (!activeCandidates.length) return [];
    const hasTeam = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!hasTeam) return [];

    const teamWeaknesses = analysis.weaknesses;

    // Pokémon ya presentes en el equipo (no recomendar duplicados)
    const teamSlugs = new Set(
      team.map((s) => s.name.toLowerCase().replace(/\s+/g, "-")).filter(Boolean)
    );

    // Rol recomendado por el análisis: se calcula aquí directamente (sin depender
    // de statsAnalysis que se declara después) usando la misma lógica: score cada rol
    // contra el promedio de stats del equipo y tomar el de menor puntuación ponderada
    // (el más carente). Si no hay suficientes Pokémon con stats, queda en null.
    const slotsWithStats = team.filter((s) => s.stats !== null && s.stats !== undefined);
    let neededRole: { label: string; color: string } | null = null;
    if (slotsWithStats.length >= 3) {
      const STAT_KEYS: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];
      const count = slotsWithStats.length;
      const avgStats = {} as BaseStats;
      STAT_KEYS.forEach((key) => {
        avgStats[key] = Math.round(
          slotsWithStats.reduce((sum, s) => sum + (s.stats![key] ?? 0), 0) / count
        );
      });
      const existingRoleCounts: Record<string, number> = {};
      slotsWithStats.forEach((s) => {
        const r = getEffectiveRole(s, lang);
        if (r) existingRoleCounts[r.label] = (existingRoleCounts[r.label] ?? 0) + 1;
      });
      const best = scoreAllRoles(avgStats)
        .map(({ role, score }) => ({
          role,
          adjustedScore: score + (existingRoleCounts[role[lang]] ?? 0) * 25,
        }))
        .sort((a, b) => a.adjustedScore - b.adjustedScore)[0];
      if (best) neededRole = { label: best.role[lang], color: best.role.color };
    }

    // Rango de IDs para el filtro de generación
    const genRange = recFilterGen !== null
      ? GEN_RANGES.find((g) => g.gen === recFilterGen) ?? null
      : null;

    // Mapa slug (inglés) → nombre en español, para que el filtro de habilidad
    // funcione escribiendo en español aunque los datos de la dex estándar
    // solo traigan el slug en inglés (ej. "clorofila" → "chlorophyll").
    const abilityEsNameBySlug = new Map<string, string>();
    abilitiesStandardData.forEach((a) => abilityEsNameBySlug.set(a.slug, a.nameEs));

    // Score todos los candidatos, aplicando filtros previos al scoring para eficiencia.
    // El rol real de cada candidato se calcula una sola vez aquí (reutilizando el
    // mismo getRole que usa el equipo) para no duplicar el cálculo entre el filtro
    // suavizado de rol y el bonus de puntuación.
    const withRealRole = activeCandidates.map((c) => ({
      candidate: c,
      realRole: c.stats ? getRole(c.stats, lang) : null,
      // Precalculamos el match del filtro manual (si hay) para reutilizarlo en
      // el bonus sin llamar a scoreAllRoles dos veces.
      roleMatch: (c.stats && recFilterRoleManual)
        ? matchesRole(c.stats, recFilterRoleManual)
        : (c.stats && recFilterMatchRole && neededRole)
          ? matchesRole(c.stats, neededRole.label)
          : null,
    }));

    const scored = withRealRole
      .filter(({ candidate: c, roleMatch }) => {
        // Excluir los del equipo
        if (teamSlugs.has(c.slug)) return false;
        // Excluir descartados manualmente
        if (recDiscarded.has(c.slug)) return false;
        // Filtro de generación por rango de ID
        {
          const genCheckId = c.dexId ?? c.id;
          if (genRange && (genCheckId < genRange.min || genCheckId > genRange.max)) return false;
        }
        // Filtro de tipos: soporte para tipo único o combinación de dos tipos
        // Si hay segundo tipo seleccionado, el candidato debe tener AMBOS tipos (en cualquier orden)
        if (recFilterType2 && recFilterTypes.length > 0) {
          const type1 = recFilterTypes[0];
          const type2 = recFilterType2;
          const hasType1 = c.types.includes(type1);
          const hasType2 = c.types.includes(type2);
          if (!hasType1 || !hasType2) return false;
        } else if (recFilterTypes.length > 0) {
          // Solo un tipo seleccionado: comportamiento original
          const hasType = c.types.some((ty) => recFilterTypes.includes(ty));
          if (!hasType) return false;
        }
        // Filtro por habilidad: texto libre, busca coincidencia parcial tanto
        // en las habilidades normales como en la oculta (sin distinguir
        // mayúsculas/acentos). En modo Z, los nombres ya vienen en español
        // (ej. "Adaptable"); en modo estándar vienen como slug de PokéAPI
        // (ej. "chlorophyll"), así que se compara también contra su versión
        // formateada para que "clorofila" no falle si el usuario escribe en
        // español sobre datos en inglés.
        if (recFilterAbility.trim().length > 0) {
          const q = normalizeApostrophe(recFilterAbility.trim().toLowerCase());
          const candidateAbilityNames = [...(c.abilities ?? []), c.hiddenAbility ?? ""].filter(Boolean);
          const hasMatch = candidateAbilityNames.some((ab) => {
            const raw = ab.toLowerCase();
            const display = formatForDisplay(ab).toLowerCase();
            const esName = abilityEsNameBySlug.get(ab)?.toLowerCase() ?? "";
            return raw.includes(q) || display.includes(q) || (esName.length > 0 && esName.includes(q));
          });
          if (!hasMatch) return false;
        }
        // Filtro por movimiento (solo Pokémon Z): el candidato debe poder
        // aprender TODOS los movimientos seleccionados (AND), no solo uno.
        if (recFilterMoves.length > 0) {
          const learnable = c.learnableMoveNames;
          if (!learnable || !recFilterMoves.every((mv) => learnable.includes(mv))) return false;
        }
        // Filtro: solo últimas evoluciones
        if (recFilterFinalEvo && !c.isFinalEvo) return false;
        // Filtro: ocultar legendarios
        if (!recFilterLegendary && isLegendary(c)) return false;
        // Filtro: solo originales de Pokémon Z. Las Megas/Gigamax (rangos
        // curados 90009-90025 y 91000-91118) también deben pasar este
        // chequeo, pero con dos matices adicionales sobre la comparación
        // simple de especie base:
        //  1) Entei, Volcarona, Florges y Grimmsnarl (Z_MEGA_ONLY_SPECIES)
        //     tienen su entrada BASE 1:1 igual a la oficial (por eso no
        //     están en POKEMON_Z_ORIGINALS), pero su MEGA sí es contenido
        //     exclusivo de Pokémon Z — así que su Mega cuenta como original
        //     aunque la base no lo sea.
        //  2) Mega Chesnaught, Mega Delphox y Mega Greninja son al revés:
        //     su especie base SÍ es original de Z (están en
        //     POKEMON_Z_ORIGINALS por sus stats/habilidad alterados), pero
        //     esas 3 Megas puntuales son réplicas de la Mega oficial de
        //     PokéAPI (no contenido exclusivo), así que no deben contar
        //     como originales aunque su base sí lo sea.
        // El switch "Mostrar Megas"/"Mostrar Gigamax" de más abajo sigue
        // controlando aparte si se muestran o no las Megas/Gigamax en general.
        if (recFilterOnlyOriginals) {
          const isCuratedMega = activePokedex === "pokemon-z" && c.formLabel === "Mega" && c.id >= 90000;
          const rawName = normalizeApostrophe(c.name);
          const baseSpeciesName = stripZFormPrefixSuffix(rawName);
          const baseKey = baseSpeciesName.toLowerCase();
          // Para Chesnaught/Delphox/Greninja el JSON trae DOS Megas por
          // especie con el mismo nombre base: la exclusiva del hackrom
          // lleva el sufijo " Z" ("Mega Chesnaught Z", id 91021) y la
          // réplica de la oficial no lo lleva ("Mega Chesnaught", id
          // 91022). Sin distinguir por ese sufijo, ambas quedaban marcadas
          // como duplicado oficial por igual (mismo baseKey "chesnaught"
          // tras sacarle el sufijo), así que el filtro las excluía a las
          // dos en vez de solo a la réplica.
          const hasZSuffix = /\s+Z$/.test(rawName);
          const isOfficialDuplicateMega =
            isCuratedMega && Z_MEGA_OFFICIAL_DUPLICATE_SPECIES.has(baseKey) && !hasZSuffix;
          const isExclusiveMegaOnlySpecies = isCuratedMega && Z_MEGA_ONLY_SPECIES.has(baseKey);
          const isOriginal =
            (POKEMON_Z_ORIGINALS.has(baseSpeciesName) && !isOfficialDuplicateMega) || isExclusiveMegaOnlySpecies;
          if (!isOriginal) return false;
        }
        // Filtro: excluir entradas de datos inválidas conocidas. Ditto no
        // puede Megaevolucionar (su gimmick es Transform, incompatible con
        // Mega Evolución), así que si el JSON curado trae por error una
        // "Mega Ditto" nunca debe aparecer como candidato, sin importar el
        // switch "Mostrar Megas".
        if (activePokedex === "pokemon-z" && c.formLabel === "Mega" && c.id >= 90000) {
          const baseKey = stripZFormPrefixSuffix(normalizeApostrophe(c.name)).toLowerCase();
          if (baseKey === "ditto") return false;
        }
        // Filtro: Megas (dex normal, PokéAPI). Se detecta por el slug oficial
        // (ej. "venusaur-mega", "charizard-mega-x") — EXCLUDED_FORM_PATTERN ya
        // no las saca del fetch, así que sin este filtro seguirían apareciendo
        // siempre; acá se controla con el switch.
        if (activePokedex !== "pokemon-z" && !recFilterShowMega && /-mega(-[xy])?\b/i.test(c.slug)) return false;
        // Filtro: Gigamax (dex normal, PokéAPI). Se detecta por el slug
        // oficial (ej. "venusaur-gmax") — igual mecánica que el de Megas.
        if (activePokedex !== "pokemon-z" && !recFilterShowGmax && /-gmax\b/i.test(c.slug)) return false;
        // Filtro: Megas y Gigamax (dex Pokémon Z). Se usa el campo formLabel
        // del JSON, que es el más confiable para esto — no se puede usar un
        // substring del nombre (ej. "Meganium"/"Yanmega" contienen "mega"
        // sin ser Megaevoluciones). Los rangos viejos 90001-90008 y
        // 90059-90078 ya no existen en el JSON (migrados a 91000-91118), así
        // que se sacó el chequeo hardcodeado por esos IDs.
        if (activePokedex === "pokemon-z") {
          // OJO: el JSON usa formLabel "Mega" tanto para las Megas reales
          // como (por error/diseño) para la entrada BASE de 26 especies que
          // tienen mega en el juego (ej. Gyarados id 130, Charizard id 6,
          // Lucario id 448...). Por eso NO alcanza con formLabel === "Mega":
          // hay que exigir también que sea una entrada de la zona fakedex
          // (id >= 90000), o species base como Gyarados quedan atrapadas
          // por el switch igual que las Megas de verdad.
          const isZMega = c.formLabel === "Mega" && c.id >= 90000;
          if (!recFilterZShowMega && isZMega) return false;
          if (!recFilterZShowGmax && c.formLabel === "Gmax") return false;
        }
        // Filtro de rol suavizado (Opción D):
        // manual tiene prioridad sobre el toggle automático.
        // Se usa matchesRole en vez de comparación exacta → pasan también Pokémon
        // cuyo rol seleccionado está cerca del top (margen) o supera un mínimo absoluto.
        if (recFilterRoleManual || recFilterMatchRole) {
          if (!c.stats) return false;          // sin stats no podemos evaluar
          if (!roleMatch) return false;         // no se pudo calcular (neededRole null)
          if (!roleMatch.passes) return false;
        }
        // Filtro: mínimos por stat. Solo se evalúan las stats con valor
        // (vacío = no se filtra). Es un AND entre todas las que tengan valor.
        // La stat activa en "ordenar por stat más alta" queda deshabilitada
        // en la UI, así que en la práctica nunca coincide con recFilterSortStat.
        {
          const minEntries = (Object.keys(recFilterMinStats) as (keyof BaseStats)[])
            .filter((k) => recFilterMinStats[k].trim() !== "");
          if (minEntries.length > 0) {
            if (!c.stats) return false;
            for (const k of minEntries) {
              const min = parseInt(recFilterMinStats[k], 10);
              if (!Number.isNaN(min) && c.stats[k] < min) return false;
            }
          }
        }
        return true;
      })
      .map(({ candidate, realRole, roleMatch }) => {
        const result = scorePokemonCandidate(team, candidate.types as string[], typeRelations);
        // Bonus de priorización hacia el rol que el equipo necesita.
        // Graduado según qué tan bien encaja el candidato en el rol:
        //   exact   → rol #1 del Pokémon coincide con el buscado  → bonus máximo
        //   margin  → rol muy cercano al top (≤15 pts)            → bonus alto
        //   minimum → supera el mínimo absoluto (≥28 pts)         → bonus moderado
        //   partial → cumple mínimos absolutos pero alguna stat núcleo
        //             queda fuera de su propio top-3 (ej. Xerneas)  → bonus mínimo
        //   sin stats → proxy por tipo (igual que antes)          → bonus bajo
        const roleEnLabel = neededRole
          ? ROLES.find((r) => r.es === neededRole!.label || r.en === neededRole!.label)?.en ?? neededRole!.label
          : null;
        let roleBonus = 0;
        if (neededRole) {
          const matchForBonus = roleMatch ?? (candidate.stats ? matchesRole(candidate.stats, neededRole.label) : null);
          if (matchForBonus) {
            if      (matchForBonus.reason === "exact"  ) roleBonus = 80;
            else if (matchForBonus.reason === "margin" ) roleBonus = 55;
            else if (matchForBonus.reason === "minimum") roleBonus = 30;
            else if (matchForBonus.reason === "partial") roleBonus = 5;
          } else if (!candidate.stats && roleEnLabel && typeMatchesRole(candidate.types as string[], roleEnLabel)) {
            roleBonus = 20;
          }
        }

        // Bonus por stats totales (BST): un Pokémon con stats brutas muy altas
        // (típicamente legendarios) puede "no encajar perfecto" en un rol
        // específico (ver matchesRole/"partial" más arriba, ej. Xerneas) pero
        // sigue siendo objetivamente más poderoso. Antes esto no se consideraba
        // en absoluto — solo importaba qué tan "puro" era el encaje de rol, no
        // cuán altas eran las stats en sí. Escala 0–80 sobre un rango de BST
        // típico (300 débil, 720 legendario tope) para que sea comparable en
        // magnitud al roleBonus, pero con más peso en la cascada final.
        const bst = candidate.stats
          ? Object.values(candidate.stats).reduce((sum: number, v: number) => sum + v, 0)
          : 0;
        const bstBonus = Math.max(0, Math.min(80, ((bst - 300) / (720 - 300)) * 80));

        // Antes: bstBonus*1000 + roleBonus*100 hacía que las stats totales
        // dominaran CASI SIEMPRE (una diferencia de 1 punto de bstBonus vale
        // lo mismo que 10 puntos de roleBonus), dejando al rol casi sin
        // influencia real — los legendarios (BST alto) terminaban saliendo
        // sí o sí, sin importar qué tan bien encajaran en el rol que el
        // equipo necesita. Ahora se combinan en un solo término ponderado
        // (70% stats / 30% rol, mismo rango 0–80 cada uno) para que ambos
        // factores realmente compitan entre sí, en vez de que uno aplaste
        // al otro por diferencia de escala. Ajustado tras feedback a 70% rol
        // / 30% stats: el encaje de rol pesa más, pero el poder bruto
        // sigue teniendo influencia real (antes tenía cero peso).
        //   priority1 (arreglar debilidades graves)      > todo lo demás
        //   priority2 (no crear debilidades críticas)    > todo lo siguiente
        //   powerRoleBonus (30% stats totales + 70% rol)  > resto
        //   priority3 (resistencias nuevas)               > priority4
        //   priority4 (equilibrio general)
        const powerRoleBonus = bstBonus * 0.3 + roleBonus * 0.7;
        const finalScore = recFilterPrioritizeCoverage
          ? result.priority1 * 100000 + result.priority2 * 10000 + powerRoleBonus * 100 + result.priority3 * 10 + result.priority4
          : powerRoleBonus * 100 + result.priority3 * 10 + result.priority4; // sin sesgo: ordena por poder bruto + rol + resistencias + equilibrio
        return { candidate, ...result, score: finalScore, realRole };
      })
      .sort((a, b) => {
        // Filtro "ordenar por stat más alta": si está activo, el orden se
        // basa directamente en esa stat (mayor a menor) en vez del score de
        // recomendación normal. Los candidatos sin stats (no debería pasar
        // en la práctica) quedan al final.
        if (recFilterSortStat) {
          const av = a.candidate.stats ? a.candidate.stats[recFilterSortStat] : -1;
          const bv = b.candidate.stats ? b.candidate.stats[recFilterSortStat] : -1;
          if (av !== bv) return bv - av;
        }
        return b.score - a.score;
      });

    // Filtro de duplicados de tipo: si está activado, no permitir dos Pokémon
    // con exactamente la misma combinación de tipos (ordenada)
    const seenTypeCombos = new Map<string, number>();
    // NOTA: antes, con el switch apagado, igual se aplicaba un tope oculto de
    // "máximo 2 por combo" como red de seguridad. Eso bloqueaba candidatos
    // (ej. Xerneas, Hada puro) que compartían combo con 4+ Pokémon mejor
    // puntuados (Florges, Aromatisse, Slurpuff, Sylveon) — nunca aparecían
    // ni descartando todo, porque el tope los cortaba en este paso, antes
    // de llegar al recorte final. Ahora, sin el switch, no hay tope alguno:
    // el único filtro es el que el usuario pide explícitamente activando
    // "Evitar tipos repetidos", y el mecanismo de "ir descartando para que
    // aparezca el siguiente mejor" queda como el único control del usuario.
    const deduplicated = recFilterNoDupTypes
      ? scored.filter(({ candidate }) => {
          const key = [...candidate.types].sort().join("/");
          const count = seenTypeCombos.get(key) ?? 0;
          if (count >= 1) return false; // solo 1 por combo exacto
          seenTypeCombos.set(key, count + 1);
          return true;
        })
      : scored;

    // Máximo 6 recomendaciones visibles — descartando las mostradas, el
    // siguiente mejor de la lista completa (ya sin tope oculto por combo)
    // ocupa el lugar automáticamente.
    const top = deduplicated.slice(0, 6);

    // Construye las explicaciones de cada recomendación
    const result = top.map(({ candidate, score, reduces, immunities, newResistances, criticalAdds, addsWeakness, realRole }) => {
      // En modo Z el slug ya viene del nombre en español; formatForDisplay lo capitaliza bien.
      // En modo estándar es el slug de PokéAPI (guiones → espacios con mayúsculas).
      const name = formatForDisplay(candidate.slug);
      const reasons: Array<{ positive: boolean; weakType: string; isImmune?: boolean }> = [];

      // Positivo: inmunidades primero, luego reducciones de debilidad,
      // cada bloque ordenado por separado por cuántos Pokémon del equipo ya
      // eran débiles a ese tipo (un sort global sobre ambos bloques juntos
      // los intercalaría cuando una inmunidad tiene menos peso que una
      // reducción, rompiendo el agrupamiento visual en la tarjeta —
      // ej. "Cubre fuego" / "Inmune tierra" / "Cubre roca" en vez de un
      // solo grupo "Cubre fuego, roca").
      const immunitiesSorted = [...immunities].sort(
        (a, b) => (teamWeaknesses[b] ?? 0) - (teamWeaknesses[a] ?? 0)
      );
      const reducesSorted = reduces
        .filter((t) => !immunities.includes(t))
        .sort((a, b) => (teamWeaknesses[b] ?? 0) - (teamWeaknesses[a] ?? 0));
      [...immunitiesSorted, ...reducesSorted]
        .slice(0, 3)
        .forEach((t) => reasons.push({ positive: true, weakType: t, isImmune: immunities.includes(t) }));

      // Negativo: solo avisar de debilidades críticas nuevas (la prioridad 2
      // del algoritmo es justamente evitarlas)
      criticalAdds.slice(0, 1).forEach((t) => reasons.push({ positive: false, weakType: t }));

      const noNewCritical = criticalAdds.length === 0;
      const addsResistances = newResistances.length > 0;

      // ¿El rol REAL del candidato coincide con el rol que el equipo necesita?
      // Se usa solo para resaltar visualmente la tarjeta — nunca para sustituir
      // la etiqueta de rol real que se muestra siempre.
      const candidateFitsRole = neededRole && realRole
        ? realRole.label === neededRole.label
        : null; // null = no se puede determinar (sin stats del candidato)

      return {
        candidate,
        name,
        score,
        reasons,
        noNewCritical,
        addsResistances,
        newResistancesCount: newResistances.length,
        hasMinorWeakness: addsWeakness.length > 0,
        immunities,
        newResistances,
        reduces,
        neededRole, // Rol que el equipo necesita (calculado por el análisis del equipo)
        realRole, // Rol REAL del candidato (mismo sistema de roles, basado en sus stats)
        candidateFitsRole, // true/false/null: si el rol real coincide con el necesitado
      };
    });
    return result;
  }, [team, analysis, typeRelations, activeCandidates, lang, recDiscarded, recFilterTypes, recFilterType2, recFilterAbility, recFilterGen, recFilterFinalEvo, recFilterLegendary, recFilterOnlyOriginals, recFilterNoDupTypes, recFilterMatchRole, recFilterPrioritizeCoverage, recFilterRoleManual, activePokedex, recFilterShowMega, recFilterShowGmax, recFilterZShowMega, recFilterZShowGmax, recFilterSortStat, recFilterMinStats, recFilterMoves, abilitiesStandardData]);

  // Priorizar la carga de sprites de los candidatos visibles actualmente
  useEffect(() => {
    if (activePokedex !== "pokemon-z" || pokemonZData.length === 0) return;
    let cancelled = false;
    const priorityEntries = pokemonRecommendations.map(({ candidate }: any) => candidate);
    if (priorityEntries.length === 0) return;
    Promise.all(priorityEntries.map(async (c: any) => {
      const key = String(c.id);
      if (zSpritesCache[key]) return;
      const url = getZSpriteUrl(c);
      const cropped = await cropFirstFrame(url);
      if (!cancelled) setZSpritesCache((prev) => ({ ...prev, [key]: cropped }));
    }));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePokedex, pokemonRecommendations]);

  // Stats balance analysis with role-based suggestions
  const statsAnalysis = useMemo(() => {
    const STAT_KEYS: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];
    const slotsWithStats = team.filter((s) => s.stats !== null && s.stats !== undefined);
    if (slotsWithStats.length < 3) return null;

    const count = slotsWithStats.length;
    const averages = {} as BaseStats;
    STAT_KEYS.forEach((key) => {
      const total = slotsWithStats.reduce((sum, s) => sum + (s.stats![key] ?? 0), 0);
      averages[key] = Math.round(total / count);
    });

    // More realistic thresholds for competitive Pokémon
    // ALTO ≥ 90, MEDIO 75–89, BAJO < 75
    const level = (v: number): "alto" | "medio" | "bajo" =>
      v >= 90 ? "alto" : v >= 75 ? "medio" : "bajo";

    const levels = {} as Record<keyof BaseStats, "alto" | "medio" | "bajo">;
    STAT_KEYS.forEach((k) => { levels[k] = level(averages[k]); });

    const STAT_NAMES = STAT_NAMES_I18N[lang];

    // Sort stats by average ascending to find the weakest
    const statsByAvg = [...STAT_KEYS].sort((a, b) => averages[a] - averages[b]);

    // Gap score: how far below the team's best stat each stat is
    const teamMax = Math.max(...STAT_KEYS.map((k) => averages[k]));
    const gaps = {} as Record<keyof BaseStats, number>;
    STAT_KEYS.forEach((k) => { gaps[k] = teamMax - averages[k]; });

    // Pre-compute which roles the team already has and how many
    const existingRoleCounts: Record<string, number> = {};
    slotsWithStats.forEach((s) => {
      const r = getEffectiveRole(s, lang);
      if (!r) return;
      existingRoleCounts[r.label] = (existingRoleCounts[r.label] ?? 0) + 1;
    });

    // Build role suggestions: score each ROLE against team average stats
    // Prefer roles the team lacks most.
    // Se excluye BALANCED_ROLE ("Todoterreno Puro") de esta sugerencia: su
    // score depende de qué tan PAREJO está el promedio de stats del equipo
    // (ver getBalanceScore), y cualquier equipo real con Pokémon especializados
    // va a tener un promedio con bastante dispersión — por eso este rol casi
    // siempre queda con el score más bajo y "gana" como sugerencia, aunque en
    // la práctica solo un puñado de legendarios (Mew, Arceus) lo cumplen. No
    // tiene sentido recomendarle al usuario que consiga uno de esos como
    // "el rol que le falta al equipo". Sigue detectándose normalmente para
    // Pokémon individuales vía getRole (ej. si ya tienes un Mew en el equipo).
    const avgStats: BaseStats = averages;
    const allRoleScores = scoreAllRoles(avgStats).filter((r) => r.role.es !== BALANCED_ROLE.es);

    // Sort by score ascending (weakest roles in the team avg = most needed)
    // But penalize roles already heavily covered
    const suggestions = allRoleScores
      .map(({ role, score }) => {
        const existingCount = existingRoleCounts[role[lang]] ?? 0;
        // Penalize roles the team already has plenty of: since lower score = "more needed",
        // we must ADD points (push it away from the minimum), not subtract.
        const adjustedScore = score + existingCount * 25;
        // Find which stats are weakest for this role
        const statEntries = Object.entries(role.weights) as [keyof BaseStats, number][];
        const [statA, statB] = statEntries
          .sort(([, a], [, b]) => b - a)
          .map(([k]) => k);
        return { role: { label: role[lang], color: role.color }, statA, statB: statB ?? statA, existingCount, score: adjustedScore };
      })
      .sort((a, b) => a.score - b.score); // lowest score = most needed

    const seen = new Set<string>();
    const topSuggestions = suggestions
      .filter((s) => { if (seen.has(s.role.label)) return false; seen.add(s.role.label); return true; })
      .slice(0, 2);

    // Role redundancy: flag any role with 3+ Pokémon
    const roleCounts: Record<string, { role: { label: string; color: string }; count: number; pokemon: string[] }> = {};
    slotsWithStats.forEach((s) => {
      if (!s.name) return;
      const r = getEffectiveRole(s, lang);
      if (!r) return;
      if (!roleCounts[r.label]) roleCounts[r.label] = { role: r, count: 0, pokemon: [] };
      roleCounts[r.label].count++;
      roleCounts[r.label].pokemon.push(s.isFake ? `${s.name} ★` : s.name);
    });
    const redundantRoles = Object.values(roleCounts).filter((r) => r.count >= 3);

    // allBalanced: no stat is BAJO AND no big gap (>25 pts from max) AND no redundancy
    const hasLow = STAT_KEYS.some((k) => levels[k] === "bajo");
    const hasBigGap = STAT_KEYS.some((k) => gaps[k] > 25);
    const allBalanced = !hasLow && !hasBigGap && redundantRoles.length === 0;

    return { averages, levels, gaps, STAT_KEYS, STAT_NAMES, count, topSuggestions, allBalanced, redundantRoles };
  }, [team, lang]);

  // Roles summary — includes Fakemon with stats
  const rolesSummary = useMemo(() => {
    const counts: Record<string, { label: string; color: string; count: number; pokemon: string[] }> = {};
    team.forEach((slot) => {
      if (!slot.name) return;
      if (!slot.stats) return;
      const role = getEffectiveRole(slot, lang);
      if (!role) return;
      if (!counts[role.label]) counts[role.label] = { ...role, count: 0, pokemon: [] };
      counts[role.label].count++;
      counts[role.label].pokemon.push(slot.isFake ? `${slot.name} ★` : slot.name);
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [team, lang]);

  // Dashboard: all team-level metrics in one place
  const dashboard = useMemo(() => {
    const total = Object.keys(typeRelations).length;
    const filledSlots = team.filter((s) => s.types.filter(Boolean).length > 0);
    if (!filledSlots.length || !total) return null;

    // Offensive coverage %
    const offPct = total > 0 ? Math.round((coverage.supCount / total) * 100) : 0;

    // Defensive breakdown: for each type, how many Pokémon are weak / resist / immune
    const defWeakCount = Object.values(analysis.weaknesses).filter((v) => v > 0).length;
    const defResistCount = Object.values(analysis.strengths).filter((v) => v > 0).length;
    const defTotal = total;
    const defPct = defTotal > 0 ? Math.round((defResistCount / defTotal) * 100) : 0;

    // Phys vs Special balance (based on move categories)
    let physMoves = 0, specMoves = 0;
    team.forEach((s) => s.moves.forEach((m) => {
      if (!m.name) return;
      if (m.category === "Physical") physMoves++;
      if (m.category === "Special") specMoves++;
    }));
    const totalMoves = physMoves + specMoves;
    const physPct = totalMoves > 0 ? Math.round((physMoves / totalMoves) * 100) : 50;
    const specPct = totalMoves > 0 ? 100 - physPct : 50;

    // Average speed + BST
    const slotsWithStats = team.filter((s) => s.stats);
    const avgSpe = slotsWithStats.length
      ? Math.round(slotsWithStats.reduce((a, s) => a + s.stats!.SPE, 0) / slotsWithStats.length) : 0;
    const avgBST = slotsWithStats.length
      ? Math.round(slotsWithStats.reduce((a, s) => {
          const st = s.stats!;
          return a + st.HP + st.ATK + st.DEF + st["SP.ATK"] + st["SP.DEF"] + st.SPE;
        }, 0) / slotsWithStats.length) : 0;

    // Speed tier label for team
    const speedTier = getSpeedTier(avgSpe, lang);

    // Role distribution
    const roleDist = rolesSummary;

    return { offPct, defPct, defWeakCount, defResistCount, physPct, specPct, avgSpe, avgBST, speedTier, roleDist, filledCount: filledSlots.length };
  }, [team, typeRelations, coverage, analysis, rolesSummary, lang]);

  // Per-type breakdown: which Pokémon are weak/resist/immune to each type
  const typeDetail = useMemo(() => {
    const result: Record<string, { weak: { name: string; sprite?: string | null; mult: number }[]; resist: { name: string; sprite?: string | null; mult: number }[]; immune: { name: string; sprite?: string | null }[] }> = {};
    Object.keys(typeRelations).forEach((atk) => {
      const rel = typeRelations[atk];
      if (!rel) return;
      const doubleTo = new Set(rel.double_damage_to.map((t: any) => t.name));
      const halfTo   = new Set(rel.half_damage_to.map((t: any) => t.name));
      const noTo     = new Set(rel.no_damage_to.map((t: any) => t.name));
      const weak: { name: string; sprite?: string | null; mult: number }[] = [];
      const resist: { name: string; sprite?: string | null; mult: number }[] = [];
      const immune: { name: string; sprite?: string | null }[] = [];
      team.forEach((poke) => {
        const types = poke.types.filter(Boolean);
        if (!types.length || !poke.name) return;
        let mult = 1;
        types.forEach((def) => {
          if (noTo.has(def)) mult *= 0;
          else if (doubleTo.has(def)) mult *= 2;
          else if (halfTo.has(def)) mult *= 0.5;
        });
        if (mult === 0) immune.push({ name: poke.name, sprite: poke.sprite });
        else if (mult >= 2) weak.push({ name: poke.name, sprite: poke.sprite, mult });
        else if (mult <= 0.5) resist.push({ name: poke.name, sprite: poke.sprite, mult });
      });
      result[atk] = { weak, resist, immune };
    });
    return result;
  }, [team, typeRelations]);

  // Team summary: combine type gaps + stat role gaps → suggest a Pokémon type + role
  const teamSummary = useMemo(() => {
    if (!Object.keys(typeRelations).length) return null;
    const hasTeam = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!hasTeam) return null;

    // 1. Collect defensive needs: types the team is weak to (≥2 Pokémon)
    const defensiveNeeds = Object.entries(analysis.weaknesses)
      .filter(([_, c]) => c >= 2)
      .sort(([, a], [, b]) => b - a)
      .map(([t]) => t);

    // 2. Collect offensive gaps: types with 0 supereffective coverage
    const offensiveGaps = Object.entries(coverage.canHitSupereffective)
      .filter(([_, v]) => v === 0)
      .map(([t]) => t);

    // 3. Stat role needed (top suggestion from statsAnalysis)
    const neededRole = statsAnalysis?.topSuggestions?.[0] ?? null;

    if (defensiveNeeds.length === 0 && offensiveGaps.length === 0 && !neededRole) return null;

    // 4. Score each candidate type (and dual combos) by how many needs they address
    // Single types
    const candidateScores: Record<string, { score: number; defensiveCovers: string[]; offensiveCovers: string[] }> = {};

    allTypes.forEach((candidateType) => {
      const rel = typeRelations[candidateType];
      if (!rel) return;
      // Defensive: does this type RESIST the team's weak types?
      const resistedByCandidate = new Set([
        ...rel.half_damage_from?.map((x: any) => x.name) ?? [],
        ...rel.no_damage_from?.map((x: any) => x.name) ?? [],
      ]);
      const defensiveCovers = defensiveNeeds.filter((t) => resistedByCandidate.has(t));

      // Offensive: does this type hit the gaps super-effectively?
      const superEffTo = new Set(rel.double_damage_to?.map((x: any) => x.name) ?? []);
      const offensiveCovers = offensiveGaps.filter((t) => superEffTo.has(t));

      // Severidad: pesa cada debilidad resuelta según CUÁNTOS miembros del
      // equipo son débiles a ese tipo (analysis.weaknesses[t]), en vez de un
      // punto fijo por tipo. Así, resolver una debilidad que afecta a 4
      // miembros vale mucho más que una que solo afecta a 2 — mismo criterio
      // de severidad (before.weak) que usa scorePokemonCandidate en priority1,
      // para que este resumen y el ranking de candidatos no se contradigan.
      const defensiveWeight = defensiveCovers.reduce((sum, t) => sum + (analysis.weaknesses[t] ?? 0), 0);
      const score = defensiveWeight * 2 + offensiveCovers.length;
      if (score > 0) {
        candidateScores[candidateType] = { score, defensiveCovers, offensiveCovers };
      }
    });

    // Pick top 3 single types
    const topTypes = Object.entries(candidateScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 3)
      .map(([t, data]) => ({ type: t, ...data, isDouble: false }));

    // 5. Try top dual-type combos from top candidates
    const topCandidates = Object.entries(candidateScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 5)
      .map(([t]) => t);

    let bestDual: { types: string[]; score: number; defensiveCovers: string[]; offensiveCovers: string[] } | null = null;
    for (let i = 0; i < topCandidates.length; i++) {
      for (let j = i + 1; j < topCandidates.length; j++) {
        const t1 = topCandidates[i], t2 = topCandidates[j];
        const d1 = candidateScores[t1], d2 = candidateScores[t2];
        const combinedDef = [...new Set([...d1.defensiveCovers, ...d2.defensiveCovers])];
        const combinedOff = [...new Set([...d1.offensiveCovers, ...d2.offensiveCovers])];
        const combinedDefWeight = combinedDef.reduce((sum, t) => sum + (analysis.weaknesses[t] ?? 0), 0);
        const score = combinedDefWeight * 2 + combinedOff.length;
        if (!bestDual || score > bestDual.score) {
          bestDual = { types: [t1, t2], score, defensiveCovers: combinedDef, offensiveCovers: combinedOff };
        }
      }
    }

    return {
      topTypes,
      bestDual,
      neededRole,
      defensiveNeeds: defensiveNeeds.slice(0, 3),
      offensiveGaps: offensiveGaps.slice(0, 3),
    };
  }, [team, analysis, coverage, typeRelations, allTypes, statsAnalysis, lang]);

  // ─── Puntuación general del equipo (0-100) ──────────────────────────────────
  // Combina 4 pilares ya calculados en otras partes de la app (mismas fuentes
  // que alimentan el resto de la UI, para que el número sea consistente con
  // lo que el usuario ya ve en pantalla):
  //   1. Cobertura ofensiva  (coverage.supCount / nº de tipos)
  //   2. Solidez defensiva   (analysis.weaknesses / analysis.strengths)
  //   3. Balance de stats    (statsAnalysis: niveles + brechas)
  //   4. Diversidad de roles (rolesSummary: redundancia de roles)
  // Cada pilar puntúa 0-100. Si un pilar no tiene datos suficientes (p.ej.
  // menos de 3 Pokémon con stats) se omite del promedio final y su peso se
  // redistribuye entre los pilares restantes, para no penalizar equipos
  // incompletos con un número injustamente bajo.
  const teamScore = useMemo(() => {
    const totalTypes = Object.keys(typeRelations).length;
    const hasTeamWithTypes = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!totalTypes || !hasTeamWithTypes) return null;

    // No mostrar puntuación hasta que al menos 3 Pokémon del equipo tengan
    // los 4 movimientos cargados (evita puntuar equipos a medio armar).
    const slotsWithFullMoves = team.filter(
      (s) => s.moves.filter((m) => m.name && m.name.trim() !== "").length >= 4
    );
    if (slotsWithFullMoves.length < 3) return null;

    const pillars: { key: "offense" | "defense" | "stats" | "roles"; score: number; available: boolean }[] = [];

    // 1. Cobertura ofensiva: % de tipos que el equipo golpea superefectivamente
    const offenseScore = Math.round((coverage.supCount / totalTypes) * 100);
    pillars.push({ key: "offense", score: offenseScore, available: true });

    // 2. Solidez defensiva: penaliza debilidades compartidas por 2+ Pokémon,
    // más fuerte cuantos más Pokémon comparten esa debilidad; premia resistencias.
    let defenseScore = 100;
    Object.values(analysis.weaknesses).forEach((count) => {
      if (count >= 3) defenseScore -= 16;
      else if (count >= 2) defenseScore -= 8;
    });
    const resistBonus = Math.min(Object.keys(analysis.strengths).length * 2, 20);
    defenseScore = Math.max(0, Math.min(100, defenseScore + resistBonus));
    pillars.push({ key: "defense", score: defenseScore, available: true });

    // 3. Balance de stats: solo si hay suficientes Pokémon con stats (mismo
    // umbral que statsAnalysis, que ya exige 3+).
    if (statsAnalysis) {
      const STAT_KEYS = statsAnalysis.STAT_KEYS;
      let statsScore = 100;
      STAT_KEYS.forEach((k) => {
        const lv = statsAnalysis.levels[k];
        if (lv === "bajo") statsScore -= 12;
        else if (lv === "medio") statsScore -= 4;
        const gap = statsAnalysis.gaps[k];
        if (gap > 25) statsScore -= 6;
      });
      statsScore -= statsAnalysis.redundantRoles.length * 10;
      statsScore = Math.max(0, Math.min(100, statsScore));
      pillars.push({ key: "stats", score: statsScore, available: true });
    } else {
      pillars.push({ key: "stats", score: 0, available: false });
    }

    // 4. Diversidad de roles: más roles distintos = mejor; penaliza
    // concentración (muchos Pokémon en el mismo rol).
    if (rolesSummary.length > 0) {
      const totalWithRole = rolesSummary.reduce((sum, r) => sum + r.count, 0);
      const distinctRoles = rolesSummary.length;
      const maxShare = Math.max(...rolesSummary.map((r) => r.count)) / totalWithRole;
      // Bono por variedad (hasta 6 roles distintos = ideal para un equipo de 6)
      const varietyScore = Math.min((distinctRoles / Math.min(totalWithRole, 6)) * 100, 100);
      // Penalización por concentración: si todo el equipo comparte 1-2 roles, baja fuerte
      const concentrationPenalty = maxShare > 0.5 ? (maxShare - 0.5) * 100 : 0;
      const rolesScore = Math.max(0, Math.min(100, Math.round(varietyScore - concentrationPenalty)));
      pillars.push({ key: "roles", score: rolesScore, available: true });
    } else {
      pillars.push({ key: "roles", score: 0, available: false });
    }

    const availablePillars = pillars.filter((p) => p.available);
    if (!availablePillars.length) return null;

    const total = Math.round(
      availablePillars.reduce((sum, p) => sum + p.score, 0) / availablePillars.length
    );

    const grade =
      total >= 90 ? { label: t.teamScoreGradeS, color: "#10b981" } :
      total >= 75 ? { label: t.teamScoreGradeA, color: "#38bdf8" } :
      total >= 55 ? { label: t.teamScoreGradeB, color: "#facc15" } :
      total >= 35 ? { label: t.teamScoreGradeC, color: "#fb923c" } :
                     { label: t.teamScoreGradeD, color: "#f87171" };

    return {
      total,
      grade,
      offense: pillars.find((p) => p.key === "offense")!,
      defense: pillars.find((p) => p.key === "defense")!,
      stats: pillars.find((p) => p.key === "stats")!,
      roles: pillars.find((p) => p.key === "roles")!,
    };
  }, [team, typeRelations, coverage, analysis, statsAnalysis, rolesSummary, t]);

  const badgeClass = (t: string) => `type-badge type-${t.replace(/\s+/g, "-").toLowerCase()}`;

  // ─── Badge de rol reutilizable ──────────────────────────────────────────
  // Se usa en TODOS los lugares donde se muestra un rol (slot del equipo,
  // radar de aptitud, balance de stats, resumen del equipo, recomendaciones).
  // Al pasar el cursor muestra un tooltip con la descripción del rol (qué
  // stats lo definen, reutilizando getRoleDescription / ROLES). Opcionalmente
  // puede mostrar contenido extra debajo de la descripción (ej. una nota de
  // que el rol real no coincide con el recomendado) o la lista de Pokémon
  // del equipo que tienen ese rol.
  const RoleBadge = ({
    label,
    color,
    size = "text-[13px]",
    dimmed = false,
    extra,
    pokemonList,
    countBadge,
  }: {
    label: string;
    color: string | null | undefined;
    size?: string;
    dimmed?: boolean;
    extra?: React.ReactNode;
    pokemonList?: string[];
    countBadge?: number;
  }) => (
    <FloatingTooltip
      preferredPlacement="top"
      content={
        <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{label}</div>
          <div>{getRoleDescription(label, lang) ?? ""}</div>
          {pokemonList && pokemonList.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-slate-400">{pokemonList.join(", ")}</div>
          )}
          {extra}
        </div>
      }
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${size} font-semibold text-white cursor-default transition-opacity ${dimmed ? "opacity-40" : "opacity-100"}`}
        style={{ backgroundColor: (color ?? "#333") + "cc" }}
      >
        {label}
        {countBadge && countBadge > 1 && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[13px]">{countBadge}</span>
        )}
      </span>
    </FloatingTooltip>
  );

  const moveCategoryClass = (category: Move["category"]) => {
    if (category === "Physical") return "bg-[#7f1d1d]/90 text-slate-200 border border-slate-700/40";
    if (category === "Special") return "bg-[#1e3a5f]/90 text-slate-200 border border-slate-700/40";
    return "bg-[#374151]/90 text-slate-200 border border-slate-700/40";
  };

  /** Devuelve el style inline de fondo para una tarjeta de movimiento:
   *  color de tipo + patrón CSS sutil según categoría. */
  const moveBgStyle = (category: Move["category"], moveType: string | null | undefined): React.CSSProperties => {
    const base = TYPE_COLORS[moveType ?? ""] ?? "#334155";
    if (category === "Physical") {
      // Diagonal stripes — very subtle, low opacity, wide spacing
      return {
        background: `repeating-linear-gradient(
          -45deg,
          ${base}0d 0px,
          ${base}0d 1.5px,
          transparent 1.5px,
          transparent 14px
        )`,
        backgroundColor: base + "12",
      };
    }
    if (category === "Special") {
      // Dot grid — very faint, sparse
      return {
        backgroundImage: `radial-gradient(${base}18 1px, transparent 1px)`,
        backgroundSize: "12px 12px",
        backgroundColor: base + "0e",
      };
    }
    // Status — horizontal lines, barely visible
    return {
      background: `repeating-linear-gradient(
        180deg,
        ${base}0d 0px,
        ${base}0d 1px,
        transparent 1px,
        transparent 12px
      )`,
      backgroundColor: base + "0e",
    };
  };

  const moveCategoryDot = (category: Move["category"]) => {
    if (category === "Physical") return "⛏";
    if (category === "Special") return "✨";
    return "⚙️";
  };

  return (
    <div ref={rootRef} className="min-h-screen px-3 py-4 sm:p-6 bg-linear-to-b from-slate-900 via-[#041229] to-[#031022] text-slate-100">
      {/* Notificación flotante estilo la página (reemplaza los alert() del navegador) */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] max-w-xs rounded-lg border border-amber-500/40 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-xl shadow-black/40 animate-[fadeInUp_0.2s_ease-out]">
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-none">⚠️</span>
            <span className="text-sm text-slate-200 leading-snug">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-auto shrink-0 text-slate-500 hover:text-slate-300 text-xs leading-none"
            >✕</button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0); max-height: 200px; }
        }
        /* ── PokeRun custom scrollbars ── */
        :root {
          --sb-track: #0a1628;
          --sb-thumb: #1e3a5f;
          --sb-thumb-hover: #2563eb;
          --sb-size: 6px;
        }
        /* Webkit (Chrome, Safari, Edge) */
        ::-webkit-scrollbar { width: var(--sb-size); height: var(--sb-size); }
        ::-webkit-scrollbar-track { background: var(--sb-track); border-radius: 99px; }
        ::-webkit-scrollbar-thumb { background: var(--sb-thumb); border-radius: 99px; border: 1px solid var(--sb-track); }
        ::-webkit-scrollbar-thumb:hover { background: var(--sb-thumb-hover); }
        ::-webkit-scrollbar-corner { background: var(--sb-track); }
        /* Firefox */
        * { scrollbar-width: thin; scrollbar-color: var(--sb-thumb) var(--sb-track); }
        /* Touch drag for slot reorder */
        .touch-drag-handle { touch-action: none; }
        /* ── Switch custom "Fakemon" ── */
        .fm-switch {
          --fm-w: 40px;
          --fm-h: 22px;
          --fm-pad: 2px;
          position: relative;
          display: inline-flex;
          align-items: center;
          width: var(--fm-w);
          height: var(--fm-h);
          border-radius: 999px;
          border: 1px solid rgba(56, 189, 248, 0.25);
          background: linear-gradient(180deg, #0a1628 0%, #0d1f38 100%);
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
          flex-shrink: 0;
        }
        .fm-switch:hover { border-color: rgba(56, 189, 248, 0.45); }
        .fm-switch:focus-visible {
          outline: none;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(56, 189, 248, 0.5);
        }
        .fm-switch[data-on="true"] {
          background: linear-gradient(180deg, #0369a1 0%, #075985 100%);
          border-color: rgba(56, 189, 248, 0.6);
        }
        .fm-switch-thumb {
          position: absolute;
          top: var(--fm-pad);
          left: var(--fm-pad);
          width: calc(var(--fm-h) - 2 * var(--fm-pad));
          height: calc(var(--fm-h) - 2 * var(--fm-pad));
          border-radius: 50%;
          background: #cbd5e1;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .fm-switch[data-on="true"] .fm-switch-thumb {
          transform: translateX(calc(var(--fm-w) - var(--fm-h)));
          background: #f0f9ff;
        }
        .fm-switch-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        /* ── Checkbox custom (Fakemon / Movimiento inventado) ── */
        .pr-checkbox {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          flex-shrink: 0;
        }
        .pr-checkbox input {
          position: absolute;
          inset: 0;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }
        .pr-checkbox-box {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 5px;
          border: 1.5px solid #3b5578;
          background: #0a1628;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
        }
        .pr-checkbox-box::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 46%;
          width: 5px;
          height: 9px;
          border: solid #0a1628;
          border-width: 0 2px 2px 0;
          transform: translate(-50%, -50%) rotate(45deg) scale(0);
          transition: transform 0.12s ease;
        }
        .pr-checkbox input:checked ~ .pr-checkbox-box {
          background: #38bdf8;
          border-color: #38bdf8;
        }
        .pr-checkbox input:checked ~ .pr-checkbox-box::after {
          transform: translate(-50%, -50%) rotate(45deg) scale(1);
        }
        .pr-checkbox input:hover ~ .pr-checkbox-box {
          border-color: #60a5fa;
        }
        .pr-checkbox input:focus-visible ~ .pr-checkbox-box {
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(56, 189, 248, 0.5);
        }
        /* xs breakpoint (≥420px) */
        @media (min-width: 420px) {
          .xs\\:inline { display: inline !important; }
          .xs\\:hidden { display: none !important; }
          .xs\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
      <header className="mb-6 sm:mb-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Pokerun Builder"
              className="h-14 w-14 shrink-0 object-contain drop-shadow"
            />
            <span className="text-[11px] uppercase tracking-[0.25em] text-slate-500 font-medium">PokeRun Builder</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Pokedex selector — dropdown personalizado con opciones "gordas" */}
            <div className="relative" ref={pokedexDropdownRef}>
              <button
                type="button"
                onClick={() => setPokedexDropdownOpen((v) => !v)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activePokedex === "pokemon-z"
                    ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                    : "border-slate-700/60 bg-slate-900/70 text-slate-200"
                } hover:brightness-110`}
              >
                {activePokedex === "pokemon-z" ? (
                  <img
                    src="/pokemon-z-logo.webp"
                    alt="Pokémon Z"
                    className="h-6 w-6 shrink-0 object-contain drop-shadow"
                  />
                ) : (
                  <PokeballIcon className="h-5 w-5 shrink-0" />
                )}
                <span className="hidden xs:inline">
                  {POKEDEX_OPTIONS.find((p) => p.id === activePokedex)?.label}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${pokedexDropdownOpen ? "rotate-180" : ""}`}
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {pokedexDropdownOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 rounded-2xl border border-slate-700/70 bg-slate-950/98 p-2 shadow-2xl shadow-black/60 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePokedex("standard");
                      setPokedexDropdownOpen(false);
                      setRecFilterMoves([]);
                      setRecFilterAbility("");
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      activePokedex === "standard"
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-transparent hover:bg-slate-800/70"
                    }`}
                  >
                    <PokeballIcon className="h-9 w-9 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-100">Pokedex</span>
                      <span className="block text-[11px] text-slate-500 leading-snug">
                        {lang === "es" ? "Pokedex Nacional" : "National Pokedex"}
                      </span>
                    </span>
                    {activePokedex === "standard" && (
                      <span className="ml-auto shrink-0 text-blue-400">✓</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActivePokedex("pokemon-z");
                      setPokedexDropdownOpen(false);
                      setRecFilterMoves([]);
                      setRecFilterAbility("");
                    }}
                    className={`mt-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      activePokedex === "pokemon-z"
                        ? "border-yellow-500/50 bg-yellow-500/10"
                        : "border-transparent hover:bg-slate-800/70"
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                      <img
                        src="/pokemon-z-logo.webp"
                        alt="Pokémon Z"
                        className="h-full w-full object-contain drop-shadow"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-100">Pokémon Z</span>
                      <span className="block text-[11px] text-slate-500 leading-snug">
                        {pokemonZData.length > 0 && movesZData.length > 0
                          ? `${pokemonZData.length} Pokémon · ${movesZData.length} ${lang === "es" ? "movimientos" : "moves"}`
                          : pokemonZData.length > 0
                          ? lang === "es" ? "Cargando movimientos…" : "Loading moves…"
                          : lang === "es" ? "Pokémon Customizados" : "Custom Pokemon"}
                      </span>
                    </span>
                    {activePokedex === "pokemon-z" && (
                      <span className="ml-auto shrink-0 text-yellow-400">✓</span>
                    )}
                  </button>
                </div>
              )}
            </div>
            {/* Mode toggle: simple / advanced */}
            <FloatingTooltip
              preferredPlacement="bottom"
              content={
                <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-xl text-xs text-slate-300 leading-relaxed">
                  <p className="font-semibold text-slate-100 mb-1">{isAdvanced ? t.modeAdvanced : t.modeSimple}</p>
                  <p>{isAdvanced ? t.modeAdvancedDesc : t.modeSimpleDesc}</p>
                </div>
              }
            >
              <div className="flex items-center rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5 gap-0.5">
                {([
                  ["simple", "🌱"],
                  ["advanced", "🛠️"],
                ] as const).map(([mode, icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${viewMode === mode ? "bg-emerald-700 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {icon} <span className="hidden xs:inline">{mode === "simple" ? t.modeSimple : t.modeAdvanced}</span>
                  </button>
                ))}
              </div>
            </FloatingTooltip>
            {/* Language toggle */}
            <div className="flex items-center rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5 gap-0.5">
              {(["es", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${lang === l ? "bg-blue-700 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {l === "es" ? <FlagES /> : <FlagGB />}
                  {l === "es" ? "ES" : "EN"}
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <a
                href="https://github.com/nixixo"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub: nixixo"
                className="flex items-center justify-center h-7 w-7 rounded-full border border-slate-700/60 bg-slate-900/70 text-slate-400 transition hover:text-slate-100 hover:border-slate-500"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                </svg>
              </a>
              <a
                href="https://discord.com/users/436280183977279500"
                target="_blank"
                rel="noopener noreferrer"
                title="Discord: .nixixo"
                className="flex items-center justify-center h-7 w-7 rounded-full border border-slate-700/60 bg-slate-900/70 text-slate-400 transition hover:text-slate-100 hover:border-slate-500"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.26a18.27 18.27 0 0 0-5.48 0 12.6 12.6 0 0 0-.62-1.26.08.08 0 0 0-.08-.04c-1.7.29-3.36.8-4.89 1.52a.07.07 0 0 0-.03.03C.53 8.6-.32 12.7.1 16.76a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.28a.07.07 0 0 1 .08 0c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08 0c.12.1.24.19.37.28a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.11c.36.7.78 1.37 1.23 2a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6.01-3.03.08.08 0 0 0 .03-.06c.5-4.7-.83-8.76-3.5-12.36a.06.06 0 0 0-.03-.03ZM8.02 14.34c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Main hero block — compact */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-[#050f1f] to-[#03091a] px-4 py-3 sm:px-8 sm:py-4 shadow-xl shadow-black/40">
          {/* Decorative rings */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[3px] border-slate-700/20 opacity-40" />
          <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full border-[2px] border-blue-700/15 opacity-40" />
          <div className="pointer-events-none absolute -right-2 -top-2 h-32 w-32 rounded-full border border-blue-600/10 opacity-40" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 32px)" }} />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            {/* Fila 1 en mobile: título + botón Objetos. En sm:+ el wrapper
                desaparece (sm:contents) y el título pasa a ser el item
                izquierdo del header; el botón Objetos de esta fila se oculta
                y reaparece agrupado junto a las stats (ver más abajo). */}
            <div className="flex items-start justify-between gap-3 sm:contents">
              {/* Title + subtitle */}
              <div className="min-w-0 sm:flex-1">
                <div className="flex flex-wrap items-baseline gap-1.5 mb-0.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none">🎴 PokeRun</h1>
                  <span className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent leading-none">Builder</span>
                  <span className="text-base">✨</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 max-w-md leading-snug hidden sm:block">{t.appSubtitle}</p>
              </div>

              {/* Botón Objetos — versión mobile (1ra fila, junto al título) */}
              <button
                type="button"
                onClick={() => setItemsModalOpen(true)}
                className="flex sm:hidden items-center gap-1.5 rounded-xl border border-slate-700/40 bg-slate-900/60 px-3 py-1.5 shrink-0 text-slate-200 transition hover:border-amber-500/60 hover:text-amber-300"
              >
                <span className="text-sm">🎒</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                  {lang === "es" ? "Objetos" : "Items"}
                </span>
              </button>
            </div>

            {/* Team score — destacado, centro del hero */}
            {team.some((s) => s.name.trim() !== "") && (
              <div className="flex justify-center shrink-0 order-first sm:order-none sm:flex-1">
                {!teamScore ? (
                  <div className="flex flex-col items-center gap-1 cursor-default">
                    <div className="relative h-[88px] w-[88px] sm:h-[104px] sm:w-[104px] flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 absolute inset-0">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="9" />
                      </svg>
                      <span className="text-xl">🔒</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-[0.18em] text-slate-500 max-w-[110px] text-center leading-tight">
                      {lang === "es" ? "Se calcula con 3+ Pokémon" : "Unlocks with 3+ Pokémon"}
                    </span>
                  </div>
                ) : (
                <FloatingTooltip
                  preferredPlacement="bottom"
                  content={
                    <div className="w-80 rounded-2xl border border-slate-700 bg-slate-950/98 p-5 shadow-xl shadow-black/50 text-base text-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm uppercase tracking-[0.2em] text-slate-500">{t.teamScoreTitle}</div>
                        <div className="text-2xl font-extrabold tabular-nums" style={{ color: teamScore.grade.color }}>{teamScore.total}<span className="text-slate-500 text-sm font-medium">/100</span></div>
                      </div>
                      <div className="space-y-3.5">
                        {[
                          { key: "offense", label: t.teamScoreOffense, desc: t.teamScoreOffenseDesc, data: teamScore.offense, icon: "⚔️" },
                          { key: "defense", label: t.teamScoreDefense, desc: t.teamScoreDefenseDesc, data: teamScore.defense, icon: "🛡️" },
                          { key: "stats",   label: t.teamScoreStats,   desc: t.teamScoreStatsDesc,   data: teamScore.stats,   icon: "📈" },
                          { key: "roles",   label: t.teamScoreRoles,   desc: t.teamScoreRolesDesc,   data: teamScore.roles,   icon: "🧩" },
                        ].map(({ key, label, desc, data, icon }) => (
                          <div key={key} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-300 flex items-center gap-2">
                                <span className="text-sm">{icon}</span>{label}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-slate-300">
                                {data.available ? `${data.score}/100` : t.teamScoreNotEnoughData}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: data.available ? `${data.score}%` : "0%", backgroundColor: getStatColor(data.score * 2.55) }}
                              />
                            </div>
                            <p className="text-[13px] text-slate-500 leading-snug">{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  }
                >
                  <div className="flex flex-col items-center gap-1 cursor-default">
                    <div className="relative h-[88px] w-[88px] sm:h-[104px] sm:w-[104px]">
                      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="9" />
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          stroke={teamScore.grade.color}
                          strokeWidth="9"
                          strokeLinecap="round"
                          strokeDasharray={`${(teamScore.total / 100) * 263.9} 263.9`}
                          style={{ transition: "stroke-dasharray 0.6s ease-out", filter: `drop-shadow(0 0 6px ${teamScore.grade.color}66)` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none" style={{ color: teamScore.grade.color }}>{teamScore.total}</span>
                        <span className="text-[9px] text-slate-500 leading-none mt-0.5">/100</span>
                      </div>
                    </div>
                    <div
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: teamScore.grade.color, backgroundColor: `${teamScore.grade.color}18`, border: `1px solid ${teamScore.grade.color}40` }}
                    >
                      {teamScore.grade.label}
                    </div>
                    <span className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{t.teamScore}</span>
                  </div>
                </FloatingTooltip>
                )}
              </div>
            )}

            {/* Botón Objetos (versión desktop) + resumen Equipo/Tipos/Con
                stats, agrupados a la derecha del header. sm:flex-1 +
                sm:justify-end equilibra este bloque con el título (que
                también es sm:flex-1), dejando el team score realmente
                centrado entre ambos. */}
            <div className="flex flex-col sm:flex-row sm:flex-1 sm:items-end sm:justify-end gap-2 shrink-0">
              {/* Botón Objetos: abre el buscador de objetos (nombre/descripción
                  + filtro de originales Z). Oculto en mobile porque ahí se
                  muestra en la 1ra fila, junto al título. */}
              <button
                type="button"
                onClick={() => setItemsModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-700/40 bg-slate-900/60 px-3 py-1.5 shrink-0 text-slate-200 transition hover:border-amber-500/60 hover:text-amber-300"
              >
                <span className="text-sm">🎒</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                  {lang === "es" ? "Objetos" : "Items"}
                </span>
              </button>

              {/* Live team stats */}
              <div className="flex gap-2 shrink-0 overflow-x-auto pb-0.5 sm:pb-0 sm:flex-col sm:items-end">
                {(() => {
                  const filled = team.filter(s => s.name).length;
                  const typesInTeam = Array.from(new Set(team.flatMap(s => s.types.filter(Boolean))));
                  const withStats = team.filter(s => s.stats).length;
                  return ([
                    ["🏆", lang === "es" ? "Equipo" : "Team", `${filled}/6`],
                    ["🔷", lang === "es" ? "Tipos" : "Types", `${typesInTeam.length}`],
                    ["📊", lang === "es" ? "Con stats" : "With stats", `${withStats}`],
                  ] as [string, string, string][]).map(([icon, label, value]) => (
                    <div key={label} className="flex items-center gap-1.5 rounded-xl border border-slate-700/40 bg-slate-900/60 px-2.5 py-1.5 shrink-0 w-full sm:max-w-[160px] sm:justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm shrink-0">{icon}</span>
                        <span className="text-[9px] uppercase tracking-[0.18em] text-slate-500 leading-none">{label}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-200">{value}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Selector de Pokedex movido arriba, a la barra superior del header */}
      </header>
      {isMounted && (
      <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-4">
        <CollapsibleSection
          as="section"
          className={`pokedex-panel p-3 sm:p-4 rounded-lg h-full relative ${moveOpen.some((s) => s?.some(Boolean)) ? "z-40" : ""}`}
          headerClassName="mb-4"
          icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">📋</span>}
          title={t.myTeam}
          guide={!isAdvanced ? t.guideTeamSection : undefined}
          storageKey="my-team"
          headerExtra={
            <>
              <button
                type="button"
                onClick={() => setOnlyLearnableMoves((v) => !v)}
                title={t.onlyLearnableMovesTitle}
                aria-pressed={onlyLearnableMoves}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  onlyLearnableMoves
                    ? "bg-emerald-700/80 text-white hover:bg-emerald-600"
                    : "bg-slate-700/60 text-slate-300 hover:bg-slate-600/60"
                }`}
              >
                <span>{onlyLearnableMoves ? "✅" : "📖"}</span> <span>{t.onlyLearnableMoves}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPlantillas(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-700/80 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <span>💾</span> <span className="hidden xs:inline">{t.saveTemplates}</span><span className="xs:hidden">Plantillas</span> {savedTeams.length > 0 && <span className="inline-flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-white/20 text-xs">{savedTeams.length}</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleared = Array.from({ length: 6 }, EMPTY_SLOT);
                  setTeam(cleared);
                  setPokemonInputDraft(Array.from({ length: 6 }, () => null));
                  setPokemonSearch(Array.from({ length: 6 }, () => ""));
                  if (typeof window !== "undefined") {
                    localStorage.removeItem(STORAGE_KEY);
                  }
                }}
                className="inline-flex items-center justify-center rounded-full bg-red-600/90 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {t.clearTeam}
              </button>
              <div className="fm-switch-wrap rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 sm:px-3 py-1.5 sm:py-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-300 whitespace-nowrap">{t.fakemonModeLabel}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fakemonModeOn}
                  aria-label={t.fakemonModeLabel}
                  data-on={fakemonModeOn}
                  onClick={() => setFakemonModeOn((v) => !v)}
                  className="fm-switch"
                >
                  <span className="fm-switch-thumb" />
                </button>
              </div>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {team.map((slot, idx) => {
              const hasOpenMoveDropdown = moveOpen[idx]?.some(Boolean);
              return (
              <div
                key={idx}
                data-slot-idx={idx}
                ref={(el) => { teamCardRefs.current[idx] = el; }}
                className={`pokedex-card relative hover:z-20 ${hasOpenMoveDropdown ? "z-30" : ""} p-1.5 rounded-lg border-blue-800/30 hover:shadow-lg btn-interactive flex flex-col gap-1.5 transition-all ${dragOverIdx === idx && dragFromIdx !== idx ? "ring-2 ring-blue-400/70 bg-blue-950/30 scale-[1.02]" : ""} ${dragFromIdx === idx ? "opacity-30" : ""}`}
              >
                {/* Drag handle */}
                <div
                  onPointerDown={(e) => {
                    e.preventDefault();
                    startSlotDrag(idx, e.clientX, e.clientY, e.currentTarget);
                  }}
                  className="touch-drag-handle flex items-center justify-between text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing select-none py-0.5"
                  title="Arrastra para reordenar"
                  style={{ touchAction: "none" }}
                >
                  <span className="text-lg tracking-widest">⠿</span>
                  <span className="text-[11px] sm:text-[13px] uppercase tracking-widest opacity-50">{t.dragHandle}</span>
                </div>
                {/* Fila compacta: siempre visible, sprite chico + nombre. Click para expandir/colapsar. */}
                <button
                  type="button"
                  onClick={() => toggleSlotCollapsed(idx)}
                  className="flex items-center gap-2 w-full text-left rounded-md px-1 py-1 -mx-1 transition hover:bg-slate-800/40"
                >
                  <div className="w-9 h-9 bg-[#031421] rounded-md overflow-hidden flex items-center justify-center shrink-0">
                    <SpriteImg
                      src={slot.sprite && !failedSpriteUrls.has(slot.sprite) ? slot.sprite : null}
                      alt={slot.name}
                      className="w-8 h-8 object-contain"
                      style={buildSpriteStyle(slot.spriteTransform, Z_SLOT_SPRITE_ZOOM_OVERRIDES[slot.name])}
                      onError={() => markSpriteFailed(slot.sprite!)}
                      placeholderClassName="h-5 w-5 opacity-40"
                    />
                  </div>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-slate-100 capitalize truncate">
                    {slot.name || "Pokémon"}
                  </span>
                  <span className={`shrink-0 text-slate-500 text-xs transition-transform ${slotCollapsed[idx] ? "" : "rotate-180"}`}>▾</span>
                </button>
                {!slotCollapsed[idx] && (
                <>
                <div className="flex gap-2 items-start">
                  <div className="w-16 h-16 sm:w-32 sm:h-32 bg-[#031421] flex items-center justify-center rounded-lg shrink-0 overflow-hidden">
                    <SpriteImg
                      src={slot.sprite && !failedSpriteUrls.has(slot.sprite) ? slot.sprite : null}
                      alt={slot.name}
                      className="w-14 h-14 sm:w-28 sm:h-28 object-contain"
                      style={buildSpriteStyle(slot.spriteTransform, Z_SLOT_SPRITE_ZOOM_OVERRIDES[slot.name])}
                      onError={() => markSpriteFailed(slot.sprite!)}
                      placeholderClassName="h-8 w-8 sm:h-12 sm:w-12 opacity-40"
                    />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-nowrap min-w-0">
                        <div className="text-base font-semibold text-slate-100 capitalize truncate min-w-0" title={slot.name || "Pokémon"}>{slot.name || "Pokémon"}</div>
                        {slot.stats && isAdvanced ? (
                          <div
                            className="relative inline-flex items-center group shrink-0"
                            onMouseEnter={() => openStatsTooltip(idx)}
                            onMouseLeave={() => scheduleCloseStatsTooltip(idx)}
                          >
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[14px] text-slate-300 cursor-pointer"
                              onClick={() => setStatsTooltipOpen((prev) => prev.map((v, i) => i === idx ? !v : v))}
                            >ⓘ</span>
                            {/* Desktop: hover con margen de gracia (onMouseEnter/Leave arriba); Mobile: tap toggle */}
                            <div className={`absolute top-0 z-50 w-72 sm:w-80 rounded-2xl border border-slate-700 bg-slate-950/97 p-4 text-sm text-slate-100 shadow-xl shadow-black/50 ${statsTooltipOpen[idx] ? "block" : "hidden"} ${idx % 2 === 0 ? "left-full ml-2" : "right-full mr-2"}`}
                              style={{ maxHeight: "70vh", overflowY: "auto" }}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Stats base" : "Base stats"}</div>
                                <button type="button" className="sm:hidden text-slate-500 hover:text-slate-300 text-xs px-1" onClick={() => { if (statsTooltipCloseTimers.current[idx]) clearTimeout(statsTooltipCloseTimers.current[idx]); setStatsTooltipOpen((prev) => prev.map((v, i) => i === idx ? false : v)); }}>✕</button>
                              </div>
                              <div className="space-y-2 mb-4">
                                {statLabels.map(([key, label]) => {
                                  const value = slot.stats![key];
                                  const statNames = STAT_NAMES_I18N[lang];
                                  return (
                                    <div key={key} className="space-y-0.5">
                                      <div className="flex items-center justify-between text-[13px] text-slate-300">
                                        <span className="uppercase tracking-wide">{statNames[key]}</span>
                                        <span className="font-semibold tabular-nums">{value}</span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-slate-800">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Bulk metrics (Opción B) */}
                              {(() => {
                                const bulk = getBulk(slot.stats!);
                                const speedTier = getSpeedTier(slot.stats!.SPE, lang);
                                return (
                                  <div className="mb-4 space-y-2">
                                    <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Métricas" : "Metrics"}</div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {[
                                        { label: lang === "es" ? "Bulk fís." : "Phys. bulk", value: bulk.physical,  color: "#0369a1" },
                                        { label: lang === "es" ? "Bulk esp." : "Spec. bulk", value: bulk.special,   color: "#1d4ed8" },
                                        { label: lang === "es" ? "Poder of." : "Offense",    value: bulk.offensive, color: "#ea580c" },
                                      ].map(({ label, value, color }) => (
                                        <div key={label} className="rounded-lg bg-slate-900/80 border border-slate-700/50 px-2 py-1.5 text-center">
                                          <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
                                          <div className="text-sm font-bold" style={{ color }}>{value}</div>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Speed tier (Opción D) */}
                                    <div className="flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-700/50 px-3 py-1.5">
                                      <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{lang === "es" ? "Tier velocidad" : "Speed tier"}</span>
                                      <span className="text-xs font-bold" style={{ color: speedTier.color }}>{speedTier.label} ({slot.stats!.SPE})</span>
                                    </div>
                                  </div>
                                );
                              })()}
                              {/* Role radar (Opción A) */}
                              <div className="space-y-1.5">
                                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Aptitud por rol" : "Role aptitude"}</div>
                                {scoreAllRoles(slot.stats!)
                                  .sort((a, b) => b.score - a.score)
                                  .slice(0, 5)
                                  .map(({ role, score }) => {
                                    const roleKey = `${idx}:${role.en}`;
                                    const isOpen = openRoleKeys.has(roleKey);
                                    // Stats que definen el rol (weights > 0), ordenadas de mayor a menor peso.
                                    const keyStats = (Object.entries(role.weights) as [keyof BaseStats, number][])
                                      .filter(([, w]) => (w ?? 0) > 0)
                                      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
                                    const statNames = STAT_NAMES_I18N[lang];
                                    return (
                                      <div key={role.en} className="rounded-lg overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => toggleRoleOpen(roleKey)}
                                          className="flex items-center gap-2 w-full text-left py-0.5"
                                        >
                                          <span className="text-[11px] text-slate-400 w-32 shrink-0 truncate">{role[lang]}</span>
                                          <span className="flex-1 h-1.5 rounded-full bg-slate-800">
                                            <span className="block h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: role.color }} />
                                          </span>
                                          <span className="text-[11px] text-slate-500 w-8 text-right tabular-nums">{score}%</span>
                                          <span className={`shrink-0 text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                                        </button>
                                        {isOpen && (
                                          <div className="mt-1 mb-1.5 rounded-lg border border-slate-700/60 bg-slate-900/70 p-2 text-[11px] text-slate-300 space-y-1.5">
                                            <div>{getRoleDescription(role[lang], lang) ?? ""}</div>
                                            <div className="flex flex-wrap gap-1">
                                              {keyStats.map(([statKey]) => (
                                                <span
                                                  key={statKey}
                                                  className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200"
                                                >
                                                  {statNames[statKey]}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {slot.stats && isAdvanced && (() => {
                          const role = getEffectiveRole(slot, lang);
                          const isManual = !!slot.manualRoleEn;
                          const isOpen = roleSelectOpenIdx === idx;
                          return (
                            <span className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setRoleSelectOpenIdx(isOpen ? null : idx)}
                                title={
                                  isManual
                                    ? (lang === "es" ? "Rol elegido manualmente. Clic para cambiar." : "Manually chosen role. Click to change.")
                                    : (lang === "es" ? "Rol automático por stats. Clic para elegir uno manual." : "Automatic role from stats. Click to set one manually.")
                                }
                                className="flex items-center gap-1"
                              >
                                {role ? <RoleBadge label={role.label} color={role.color} /> : (
                                  <span className="rounded-full border border-dashed border-slate-600 px-2 py-0.5 text-[10px] text-slate-500">
                                    {lang === "es" ? "Elegir rol" : "Pick role"}
                                  </span>
                                )}
                                {isManual && (
                                  <span title={lang === "es" ? "Manual" : "Manual"} className="text-[10px] text-amber-400">✏️</span>
                                )}
                              </button>
                              {isOpen && (
                                <div
                                  className="absolute right-0 top-full z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-1.5 shadow-xl shadow-black/60"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => { setSlotManualRole(idx, null); setRoleSelectOpenIdx(null); }}
                                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-800 ${
                                      !isManual ? "text-emerald-300" : "text-slate-300"
                                    }`}
                                  >
                                    <span>{lang === "es" ? "Automático (por stats)" : "Automatic (by stats)"}</span>
                                    {!isManual && <span>✓</span>}
                                  </button>
                                  <div className="my-1 border-t border-slate-800" />
                                  {[...ROLES, BALANCED_ROLE].map((r) => (
                                    <button
                                      key={r.en}
                                      type="button"
                                      onClick={() => { setSlotManualRole(idx, r.en); setRoleSelectOpenIdx(null); }}
                                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-800 ${
                                        slot.manualRoleEn === r.en ? "text-emerald-300" : "text-slate-300"
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                                        {r[lang]}
                                      </span>
                                      {slot.manualRoleEn === r.en && <span>✓</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                      {!isAdvanced && (
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t.guideTypes}</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {slot.types.filter(Boolean).length ? (
                          slot.types.filter(Boolean).map((t_) => (
                            <span key={t_} className={badgeClass(t_)}>
                              {tn(t_)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">{t.noTypes}</span>
                        )}
                      </div>
                      {(slot.abilities && slot.abilities.length > 0) || slot.hiddenAbility ? (
                        <div className="space-y-1">
                        {!isAdvanced && (
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t.guideAbilities}</div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(slot.abilities ?? []).map((ab) => (
                            <FloatingTooltip
                              key={ab}
                              preferredPlacement="top"
                              content={
                                <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{getAbilityDisplayName(ab)}</div>
                                  <div>{(lang === "es" ? abilitiesZDescData[ab]?.description : (abilitiesZDescData[ab]?.descriptionEn ?? abilitiesZDescData[ab]?.description)) ?? ""}</div>
                                </div>
                              }
                            >
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-slate-200 cursor-default">
                                {getAbilityDisplayName(ab)}
                              </span>
                            </FloatingTooltip>
                          ))}
                          {slot.hiddenAbility ? (
                            <FloatingTooltip
                              preferredPlacement="top"
                              content={
                                <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{getAbilityDisplayName(slot.hiddenAbility)} ({lang === "es" ? "oculta" : "hidden"})</div>
                                  <div>{(lang === "es" ? abilitiesZDescData[slot.hiddenAbility]?.description : (abilitiesZDescData[slot.hiddenAbility]?.descriptionEn ?? abilitiesZDescData[slot.hiddenAbility]?.description)) ?? ""}</div>
                                </div>
                              }
                            >
                              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-500 bg-slate-800/60 px-2 py-0.5 text-[11px] font-semibold text-slate-300 cursor-default">
                                {getAbilityDisplayName(slot.hiddenAbility)}
                              </span>
                            </FloatingTooltip>
                          ) : null}
                        </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-wrap items-center gap-2 text-sm text-slate-300" ref={(el) => { pokemonInputWrapRefs.current[idx] = el; }}>
                  <input
                    value={pokemonInputDraft[idx] !== null ? pokemonInputDraft[idx]! : slot.name}
                    onFocus={() => {
                      setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? slot.name : d)));
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? value : d)));
                      setPokemonSearch((prev) => prev.map((current, i) => (i === idx ? value : current)));
                      // Solo tocamos el nombre "real" del slot cuando se borra por completo
                      // (esto ya dispara el reseteo a EMPTY_SLOT dentro de updateSlot). Mientras
                      // se está escribiendo/editando, el nombre confirmado NO cambia — así el
                      // ajuste de sprite por nombre (ej. Mega Delphox Z) no se pierde a mitad de tipeo.
                      if (value.trim() === "") {
                        updateSlot(idx, { name: "" });
                      }
                    }}
                    onBlur={() => {
                      // Sin selección confirmada: se descarta el borrador y el input
                      // vuelve a mostrar el nombre ya confirmado (cancela la edición).
                      setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? null : d)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? null : d)));
                        setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
                        return;
                      }
                      if (!pokemonOpen[idx] || pokemonResults[idx].length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setPokemonSelectedIdx((prev) =>
                          prev.map((sel, i) =>
                            i === idx ? Math.min(sel + 1, pokemonResults[idx].length - 1) : sel
                          )
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setPokemonSelectedIdx((prev) =>
                          prev.map((sel, i) => (i === idx ? Math.max(sel - 1, -1) : sel))
                        );
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (pokemonSelectedIdx[idx] >= 0 && pokemonSelectedIdx[idx] < pokemonResults[idx].length) {
                          selectPokemonSuggestion(idx, pokemonResults[idx][pokemonSelectedIdx[idx]]);
                        }
                      }
                    }}
                    placeholder={slot.isFake ? t.searchFakemon : t.searchPokemon}
                    className="min-w-0 flex-1 bg-transparent border border-blue-800/40 text-slate-100 placeholder-slate-500 px-2 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-700 text-[13px] sm:text-sm"
                  />
                  {!slot.isFake && (
                    <button
                      type="button"
                      onClick={() => fetchPokemon(pokemonInputDraft[idx] ?? slot.name, idx)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 px-2.5 sm:px-3.5 py-1.5 text-white btn-interactive whitespace-nowrap text-xs sm:text-sm font-semibold shadow-sm shadow-blue-950/40 transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="2" />
                        <path d="M13.6 13.6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span className="hidden xs:inline">{t.btnSearch}</span>
                    </button>
                  )}
                  <div className="inline-flex items-center gap-2 sm:gap-3">
                    {fakemonModeOn && (
                      <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm cursor-pointer select-none">
                        <span className="pr-checkbox">
                          <input
                            type="checkbox"
                            checked={slot.isFake}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (!checked) {
                                // Al dejar de ser Fakemon, los movimientos inventados
                                // ya no aplican: se limpian para que no queden
                                // "escondidos" con isFake=true fuera de contexto.
                                updateSlot(idx, {
                                  isFake: false,
                                  moves: slot.moves.map((m) =>
                                    m.isFake ? EMPTY_MOVE() : m
                                  ),
                                });
                              } else {
                                updateSlot(idx, { isFake: true });
                              }
                            }}
                          />
                          <span className="pr-checkbox-box" />
                        </span>
                        {t.checkFakemon}
                      </label>
                    )}
                    {slot.isFake ? (
                      <button
                        type="button"
                        onClick={() => openFakemonConfig(idx)}
                        className="rounded-full bg-slate-800/90 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:bg-slate-700"
                      >
                        {t.btnConfigure}
                      </button>
                    ) : null}
                  </div>
                </div>
                {!slot.isFake && (
                  <AnchoredDropdown
                    anchorEl={pokemonInputWrapRefs.current[idx]}
                    open={pokemonOpen[idx] && pokemonResults[idx].length > 0}
                  >
                    <div data-move-dropdown="true" className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 shadow-lg text-sm" onMouseDown={(e) => e.stopPropagation()}>
                      {pokemonResults[idx].map((name, resultIdx) => {
                        // El value interno puede venir codificado como "Label#id"
                        // (formas/megas Z); separamos para mostrar solo el label limpio.
                        const hashIdx = name.lastIndexOf("#");
                        const displayLabel = hashIdx >= 0 ? name.slice(0, hashIdx) : name;
                        return (
                        <button
                          key={name}
                          type="button"
                          ref={(el) => {
                            if (el && pokemonSelectedIdx[idx] === resultIdx) {
                              el.scrollIntoView({ block: "nearest" });
                            }
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectPokemonSuggestion(idx, name);
                          }}
                          onMouseEnter={() =>
                            setPokemonSelectedIdx((prev) =>
                              prev.map((sel, i) => (i === idx ? resultIdx : sel))
                            )
                          }
                          className={`w-full text-left px-3 py-2 ${
                            pokemonSelectedIdx[idx] === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                          } focus:bg-slate-700/80`}
                        >
                          {formatForDisplay(displayLabel)}
                        </button>
                        );
                      })}
                    </div>
                  </AnchoredDropdown>
                )}
                {slot.isFake ? (
                  <div className="mt-3 rounded-2xl border border-slate-800/60 bg-slate-950/60 p-3 text-slate-300">
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">{t.fakemonConfigured}</div>
                    <div className="flex flex-wrap gap-2">
                      {slot.types.filter(Boolean).length ? (
                        slot.types.filter(Boolean).map((type) => (
                          <span key={type} className={badgeClass(type)}>
                            {tn(type)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">{t.noTypesSet}</span>
                      )}
                    </div>
                  </div>
                ) : null}

                {!isAdvanced && (
                  <div className="mt-3 mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">{t.guideMoves}</div>
                )}
                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                  {slot.moves.map((m, mi) => {
                    const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
                    const CategoryIcon = ({ cat, size = 18 }: { cat: string; size?: number }) => {
                      if (cat === "Physical") return (
                        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#C03028" stroke="#7f1010" strokeWidth="1"/>
                          <path d="M5 13L9 5L13 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <circle cx="9" cy="5" r="1.5" fill="white"/>
                        </svg>
                      );
                      if (cat === "Special") return (
                        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#6890F0" stroke="#1e3a8a" strokeWidth="1"/>
                          <path d="M9 4L10.2 7.5H14L11 9.8L12.2 13.2L9 11L5.8 13.2L7 9.8L4 7.5H7.8L9 4Z" fill="white"/>
                        </svg>
                      );
                      return (
                        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#705898" stroke="#3b1e6b" strokeWidth="1"/>
                          <circle cx="9" cy="9" r="3.5" fill="white" opacity="0.9"/>
                          <circle cx="9" cy="9" r="1.5" fill="#705898"/>
                        </svg>
                      );
                    };
                    const moveDescription = lang === "es"
                      ? (m.descriptionEs || m.descriptionEn)
                      : (m.descriptionEn || m.descriptionEs);
                    const isDraggingThisMove = dragMoveFrom?.slotIdx === idx && dragMoveFrom?.moveIdx === mi;
                    const isDragOverThisMove = moveDragOverIdx?.slotIdx === idx && moveDragOverIdx?.moveIdx === mi;
                    return (
                      <div
                        key={mi}
                        className={`pokedex-card rounded-xl border-blue-800/30 p-2 sm:p-2.5 transition ${isDraggingThisMove ? "opacity-40" : ""} ${isDragOverThisMove ? "ring-2 ring-sky-400/70" : ""}`}
                        style={moveBgStyle(m.category, m.type)}
                        onDragOver={(e) => {
                          if (dragMoveFrom && dragMoveFrom.slotIdx === idx) {
                            e.preventDefault();
                            setMoveDragOverIdx({ slotIdx: idx, moveIdx: mi });
                          }
                        }}
                        onDrop={(e) => {
                          if (dragMoveFrom && dragMoveFrom.slotIdx === idx) {
                            e.preventDefault();
                            swapMoves(idx, dragMoveFrom.moveIdx, mi);
                          }
                          setDragMoveFrom(null);
                          setMoveDragOverIdx(null);
                        }}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Handle simple de drag & drop: solo reordena movimientos dentro del mismo Pokémon */}
                            <span
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setDragMoveFrom({ slotIdx: idx, moveIdx: mi });
                              }}
                              onDragEnd={() => {
                                setDragMoveFrom(null);
                                setMoveDragOverIdx(null);
                              }}
                              title={lang === "es" ? "Arrastrar para reordenar" : "Drag to reorder"}
                              className="cursor-grab active:cursor-grabbing select-none text-slate-500 hover:text-slate-300 text-sm leading-none px-0.5"
                            >
                              ⠿
                            </span>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t.attackSlot} {mi + 1}</div>
                          </div>
                          {slot.isFake && (
                            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
                              <span className="pr-checkbox">
                                <input
                                  type="checkbox"
                                  checked={!!m.isFake}
                                  onChange={(e) => updateMove(idx, mi, { isFake: e.target.checked })}
                                />
                                <span className="pr-checkbox-box" />
                              </span>
                              {t.moveInvented}
                            </label>
                          )}
                        </div>

                        {m.isFake ? (
                          <div className="space-y-3">
                            <input
                              placeholder={t.fakeMovePlaceholder}
                              value={m.name}
                              onChange={(e) => updateMove(idx, mi, { name: e.target.value })}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                            />
                            <select
                              value={m.category}
                              onChange={(e) => updateMove(idx, mi, { category: e.target.value as Move["category"] })}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                            >
                              <option value="Physical">{t.catPhysical}</option>
                              <option value="Special">{t.catSpecial}</option>
                              <option value="Status">{t.catStatus}</option>
                            </select>
                            <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-2">
                              <button
                                type="button"
                                onClick={() => toggleFakeType(idx, mi)}
                                className="flex w-full items-center justify-between gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200"
                              >
                                <span>{t.fakeTypeLabel}{m.type ? `: ${tn(m.type)}` : ""}</span>
                                <span>{fakeTypeOpen[idx][mi] ? "▾" : "▸"}</span>
                              </button>
                              {fakeTypeOpen[idx][mi] && (
                                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {allTypes.map((ty) => (
                                    <button
                                      key={ty}
                                      type="button"
                                      onClick={() => updateMove(idx, mi, { type: m.type === ty ? null : ty })}
                                      className={`${badgeClass(ty)} type-picker-badge min-h-8 w-full px-2 py-1 opacity-75 transition hover:opacity-100 ${m.type === ty ? "ring-2 ring-white/70 opacity-100" : ""}`}
                                    >
                                      {tn(ty)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="relative" ref={(el) => { moveInputWrapRefs.current[`${idx}-${mi}`] = el; }}>
                            <input
                              placeholder={t.movePlaceholder}
                              value={moveInputDraft[idx][mi] !== null
                                ? moveInputDraft[idx][mi]!
                                : (() => {
                                    if (lang !== "es") return m.name;
                                    // Priority: stored nameEs → bulk-loaded ES map → EN name
                                    return m.nameEs || moveEsDisplay[m.name] || m.name;
                                  })()
                              }
                              onFocus={() => {
                                // Enter edit mode: pre-fill with the current translated display name
                                const display = lang === "es"
                                  ? (m.nameEs || moveEsDisplay[m.name] || m.name)
                                  : m.name;
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? display : d) : s)
                                );
                              }}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Update draft only — never touch m.name/m.nameEs while typing
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? value : d) : s)
                                );
                              }}
                              onKeyDown={(e) => {
                                if (!moveOpen[idx][mi] || moveResults[idx][mi].length === 0) return;
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setMoveSelectedIdx((prev) =>
                                    prev.map((s, si) => si === idx
                                      ? s.map((sel, mj) => mj === mi ? Math.min(sel + 1, moveResults[idx][mi].length - 1) : sel)
                                      : s)
                                  );
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setMoveSelectedIdx((prev) =>
                                    prev.map((s, si) => si === idx
                                      ? s.map((sel, mj) => mj === mi ? Math.max(sel - 1, -1) : sel)
                                      : s)
                                  );
                                } else if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (moveSelectedIdx[idx][mi] >= 0 && moveSelectedIdx[idx][mi] < moveResults[idx][mi].length) {
                                    selectMoveSuggestion(idx, mi, moveResults[idx][mi][moveSelectedIdx[idx][mi]]);
                                  }
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  // Cancel edit: revert to display mode
                                  setMoveInputDraft((prev) =>
                                    prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? null : d) : s)
                                  );
                                  setMoveOpen((prev) =>
                                    prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s)
                                  );
                                }
                              }}
                              onBlur={() => {
                                const draft = moveInputDraft[idx][mi];
                                if (draft === null) return;
                                // Resolve: try ES map first, then use draft as English slug
                                const normalized = normalizeMoveSearch(draft);

const enSlug =
  Object.entries(moveEsMap).find(
    ([es]) => normalizeMoveSearch(es) === normalized
  )?.[1] ?? formatForAPI(draft);
                                // Clear draft → back to display mode
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? null : d) : s)
                                );
                                setMoveOpen((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s)
                                );
                                if (enSlug) {
                                  updateMove(idx, mi, { name: enSlug });
                                  fetchMove(enSlug, idx, mi);
                                }
                              }}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-950/50 py-2 pl-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                              style={{
                                paddingRight:
                                  moveDescription ? "4.2rem" : "2.25rem",
                              }}
                            />
                            {!m.isFake && m.name && moveDescription && (
                              <div className="absolute right-9 top-1/2 -translate-y-1/2">
                                <FloatingTooltip
                                  preferredPlacement="right"
                                  content={
                                    <div className="w-64 rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-xl shadow-black/50 text-sm text-slate-100">
                                      <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1.5">
                                        {lang === "es" ? "Descripción" : "Description"}
                                      </div>
                                      <p className="text-[13px] leading-snug text-slate-200">{moveDescription}</p>
                                      {(m.power != null || m.accuracy != null || m.pp != null) && (
                                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-3 text-[11px] text-slate-400">
                                          <span>{lang === "es" ? "Poder" : "Power"}: <span className="text-slate-200 font-semibold">{m.power ?? "—"}</span></span>
                                          <span>{lang === "es" ? "Precisión" : "Accuracy"}: <span className="text-slate-200 font-semibold">{m.accuracy ?? "—"}</span></span>
                                          <span>PP: <span className="text-slate-200 font-semibold">{m.pp ?? "—"}</span></span>
                                        </div>
                                      )}
                                    </div>
                                  }
                                >
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                                    title={lang === "es" ? "Descripción del movimiento" : "Move description"}
                                  >
                                    ⓘ
                                  </button>
                                </FloatingTooltip>
                              </div>
                            )}                            {((activePokedex === "pokemon-z" && movesZData.length > 0) ||
                              (activePokedex === "standard" && movesStandardData.length > 0)) && (
                              <button
                                type="button"
                                onClick={() => openMoveFilter(idx, mi)}
                                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                                title={lang === "es" ? "Filtrar movimientos" : "Filter moves"}
                              >
                                🔎
                              </button>
                            )}
                            <AnchoredDropdown
                              anchorEl={moveInputWrapRefs.current[`${idx}-${mi}`]}
                              open={moveOpen[idx][mi] && moveResults[idx][mi].length > 0}
                            >
                              <div data-move-dropdown="true" className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 text-sm shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
                                {moveResults[idx][mi].map((name, resultIdx) => {
                                  // Mostrar solo el nombre en el idioma activo, igual que en la dex Z
                                  const esDisplay = moveEsDisplay[name];
                                  const label = lang === "es" && esDisplay ? esDisplay : formatForDisplay(name);
                                  const learnBadge = getMoveLearnBadge(idx, name);
                                  return (
                                    <button
                                      key={name}
                                      type="button"
                                      ref={(el) => {
                                        if (el && moveSelectedIdx[idx][mi] === resultIdx) {
                                          el.scrollIntoView({ block: "nearest" });
                                        }
                                      }}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectMoveSuggestion(idx, mi, name);
                                      }}
                                      onMouseEnter={() =>
                                        setMoveSelectedIdx((prev) =>
                                          prev.map((s, si) => si === idx
                                            ? s.map((sel, mj) => mj === mi ? resultIdx : sel)
                                            : s)
                                        )
                                      }
                                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 ${
                                        moveSelectedIdx[idx][mi] === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                                      }`}
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        <span className="truncate">{label}</span>
                                      </span>
                                      {learnBadge && (
                                        <span className="shrink-0 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                                          {learnBadge}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </AnchoredDropdown>
                            </div>
                            {isHP && isAdvanced && (
                              <div className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/20 p-2 animate-[fadeSlideDown_0.18s_ease-out]">
                                <button
                                  type="button"
                                  onClick={() => toggleHpType(idx, mi)}
                                  className="flex w-full items-center justify-between gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200"
                                >
                                  <span>{t.hpTypeLabel}{m.hiddenPowerType ? `: ${tn(m.hiddenPowerType)}` : ""}</span>
                                  <span>{hpTypeOpen[idx][mi] ? "▾" : "▸"}</span>
                                </button>
                                {hpTypeOpen[idx][mi] && (
                                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                    {allTypes.filter((ty) => ty !== "normal" && ty !== "fairy").map((ty) => (
                                      <button
                                        key={ty}
                                        type="button"
                                        onClick={() => updateMove(idx, mi, { hiddenPowerType: m.hiddenPowerType === ty ? null : ty })}
                                        className={`${badgeClass(ty)} min-h-7 px-2 py-1 text-[12px] opacity-75 transition hover:opacity-100 ${m.hiddenPowerType === ty ? "ring-2 ring-white/70 opacity-100" : ""}`}
                                      >
                                        {tn(ty)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800/70 pt-3">
                          {isAdvanced ? (
                          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                            <span className="shrink-0"><CategoryIcon cat={m.category} size={22} /></span>
                            <span className="text-[10px] leading-none font-medium uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">
                              {m.category === "Physical" ? t.catPhysical : m.category === "Special" ? t.catSpecial : t.catStatus}
                            </span>
                          </div>
                          ) : <span />}
                          <span className="flex-1 min-w-0" />
                          {isHP && m.hiddenPowerType ? (
                            <span className={`${badgeClass(m.hiddenPowerType)} ml-auto min-h-7 px-2.5 py-0.5 text-[12px] whitespace-nowrap shrink-0`}>{tn(m.hiddenPowerType)}</span>
                          ) : m.type ? (
                            <span className={`${badgeClass(m.type)} ml-auto min-h-7 px-2.5 py-0.5 text-[12px] whitespace-nowrap shrink-0`}>{tn(m.type)}</span>
                          ) : (
                            <span className="ml-auto inline-flex min-h-7 items-center rounded-full border border-slate-700 px-2.5 py-0.5 text-[12px] text-slate-500 whitespace-nowrap shrink-0">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
                )}
              </div>
              );
            })}
          </div>
        </CollapsibleSection>

        <section className="pokedex-panel p-3 sm:p-4 rounded-lg h-full flex flex-col gap-3 min-h-0 overflow-hidden">
          <h2 className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-semibold tracking-tight text-slate-100">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">📊</span>
            {lang === "es" ? "Análisis del equipo" : "Team Analysis"}
          </h2>
          <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
          <div className="w-px bg-gradient-to-b from-blue-700/40 via-slate-700/20 to-transparent shrink-0 mr-3 ml-1" />
          <div className="grid gap-2 flex-1 min-h-0 overflow-hidden">
            <CollapsibleSection
              as="div"
              className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 h-full min-h-0 overflow-hidden"
              headerClassName="mb-2 sm:mb-3"
              icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">⚔️</span>}
              title={lang === "es" ? "Tipos" : "Types"}
              guide={!isAdvanced ? t.guideDefenseSection : undefined}
              storageKey="defensive-coverage"
            >
              {loadingRelations ? (
                <div className="text-slate-300">{lang === "es" ? "Cargando relaciones de tipos..." : "Loading type chart..."}</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {sharedWeaknesses.length > 0 && (
                    <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2.5">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-red-400 mb-1.5 font-medium">
                        {lang === "es" ? "Debilidades compartidas del equipo" : "Team's shared weaknesses"}
                      </div>
                      <div className="space-y-2.5">
                        {sharedWeaknesses.map(({ weakType, count, names, resistantTypes }) => (
                          <div key={weakType}>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className={`${badgeClass(weakType)} text-[13px] px-2 py-0.5`}>{tn(weakType)}</span>
                              <span className="text-red-300 font-semibold">
                                {count}× {lang === "es" ? "en el equipo" : "on the team"}
                              </span>
                              {names.length > 0 && <span className="text-slate-500">({names.join(", ")})</span>}
                            </div>
                            {resistantTypes.length > 0 && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-slate-600">{lang === "es" ? "resistido por:" : "resisted by:"}</span>
                                {resistantTypes.map((ty) => (
                                  <span key={ty} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5 opacity-80`}>{tn(ty)}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 items-stretch">
                    <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base leading-none">🔻</span>
                        <span className="font-semibold text-slate-100">{t.weaknesses} (×2+)</span>
                        {Object.values(analysis.weaknesses).some(c => c >= 4) && (
                          <span className="inline-flex items-center rounded-full bg-red-950/60 border border-red-500/40 px-1.5 py-0.5 text-[10px] font-bold text-red-300 uppercase tracking-wider">⚠ ×4</span>
                        )}
                      </div>
                    <div className="flex flex-wrap content-start gap-2 flex-1">
                        {Object.entries(analysis.weaknesses).length ? (
                          Object.entries(analysis.weaknesses)
                            .sort(([, a], [, b]) => b - a)
                            .map(([ty, c]) => {
                              const detail = typeDetail[ty];
                              const hasDetail = isAdvanced && detail && (detail.weak.length > 0 || detail.resist.length > 0 || detail.immune.length > 0);
                              return (
                                <FloatingTooltip
                                  key={ty}
                                  preferredPlacement="top"
                                  content={
                                    hasDetail ? (
                                      <div className="w-52 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">{tn(ty)}</div>
                                        {detail.weak.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[10px] text-red-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Débiles" : "Weak"}</div>
                                            {detail.weak.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-red-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.resist.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[10px] text-emerald-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Resisten" : "Resist"}</div>
                                            {detail.resist.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-emerald-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.immune.length > 0 && (
                                          <div>
                                            <div className="text-[10px] text-blue-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Inmunes" : "Immune"}</div>
                                            {detail.immune.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-blue-300 font-bold shrink-0">0×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : null
                                  }
                                >
                                  <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-slate-200 whitespace-nowrap w-fit cursor-default transition-all
                                    ${c >= 4
                                      ? "h-11 bg-red-950/60 border border-red-500/50 shadow shadow-red-900/40 ring-1 ring-red-500/20"
                                      : c >= 3
                                      ? "h-10 bg-red-950/30 border border-red-700/40"
                                      : "h-9 bg-slate-900/80 border border-slate-800/60"
                                    }`}>
                                    <span className={`${badgeClass(ty)} ${c >= 4 ? "text-[15px]" : "text-[13px]"}`}>{tn(ty)}</span>
                                    <span className={`font-bold tabular-nums ${c >= 4 ? "text-sm text-red-300" : c >= 3 ? "text-xs text-red-400/80" : "text-xs text-slate-400"}`}>{c}×</span>
                                  </div>
                                </FloatingTooltip>
                              );
                            })
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-slate-900/80 px-3 py-8 text-slate-500 text-sm gap-2 w-full min-h-[96px]">
                            <span className="text-lg">∘</span>
                            <span>{lang === "es" ? "No hay datos de debilidades aún" : "No weakness data yet"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base leading-none">🛡️</span>
                        <span className="font-semibold text-slate-100">{t.strengths} (≤×0.5)</span>
                      </div>
                      <div className="flex flex-wrap content-start gap-2 flex-1">
                        {Object.entries(analysis.strengths).length ? (
                          Object.entries(analysis.strengths)
                            .sort(([, a], [, b]) => b - a)
                            .map(([ty, c]) => {
                              const detail = typeDetail[ty];
                              const hasDetail = isAdvanced && detail && (detail.weak.length > 0 || detail.resist.length > 0 || detail.immune.length > 0);
                              return (
                                <FloatingTooltip
                                  key={ty}
                                  preferredPlacement="top"
                                  content={
                                    hasDetail ? (
                                      <div className="w-52 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">{tn(ty)}</div>
                                        {detail.weak.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[10px] text-red-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Débiles" : "Weak"}</div>
                                            {detail.weak.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-red-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.resist.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[10px] text-emerald-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Resisten" : "Resist"}</div>
                                            {detail.resist.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-emerald-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.immune.length > 0 && (
                                          <div>
                                            <div className="text-[10px] text-blue-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Inmunes" : "Immune"}</div>
                                            {detail.immune.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-blue-300 font-bold shrink-0">0×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : null
                                  }
                                >
                                  <div className={`flex items-center gap-1.5 h-10 rounded-lg bg-slate-900/80 px-2.5 py-1 text-slate-200 whitespace-nowrap w-fit cursor-default ${c >= 3 ? "border border-emerald-500/30 shadow-sm shadow-emerald-500/10" : ""}`}>
                                    <span className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                                    <span className={`text-xs font-semibold ${c >= 3 ? "text-emerald-200" : "text-slate-300"}`}>{c}×</span>
                                  </div>
                                </FloatingTooltip>
                              );
                            })
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-slate-900/80 px-3 py-8 text-slate-500 text-sm gap-2 w-full min-h-[96px]">
                            <span className="text-lg">∘</span>
                            <span>No hay datos de resistencias aún</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {typeAddSuggestions.length > 0 && (
                    <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/10 px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base leading-none">🧩</span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-400 font-medium">
                          {lang === "es" ? "Tipos recomendados para agregar" : "Recommended types to add"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {typeAddSuggestions.map(({ type, addsResistTypes, coversWeaknessTypes }) => (
                          <div key={type} className="flex flex-wrap items-center gap-1.5 text-xs rounded-lg bg-slate-950/60 border border-emerald-900/30 px-2.5 py-1.5">
                            <span className={`${badgeClass(type)} text-[13px] px-2 py-0.5`}>{tn(type)}</span>
                            {coversWeaknessTypes.length > 0 && (
                              <span className="flex flex-wrap items-center gap-1">
                                <span className="text-slate-600">{lang === "es" ? "cubre:" : "covers:"}</span>
                                {coversWeaknessTypes.map((ty) => (
                                  <span key={ty} className={`${badgeClass(ty)} text-[11px] px-1.5 py-0.5 opacity-90`}>{tn(ty)}</span>
                                ))}
                              </span>
                            )}
                            {addsResistTypes.length > 0 && (
                              <span className="flex flex-wrap items-center gap-1">
                                <span className="text-slate-600">{lang === "es" ? "resiste:" : "resists:"}</span>
                                {addsResistTypes.map((ty) => (
                                  <span key={ty} className={`${badgeClass(ty)} text-[11px] px-1.5 py-0.5 opacity-70`}>{tn(ty)}</span>
                                ))}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              as="div"
              className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 h-full min-h-0 flex flex-col overflow-hidden"
              headerClassName="mb-2 sm:mb-3"
              icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">⚡</span>}
              title={t.coverageTitle}
              guide={!isAdvanced ? t.guideCoverageSection : undefined}
              storageKey="offensive-coverage"
              bodyClassName="flex-1 grid gap-3 min-h-0 overflow-hidden"
            >
                <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 text-slate-200">
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-1">{t.coverageTypesCovered}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">{coverage.supCount}</span>
                    <span className="text-slate-500 text-sm">/ {Object.keys(typeRelations).length} {t.coverageOf}</span>
                  </div>
                </div>
                {/* Tipos NO cubiertos — ahora es su propia tarjeta hermana (antes
                    quedaba anidada dentro del cuadro de arriba, mientras que
                    "Tipos con menor cobertura" ya era una tarjeta aparte; así
                    las dos quedan al mismo nivel y con el mismo tratamiento). */}
                {Object.keys(typeRelations).length > 0 && (() => {
                    const hasAnyOffensiveData = Object.values(coverage.canHitSupereffective).some((v) => v > 0);
                    if (!hasAnyOffensiveData) {
                      return (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-6 text-center">
                          <span className="text-xl">🎯</span>
                          <span className="text-sm text-slate-500">
                            {lang === "es" ? "Añade movimientos para ver cobertura" : "Add moves to see coverage"}
                          </span>
                        </div>
                      );
                    }
                    const uncovered = Object.keys(typeRelations).filter(
                      (ty) => !coverage.canHitSupereffective[ty] || coverage.canHitSupereffective[ty] === 0
                    );
                    return uncovered.length > 0 ? (
                      <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-2.5 py-2">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-red-400 mb-1.5 font-medium">
                          {lang === "es" ? "Sin cobertura frente a" : "No coverage against"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {uncovered.map((ty) => (
                            <span key={ty} className={`${badgeClass(ty)} text-[13px] px-2 py-0.5 ring-1 ring-red-500/30`}>{tn(ty)}</span>
                          ))}
                        </div>
                        {attackSuggestions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-red-900/30 space-y-1.5">
                            {attackSuggestions.map(({ atkType, covers }) => {
                              const allSuperEffective = typeRelations[atkType]?.double_damage_to?.map((d: any) => d.name) ?? [];
                              const secondaryCoverage = allSuperEffective.filter((ty: string) => !covers.includes(ty));
                              return (
                                <div key={atkType} className="text-xs">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`${badgeClass(atkType)} text-[13px] shrink-0`}>{tn(atkType)}</span>
                                    <span className="text-slate-400">{t.atkSuggCovers} {covers.length} {t.atkSuggUncovered}</span>
                                    {covers.map((ty: string) => (
                                      <span key={ty} className={`${badgeClass(ty)} text-[13px]`}>{tn(ty)}</span>
                                    ))}
                                  </div>
                                  {secondaryCoverage.length > 0 && (
                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-600">{t.atkSuggAlso}</span>
                                      {secondaryCoverage.map((ty: string) => (
                                        <span key={ty} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5 opacity-50`}>{tn(ty)}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-2.5 py-1.5 text-[11px] text-emerald-400">
                        ✓ {lang === "es" ? "Cobertura completa" : "Full coverage"}
                      </div>
                    );
                })()}
                {weakCoverageSuggestion && weakCoverageSuggestion.weakTypes.length > 0 && (
                  <div className="rounded-lg border border-amber-800/40 bg-amber-950/10 px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-amber-400 mb-1.5 font-medium">
                      {lang === "es" ? "Tipos con menor cobertura" : "Types with least coverage"}
                      <span className="text-amber-500/70 normal-case tracking-normal font-normal">
                        {" "}({weakCoverageSuggestion.minCount}× {lang === "es" ? "cada uno" : "each"})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {weakCoverageSuggestion.weakTypes.map((ty) => (
                        <span key={ty} className={`${badgeClass(ty)} text-[13px] px-2 py-0.5`}>{tn(ty)}</span>
                      ))}
                    </div>
                    {weakCoverageSuggestion.bestTypes.length > 0 ? (
                      <div className="space-y-1 pt-1.5 border-t border-amber-900/30">
                        <div className="text-xs text-slate-400 mb-0.5">
                          {lang === "es" ? "Tipo(s) de ataque recomendados:" : "Recommended attack type(s):"}
                        </div>
                        {weakCoverageSuggestion.bestTypes.map(({ atkType, covered }) => (
                          <div key={atkType} className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                            <span className={`${badgeClass(atkType)} text-[13px]`}>{tn(atkType)}</span>
                            <span className="text-slate-600">
                              {lang === "es" ? "cubre" : "covers"} {covered.length}/{weakCoverageSuggestion.weakTypes.length}
                            </span>
                            {covered.map((ty) => (
                              <span key={ty} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5 opacity-70`}>{tn(ty)}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 pt-1.5 border-t border-amber-900/30">
                        {lang === "es" ? "No hay ningún tipo de ataque que refuerce esto." : "No attack type would help here."}
                      </div>
                    )}
                  </div>
                )}
                {isAdvanced && (
                <div>
                  <div className="font-semibold text-slate-100 mb-2 text-sm">{t.superEffective}</div>
                  {Object.values(coverage.canHitSupereffective).every((v) => v === 0) ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-6 text-center">
                      <span className="text-xl">⚔️</span>
                      <span className="text-sm text-slate-500">{lang === "es" ? "Añade movimientos para ver cobertura" : "Add moves to see coverage"}</span>
                    </div>
                  ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(coverage.canHitSupereffective)
                      .filter(([_, v]) => v > 0)
                      .map(([ty]) => (
                        <div key={ty} className="flex items-center gap-1.5 h-8 rounded-lg bg-slate-900/80 px-2 py-1 text-slate-200 whitespace-nowrap w-fit">
                          <span className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                          <span className="text-xs font-semibold text-slate-300">{coverage.canHitSupereffective[ty]}×</span>
                        </div>
                      ))}
                  </div>
                  )}
                </div>
                )}
                {isAdvanced && moveTypeRedundancy.length > 0 && (
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1.5 font-medium">
                      {lang === "es" ? "Movimientos ofensivos repetidos" : "Repeated offensive moves"}
                    </div>
                    <div className="space-y-2">
                      {moveTypeRedundancy.map(({ atkType, count, pokemonNames }) => (
                        <div key={atkType} className="flex flex-wrap items-center gap-1.5">
                          <span className={`${badgeClass(atkType)} text-[13px] px-2 py-0.5`}>{tn(atkType)}</span>
                          <span className="text-sm font-semibold text-slate-300">×{count}</span>
                          {pokemonNames.map((name) => (
                            <span key={name} className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[12px] font-medium text-slate-200 capitalize">
                              {name}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {lang === "es"
                        ? "Del segundo movimiento del mismo tipo en adelante no suman cobertura nueva: pegan a los mismos tipos que el primero."
                        : "From the second move of the same type onward, they don't add new coverage: they hit the same types as the first."}
                    </div>
                  </div>
                )}
            </CollapsibleSection>

            {isAdvanced && (<>
            <CollapsibleSection
              as="div"
              className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 min-h-0 flex flex-col"
              headerClassName="mb-2 sm:mb-3"
              icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">📈</span>}
              title={t.statsBalance}
              storageKey="stats-balance"
            >
              {statsAnalysis ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {statsAnalysis.STAT_KEYS.map((key) => {
                      const value = statsAnalysis.averages[key];
                      const lv = statsAnalysis.levels[key];
                      const lvColor = lv === "alto" ? "text-emerald-400" : lv === "medio" ? "text-yellow-400" : "text-red-400";
                      const lvLabel = lv === "alto" ? t.statLevelHigh : lv === "medio" ? t.statLevelMid : t.statLevelLow;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-[14px] uppercase tracking-[0.15em]">
                            <span className="text-slate-300 w-16">{statsAnalysis.STAT_NAMES[key]}</span>
                            <span className="text-slate-400 w-8 text-center">{value}</span>
                            <span className={`font-semibold w-12 text-right ${lvColor}`}>{lvLabel}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {statsAnalysis.allBalanced ? (
                    <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/30 px-3 py-2.5 text-xs text-emerald-300 leading-relaxed">
                      {t.balancedOk}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {statsAnalysis.redundantRoles.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[13px] uppercase tracking-[0.2em] text-amber-500">{t.redundantRoles}</div>
                          {statsAnalysis.redundantRoles.map(({ role, count: rc, pokemon }) => (
                            <div key={role.label} className="flex items-center gap-3 rounded-xl border border-amber-800/40 bg-amber-950/30 px-3 py-2.5">
                              <RoleBadge label={role.label} color={role.color} size="text-[14px]" pokemonList={pokemon} />
                              <div className="text-xs text-amber-300 leading-relaxed">
                                <span className="font-semibold">{rc} {lang === "es" ? "Pokémon" : "Pokémon"} {t.redundantDesc}</span> ({pokemon.join(", ")}) {t.redundantNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {statsAnalysis.topSuggestions.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500">{t.roleSuggTitle}</div>
                          {statsAnalysis.topSuggestions.map(({ role, statA, statB, existingCount }) => {
                            const gapA = statsAnalysis.gaps[statA];
                            const gapB = statsAnalysis.gaps[statB];
                            const isUrgent = statsAnalysis.levels[statA] === "bajo" || statsAnalysis.levels[statB] === "bajo";
                            return (
                              <div key={role.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isUrgent ? "border-red-800/40 bg-red-950/20" : "border-slate-700/40 bg-slate-900/60"}`}>
                                <RoleBadge label={role.label} color={role.color} size="text-[14px]" />
                                <div className="text-xs text-slate-300 leading-relaxed">
                                  {existingCount > 0
                                    ? <>{t.roleExisting} <span className="font-semibold text-yellow-300">{existingCount}</span> {t.roleExistingMid} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statA]}</span> ({gapA} {t.rolesBelowBest}) {lang === "es" ? "y" : "and"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statB]}</span> ({gapB} {t.rolesBelowBest})</>
                                    : <>{isUrgent ? <span className="text-red-300 font-semibold">{t.roleNew}</span> : t.roleNewAlt} {lang === "es" ? "en" : "in"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statA]}</span> {lang === "es" ? "y" : "and"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statB]}</span> — {t.roleNewEnd} {role.label}</>
                                  }
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {rolesSummary.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500">{t.teamRoles}</div>
                      <div className="flex flex-wrap gap-2">
                        {rolesSummary.map((r) => (
                          <RoleBadge key={r.label} label={r.label} color={r.color} size="text-[14px]" countBadge={r.count} pokemonList={r.pokemon} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-[13px] text-slate-500 text-right">{t.basedOn} {statsAnalysis.count} {t.basedOnEnd}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-sm gap-2">
                  <span className="text-2xl">📊</span>
                  <span>{t.loadStats}</span>
                </div>
              )}
            </CollapsibleSection>
            </>)}
          </div>
          </div>{/* end flex conductor */}
        </section>
      </div>
      {/* ── DASHBOARD + POKÉMON IDEAL (fila 1) — solo modo avanzado ──── */}
      {isAdvanced && (
      <div className={`grid grid-cols-1 gap-4 items-stretch ${dashboard && teamSummary ? "md:grid-cols-[1.05fr_0.95fr]" : ""}`}>
      {dashboard && (
        <div className="pokedex-panel p-3 sm:p-4 rounded-lg h-full flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">🧭</span>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-100">
              {lang === "es" ? "Dashboard del equipo" : "Team Dashboard"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">

            {/* Helper: reusable tooltip wrapper */}
            {(() => {
              const DashCard = ({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip: React.ReactNode }) => (
                <div className="group relative col-span-1 rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400 leading-tight">{label}</div>
                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-500 cursor-help">ⓘ</span>
                  </div>
                  {children}
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/98 p-3 text-xs text-slate-300 leading-relaxed shadow-2xl opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100">
                    {tooltip}
                    <div className="absolute left-1/2 -bottom-1.5 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-slate-700 bg-slate-950" />
                  </div>
                </div>
              );

              return (
                <>
                  {/* Cobertura ofensiva */}
                  <DashCard
                    label={lang === "es" ? "Cob. ofensiva" : "Off. coverage"}
                    tooltip={<>
                      <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Cobertura ofensiva" : "Offensive coverage"}</p>
                      <p>{lang === "es" ? "% de tipos contra los que tu equipo puede golpear de forma supereficaz con sus movimientos actuales." : "% of types your team can hit super-effectively with its current moves."}</p>
                      <p className="mt-1.5 text-slate-400">{lang === "es" ? "🟢 +80% excelente · 🟡 55–79% aceptable · 🔴 <55% hay huecos importantes" : "🟢 +80% great · 🟡 55–79% decent · 🔴 <55% significant gaps"}</p>
                    </>}
                  >
                    <div className="text-2xl font-bold text-slate-100">{dashboard.offPct}<span className="text-base text-slate-400 ml-0.5">%</span></div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${dashboard.offPct}%`, background: dashboard.offPct >= 80 ? "#16a34a" : dashboard.offPct >= 55 ? "#ca8a04" : "#dc2626" }} />
                    </div>
                    <div className="text-xs text-slate-400">{coverage.supCount}/{Object.keys(typeRelations).length} {lang === "es" ? "tipos" : "types"}</div>
                  </DashCard>

                  {/* Cobertura defensiva */}
                  <DashCard
                    label={lang === "es" ? "Cob. defensiva" : "Def. coverage"}
                    tooltip={<>
                      <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Cobertura defensiva" : "Defensive coverage"}</p>
                      <p>{lang === "es" ? "% de tipos cubiertos por resistencias o inmunidades del equipo. Cuanto más alto, menos flancos expuestos." : "% of types covered by team resistances or immunities. Higher means fewer exposed flanks."}</p>
                      <p className="mt-1.5 text-slate-400">{lang === "es" ? `${dashboard.defResistCount} tipos resistidos · ${dashboard.defWeakCount} debilidades netas` : `${dashboard.defResistCount} resisted types · ${dashboard.defWeakCount} net weaknesses`}</p>
                    </>}
                  >
                    <div className="text-2xl font-bold text-slate-100">{dashboard.defPct}<span className="text-base text-slate-400 ml-0.5">%</span></div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${dashboard.defPct}%`, background: dashboard.defPct >= 60 ? "#16a34a" : dashboard.defPct >= 40 ? "#ca8a04" : "#dc2626" }} />
                    </div>
                    <div className="text-xs text-slate-400">
                      <span className="text-emerald-400">{dashboard.defResistCount} resist</span>
                      {" · "}
                      <span className="text-red-400">{dashboard.defWeakCount} {lang === "es" ? "deb." : "weak"}</span>
                    </div>
                  </DashCard>

                  {/* Balance físico / especial */}
                  <DashCard
                    label={lang === "es" ? "Fís. / Esp." : "Phys / Spec"}
                    tooltip={<>
                      <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Balance físico / especial" : "Physical / Special balance"}</p>
                      <p>{lang === "es" ? "Distribución del daño entre movimientos físicos y especiales. Un equipo equilibrado dificulta que el rival se defienda con un solo stat." : "Distribution of damage between physical and special moves. A balanced team is harder to wall with a single defensive stat."}</p>
                      <p className="mt-1.5 text-slate-400">{lang === "es" ? "⚠ >65% en un lado = predecible · ✓ 35–65% = equilibrado" : "⚠ >65% one side = predictable · ✓ 35–65% = balanced"}</p>
                    </>}
                  >
                    <div className="flex items-end gap-1">
                      <span className="text-xl font-bold text-orange-400">{dashboard.physPct}%</span>
                      <span className="text-slate-500 text-base pb-0.5">/</span>
                      <span className="text-xl font-bold text-indigo-400">{dashboard.specPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-indigo-900/60 overflow-hidden">
                      <div className="h-full rounded-full transition-all bg-orange-500" style={{ width: `${dashboard.physPct}%` }} />
                    </div>
                    <div className="text-xs text-slate-400">
                      {dashboard.physPct > 65 ? (lang === "es" ? "⚠ Muy físico" : "⚠ Very physical") :
                       dashboard.specPct > 65 ? (lang === "es" ? "⚠ Muy especial" : "⚠ Very special") :
                       (lang === "es" ? "✓ Equilibrado" : "✓ Balanced")}
                    </div>
                  </DashCard>

                  {/* Velocidad media */}
                  <DashCard
                    label={lang === "es" ? "Vel. media" : "Avg speed"}
                    tooltip={<>
                      <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Velocidad media del equipo" : "Average team speed"}</p>
                      <p>{lang === "es" ? "Promedio del stat de Velocidad base de todos los Pokémon con stats definidos. Determina quién ataca primero en combate." : "Average base Speed stat across all Pokémon with defined stats. Determines who attacks first in battle."}</p>
                      <p className="mt-1.5 text-slate-400">{lang === "es" ? "🐢 <70 lento · 🚶 70–90 medio · 🏃 91–110 rápido · ⚡ >110 muy rápido" : "🐢 <70 slow · 🚶 70–90 mid · 🏃 91–110 fast · ⚡ >110 very fast"}</p>
                    </>}
                  >
                    <div className="text-2xl font-bold text-slate-100">{dashboard.avgSpe}</div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((dashboard.avgSpe / 180) * 100)}%`, backgroundColor: dashboard.speedTier.color }} />
                    </div>
                    <div className="text-xs font-semibold" style={{ color: dashboard.speedTier.color }}>{dashboard.speedTier.label}</div>
                  </DashCard>

                  {/* BST medio */}
                  <DashCard
                    label={lang === "es" ? "BST medio" : "Avg BST"}
                    tooltip={<>
                      <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "BST medio del equipo" : "Average team BST"}</p>
                      <p>{lang === "es" ? "Promedio del Base Stat Total (suma de los 6 stats base) de todos los Pokémon. Referencia del poder general del equipo, aunque no determina por sí solo su calidad competitiva." : "Average Base Stat Total (sum of 6 base stats) across the team. A reference for overall power, though it doesn't determine competitive quality on its own."}</p>
                      <p className="mt-1.5 text-slate-400">{lang === "es" ? "⚪ <480 bajo · 🟡 480–539 medio · 🔵 540+ alto (pseudo-legendario+)" : "⚪ <480 low · 🟡 480–539 mid · 🔵 540+ high (pseudo-legendary+)"}</p>
                    </>}
                  >
                    <div className="text-2xl font-bold text-slate-100">{dashboard.avgBST}</div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((dashboard.avgBST / 720) * 100)}%`, background: dashboard.avgBST >= 540 ? "#0891b2" : dashboard.avgBST >= 480 ? "#ca8a04" : "#6b7280" }} />
                    </div>
                    <div className="text-xs text-slate-400">
                      {dashboard.avgBST >= 540 ? (lang === "es" ? "Alto" : "High") : dashboard.avgBST >= 480 ? (lang === "es" ? "Medio" : "Mid") : (lang === "es" ? "Bajo" : "Low")}
                    </div>
                  </DashCard>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* Team Summary Panel — incluye análisis de tipo ideal + recomendaciones */}
      {teamSummary && (
        <div className="p-3 sm:p-4 pokedex-panel rounded-lg h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-slate-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 text-sm">🎯</span>
              <h2 className="text-base font-semibold tracking-tight">{t.summaryTitle}</h2>
            </div>
            {/* ── Análisis de tipo ideal ── */}
            <div className="grid gap-3 sm:grid-cols-2">
              {teamSummary.topTypes.length > 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 space-y-2">
                  <div className="text-[14px] uppercase tracking-[0.2em] text-slate-500">{t.bestSingle}</div>
                  {teamSummary.topTypes.slice(0, 2).map(({ type, defensiveCovers, offensiveCovers }) => (
                    <div key={type} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${badgeClass(type)} text-xs`}>{tn(type)}</span>
                        {teamSummary.neededRole?.role?.label && (
                          <RoleBadge label={teamSummary.neededRole.role.label} color={teamSummary.neededRole.role.color} size="text-[14px]" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                        {defensiveCovers.length > 0 && (
                          <span className="flex items-center gap-1 flex-wrap">{t.summaryResists}{defensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                        )}
                        {offensiveCovers.length > 0 && (
                          <span className="flex items-center gap-1 flex-wrap">{t.summaryCovers}{offensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0) && (
                <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-3 space-y-2">
                  <div className="text-[14px] uppercase tracking-[0.2em] text-blue-400">{t.bestDual}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {teamSummary.bestDual.types.map((ty) => (
                      <span key={ty} className={`${badgeClass(ty)} text-xs`}>{tn(ty)}</span>
                    ))}
                    {teamSummary.neededRole?.role?.label && (
                      <RoleBadge label={teamSummary.neededRole.role.label} color={teamSummary.neededRole.role.color} size="text-[14px]" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                    {teamSummary.bestDual.defensiveCovers.length > 0 && (
                      <span className="flex items-center gap-1 flex-wrap">{t.summaryResists}{teamSummary.bestDual.defensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                    )}
                    {teamSummary.bestDual.offensiveCovers.length > 0 && (
                      <span className="flex items-center gap-1 flex-wrap">{t.summaryCovers}{teamSummary.bestDual.offensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Tarjeta de recomendación */}
            <div className="mt-3 rounded-2xl border border-amber-600/30 bg-gradient-to-br from-amber-950/25 via-slate-900/60 to-slate-900/50 p-3.5 flex gap-3 shadow-sm shadow-black/20">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 text-lg">
                💡
              </span>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-[11px] uppercase tracking-[0.25em] text-amber-400 font-semibold">
                  {lang === "es" ? "Recomendación" : "Recommendation"}
                </div>
                <div className="text-sm text-slate-100 leading-relaxed">
                  {(() => {
                    const primaryType = teamSummary.topTypes[0]?.type;
                    const hasDual = !!(teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0));
                    const dualTypes = teamSummary.bestDual?.types ?? [];
                    const role = teamSummary.neededRole?.role;
                    const TypeBadge = ({ ty }: { ty: string }) => (
                      <span className={`${badgeClass(ty)} text-xs mx-0.5 align-middle whitespace-nowrap`}>{tn(ty)}</span>
                    );
                    const DualTypeBadges = () => (
                      <>
                        {dualTypes.map((ty, i) => (
                          <React.Fragment key={ty}>
                            <TypeBadge ty={ty} />
                            {i < dualTypes.length - 1 && <span className="text-slate-500 mx-0.5">/</span>}
                          </React.Fragment>
                        ))}
                      </>
                    );

                    if (role?.label) {
                      return (
                        <>
                          {lang === "es" ? "Tu equipo se beneficiaría de un Pokémon con rol de " : "Your team would benefit from a Pokémon with the "}
                          <span className="inline-flex align-middle mx-0.5">
                            <RoleBadge label={role.label} color={role.color} size="text-[13px]" />
                          </span>
                          {lang === "en" ? " role" : ""}
                          {primaryType && (
                            <>
                              {lang === "es" ? ", preferiblemente de tipo " : ", ideally "}
                              <TypeBadge ty={primaryType} />
                              {lang === "en" ? " type" : ""}
                              {hasDual && (
                                <>
                                  {lang === "es" ? " o doble tipo " : " or dual "}
                                  <DualTypeBadges />
                                </>
                              )}
                            </>
                          )}
                          {"."}
                        </>
                      );
                    }

                    return (
                      <>
                        {lang === "es" ? "Considera añadir un Pokémon de tipo " : "Consider adding a "}
                        {primaryType && <TypeBadge ty={primaryType} />}
                        {lang === "en" ? " type Pokémon" : ""}
                        {hasDual && (
                          <>
                            {lang === "es" ? " o doble tipo " : " or dual "}
                            <DualTypeBadges />
                          </>
                        )}
                        {lang === "es" ? " para equilibrar el equipo." : " to balance the team."}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
      )}
      </div>
      )}
      {/* ── ¿QUIÉN CONVIENE REEMPLAZAR? ─────────────────────────────── */}
      {(
      <div className="pokedex-panel p-3 sm:p-4 rounded-lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 text-sm">🔁</span>
            <h2 className="text-base font-semibold tracking-tight text-slate-100">
              {lang === "es" ? "¿Quién conviene reemplazar?" : "Who should you replace?"}
            </h2>
          </div>
          {!isAdvanced && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-700/50 bg-sky-950/40 px-4 py-3 text-[14px] sm:text-[15px] leading-relaxed text-sky-200">
              <span className="shrink-0 text-xl leading-none">💡</span>
              <span>{t.guideReplaceSection}</span>
            </div>
          )}
          <p className="text-xs text-slate-400 -mt-1">
            {lang === "es"
              ? "Ordenado de menor a mayor aporte real al equipo (cobertura única, redundancia, debilidades compartidas y stats totales)."
              : "Sorted from least to most real contribution to the team (unique coverage, redundancy, shared weaknesses, and total stats)."}
          </p>
          {teamContribution.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-sm gap-2 text-center">
              <span className="text-2xl">🔁</span>
              <span>
                {lang === "es"
                  ? "Agrega al menos 3 Pokémon con tipo para ver a quién conviene reemplazar."
                  : "Add at least 3 Pokémon with a type to see who's worth replacing."}
              </span>
            </div>
          ) : (
          (() => {
            const [worst, ...rest] = teamContribution;
            const isActuallyWeakest = rest.length > 0 ? worst.value < rest[0].value : true;
            const handleRemove = (idx: number) => updateSlot(idx, { name: "" });

            return (
              <div className="space-y-3">
                <ContributionCard
                  entry={worst}
                  rank={0}
                  highlight={isActuallyWeakest}
                  lang={lang}
                  tn={tn}
                  badgeClass={badgeClass}
                  onRemove={handleRemove}
                />
                {rest.length > 0 && (
                  <>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowRestContribution((v) => !v)}
                        className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:border-slate-500 hover:bg-slate-800/60 transition-colors"
                      >
                        <span className={`inline-block transition-transform ${showRestContribution ? "rotate-180" : ""}`}>▾</span>
                        {showRestContribution
                          ? (lang === "es" ? "Ocultar el resto del equipo" : "Hide the rest of the team")
                          : (lang === "es" ? "Ver el resto del equipo" : "Show the rest of the team")}
                      </button>
                    </div>
                    {showRestContribution && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {rest.map((entry, i) => (
                          <ContributionCard
                            key={entry.idx}
                            entry={entry}
                            rank={i + 1}
                            highlight={false}
                            lang={lang}
                            tn={tn}
                            badgeClass={badgeClass}
                            onRemove={handleRemove}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()
          )}
        </div>
      </div>
      )}
      {/* ── POKÉMON RECOMENDADOS (fila 2 — ancho completo) ───────────── */}
      {(
      <div className="pokedex-panel p-3 sm:p-4 rounded-lg">
            {/* ── Pokémon recomendados ── */}
            <div className="space-y-3">
              {/* Header: título a la izquierda, botones de filtro a la derecha, todo en la misma fila */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 text-sm">⭐</span>
                  <h2 className="text-base font-semibold tracking-tight text-slate-100">{t.recommendedPokemon}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(recDiscarded.size > 0 || recFilterTypes.length > 0 || recFilterType2 || recFilterAbility.trim() !== "" || recFilterGen !== null || (isAdvanced && recFilterRoleManual !== null) || recFilterSortStat !== null || Object.values(recFilterMinStats).some((v) => v.trim() !== "") || recFilterMoves.length > 0) && (
                    <button
                      type="button"
                      onClick={() => { setRecDiscarded(new Set()); setRecFilterTypes([]); setRecFilterType2(""); setRecFilterAbility(""); setRecFilterGen(null); setRecFilterRoleManual(null); setRecFilterSortStat(null); setRecFilterMinStats(EMPTY_STAT_INPUT); setRecFilterMoves([]); }}
                      className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition"
                    >
                      {t.recFilterReset}
                      {recDiscarded.size > 0 && ` (${recDiscarded.size} ${t.recFilterDiscarded})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRecShowFilters((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${recShowFilters || recFilterTypes.length > 0 || recFilterType2 || recFilterAbility.trim() !== "" || recFilterGen !== null || recFilterSortStat !== null || Object.values(recFilterMinStats).some((v) => v.trim() !== "") || recFilterMoves.length > 0 ? "border-sky-600 bg-sky-900/40 text-sky-300" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                  >
                    🔍 {t.recFilterTitle}
                    {(recFilterTypes.length > 0 || recFilterType2 || recFilterAbility.trim() !== "" || recFilterGen !== null || recFilterSortStat !== null || Object.values(recFilterMinStats).some((v) => v.trim() !== "") || recFilterMoves.length > 0) && (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] text-white font-bold">
                        {recFilterTypes.length + (recFilterType2 ? 1 : 0) + (recFilterAbility.trim() !== "" ? 1 : 0) + (recFilterGen !== null ? 1 : 0) + (recFilterSortStat !== null ? 1 : 0) + Object.values(recFilterMinStats).filter((v) => v.trim() !== "").length + recFilterMoves.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              {!isAdvanced && (
                <div className="flex items-start gap-3 rounded-xl border border-sky-700/50 bg-sky-950/40 px-4 py-3 text-[14px] sm:text-[15px] leading-relaxed text-sky-200">
                  <span className="shrink-0 text-xl leading-none">💡</span>
                  <span>{t.guideRecommendedSection}</span>
                </div>
              )}

              {/* Panel de filtros desplegable */}
              {recShowFilters && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                    {/* ══════════ COLUMNA IZQUIERDA ══════════ */}
                    <div className="space-y-2 md:pr-2 md:border-r md:border-slate-800">
                      {/* Switches rápidos */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pb-2 border-b border-slate-800/80">
                        {[
                          ...(activePokedex === "pokemon-z" ? [{ key: "onlyOriginals", emoji: "📘", label: lang === "es" ? `${POKEDEX_OPTIONS.find(p => p.id === activePokedex)?.label ?? activePokedex} ${t.recFilterOnlyOriginals}` : `Original ${POKEDEX_OPTIONS.find(p => p.id === activePokedex)?.label ?? activePokedex}`, value: recFilterOnlyOriginals, setter: setRecFilterOnlyOriginals as (v: boolean) => void }] : []),
                          { key: "finalEvo", emoji: "🌟", label: t.recFilterFinalEvo, value: recFilterFinalEvo, setter: setRecFilterFinalEvo },
                          { key: "prioritizeCoverage", emoji: "🛡️", label: t.recFilterPrioritizeCoverage, value: recFilterPrioritizeCoverage, setter: setRecFilterPrioritizeCoverage },
                          { key: "noDup", emoji: "🚫", label: t.recFilterNoDupTypes, value: recFilterNoDupTypes, setter: setRecFilterNoDupTypes },
                          { key: "legendary", emoji: "👑", label: t.recFilterLegendary, value: recFilterLegendary, setter: setRecFilterLegendary },
                          ...(activePokedex === "pokemon-z"
                            ? [
                                { key: "zMega", emoji: "💠", label: lang === "es" ? "Mostrar Megas" : "Show Megas", value: recFilterZShowMega, setter: setRecFilterZShowMega },
                              ]
                            : [
                                { key: "stdMega", emoji: "💠", label: lang === "es" ? "Mostrar Megas" : "Show Megas", value: recFilterShowMega, setter: setRecFilterShowMega },
                                { key: "stdGmax", emoji: "🌀", label: lang === "es" ? "Mostrar Gigamax" : "Show Gigantamax", value: recFilterShowGmax, setter: setRecFilterShowGmax },
                              ]),
                        ]
                          .filter((sw) => isAdvanced || (sw.key !== "noDup" && sw.key !== "prioritizeCoverage"))
                          .map(({ key, emoji, label, value, setter }) => (
                          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={value}
                              onClick={() => setter(!value)}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${value ? "bg-gradient-to-r from-sky-500 to-sky-400" : "bg-slate-700"}`}
                            >
                              <span
                                className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${value ? "translate-x-[22px]" : "translate-x-1"}`}
                              />
                            </button>
                            <span className="text-[15px] text-slate-300 leading-none whitespace-nowrap">
                              <span className="mr-1">{emoji}</span>{label}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* Filtro por tipo — doble tipo */}
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterType}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {allTypes.map((type) => {
                            const active = recFilterTypes.includes(type);
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  setRecFilterTypes((prev) =>
                                    active ? prev.filter((t) => t !== type) : [type]
                                  );
                                  if (active) setRecFilterType2("");
                                }}
                                className={`${badgeClass(type)} text-[14px] leading-none px-2.5 py-2 transition ${active ? "ring-2 ring-white/40 scale-105" : "opacity-50 hover:opacity-80"}`}
                              >
                                {tn(type)}
                              </button>
                            );
                          })}
                        </div>
                        {recFilterTypes.length > 0 && (
                          <div className="mt-1.5">
                            <div className="text-[13px] uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                              {lang === "es" ? "Segundo tipo (opcional)" : "Second type (optional)"}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {allTypes
                                .filter((type) => type !== recFilterTypes[0])
                                .map((type) => {
                                  const active = recFilterType2 === type;
                                  return (
                                    <button
                                      key={type}
                                      type="button"
                                      onClick={() => setRecFilterType2(active ? "" : type)}
                                      className={`${badgeClass(type)} text-[14px] leading-none px-2.5 py-2 transition ${active ? "ring-2 ring-white/40 scale-105" : "opacity-40 hover:opacity-70"}`}
                                    >
                                      {tn(type)}
                                    </button>
                                  );
                                })}
                            </div>
                            {recFilterType2 && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-400">
                                <span>{lang === "es" ? "Mostrando:" : "Showing:"}</span>
                                <span className={`${badgeClass(recFilterTypes[0])} text-[12px] leading-none px-1.5 py-1`}>{tn(recFilterTypes[0])}</span>
                                <span className="text-slate-500">/</span>
                                <span className={`${badgeClass(recFilterType2)} text-[12px] leading-none px-1.5 py-1`}>{tn(recFilterType2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Filtro por habilidad — con autocompletado (modo avanzado, columna izquierda) */}
                      {isAdvanced && (
                      <div className="relative">
                        <div className="mb-1.5 text-[13px] uppercase tracking-[0.15em] text-slate-500">
                          {lang === "es" ? "Buscar por habilidad" : "Search by ability"}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={recFilterAbility}
                            maxLength={50}
                            onChange={(e) => {
                              setRecFilterAbility(e.target.value);
                              setRecFilterAbilityOpen(e.target.value.trim().length >= 2);
                              setRecFilterAbilitySelectedIdx(-1);
                            }}
                            onFocus={() => {
                              if (recFilterAbility.trim().length >= 2) setRecFilterAbilityOpen(true);
                            }}
                            onBlur={() => {
                              // Delay para permitir que el click en una sugerencia registre antes de cerrar
                              setTimeout(() => setRecFilterAbilityOpen(false), 150);
                            }}
                            onKeyDown={(e) => {
                              if (!recFilterAbilityOpen || recFilterAbilitySuggestions.length === 0) return;
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setRecFilterAbilitySelectedIdx((prev) => Math.min(prev + 1, recFilterAbilitySuggestions.length - 1));
                              } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setRecFilterAbilitySelectedIdx((prev) => Math.max(prev - 1, -1));
                              } else if (e.key === "Enter") {
                                e.preventDefault();
                                if (recFilterAbilitySelectedIdx >= 0) {
                                  setRecFilterAbility(recFilterAbilitySuggestions[recFilterAbilitySelectedIdx]);
                                  setRecFilterAbilityOpen(false);
                                }
                              } else if (e.key === "Escape") {
                                setRecFilterAbilityOpen(false);
                              }
                            }}
                            placeholder={lang === "es" ? "Ej. Adaptable, Intimidación…" : "E.g. Adaptability, Intimidate…"}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-3 pr-9 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                          />
                          <button
                            type="button"
                            onClick={() => { setRecAbilityModalSearch(""); setRecAbilityModalDescSearch(""); setRecAbilityModalOpen(true); }}
                            title={lang === "es" ? "Explorar habilidades" : "Browse abilities"}
                            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                          >
                            🔎
                          </button>
                        </div>
                        {recFilterAbilityOpen && recFilterAbilitySuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 text-sm shadow-xl" onMouseDown={(e) => e.preventDefault()}>
                            {recFilterAbilitySuggestions.map((ab, i) => (
                              <button
                                key={ab}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setRecFilterAbility(ab);
                                  setRecFilterAbilityOpen(false);
                                }}
                                onMouseEnter={() => setRecFilterAbilitySelectedIdx(i)}
                                className={`w-full px-3 py-2 text-left ${
                                  recFilterAbilitySelectedIdx === i ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                                }`}
                              >
                                {ab}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Filtro por movimiento — hasta 4 a la vez, el candidato debe
                          aprenderlos TODOS (modo avanzado, ambas pokédex) */}
                      {isAdvanced && (activePokedex === "pokemon-z" ? movesZData.length > 0 : movesStandardData.length > 0) && (
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">
                          {lang === "es" ? "Buscar por movimiento" : "Search by move"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recFilterMoves.map((mvName) => {
                            const mv = (activePokedex === "pokemon-z" ? movesZData : movesStandardData).find((m: any) => m.internalName === mvName);
                            const label = mv ? (lang === "es" ? mv.name : mv.nameEn) : mvName;
                            return (
                              <span
                                key={mvName}
                                className="inline-flex items-center gap-1.5 rounded-full border border-sky-700/50 bg-sky-900/30 px-2.5 py-1.5 text-[14px] leading-none text-sky-200"
                              >
                                {label}
                                <button
                                  type="button"
                                  onClick={() => setRecFilterMoves((prev) => prev.filter((m) => m !== mvName))}
                                  className="text-sky-400 hover:text-sky-100"
                                  aria-label={lang === "es" ? "Quitar" : "Remove"}
                                >
                                  ✕
                                </button>
                              </span>
                            );
                          })}
                          {recFilterMoves.length < 4 && (
                            <button
                              type="button"
                              onClick={() => setRecFilterMoveModalOpen(true)}
                              className="rounded-full border border-dashed border-slate-600 px-2.5 py-1.5 text-[14px] leading-none text-slate-400 transition hover:border-sky-500 hover:text-sky-300"
                            >
                              + {lang === "es" ? "Añadir movimiento" : "Add move"}
                            </button>
                          )}
                        </div>
                        {recFilterMoves.length > 0 && (
                          <div className="mt-1.5 text-[12px] text-slate-500">
                            {lang === "es" ? "Debe poder aprender todos los movimientos seleccionados." : "Must be able to learn all selected moves."}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Filtro por generación (modo avanzado, columna izquierda) — al final de la columna */}
                      {isAdvanced && (
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterGen}</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRecFilterGen(null)}
                            className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                          >
                            {t.recFilterGenAll}
                          </button>
                          {GEN_RANGES.map(({ gen, label }) => (
                            <button
                              key={gen}
                              type="button"
                              onClick={() => setRecFilterGen(recFilterGen === gen ? null : gen)}
                              className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === gen ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      )}
                    </div>

                    {/* ══════════ COLUMNA DERECHA ══════════ */}
                    <div className="space-y-2">
                      {/* Filtro por rol */}
                      {isAdvanced && (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500">
                            {lang === "es" ? "Filtrar por rol" : "Filter by role"}
                          </div>
                          <button
                            type="button"
                            onClick={() => setRoleFilterLegendOpen((v) => !v)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${roleFilterLegendOpen ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-sky-700/60 bg-sky-950/40 text-sky-300 hover:border-sky-500 hover:bg-sky-900/50 hover:text-sky-100"}`}
                          >
                            <span className="text-[14px]">ⓘ</span>
                            {lang === "es" ? "¿Qué significa cada rol?" : "What does each role mean?"}
                            <span className={`text-[12px] transition-transform ${roleFilterLegendOpen ? "rotate-180" : ""}`}>▾</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRecFilterRoleManual(null)}
                            className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterRoleManual === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                          >
                            {lang === "es" ? "Cualquier rol" : "Any role"}
                          </button>
                          {[...ROLES, BALANCED_ROLE].map((role) => {
                            const label = role[lang as "es" | "en"];
                            const active = recFilterRoleManual === label;
                            return (
                              <button
                                key={role.en}
                                type="button"
                                onClick={() => setRecFilterRoleManual(active ? null : label)}
                                className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${active ? "" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                                style={active ? { borderColor: role.color, backgroundColor: `${role.color}22`, color: role.color } : {}}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {roleFilterLegendOpen && (
                          <div className="mt-2 space-y-1.5 rounded-lg border border-slate-700/60 bg-slate-900/70 p-2.5">
                            {[...ROLES, BALANCED_ROLE].map((role) => {
                              const label = role[lang as "es" | "en"];
                              const keyStats = (Object.entries(role.weights) as [keyof BaseStats, number][])
                                .filter(([, w]) => (w ?? 0) > 0)
                                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
                              const statNames = STAT_NAMES_I18N[lang];
                              return (
                                <div key={role.en} className="text-[14px] leading-snug">
                                  <div className="flex flex-wrap items-baseline gap-1.5">
                                    <span className="font-semibold" style={{ color: role.color }}>{label}:</span>
                                    <span className="text-slate-400">{lang === "es" ? role.descEs : role.descEn}</span>
                                  </div>
                                  {keyStats.length > 0 && (
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                      {keyStats.map(([statKey]) => (
                                        <span
                                          key={statKey}
                                          className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-slate-200"
                                        >
                                          {statNames[statKey]}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Ordenar por stat más alta */}
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterSortStatTitle}</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRecFilterSortStat(null)}
                            className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterSortStat === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                          >
                            {t.recFilterSortStatNone}
                          </button>
                          {statLabels.map(([key, label]) => {
                            const active = recFilterSortStat === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => toggleRecFilterSortStat(key)}
                                className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${active ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* En modo sencillo: habilidad y generación se muestran acá, a la derecha */}
                      {!isAdvanced && (
                        <>
                          <div className="relative">
                            <div className="mb-1.5 text-[13px] uppercase tracking-[0.15em] text-slate-500">
                              {lang === "es" ? "Buscar por habilidad" : "Search by ability"}
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={recFilterAbility}
                                maxLength={50}
                                onChange={(e) => {
                                  setRecFilterAbility(e.target.value);
                                  setRecFilterAbilityOpen(e.target.value.trim().length >= 2);
                                  setRecFilterAbilitySelectedIdx(-1);
                                }}
                                onFocus={() => {
                                  if (recFilterAbility.trim().length >= 2) setRecFilterAbilityOpen(true);
                                }}
                                onBlur={() => {
                                  setTimeout(() => setRecFilterAbilityOpen(false), 150);
                                }}
                                onKeyDown={(e) => {
                                  if (!recFilterAbilityOpen || recFilterAbilitySuggestions.length === 0) return;
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setRecFilterAbilitySelectedIdx((prev) => Math.min(prev + 1, recFilterAbilitySuggestions.length - 1));
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setRecFilterAbilitySelectedIdx((prev) => Math.max(prev - 1, -1));
                                  } else if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (recFilterAbilitySelectedIdx >= 0) {
                                      setRecFilterAbility(recFilterAbilitySuggestions[recFilterAbilitySelectedIdx]);
                                      setRecFilterAbilityOpen(false);
                                    }
                                  } else if (e.key === "Escape") {
                                    setRecFilterAbilityOpen(false);
                                  }
                                }}
                                placeholder={lang === "es" ? "Ej. Adaptable, Intimidación…" : "E.g. Adaptability, Intimidate…"}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-3 pr-9 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                              />
                              <button
                                type="button"
                                onClick={() => { setRecAbilityModalSearch(""); setRecAbilityModalDescSearch(""); setRecAbilityModalOpen(true); }}
                                title={lang === "es" ? "Explorar habilidades" : "Browse abilities"}
                                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                              >
                                🔎
                              </button>
                            </div>
                            {recFilterAbilityOpen && recFilterAbilitySuggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 text-sm shadow-xl" onMouseDown={(e) => e.preventDefault()}>
                                {recFilterAbilitySuggestions.map((ab, i) => (
                                  <button
                                    key={ab}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setRecFilterAbility(ab);
                                      setRecFilterAbilityOpen(false);
                                    }}
                                    onMouseEnter={() => setRecFilterAbilitySelectedIdx(i)}
                                    className={`w-full px-3 py-2 text-left ${
                                      recFilterAbilitySelectedIdx === i ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                                    }`}
                                  >
                                    {ab}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterGen}</div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setRecFilterGen(null)}
                                className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                              >
                                {t.recFilterGenAll}
                              </button>
                              {GEN_RANGES.map(({ gen, label }) => (
                                <button
                                  key={gen}
                                  type="button"
                                  onClick={() => setRecFilterGen(recFilterGen === gen ? null : gen)}
                                  className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === gen ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Mínimos por stat — 2 filas de 3, compacto (solo modo avanzado) */}
                      {isAdvanced && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="flex items-baseline justify-between">
                          <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1">{t.recFilterMinStatsTitle}</div>
                          <div className="text-[12px] text-slate-500 mb-1">{t.recFilterMinStatsNote}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {statLabels.map(([key, label]) => {
                            const disabled = recFilterSortStat === key;
                            return (
                              <label key={key} className={`text-[13px] ${disabled ? "opacity-40" : ""}`}>
                                <span className="text-slate-400 block leading-none mb-1">{label}</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={255}
                                  disabled={disabled}
                                  value={recFilterMinStats[key]}
                                  onChange={(e) => setRecFilterMinStats((prev) => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="-"
                                  className="w-full rounded-md border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-[14px] text-slate-100 outline-none transition focus:border-sky-500 disabled:cursor-not-allowed"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de recomendaciones — grid compacto */}
              {pokemonRecommendations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 items-stretch">
                  {pokemonRecommendations.map(({ candidate, name, reasons, noNewCritical, addsResistances, immunities, newResistances, reduces, neededRole, realRole, candidateFitsRole }) => {
                    const allCandidateWeaknesses = getCandidateWeaknesses(candidate.types as string[], typeRelations);
                    const reasonWeakTypes = new Set(reasons.filter((r) => !r.positive).map((r) => r.weakType));
                    const candidateWeaknesses = allCandidateWeaknesses.filter((ty) => !reasonWeakTypes.has(ty));
                    const reasonTypes = new Set(reasons.map((r) => r.weakType));
                    const extraImmunities = immunities.filter((ty) => !reasonTypes.has(ty));
                    const extraResistances = newResistances.filter((ty) => !immunities.includes(ty) && !reasonTypes.has(ty));

                    const groupedReasons: Array<{ positive: boolean; isImmune?: boolean; types: string[] }> = [];
                    reasons.forEach((r) => {
                      const last = groupedReasons[groupedReasons.length - 1];
                      if (last && last.positive === r.positive && !!last.isImmune === !!r.isImmune) {
                        last.types.push(r.weakType);
                      } else {
                        groupedReasons.push({ positive: r.positive, isImmune: r.isImmune, types: [r.weakType] });
                      }
                    });

                    // Filas fijas Inmune / Cubre / Añade, siempre en el mismo orden
                    // y siempre presentes (aunque vacías) para que todas las tarjetas
                    // midan lo mismo sin depender de items-stretch.
                    const immuneTypes: string[] = [];
                    const coverTypes: string[] = [];
                    const addTypes: string[] = [];
                    groupedReasons.forEach((g) => {
                      const arr = g.isImmune ? immuneTypes : g.positive ? coverTypes : addTypes;
                      g.types.forEach((ty) => { if (!arr.includes(ty)) arr.push(ty); });
                    });
                    const fixedReasonRows = [
                      { key: "immune", label: lang === "es" ? "Inmune" : "Immune", icon: "🛡️", labelCl: "text-blue-400", types: immuneTypes },
                      { key: "cover", label: lang === "es" ? "Cubre" : "Covers", icon: "✅", labelCl: "text-emerald-400", types: coverTypes },
                      { key: "add", label: lang === "es" ? "Añade" : "Adds", icon: "⚠️", labelCl: "text-amber-400", types: addTypes },
                    ];

                    const isExpanded = expandedRec.has(candidate.slug);
                    const toggleExpanded = () => setExpandedRec((prev) => {
                      const next = new Set(prev);
                      next.has(candidate.slug) ? next.delete(candidate.slug) : next.add(candidate.slug);
                      return next;
                    });

                    // Todas las resistencias e inmunidades del candidato (para el panel expandido)
                    const allResistances = newResistances.filter((ty) => !immunities.includes(ty));

                    return (
                      <div key={candidate.slug} className="h-full flex flex-col rounded-xl border border-blue-800/20 bg-slate-900/75 overflow-hidden min-w-0">

                        {/* ── CUERPO PRINCIPAL: sprite izq + info der ── */}
                        <div className="flex flex-1 min-h-0">

                          {/* Columna izquierda: sprite cuadrado fijo con fondo de color del tipo primario */}
                          <div className="shrink-0 w-44 self-stretch bg-[#031421] flex items-center justify-center rounded-tl-xl overflow-hidden relative">
                            {/* Círculo de color del tipo primario como fondo */}
                            <div
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              aria-hidden="true"
                            >
                              <div
                                className="w-36 h-36 rounded-full opacity-15"
                                style={{ background: TYPE_COLORS[candidate.types[0]] ?? "#334155" }}
                              />
                            </div>
                            {/* Spinner mientras carga el sprite Z */}
                            {activePokedex === "pokemon-z" && !zSpritesTrimmed[String(candidate.id)] && !zSpritesCache[String(candidate.id)] && (
                              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="#334155" strokeWidth="3" />
                                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                              </div>
                            )}
                            <img
                              src={
                                activePokedex === "pokemon-z"
                                  ? (zSpritesTrimmed[String(candidate.id)] ?? zSpritesCache[String(candidate.id)] ?? "")
                                  : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${candidate.id}.png`
                              }
                              alt={name}
                              className="relative z-10"
                              style={{
                                imageRendering: "pixelated",
                                ...(activePokedex === "pokemon-z"
                                  ? (() => {
                                      const size = zSpriteNaturalSizes[String(candidate.id)];
                                      // Escalar al doble del tamaño trimmeado, con techo en 112px,
                                      // para que los sprites pequeños no queden diminutos.
                                      const base = size ? Math.min(size * 2, 112) : 80;
                                      // Zoom extra puntual para sprites cuyo arte deja margen
                                      // vacío dentro del bounding box (ver Z_SPRITE_ZOOM_OVERRIDES).
                                      const zoom = Z_SPRITE_ZOOM_OVERRIDES[candidate.id] ?? 1;
                                      const display = Math.min(base * zoom, 128);
                                      return { width: display, height: display, objectFit: "contain" as const };
                                    })()
                                  : { width: 128, height: 128, objectFit: "contain" as const }),
                              }}
                              onLoad={(e) => {
                                if (activePokedex !== "pokemon-z") return;
                                const key = String(candidate.id);
                                // Si ya está trimmeado, solo actualizar el tamaño
                                if (zSpritesTrimmed[key]) {
                                  const img = e.target as HTMLImageElement;
                                  setZSpriteNaturalSizes((prev) => ({ ...prev, [key]: img.naturalHeight }));
                                  return;
                                }
                                const img = e.target as HTMLImageElement;
                                const w = img.naturalWidth;
                                const h = img.naturalHeight;
                                if (w === 0 || h === 0) return;
                                try {
                                  // Dibujar en canvas para leer píxeles
                                  const canvas = document.createElement("canvas");
                                  canvas.width = w;
                                  canvas.height = h;
                                  const ctx = canvas.getContext("2d");
                                  if (!ctx) return;
                                  ctx.drawImage(img, 0, 0);
                                  const data = ctx.getImageData(0, 0, w, h).data;
                                  // Detectar bounding box de píxeles no-transparentes
                                  let minX = w, minY = h, maxX = 0, maxY = 0;
                                  for (let y = 0; y < h; y++) {
                                    for (let x = 0; x < w; x++) {
                                      const alpha = data[(y * w + x) * 4 + 3];
                                      if (alpha > 10) { // umbral de 10 para ignorar semi-transparencia
                                        if (x < minX) minX = x;
                                        if (x > maxX) maxX = x;
                                        if (y < minY) minY = y;
                                        if (y > maxY) maxY = y;
                                      }
                                    }
                                  }
                                  if (maxX < minX || maxY < minY) return; // sprite vacío
                                  // Recortar al bounding box con 2px de padding
                                  const PAD = 2;
                                  const cx = Math.max(0, minX - PAD);
                                  const cy = Math.max(0, minY - PAD);
                                  const cw = Math.min(w, maxX + PAD + 1) - cx;
                                  const ch = Math.min(h, maxY + PAD + 1) - cy;
                                  // Centrar en un canvas cuadrado (lado = max(cw, ch))
                                  const side = Math.max(cw, ch);
                                  const out = document.createElement("canvas");
                                  out.width = side;
                                  out.height = side;
                                  const octx = out.getContext("2d");
                                  if (!octx) return;
                                  octx.drawImage(canvas, cx, cy, cw, ch,
                                    Math.floor((side - cw) / 2), Math.floor((side - ch) / 2), cw, ch);
                                  const trimmedUrl = out.toDataURL("image/png");
                                  setZSpritesTrimmed((prev) => ({ ...prev, [key]: trimmedUrl }));
                                  setZSpriteNaturalSizes((prev) => ({ ...prev, [key]: side }));
                                } catch {
                                  // CORS u otro error: usar tamaño original sin trim
                                  setZSpriteNaturalSizes((prev) => ({ ...prev, [key]: h }));
                                }
                              }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>

                          {/* Columna derecha: toda la info */}
                          <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">

                            {/* Fila 1: Nombre + tooltip de stats + botón descartar */}
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[15px] font-bold text-white leading-tight truncate">{name}</span>
                                {candidate.stats && isAdvanced && (
                                  <FloatingTooltip
                                    preferredPlacement="right"
                                    content={
                                      <div className="w-64 rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-xl shadow-black/50 text-sm text-slate-100">
                                        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-2">
                                          {lang === "es" ? "Stats base" : "Base stats"}
                                        </div>
                                        <div className="space-y-1.5">
                                          {statLabels.map(([key]) => {
                                            const value = candidate.stats![key];
                                            const statNames = STAT_NAMES_I18N[lang];
                                            return (
                                              <div key={key} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-[12px] text-slate-300">
                                                  <span className="uppercase tracking-wide">{statNames[key]}</span>
                                                  <span className="font-semibold tabular-nums">{value}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-slate-800">
                                                  <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }}
                                                  />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                                          <span>{lang === "es" ? "Total" : "Total"}</span>
                                          <span className="font-semibold text-slate-300 tabular-nums">
                                            {STAT_ORDER.reduce((sum, k) => sum + (candidate.stats![k] ?? 0), 0)}
                                          </span>
                                        </div>
                                      </div>
                                    }
                                  >
                                    <span
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[12px] text-slate-300 cursor-pointer"
                                    >ⓘ</span>
                                  </FloatingTooltip>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => addCandidateToTeam(candidate)}
                                  title={lang === "es" ? "Agregar al equipo" : "Add to team"}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/40 hover:bg-emerald-500 hover:text-white hover:ring-emerald-400 transition text-[14px] leading-none font-semibold"
                                >+</button>
                                <button
                                  type="button"
                                  onClick={() => setRecDiscarded((prev) => new Set([...prev, candidate.slug]))}
                                  title={t.recFilterDiscard}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition text-[11px]"
                                >✕</button>
                              </div>
                            </div>

                            {/* Fila 2: Tipos del Pokémon */}
                            <div className="flex flex-wrap gap-1">
                              {candidate.types.map((ty) => (
                                <span key={ty} className={`${badgeClass(ty)} text-[11px] px-2 py-0.5`}>{tn(ty)}</span>
                              ))}
                            </div>

                            {/* Fila 2.5: Habilidades del candidato (normales + oculta, si tiene) */}
                            {((candidate.abilities && candidate.abilities.length > 0) || candidate.hiddenAbility) && (
                              <div className="flex flex-wrap gap-1">
                                {(candidate.abilities ?? []).map((ab) => (
                                  <FloatingTooltip
                                    key={ab}
                                    preferredPlacement="top"
                                    content={
                                      <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                          {activePokedex === "pokemon-z" ? getAbilityDisplayName(ab) : getStdAbilityLabel(ab)}
                                        </div>
                                        <div>
                                          {activePokedex === "pokemon-z"
                                            ? (lang === "es" ? abilitiesZDescData[ab]?.description : (abilitiesZDescData[ab]?.descriptionEn ?? abilitiesZDescData[ab]?.description)) ?? ""
                                            : getStdAbilityDescription(ab)}
                                        </div>
                                      </div>
                                    }
                                  >
                                    <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-300 cursor-default">
                                      {activePokedex === "pokemon-z" ? getAbilityDisplayName(ab) : getStdAbilityLabel(ab)}
                                    </span>
                                  </FloatingTooltip>
                                ))}
                                {candidate.hiddenAbility && (
                                  <FloatingTooltip
                                    preferredPlacement="top"
                                    content={
                                      <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                          {activePokedex === "pokemon-z" ? getAbilityDisplayName(candidate.hiddenAbility) : getStdAbilityLabel(candidate.hiddenAbility)}
                                          {" "}({lang === "es" ? "oculta" : "hidden"})
                                        </div>
                                        <div>
                                          {activePokedex === "pokemon-z"
                                            ? (lang === "es" ? abilitiesZDescData[candidate.hiddenAbility]?.description : (abilitiesZDescData[candidate.hiddenAbility]?.descriptionEn ?? abilitiesZDescData[candidate.hiddenAbility]?.description)) ?? ""
                                            : getStdAbilityDescription(candidate.hiddenAbility)}
                                        </div>
                                      </div>
                                    }
                                  >
                                    <span
                                      className="rounded-full border border-dashed border-slate-600 bg-slate-800/30 px-2 py-0.5 text-[10px] font-medium text-slate-400 cursor-default"
                                    >
                                      {activePokedex === "pokemon-z" ? getAbilityDisplayName(candidate.hiddenAbility) : getStdAbilityLabel(candidate.hiddenAbility)}
                                    </span>
                                  </FloatingTooltip>
                                )}
                              </div>
                            )}

                            {/* Fila 3: Rol del candidato (solo modo avanzado; requiere entender el sistema de roles) */}
                            {isAdvanced && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {realRole ? (
                                <>
                                  <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500 shrink-0">{t.recRealRole}</span>
                                  <RoleBadge label={realRole.label} color={realRole.color} size="text-[10px]" />
                                </>
                              ) : neededRole ? (
                                <>
                                  <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500 shrink-0">{t.recRole}</span>
                                  <RoleBadge label={neededRole.label} color={neededRole.color} size="text-[10px]" />
                                </>
                              ) : null}
                            </div>
                            )}

                            {/* Separador */}
                            <div className="border-t border-slate-800/60" />

                            {/* Fila 4: Razones — etiqueta corta fija + badges.
                                Siempre se reservan 3 filas de altura (Inmune/Cubre/Añade) para
                                que todas las tarjetas midan lo mismo sin depender de
                                items-stretch, pero las filas CON contenido real se muestran
                                primero (arriba) y el relleno invisible va al final — así nunca
                                queda un hueco vacío antes de "Cubre"/"Añade". */}
                            <div className="flex flex-col gap-1">
                              {noNewCritical && groupedReasons.length === 0 && (
                                // Sin ninguna razón real: el check ocupa la 1ª de las 3
                                // filas reservadas (va arriba), y solo quedan 2 filas
                                // fantasma de relleno debajo — así el total sigue siendo
                                // 3 filas, igual que en las demás tarjetas. Los badges reales
                                // usan la clase CSS propia `type-badge` (con su padding y
                                // line-height particulares), así que un <span> de texto plano
                                // con px/py de Tailwind NO alcanza la misma altura. Por eso acá
                                // se agrega un badge invisible real (misma clase que el resto)
                                // solo para forzar que la fila mida exactamente lo mismo.
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-emerald-500 inline-flex items-center gap-1">
                                    ✓ {t.recNoNewCritical}
                                  </span>
                                  <span className={`${badgeClass("normal")} invisible text-[11px] px-1.5 py-0.5 shrink-0`} aria-hidden="true">·</span>
                                </div>
                              )}
                              {(noNewCritical && groupedReasons.length === 0 ? fixedReasonRows.slice(1) : [...fixedReasonRows]
                                .sort((a, b) => (b.types.length > 0 ? 1 : 0) - (a.types.length > 0 ? 1 : 0)))
                                .map((row) => (
                                <div key={row.key} className="flex items-center gap-2">
                                  <span className={`${row.labelCl} text-[11px] font-semibold shrink-0 w-16 inline-flex items-center gap-1 ${row.types.length === 0 ? "invisible" : ""}`}>
                                    <span aria-hidden="true">{row.icon}</span>{row.label}
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {row.types.length > 0 ? (
                                      row.types.map((ty) => (
                                        <span key={ty} className={`${badgeClass(ty)} text-[11px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                      ))
                                    ) : (
                                      // Badge fantasma: mismas clases/paddings que un badge real
                                      // pero invisible, para que la fila mida exactamente lo mismo
                                      // que una fila con contenido real.
                                      <span className={`${badgeClass("normal")} invisible text-[11px] px-1.5 py-0.5`} aria-hidden="true">·</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Fila 5: botón expandible — solo modo avanzado */}
                            {isAdvanced && (immunities.length > 0 || allResistances.length > 0 || candidateWeaknesses.length > 0) && (
                              <button
                                type="button"
                                onClick={toggleExpanded}
                                className={`self-start mt-auto pt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition ${isExpanded ? "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border-sky-700/60 bg-sky-900/30 text-sky-300 hover:bg-sky-900/60 hover:border-sky-600"}`}
                              >
                                <span className="text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                                <span>{isExpanded ? (lang === "es" ? "Ocultar detalle" : "Hide detail") : (lang === "es" ? "Ver resistencias y debilidades" : "See resistances & weaknesses")}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ── PANEL EXPANDIDO: todas las resistencias y debilidades (solo modo avanzado) ── */}
                        {isAdvanced && (
                        <div
                          className="overflow-hidden transition-all duration-200"
                          style={{ maxHeight: isExpanded ? "300px" : "0px", opacity: isExpanded ? 1 : 0 }}
                        >
                          <div className="border-t border-slate-700/50 px-3 py-2.5 bg-slate-950/50 flex flex-col gap-2">
                            {immunities.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-[14px] font-semibold text-blue-400 shrink-0 w-16 mt-0.5">{lang === "es" ? "Inmune" : "Immune"}</span>
                                <div className="flex flex-wrap gap-1">
                                  {immunities.map((ty) => (
                                    <span key={ty} className={`${badgeClass(ty)} text-[11px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {allResistances.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-[14px] font-semibold text-emerald-500 shrink-0 w-16 mt-0.5">{lang === "es" ? "Resiste" : "Resists"}</span>
                                <div className="flex flex-wrap gap-1">
                                  {allResistances.map((ty) => (
                                    <span key={ty} className={`${badgeClass(ty)} text-[11px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {candidateWeaknesses.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-[14px] font-semibold text-red-400 shrink-0 w-16 mt-0.5">{lang === "es" ? "Débil a" : "Weak to"}</span>
                                <div className="flex flex-wrap gap-1">
                                  {candidateWeaknesses.map((ty) => (
                                    <span key={ty} className={`${badgeClass(ty)} text-[11px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : loadingAllPokemonData ? (
                <div className="flex items-center gap-2 text-[12px] text-slate-500 pt-1">
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
                  <span>{t.loadingRecommendations}</span>
                </div>
              ) : !team.some((s) => s.name.trim() !== "") ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-sm gap-2 text-center">
                  <span className="text-2xl">⭐</span>
                  <span>
                    {lang === "es"
                      ? "Agrega al menos 1 Pokémon a tu equipo para ver recomendaciones."
                      : "Add at least 1 Pokémon to your team to see recommendations."}
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 text-center py-2">{t.recFilterNoResults}</div>
              )}
            </div>
          </div>
      )}
      </div>
      )}
      
      {showPlantillas && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPlantillas(false); setSavingNew(false); setPlantillaDraftName(""); } }}
        >
        <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950/97 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 flex flex-col gap-4 my-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-100">{t.templateTitle}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t.templateSubtitle}</p>
              </div>
              <button type="button" onClick={() => { setShowPlantillas(false); setSavingNew(false); setPlantillaDraftName(""); }}
                className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100">
                {t.templateClose}
              </button>
            </div>
            <div className="space-y-2 max-h-[50vh] sm:max-h-64 overflow-y-auto pr-1">
              {savedTeams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-sm gap-2">
                  <span className="text-3xl">📂</span>
                  <span>{t.templateEmpty}</span>
                </div>
              ) : (
                savedTeams.map((saved) => {
                  const filledCount = saved.team.filter((s) => s.name).length;
                  const types = saved.team.flatMap((s) => s.types.filter(Boolean)).slice(0, 6);
                  return (
                    <div key={saved.id} className="flex items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/60 px-3 sm:px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-100 text-sm truncate">{saved.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {types.map((ty, i) => (
                            <span key={i} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5`}>{tn(ty)}</span>
                          ))}
                          {filledCount === 0 && <span className="text-[13px] text-slate-500">{t.templateEmptyTeam}</span>}
                        </div>
                        <div className="text-[12px] sm:text-[13px] text-slate-500 mt-1">{filledCount}/6 {t.templatePokemon} · {saved.savedAt}</div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button type="button" onClick={() => loadSavedTeam(saved)}
                          className="rounded-full bg-blue-700/80 px-2.5 sm:px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-600">{t.templateLoad}</button>
                        <button type="button" onClick={() => overwriteSavedTeam(saved.id)}
                          className="rounded-full bg-slate-700/80 px-2.5 sm:px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-600">{t.templateOverwrite}</button>
                        <button type="button" onClick={() => deleteSavedTeam(saved.id)}
                          className="rounded-full bg-red-900/60 px-2.5 sm:px-3 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-800/60">{t.templateDelete}</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {savedTeams.length < MAX_PLANTILLAS ? (
              savingNew ? (
                <div className="flex gap-2 items-center border-t border-slate-800 pt-4">
                  <input type="text" placeholder={`${t.templateNamePlaceholder} ${savedTeams.length + 1}`} value={plantillaDraftName}
                    onChange={(e) => setPlantillaDraftName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCurrentTeam(); if (e.key === "Escape") { setSavingNew(false); setPlantillaDraftName(""); } }}
                    autoFocus
                    className="flex-1 rounded-full border border-blue-700/50 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={saveCurrentTeam} className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600">{t.templateSave}</button>
                  <button type="button" onClick={() => { setSavingNew(false); setPlantillaDraftName(""); }} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:text-slate-200">{t.templateCancel}</button>
                </div>
              ) : (
                <div className="border-t border-slate-800 pt-4">
                  <button type="button" onClick={() => setSavingNew(true)}
                    className="w-full rounded-full border border-dashed border-blue-700/50 bg-blue-900/20 px-4 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 hover:border-blue-500">
                    {t.templateSaveBtn}
                  </button>
                </div>
              )
            ) : (
              <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-500">
                {t.templateMaxReached} {MAX_PLANTILLAS} {t.templateMaxEnd}
              </div>
            )}
          </div>
        </div>
      )}
      {configSlotIndex !== null ? (        
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) closeFakemonConfig(); }}
        >
          <div className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-100">{t.configTitle}</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">{t.configSubtitle}</p>
              </div>
              <button type="button" onClick={closeFakemonConfig}
                className="self-start rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100">
                {t.configClose}
              </button>
            </div>
            <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Image picker section */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 col-span-full">
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">{t.configImage}</div>
                <div className="flex gap-4 items-start flex-wrap">
                  <div className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {configDraftSprite
                      ? <img src={configDraftSprite} alt="sprite" className="w-20 h-20 object-contain" style={buildSpriteStyle(configDraftTransform)} />
                      : <span className="text-slate-500 text-xs text-center">{t.noSprite}</span>
                    }
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="text-[14px] text-slate-400 uppercase tracking-widest">{t.configSearchSprite}</div>
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder={t.configSearchPlaceholder}
                          value={fakeSpriteSearch}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFakeSpriteSearch(v);
                            setFakeSpriteSelectedIdx(-1);
                            if (v.trim().length >= 2) {
                              const filtered = pokemonList.filter((n) => n.toLowerCase().includes(v.toLowerCase())).slice(0, 8);
                              setFakeSpriteResults(filtered);
                              setFakeSpriteOpen(filtered.length > 0);
                            } else {
                              setFakeSpriteResults([]);
                              setFakeSpriteOpen(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (fakeSpriteOpen && fakeSpriteResults.length > 0) {
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setFakeSpriteSelectedIdx((prev) => Math.min(prev + 1, fakeSpriteResults.length - 1));
                                return;
                              }
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setFakeSpriteSelectedIdx((prev) => Math.max(prev - 1, -1));
                                return;
                              }
                              if (e.key === "Enter" && fakeSpriteSelectedIdx >= 0) {
                                e.preventDefault();
                                const name = fakeSpriteResults[fakeSpriteSelectedIdx];
                                setFakeSpriteSearch(formatForDisplay(name));
                                setFakeSpriteOpen(false);
                                setFakeSpriteSelectedIdx(-1);
                                setFakeSpriteLoading(true);
                                fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                                  .then((r) => r.json())
                                  .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                                  .catch(() => alert("Pokémon no encontrado"))
                                  .finally(() => setFakeSpriteLoading(false));
                                return;
                              }
                            }
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setFakeSpriteOpen(false);
                              const name = formatForAPI(fakeSpriteSearch);
                              setFakeSpriteLoading(true);
                              fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                                .then((r) => r.json())
                                .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                                .catch(() => alert("Pokémon no encontrado"))
                                .finally(() => setFakeSpriteLoading(false));
                            } else if (e.key === "Escape") {
                              setFakeSpriteOpen(false);
                              setFakeSpriteSelectedIdx(-1);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                        />
                        {fakeSpriteOpen && fakeSpriteResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/98 shadow-lg text-sm">
                            {fakeSpriteResults.map((name, resultIdx) => (
                              <button
                                key={name}
                                type="button"
                                ref={(el) => {
                                  if (el && fakeSpriteSelectedIdx === resultIdx) {
                                    el.scrollIntoView({ block: "nearest" });
                                  }
                                }}
                                onMouseEnter={() => setFakeSpriteSelectedIdx(resultIdx)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFakeSpriteSearch(formatForDisplay(name));
                                  setFakeSpriteOpen(false);
                                  setFakeSpriteSelectedIdx(-1);
                                  setFakeSpriteLoading(true);
                                  fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                                    .then((r) => r.json())
                                    .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                                    .catch(() => {})
                                    .finally(() => setFakeSpriteLoading(false));
                                }}
                                className={`w-full text-left px-3 py-2 ${fakeSpriteSelectedIdx === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"} text-slate-200`}
                              >
                                {formatForDisplay(name)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFakeSpriteOpen(false);
                          const name = formatForAPI(fakeSpriteSearch);
                          setFakeSpriteLoading(true);
                          fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                            .then((r) => r.json())
                            .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                            .catch(() => alert("Pokémon no encontrado"))
                            .finally(() => setFakeSpriteLoading(false));
                        }}
                        className="rounded-full bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 shrink-0"
                        disabled={fakeSpriteLoading}
                      >
                        {fakeSpriteLoading ? "..." : t.btnSearch}
                      </button>
                    </div>
                    <div className="text-[14px] text-slate-400 uppercase tracking-widest mt-1">{t.configOrUpload}</div>
                    <label className="flex items-center gap-2 rounded-full border border-dashed border-slate-600 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 cursor-pointer hover:border-blue-500 transition w-fit">
                      <span>📁</span> {t.configChooseFile}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            setConfigDraftSprite(dataUrl);
                            // Reset transform and open editor for custom uploads
                            setEditorTransform(DEFAULT_TRANSFORM);
                            setSpriteEditorSrc(dataUrl);
                            setSpriteEditorOpen(true);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {configDraftSprite && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditorTransform(configDraftTransform);
                            setSpriteEditorSrc(configDraftSprite);
                            setSpriteEditorOpen(true);
                          }}
                          className="text-[14px] text-sky-400 hover:text-sky-300 text-left"
                        >
                          {t.editorEditFrame}
                        </button>
                        <button type="button" onClick={() => { setConfigDraftSprite(null); setConfigDraftTransform(DEFAULT_TRANSFORM); }} className="text-[14px] text-red-400 hover:text-red-300 text-left">
                          {t.configRemoveImg}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">{t.configTypes}</div>
                <div className="grid grid-cols-3 gap-2">
                  {allTypes.map((type) => {
                    const selected = configDraftTypes.includes(type);
                    return (
                      <button key={type} type="button" onClick={() => toggleConfigType(type)}
                        className={`inline-flex items-center justify-center rounded-full px-2 py-2 text-[14px] font-semibold transition ${badgeClass(type)} ${selected ? "ring-2 ring-slate-200/40 scale-105" : "opacity-80 hover:opacity-100"}`}>
                        {tn(type)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 text-sm text-slate-400">{t.configTypesNote}</div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">{t.configStats}</div>
                    <p className="text-sm text-slate-400">{t.configStatsNote}</p>
                  </div>
                  <button type="button" onClick={() => setConfigStatsVisible((prev) => !prev)}
                    className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500">
                    {configStatsVisible ? t.configHide : t.configShow}
                  </button>
                </div>
                {configStatsVisible ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {statLabels.map(([key, label]) => (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="text-slate-300">{label}</span>
                        <input
                          type="number"
                          min={1}
                          max={255}
                          value={configDraftStats[key]}
                          onChange={(e) => updateDraftStat(key, e.target.value)}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-500"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-4 sm:mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeFakemonConfig}
                className="w-full sm:w-auto rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2.5 sm:py-2 text-sm text-slate-200 transition hover:bg-slate-800">
                {t.configCancel}
              </button>
              <button type="button" onClick={saveFakemonConfig}
                className="w-full sm:w-auto rounded-full bg-sky-600 px-4 py-2.5 sm:py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                {t.configSave}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* ── Tarjeta fantasma de drag & drop (sigue al cursor/dedo) ── */}
      {dragFromIdx !== null && dragPointerPos && typeof document !== "undefined" && createPortal(
        <div
          ref={dragGhostEl}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: dragGhostSize.current.w || undefined,
            height: dragGhostSize.current.h || undefined,
            pointerEvents: "none",
            zIndex: 9999,
            transform: `translate(${dragPointerPos.x - dragGrabOffset.current.x}px, ${dragPointerPos.y - dragGrabOffset.current.y}px) rotate(-2deg) scale(1.03)`,
            willChange: "transform",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
          }}
          className="rounded-lg border-2 border-blue-400/80 bg-slate-900/95 p-1.5 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-[#031421] rounded-lg overflow-hidden flex items-center justify-center shrink-0">
              <SpriteImg
                src={team[dragFromIdx]?.sprite ?? null}
                alt={team[dragFromIdx]?.name ?? ""}
                className="w-10 h-10 object-contain"
                style={buildSpriteStyle(team[dragFromIdx]?.spriteTransform, Z_SLOT_SPRITE_ZOOM_OVERRIDES[team[dragFromIdx]?.name ?? ""])}
                placeholderClassName="h-6 w-6 opacity-40"
              />
            </div>
            <span className="text-sm font-semibold text-slate-100 truncate">
              {team[dragFromIdx]?.name || "—"}
            </span>
          </div>
        </div>,
        document.body
      )}
      {/* ── Sprite Editor Modal ── */}
      {spriteEditorOpen && spriteEditorSrc && (
        <SpriteEditorModal
          src={spriteEditorSrc}
          initialTransform={editorTransform}
          lang={lang}
          onSave={(saved) => {
            setConfigDraftTransform(saved);
            setSpriteEditorOpen(false);
            setSpriteEditorSrc(null);
          }}
          onCancel={() => {
            setSpriteEditorOpen(false);
            setSpriteEditorSrc(null);
          }}
        />
      )}
      {/* ── Modal de filtros de movimientos ── */}
      {moveFilterTarget && (
        <MoveFilterModal
          moves={(activePokedex === "pokemon-z" ? movesZData : movesStandardData) as MoveFilterEntry[]}
          lang={lang}
          search={moveFilterSearch[moveFilterTarget.slotIdx] ?? ""}
          onSearchChange={(v) => {
            const slotIdx = moveFilterTarget.slotIdx;
            setMoveFilterSearch((prev) => prev.map((s, i) => (i === slotIdx ? v : s)));
          }}
          categories={moveFilterCategories[moveFilterTarget.slotIdx] ?? new Set<string>()}
          onToggleCategory={toggleMoveFilterCategory}
          types={moveFilterTypes[moveFilterTarget.slotIdx] ?? new Set<string>()}
          onToggleType={toggleMoveFilterType}
          onlyZOriginals={moveFilterOnlyZ}
          onToggleOnlyZOriginals={toggleMoveFilterOnlyZ}
          showOnlyZFilter={activePokedex === "pokemon-z"}
          onClearFilters={clearMoveFilters}
          sortPower={moveFilterSortPower[moveFilterTarget.slotIdx] ?? null}
          onSortPowerChange={(v) => {
            const slotIdx = moveFilterTarget.slotIdx;
            setMoveFilterSortPower((prev) => prev.map((s, i) => (i === slotIdx ? v : s)));
          }}
          learnMethods={team[moveFilterTarget.slotIdx]?.learnMethods}
          onlyLearnable={onlyLearnableMoves}
          learnableSet={
            team[moveFilterTarget.slotIdx]?.learnableMoves
              ? new Set(team[moveFilterTarget.slotIdx]!.learnableMoves as string[])
              : null
          }
          badgeClass={badgeClass}
          tn={tn}
          onSelect={selectMoveFromFilter}
          onClose={closeMoveFilter}
        />
      )}

      {/* ── Modal de filtros de movimientos — filtro "por movimiento" de
          Pokémon recomendado (modo avanzado, ambas pokédex). A diferencia
          del modal de arriba, acá "onlyLearnable" siempre es false: se
          muestran TODOS los movimientos, no solo los de un Pokémon puntual,
          ya que este filtro busca entre todos los candidatos. ── */}
      {recFilterMoveModalOpen && (
        <MoveFilterModal
          moves={(activePokedex === "pokemon-z" ? movesZData : movesStandardData) as MoveFilterEntry[]}
          lang={lang}
          search={recFilterMoveSearch}
          onSearchChange={setRecFilterMoveSearch}
          categories={recFilterMoveCategories}
          onToggleCategory={(c) =>
            setRecFilterMoveCategories((prev) => {
              const next = new Set(prev);
              if (next.has(c)) next.delete(c); else next.add(c);
              return next;
            })
          }
          types={recFilterMoveTypes}
          onToggleType={(ty) =>
            setRecFilterMoveTypes((prev) => {
              const next = new Set(prev);
              if (next.has(ty)) next.delete(ty); else next.add(ty);
              return next;
            })
          }
          onlyZOriginals={recFilterMoveOnlyZ}
          onToggleOnlyZOriginals={() => setRecFilterMoveOnlyZ((v) => !v)}
          showOnlyZFilter={activePokedex === "pokemon-z"}
          onClearFilters={() => {
            setRecFilterMoveSearch("");
            setRecFilterMoveCategories(new Set());
            setRecFilterMoveTypes(new Set());
          }}
          sortPower={recFilterMoveSortPower}
          onSortPowerChange={setRecFilterMoveSortPower}
          learnMethods={null}
          onlyLearnable={false}
          learnableSet={null}
          badgeClass={badgeClass}
          tn={tn}
          onSelect={(move) => {
            setRecFilterMoves((prev) => {
              if (prev.includes(move.internalName) || prev.length >= 4) return prev;
              return [...prev, move.internalName];
            });
          }}
          onClose={() => setRecFilterMoveModalOpen(false)}
        />
      )}

      {/* ── Modal de exploración de habilidades — filtro "por habilidad" de
          Pokémon recomendado. Solo Pokémon Z, ya que es la única pokédex con
          descripciones locales precargadas. Al elegir una, se rellena el
          mismo campo de texto (recFilterAbility) que ya usa el filtro. ── */}
      {recAbilityModalOpen && (
        <AbilityFilterModal
          abilities={abilityModalEntries}
          lang={lang}
          search={recAbilityModalSearch}
          onSearchChange={setRecAbilityModalSearch}
          descSearch={recAbilityModalDescSearch}
          onDescSearchChange={setRecAbilityModalDescSearch}
          onlyZOriginals={recAbilityModalOnlyZ}
          onToggleOnlyZOriginals={() => setRecAbilityModalOnlyZ((v) => !v)}
          onSelect={(value) => {
            setRecFilterAbility(value);
            setRecAbilityModalOpen(false);
          }}
          onClose={() => setRecAbilityModalOpen(false)}
        />
      )}

      {/* ── Modal de búsqueda de objetos (botón "Objetos" del header). ── */}
      {itemsModalOpen && (
        <ItemsBrowserModal
          items={itemsData}
          combatUseful={itemsCombatUseful}
          lang={lang}
          search={itemsSearch}
          onSearchChange={setItemsSearch}
          onlyZOriginals={itemsOnlyZ}
          onToggleOnlyZOriginals={() => setItemsOnlyZ((v) => !v)}
          onlyCombat={itemsOnlyCombat}
          onToggleOnlyCombat={() => setItemsOnlyCombat((v) => !v)}
          onClose={() => setItemsModalOpen(false)}
        />
      )}
    </div>
  );
}