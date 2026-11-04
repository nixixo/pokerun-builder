// components/guia/levelCaps.ts
//
// Tope de nivel de cada tramo de la partida. Pokémon Z reparte el juego en
// tramos cerrados por un combate de Regente (o de Liga), y hasta ganarlo tu
// equipo no pasa de cierto nivel: es lo que hace que un tramo se pueda planear
// de verdad, porque limita a qué evoluciones llegas antes de la pelea.
//
// La tabla la dio el autor de la guía; no está escrita en el PDF. Coincide con
// el nivel del as de cada jefe salvo en el 7º tramo (Hibis lleva un 67 y el
// tope es 68), así que NO se puede derivar del JSON — va a mano.
//
// Los tramos 11 y 12 (Arrayan y Siempreviva) no tienen número fijo: a esas
// alturas los combates escalan con la media de tu equipo, y la propia guía
// escribe los niveles de esos rivales como "a un nivel menos que la media de
// nivel de tu equipo". Por eso van con `cap: null` en vez de un número
// inventado, y quien los consume usa `capEfectivo`.
//
// Los hitos se anclan por NOMBRE de zona + entrenador, no por índice: el índice
// se mueve en cuanto se añade o parte una zona, y ya pasó.

import type { Zone } from "./types";

export type Hito = {
  /** Rótulo corto para la interfaz. */
  etiqueta: string;
  /** Nombre exacto del entrenador en pokemon_z_guia.json. */
  entrenador: string;
  /** Nombre exacto de la zona en pokemon_z_guia.json. */
  zona: string;
  /** Nivel máximo del tramo que CIERRA este combate. null = escala con tu equipo. */
  cap: number | null;
};

export const HITOS: Hito[] = [
  { etiqueta: "1ª Medalla", entrenador: "Regente Canola", zona: "BASTIÓN DE LA REGENTE CANOLA (1º MEDALLA)", cap: 15 },
  { etiqueta: "2ª Medalla", entrenador: "Regente Hisopo", zona: "BASTIÓN DEL REGENTE HISOPO (2º MEDALLA)", cap: 24 },
  { etiqueta: "3ª Medalla", entrenador: "Regente F3", zona: "BASTIÓN DEL REGENTE F3 (3º MEDALLA)", cap: 34 },
  {
    etiqueta: "4ª Medalla",
    entrenador: "Regente Zafra",
    zona: "2º SUBTRAMA DE PUEBLO BODEGÓN BASTIÓN DE LA REGENTE ZAFRA (4º MEDALLA)",
    cap: 41,
  },
  { etiqueta: "5ª Medalla", entrenador: "Regente Loto", zona: "BARCO DEL CAPITÁN LOTO (5º MEDALLA )", cap: 46 },
  { etiqueta: "6ª Medalla", entrenador: "Regente Belladona", zona: "BASTIÓN DE LA REGENTE BELLADONA (6º MEDALLA)", cap: 54 },
  { etiqueta: "1ª Liga", entrenador: "Reyes Áster y Angeline", zona: "CÁMARAS DE REFLEXIÓN (INTERIOR)", cap: 60 },
  { etiqueta: "7ª Medalla", entrenador: "Regente Hibis", zona: "TORRE OSCURA (7º MEDALLA)", cap: 68 },
  { etiqueta: "8ª Medalla", entrenador: "Regente Anturia", zona: "BASTIÓN ROMANTIS (8º MEDALLA)", cap: 72 },
  { etiqueta: "9ª Medalla", entrenador: "Regente Rúpico", zona: "BASTIÓN FLUXUS (9º MEDALLA)", cap: 78 },
  { etiqueta: "10ª Medalla", entrenador: "Regente Cendera", zona: "BASTIÓN FRACTAL (10º MEDALLA)", cap: 82 },
  { etiqueta: "11ª Medalla", entrenador: "Regente Arrayan", zona: "Maraña Oscura", cap: null },
  { etiqueta: "12ª Medalla", entrenador: "Regente Siempreviva", zona: "PESADILLA DE CIRCO", cap: null },
  { etiqueta: "2ª Liga", entrenador: "Alto Mando Tornasola", zona: "El Arma Definitiva", cap: 100 },
];

/** Techo del juego. Se usa como cap efectivo donde no hay tope fijo. */
export const NIVEL_MAXIMO = 100;

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export type HitoResuelto = Hito & { zoneIndex: number };

// Resolver los 14 hitos recorre las 200 zonas, y tanto el banner como el
// detalle de zona lo piden en cada render. Se cachea contra el propio array de
// zonas, que es estable mientras no se recargue el JSON.
const cache = new WeakMap<Zone[], HitoResuelto[]>();

/** Los hitos con su índice de zona, en orden de partida. Descarta los que no existan. */
export function resolverHitos(zones: Zone[]): HitoResuelto[] {
  const previo = cache.get(zones);
  if (previo) return previo;

  const resuelto: HitoResuelto[] = [];
  for (const hito of HITOS) {
    // El nombre de zona solo no basta: "Misión del Campanero" repite a todos
    // los Regentes en revancha, y ahí el tope ya no aplica. Tiene que ser la
    // zona correcta Y tener a ese entrenador dentro.
    const zoneIndex = zones.findIndex(
      (z) =>
        normalize(z.zona) === normalize(hito.zona) &&
        z.entrenadores.some((t) => normalize(t.nombre).replace(/:$/, "") === normalize(hito.entrenador))
    );
    if (zoneIndex >= 0) resuelto.push({ ...hito, zoneIndex });
  }

  resuelto.sort((a, b) => a.zoneIndex - b.zoneIndex);
  cache.set(zones, resuelto);
  return resuelto;
}

export type Tramo = {
  /** Hito que CIERRA el tramo, o null en el postgame (ya no queda ninguno). */
  hito: HitoResuelto | null;
  /** 1-based, para "Tramo 3 de 14". */
  numero: number;
  total: number;
  /** Tope del tramo. null = no hay tope fijo, escala con tu equipo. */
  cap: number | null;
  /** El que usan los cálculos: sin tope fijo, el techo del juego. */
  capEfectivo: number;
};

/**
 * En qué tramo cae una zona. El tramo es el que va HASTA el primer hito que
 * queda en esa zona o más adelante — la zona del propio jefe entra en su tramo,
 * que es justo donde el tope todavía manda.
 */
export function tramoDeZona(zones: Zone[], zoneIndex: number): Tramo {
  const hitos = resolverHitos(zones);
  const i = hitos.findIndex((h) => h.zoneIndex >= zoneIndex);

  if (i < 0) {
    // Detrás del último hito: postgame, sin nada que superar y ya al máximo.
    return { hito: null, numero: hitos.length + 1, total: hitos.length + 1, cap: NIVEL_MAXIMO, capEfectivo: NIVEL_MAXIMO };
  }

  const hito = hitos[i];
  return {
    hito,
    numero: i + 1,
    total: hitos.length + 1,
    cap: hito.cap,
    capEfectivo: hito.cap ?? NIVEL_MAXIMO,
  };
}

/** Texto corto del máximo, para meter dentro de una frase: "Nv. 24" o "variable". */
export function textoMax(tramo: Tramo): string {
  return tramo.cap === null ? "variable" : `Nv. ${tramo.cap}`;
}

/** El mismo dato como rótulo suelto de un chip: "MAX Nv. 24" o "MAX variable". */
export function etiquetaMax(tramo: Tramo): string {
  return `MAX ${textoMax(tramo)}`;
}
