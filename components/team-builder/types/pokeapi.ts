// components/team-builder/types/pokeapi.ts
//
// Las respuestas de PokéAPI que el Builder pide EN VIVO.
//
// La mayoría de los datos ya vienen congelados en public/pokeapi/ (ver
// scripts/generate-pokeapi-data.mjs), pero quedan dos consultas que no se
// pueden precalcular porque dependen de lo que el usuario escriba: la ficha de
// un Pokémon concreto y la de un movimiento concreto.
//
// Esto NO pretende describir la API entera — solo los campos que se leen, que
// son los que pueden romper si PokéAPI cambia. Todo lo demás se ignora, y por
// eso los tipos no llevan índice de sobra: si mañana hace falta un campo nuevo,
// que dé error de compilación aquí y no un `undefined` a mitad del render.

/** Un enlace con nombre, la forma que repite PokéAPI por todas partes. */
type Recurso = { name: string; url?: string };

// ─── /pokemon/{slug} ────────────────────────────────────────────────────────

export type PokeApiPokemon = {
  name: string;
  types: { slot?: number; type: Recurso }[];
  stats: { base_stat: number; stat: Recurso }[];
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: { front_default: string | null };
    };
  };
  abilities?: { ability: Recurso; is_hidden: boolean }[];
  moves?: PokeApiMovimientoAprendido[];
};

/** Una entrada del array `moves`: el movimiento y cómo se aprende en cada juego. */
export type PokeApiMovimientoAprendido = {
  move: Recurso;
  version_group_details?: {
    level_learned_at: number;
    move_learn_method: Recurso;
    version_group?: Recurso;
  }[];
};

// ─── /item/{slug} ───────────────────────────────────────────────────────────

export type PokeApiItem = {
  id: number;
  name: string;
  cost?: number;
  sprites?: { default: string | null };
  category?: Recurso;
  names?: { name: string; language?: Recurso }[];
  effect_entries?: { short_effect?: string; effect?: string; language?: Recurso }[];
  /** Ojo: aquí el campo se llama `text`, no `flavor_text` como en los movimientos. */
  flavor_text_entries?: { text?: string; language?: Recurso; version_group?: Recurso }[];
};

// ─── GraphQL (beta.pokeapi.co) ──────────────────────────────────────────────
//
// El endpoint GraphQL devuelve los nombres de campo con un sufijo de versión
// que cambia entre releases de la API, y por eso el código los arma como
// variables (`movesKey`, `namesKey`, `damageClassKey`) en vez de escribirlos.
// Eso obliga a que la fila sea indexable por string; lo que sí se puede fijar
// es la FORMA de lo que hay dentro de cada campo conocido.

export type FilaMovimientoGraphQL = {
  name: string;
  descEs?: { flavor_text: string }[];
  descEn?: { flavor_text: string }[];
  /** Los campos cuyo nombre lleva sufijo de versión. Se leen con los dos
   *  ayudantes de abajo, que hacen el estrechamiento en un solo sitio. */
  [campoConSufijoDeVersion: string]: unknown;
};

export type RespuestaGraphQL<T> = {
  data?: Record<string, T[]>;
  errors?: { message: string }[];
};

/**
 * Un campo de nombre dinámico que contiene un objeto con `name`
 * (ej. `pokemon_v2_movedamageclass`).
 */
export function nombreDeCampo(fila: FilaMovimientoGraphQL, campo: string): string | undefined {
  const valor = fila[campo];
  if (valor && typeof valor === "object" && "name" in valor) {
    const n = (valor as { name?: unknown }).name;
    return typeof n === "string" ? n : undefined;
  }
  return undefined;
}

/**
 * Un campo de nombre dinámico que contiene una LISTA de objetos con `name`
 * (ej. `pokemon_v2_movenames`). Devuelve el `name` del primero, que es como lo
 * pide la query: filtrada por idioma y con `limit: 1`.
 */
export function primerNombreDeCampo(
  fila: FilaMovimientoGraphQL,
  campo: string
): string | undefined {
  const valor = fila[campo];
  if (Array.isArray(valor) && valor.length > 0) {
    const n = (valor[0] as { name?: unknown })?.name;
    return typeof n === "string" ? n : undefined;
  }
  return undefined;
}

// ─── /move/{slug} ───────────────────────────────────────────────────────────

export type PokeApiMove = {
  name: string;
  type: Recurso;
  damage_class?: Recurso;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  /** Nombre traducido, una entrada por idioma. */
  names?: { name: string; language: Recurso }[];
  /** Descripción, una entrada por idioma Y por versión del juego. */
  flavor_text_entries?: {
    flavor_text: string;
    language?: Recurso;
    version_group?: Recurso;
  }[];
};
