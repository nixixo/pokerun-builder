// Constantes del Team Builder - Almacenamiento y configuración

// ─── Storage Keys ────────────────────────────────────────────────────────────
export const STORAGE_KEY = "pokerun-builder-team";
export const SAVED_TEAMS_KEY = "pokerun-builder-saved-teams";
export const VIEW_MODE_KEY = "pokerun-builder-view-mode";
export const POKEDEX_KEY = "pokerun-builder-active-pokedex";
export const FAKEMON_MODE_KEY = "pokerun-builder-fakemon-mode";
export const ONLY_LEARNABLE_MOVES_KEY = "pokerun-builder-only-learnable-moves";
export const MOVE_FILTER_ONLY_Z_KEY = "pokerun-builder-move-filter-only-z";
export const REC_FILTER_MOVE_ONLY_Z_KEY = "pokerun-builder-rec-move-filter-only-z";
export const REC_ABILITY_MODAL_ONLY_Z_KEY = "pokerun-builder-rec-ability-modal-only-z";
export const ITEMS_ONLY_Z_KEY = "pokerun-builder-items-only-z";
export const ITEMS_ONLY_COMBAT_KEY = "pokerun-builder-items-only-combat";

// ─── Límites ─────────────────────────────────────────────────────────────────
export const MAX_PLANTILLAS = 5;
export const TEAM_SIZE = 6;

// ─── Pokedex selector ────────────────────────────────────────────────────────
export type PokedexId = "standard" | "pokemon-z";

export const POKEDEX_OPTIONS: { id: PokedexId; label: string; emoji: string }[] = [
  { id: "standard", label: "Pokedex", emoji: "🔵" },
  { id: "pokemon-z", label: "Pokémon Z", emoji: "⚡" },
];

// ─── Generaciones ────────────────────────────────────────────────────────────
export const GEN_RANGES: { gen: number; label: string; min: number; max: number }[] = [
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

// ─── Habilidades personalizadas (Pokémon Z) ──────────────────────────────────
// Nombres en inglés para las habilidades EXCLUSIVAS del fangame Pokémon Z
export const CUSTOM_ABILITY_EN_NAMES: Record<string, string> = {
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
  "Piel Maldita": "Cursed Skin",
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

// ─── Mapa de tipos (español → API) ───────────────────────────────────────────
// Tipos y colores: ahora en @/components/shared/tipos, compartidos con la Guía.
// Se re-exportan desde aquí para no tocar los ~20 imports que ya apuntaban a
// este archivo.
export { TYPE_ES_TO_API, TYPE_ES_TO_API_NORMALIZED, TYPE_COLORS } from "@/components/shared/tipos";

// ─── Sistema de roles por puntuación ponderada ──────────────────────────────
// ROLES/BALANCED_ROLE viven acá (no en roleCalculations.ts) porque
// useRecommendations.ts las importa desde este archivo.
import type { RoleDefinition } from "../types";

export const ROLES: RoleDefinition[] = [
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

// Rol especial para Pokémon con estadísticas parejas (ej. Mew, Arceus).
export const BALANCED_ROLE: RoleDefinition = {
  es: "Todoterreno Puro", en: "Pure All-Rounder", color: "#059669",
  weights: {},
  descEs: "Todas las estadísticas parejas: no destaca en un área específica, pero no tiene puntos débiles.",
  descEn: "All stats evenly matched: no specific standout area, but no weak points either.",
};

// ─── Filtro de rol por stats núcleo ──────────────────────────────────────────
export type RoleCoreRequirement = {
  stat: "HP" | "ATK" | "DEF" | "SP.ATK" | "SP.DEF" | "SPE";
  min: number;
};

export type RoleCoreFilter = {
  required: RoleCoreRequirement[];
};

export const ROLE_CORE_FILTERS: Record<string, RoleCoreFilter> = {
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
