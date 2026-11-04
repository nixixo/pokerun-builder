// components/guia/useStarterChoice.ts
//
// Qué inicial eligió el jugador, persistido en localStorage.
//
// Los rivales llevan un inicial que depende del tuyo: esa ranura del equipo
// viene en el JSON como tres miembros con `condicion` ("Si elegiste Chespin",
// …) de los que solo se pelea uno. Sabiendo cuál elegiste se puede enseñar el
// que toca y, sobre todo, meterlo en el análisis de debilidades, del que hasta
// ahora quedaba fuera por no poder saber cuál era (ver battlePrep.ts).
//
// A diferencia de useCollectibleProgress, esto NO puede ser estado local del
// hook: lo consumen a la vez el banner de próxima batalla y el detalle de zona,
// y cambiarlo en uno tiene que verse en el otro al instante. De ahí el store de
// módulo con useSyncExternalStore en vez de useState.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pokemon-z-guia-inicial";

export type Starter = "Chespin" | "Fennekin" | "Froakie";

export const STARTERS: Starter[] = ["Chespin", "Fennekin", "Froakie"];

/** Para el chip de color del selector. */
export const STARTER_TIPO: Record<Starter, string> = {
  Chespin: "Planta",
  Fennekin: "Fuego",
  Froakie: "Agua",
};

let valor: Starter | null = null;
let hidratado = false;
const suscriptores = new Set<() => void>();

function leerDeStorage(): Starter | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return STARTERS.includes(raw as Starter) ? (raw as Starter) : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  // La primera lectura va aquí y no en el módulo: en el render del servidor no
  // hay localStorage, y leerlo durante el render del cliente daría un snapshot
  // distinto al del HTML servido. React vuelve a pedir el snapshot justo
  // después de suscribirse, así que el valor real entra sin parpadeo.
  if (!hidratado) {
    hidratado = true;
    valor = leerDeStorage();
  }
  suscriptores.add(cb);
  return () => {
    suscriptores.delete(cb);
  };
}

const getSnapshot = () => valor;
const getServerSnapshot = (): Starter | null => null;

export function useStarterChoice() {
  const inicial = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setInicial = useCallback((elegido: Starter | null) => {
    valor = elegido;
    try {
      if (elegido) window.localStorage.setItem(STORAGE_KEY, elegido);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sin localStorage la elección vale para esta sesión y ya.
    }
    for (const cb of suscriptores) cb();
  }, []);

  return { inicial, setInicial };
}

/**
 * Deja en el equipo solo el miembro condicional que corresponde al inicial
 * elegido. Sin elección devuelve el equipo tal cual, con las tres variantes:
 * es preferible enseñar de más que esconder al rival que te vas a encontrar.
 */
export function equipoSegunInicial<T extends { condicion?: string }>(
  equipo: T[],
  inicial: Starter | null
): T[] {
  if (!inicial) return equipo;
  const buscado = inicial.toLowerCase();
  return equipo.filter((m) => !m.condicion || m.condicion.toLowerCase().includes(buscado));
}

/** Si este equipo tiene la ranura que depende del inicial. */
export function tieneRanuraCondicional(equipo: { condicion?: string }[]) {
  return equipo.some((m) => m.condicion);
}
