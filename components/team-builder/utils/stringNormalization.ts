// Normalización de strings y nombres en el Team Builder

/**
 * Normaliza cualquier variante de apóstrofe (curly ' ' ´ vs recto ') a uno solo,
 * para que las comparaciones exactas de nombre (ej. "Sirfetch'd") no fallen
 * silenciosamente según qué apóstrofe use el JSON de origen.
 */
export const normalizeApostrophe = (s: string): string => 
  s.replace(/[\u2018\u2019\u02BC\u00B4]/g, "'");

/**
 * getZDisplayName le agrega el sufijo " Z" a toda especie listada en
 * Z_FORM_SPECIES (ej. "Chesnaught" -> "Chesnaught Z"), pero POKEMON_Z_ORIGINALS
 * guarda los nombres SIN ese sufijo. Sin esto, el filtro "solo originales"
 * nunca hacía match con ninguno de ellos.
 */
export const stripZSuffix = (s: string): string => 
  s.replace(/\s+Z$/, "");

/**
 * Igual que stripZSuffix, pero además saca el prefijo "Mega "/"Gigamax " para
 * poder comparar Megas/Gigamax de Pokémon Z (ej. "Mega Delphox Z",
 * "Gigamax Raichu") contra POKEMON_Z_ORIGINALS, que solo guarda el nombre de
 * la especie base.
 */
export const stripZFormPrefixSuffix = (s: string): string =>
  stripZSuffix(s).replace(/^(Mega|Gigamax)\s+/i, "");

/**
 * Normaliza un tipo desde el JSON de Pokémon Z (que puede traer capitalización
 * distinta o espacios extra) al slug de PokéAPI en inglés.
 * Ej: "HADA" → "fairy", "Electrico" → "electric"
 */
import { TYPE_ES_TO_API_NORMALIZED } from "./constants";

/**
 * Normaliza un tipo desde el JSON de Pokémon Z (que puede traer capitalización
 * distinta o espacios extra) al slug de PokéAPI en inglés.
 * Ej: "HADA" → "fairy", "Electrico" → "electric"
 * Firma de un solo parámetro: coincide con cómo la llama TeamBuilder.tsx
 * (`normalizeTypeToApi(t)`), a diferencia de la versión previa que pedía
 * TYPE_ES_TO_API_NORMALIZED como segundo argumento (nadie la llamaba así).
 */
export const normalizeTypeToApi = (t: string): string => {
  const key = t.trim().toLowerCase();
  return TYPE_ES_TO_API_NORMALIZED[key] ?? key;
};
