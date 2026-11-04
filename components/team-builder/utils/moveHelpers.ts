import type { Move } from "../types";
import type { PokeApiMovimientoAprendido } from "../types/pokeapi";

// La forma de PokéAPI vive en types/pokeapi.ts, junto al resto de la API.
// Aquí estaba redeclarada con otro nombre, y las dos versiones se habían
// separado: esta daba `version_group_details` por obligatorio cuando la API lo
// omite en algunas entradas.
type VersionGroupDetail = NonNullable<
  PokeApiMovimientoAprendido["version_group_details"]
>[number];

// ─── Movimientos: helpers ────────────────────────────────────────────────────

/**
 * Movimiento "vacío" por defecto para un slot sin asignar.
 * Se usa al inicializar un Slot nuevo y al limpiar un slot de movimiento
 * cuando el usuario borra el nombre manualmente.
 */
export const EMPTY_MOVE = (): Move => ({ name: "", category: "Physical", type: null });

/**
 * Normaliza un texto de búsqueda de movimientos para comparación insensible a
 * acentos, mayúsculas, apóstrofes y separadores. Se usa tanto para el texto
 * que escribe el usuario como para los nombres (ES/EN) contra los que se
 * compara, así "Puno Cometa" matchea con "Puño Cometa" o "puno-cometa".
 */
export const normalizeMoveSearch = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A partir del array `moves` que devuelve PokéAPI, arma un mapa
 * { slugDeMovimiento: { type, level } } indicando cómo lo aprende el
 * Pokémon: por nivel (con el nivel), por MT/MO ("machine"), por tutor o por
 * huevo. Cuando un movimiento tiene varias formas de aprenderse (distintos
 * juegos/generaciones), se prioriza nivel > MT > tutor > huevo.
 */
export const buildLearnMethodsFromApi = (
  // Opcional porque la API puede no traer el array; la guarda de dentro ya lo
  // contemplaba, solo que la firma decía otra cosa.
  moves: PokeApiMovimientoAprendido[] | undefined
): Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> => {
  const result: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> = {};
  if (!Array.isArray(moves)) return result;
  const priority = (m: string) => (m === "level-up" ? 0 : m === "machine" ? 1 : m === "tutor" ? 2 : m === "egg" ? 3 : 4);
  moves.forEach((mv: PokeApiMovimientoAprendido) => {
    const mname = mv?.move?.name;
    if (!mname) return;
    const details = Array.isArray(mv.version_group_details) ? mv.version_group_details : [];
    // for-of en vez de forEach: dentro del callback TS estrechaba `best` a
    // `never` tras el `if (!best) return`, y los accesos de abajo no
    // compilaban.
    let best: VersionGroupDetail | null = null;
    for (const d of details) {
      const method = d?.move_learn_method?.name;
      if (best === null || priority(method) < priority(best.move_learn_method?.name)) best = d;
    }
    if (best === null) return;
    const method = best.move_learn_method?.name;
    if (method === "level-up") result[mname] = { type: "level", level: best.level_learned_at || undefined };
    else if (method === "machine") result[mname] = { type: "mt" };
    else if (method === "tutor") result[mname] = { type: "tutor" };
    else if (method === "egg") result[mname] = { type: "egg" };
  });
  return result;
};
