// components/shared/tipos.ts
//
// Tipos Pokémon: del español al slug de la API, y su color.
//
// Estaba duplicado entre el Builder (utils/constants.ts) y la Guía
// (typeColors.ts, useSpeciesData.ts). Los comentarios de la Guía justificaban
// la copia diciendo que "no hay una ruta de import confirmada" entre las dos
// features — pero sí la hay: el alias `@/*` está en tsconfig.json desde
// siempre. Así que se comparte.
//
// Ojo con un detalle que la duplicación escondía: las dos copias del mapa
// normalizado NO usaban la misma clave. La del Builder pasaba a minúsculas sin
// tocar tildes ("eléctrico"); la de la Guía quitaba tildes ("electrico"). Como
// TYPE_ES_TO_API lista las dos grafías de los tres tipos con tilde, el mapa
// derivado de abajo contiene ambas formas y sirve a los dos.

/** Nombre en español (tal cual lo escriben los JSON) -> slug de PokéAPI. */
export const TYPE_ES_TO_API: Record<string, string> = {
  "Normal": "normal", "Fuego": "fire", "Agua": "water", "Eléctrico": "electric",
  "Electrico": "electric", "Planta": "grass", "Hielo": "ice", "Lucha": "fighting",
  "Veneno": "poison", "Tierra": "ground", "Volador": "flying", "Psíquico": "psychic",
  "Psiquico": "psychic", "Bicho": "bug", "Roca": "rock", "Fantasma": "ghost",
  "Dragón": "dragon", "Dragon": "dragon", "Siniestro": "dark", "Acero": "steel",
  "Hada": "fairy",
};

/**
 * El mismo mapa con las claves en minúsculas. Incluye las grafías con y sin
 * tilde porque TYPE_ES_TO_API ya lista ambas, así que vale tanto para quien
 * normaliza quitando tildes como para quien solo baja a minúsculas.
 */
export const TYPE_ES_TO_API_NORMALIZED: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_ES_TO_API).map(([k, v]) => [k.trim().toLowerCase(), v])
);

/** Del español al slug, tolerante con tildes y espacios. `null` si no es un tipo. */
export function tipoEsAApi(tipoEs: string): string | null {
  return TYPE_ES_TO_API_NORMALIZED[String(tipoEs).trim().toLowerCase()] ?? null;
}

// ─── Colores ────────────────────────────────────────────────────────────────
export const TYPE_COLORS: Record<string, string> = {
  normal: "#a8a878", fire: "#f08030", water: "#6890f0", electric: "#f8d030",
  grass: "#78c850", ice: "#98d8d8", fighting: "#c03028", poison: "#a040a0",
  ground: "#e0c068", flying: "#a890f0", psychic: "#f85888", bug: "#a8b820",
  rock: "#b8a038", ghost: "#705898", dragon: "#7038f8", dark: "#705848",
  steel: "#b8b8d0", fairy: "#ee99ac",
};
