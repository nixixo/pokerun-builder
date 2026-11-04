// components/guia/useEquipoBuilder.ts
//
// El equipo que tengas armado en el Builder, leído desde la Guía.
//
// SOLO LECTURA, y eso es una regla, no una casualidad: la Guía nunca escribe en
// las claves del Builder. Mientras se cumpla, esto no puede corromper un equipo
// ni pelearse con el autoguardado del Builder pase lo que pase aquí.
//
// Por localStorage y no por un contexto compartido: Builder y Guía son dos rutas
// distintas ("/" y "/guia") que no comparten árbol de React, y localStorage ya
// ES la fuente de verdad del Builder. Así no hay que refactorizar nada de allá.
//
// Se relee al volver a la pestaña y con el evento `storage`, así que editar el
// equipo en otra pestaña se nota aquí sin recargar.
//
// Lo que NO hay: el nivel. El Slot del Builder no lo guarda, así que todo lo que
// se construya encima es análisis de tipos, movimientos y stats base — nunca un
// cálculo de daño. Ver equipoVsRival.ts.

import { useCallback, useSyncExternalStore } from "react";
import { almacenLocal } from "@/components/shared/almacenLocal";
import { useHidratado } from "@/components/shared/preferenciaLocal";
import type { BaseStats, Move, Slot } from "../team-builder/types";
import { isValidSlot } from "../team-builder/utils/validation";
import { POKEDEX_KEY, STORAGE_KEY, TEAM_SIZE } from "../team-builder/utils/constants";
import type { PokeType } from "./typeChart";
import { ALL_TYPES } from "./typeChart";

const TIPOS_VALIDOS = new Set<string>(ALL_TYPES);

export type MovimientoEquipo = {
  nombre: string;
  /** Tipo en slug de API, o null si el movimiento no tiene tipo resuelto. */
  tipo: PokeType | null;
  categoria: Move["category"];
};

export type MiembroEquipo = {
  /** Ranura 0-5 en el Builder. Sirve de identidad estable dentro del equipo. */
  indice: number;
  nombre: string;
  /** Ya filtrados: el Slot guarda siempre dos y el segundo suele ser "". */
  tipos: PokeType[];
  stats: BaseStats | null;
  movimientos: MovimientoEquipo[];
  sprite: string | null;
  /** Fakemon del Builder: puede no tener stats ni tipos coherentes. */
  esFake: boolean;
};

function tiposDeSlot(slot: Slot): PokeType[] {
  return slot.types.filter((t): t is PokeType => TIPOS_VALIDOS.has(t));
}

function movimientosDeSlot(slot: Slot): MovimientoEquipo[] {
  return slot.moves
    .filter((m) => m.name.trim() !== "")
    .map((m) => ({
      nombre: m.nameEs || m.name,
      // Poder Oculto guarda su tipo en `hiddenPowerType`, no en `type`: es el
      // único movimiento cuyo tipo se elige por Pokémon, y en el Builder se
      // configura aparte.
      tipo: normalizarTipo(m.hiddenPowerType ?? m.type),
      categoria: m.category,
    }));
}

function normalizarTipo(valor: string | null | undefined): PokeType | null {
  if (!valor) return null;
  const t = valor.trim().toLowerCase();
  return TIPOS_VALIDOS.has(t) ? (t as PokeType) : null;
}

type Instantanea = { miembros: MiembroEquipo[]; dex: string };

const SIN_EQUIPO: Instantanea = { miembros: [], dex: "standard" };

/** El texto tal cual está guardado, sin interpretar. */
function crudoDelEquipo(): { dex: string; crudo: string | null } {
  const dex = almacenLocal.leer(POKEDEX_KEY) ?? "standard";
  const crudo = almacenLocal.leer(`${STORAGE_KEY}-${dex}`, dex === "standard" ? STORAGE_KEY : undefined);
  return { dex, crudo };
}

function parsearEquipo(dex: string, crudo: string | null): Instantanea {
  if (!crudo) return { miembros: [], dex };

  let parsed: unknown;
  try {
    parsed = JSON.parse(crudo);
  } catch {
    return { miembros: [], dex };
  }
  if (!Array.isArray(parsed) || parsed.length !== TEAM_SIZE) return { miembros: [], dex };

  const miembros: MiembroEquipo[] = [];
  parsed.forEach((valor, indice) => {
    // Mismo type guard que usa el Builder al restaurar: si el JSON guardado es
    // de un esquema viejo o está corrupto, esa ranura simplemente no existe.
    if (!isValidSlot(valor)) return;
    const slot = valor;
    if (slot.name.trim() === "") return;
    const tipos = tiposDeSlot(slot);
    if (tipos.length === 0) return;
    miembros.push({
      indice,
      nombre: slot.name,
      tipos,
      stats: slot.stats ?? null,
      movimientos: movimientosDeSlot(slot),
      sprite: slot.sprite ?? null,
      esFake: slot.isFake,
    });
  });

  return { miembros, dex };
}

// ─── El equipo como almacén externo ─────────────────────────────────────────
// localStorage vive fuera de React, así que la herramienta correcta es
// useSyncExternalStore y no un `useState` sembrado desde un efecto: aquello
// pintaba siempre "sin equipo" y luego corregía, con su parpadeo y su render en
// cascada. Aquí el servidor tiene su propia instantánea (vacía) y el cliente lee
// de verdad, sin romper la hidratación.

// `getSnapshot` tiene que devolver la MISMA referencia mientras no cambie nada,
// o React re-renderiza sin parar. Se cachea por el texto crudo: parsear solo
// ocurre cuando el equipo guardado cambió de verdad.
let claveCache: string | null = null;
let valorCache: Instantanea = SIN_EQUIPO;

function instantanea(): Instantanea {
  const { dex, crudo } = crudoDelEquipo();
  const clave = `${dex}\0${crudo ?? ""}`;
  if (clave !== claveCache) {
    claveCache = clave;
    valorCache = parsearEquipo(dex, crudo);
  }
  return valorCache;
}

function instantaneaServidor(): Instantanea {
  return SIN_EQUIPO;
}

const oyentes = new Set<() => void>();

function avisar() {
  for (const f of oyentes) f();
}

// Incluye cambios pendientes en memoria si el navegador no pudo persistirlos.
function suscribir(alCambiar: () => void) {
  const detener = almacenLocal.suscribir(alCambiar);
  if (oyentes.size === 0) {
    window.addEventListener("focus", avisar);
  }
  oyentes.add(alCambiar);
  return () => {
    detener();
    oyentes.delete(alCambiar);
    if (oyentes.size === 0) {
      window.removeEventListener("focus", avisar);
    }
  };
}

export type EquipoBuilder = {
  miembros: MiembroEquipo[];
  /** Qué Pokédex del Builder se está leyendo ("standard" | "pokemon-z"). */
  dex: string;
  /** Ya se leyó localStorage (evita parpadear el aviso de "sin equipo"). */
  cargado: boolean;
  vacio: boolean;
  releer: () => void;
};

export function useEquipoBuilder(): EquipoBuilder {
  const { miembros, dex } = useSyncExternalStore(suscribir, instantanea, instantaneaServidor);
  const cargado = useHidratado();

  // Forzar una relectura a mano. Ya no hace falta para lo normal (el `storage` y
  // el `focus` lo cubren), pero sigue expuesto por si algo cambia el equipo sin
  // pasar por ninguno de los dos.
  const releer = useCallback(() => {
    claveCache = null;
    avisar();
  }, []);

  return { miembros, dex, cargado, vacio: cargado && miembros.length === 0, releer };
}
