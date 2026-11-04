// components/team-builder/types/pokemonZ.ts
//
// Las formas de los JSON del romhack, tal como salen de data-src/ y los deja
// scripts/build-data.mjs en public/generated/.
//
// Estaban declaradas dentro de TeamBuilder.tsx, así que los paneles que las
// reciben por props no podían nombrarlas y las tipaban como `any[]`.

/** Una entrada de la Pokédex Z (public/generated/pokemon_z_completo.json). */
export interface PokemonZEntry {
  id: number;
  name: string;
  internalName: string;
  types: string[];
  stats: {
    HP: number;
    ATK: number;
    DEF: number;
    "SP.ATK": number;
    "SP.DEF": number;
    SPE: number;
  };
  // ── Learnset. Va en un archivo aparte (pokemon_z_learnsets.json) y se
  //    fusiona al vuelo, así que en el núcleo estos campos no vienen.
  moves?: Array<{ move: string; level: number }>;
  tutorMoves?: string[];
  eggMoves?: string[];
  tmMoves?: string[];
  sprite?: string;
  abilities?: string[];
  hiddenAbility?: string;
  /** Solo en formas alternativas: "Gigamax", "Mega", "Alola"... (207 de 1225). */
  formLabel?: string;
  /** Número de Pokédex nacional de la especie base (215 de 1225). */
  dexId?: number;
}

/**
 * Un movimiento ya normalizado. Sirve tanto para los del romhack
 * (moves.json) como para los del dex estándar traídos por GraphQL: el código
 * los deja en esta misma forma a propósito, para que buscador, sugerencias y
 * modal de filtros no tengan que distinguir.
 */
export interface MoveZ {
  internalName: string;
  name: string;
  nameEn: string;
  category: string;
  type: string | null;
  hackrom: boolean;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  descriptionEs: string;
  descriptionEn: string;
}

/** Una entrada cruda de moves.json, antes de normalizarla a MoveZ. */
export interface MoveZCrudo {
  internal_name?: string;
  /** Unas veces es un string suelto y otras un objeto por idioma. */
  name?: string | { es?: string; en?: string };
  category?: string;
  type?: string;
  hackrom?: boolean;
  power?: number;
  accuracy?: number;
  pp?: number;
  description?: { es?: string; en?: string };
}
