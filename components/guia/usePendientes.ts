import { codecJson, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";
import { REQUISITO_LABEL } from "./requisitos";
import type { Requisito, Zone } from "./types";

export type Pendiente = {
  id: string;
  zonaId: string;
  zonaNombre: string;
  tipo: "Objeto" | "Encuentro" | "MT";
  nombre: string;
  detalle: string;
  requisitos: Requisito[];
};

export function crearPendiente(
  zona: Pick<Zone, "id" | "zona">,
  tipo: Pendiente["tipo"],
  nombre: string,
  detalle: string,
  requisitos: Requisito[] = [],
): Pendiente {
  // El ID usa la visita original y la descripción para distinguir dos
  // ejemplares del mismo objeto sin depender del orden de las tarjetas.
  return {
    id: JSON.stringify([zona.id, tipo, nombre, detalle]),
    zonaId: zona.id,
    zonaNombre: zona.zona,
    tipo,
    nombre,
    detalle,
    requisitos,
  };
}

function esPendiente(value: unknown): value is Pendiente {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partial<Pendiente>;
  return typeof p.id === "string" && typeof p.zonaId === "string" &&
    typeof p.zonaNombre === "string" && typeof p.nombre === "string" &&
    typeof p.detalle === "string" &&
    (p.tipo === "Objeto" || p.tipo === "Encuentro" || p.tipo === "MT") &&
    Array.isArray(p.requisitos) &&
    p.requisitos.every((r) => typeof r === "string" && Object.hasOwn(REQUISITO_LABEL, r));
}

const VACIO: Pendiente[] = [];
const codecPendientes = codecJson<Pendiente[]>((value) => Array.isArray(value) ? value.filter(esPendiente) : null);

export function usePendientes() {
  const [entries, setEntries] = usePreferenciaLocal("guia:pendientes:v1", VACIO, codecPendientes);
  return {
    entries,
    isPending: (id: string) => entries.some((entry) => entry.id === id),
    toggle: (entry: Pendiente) => setEntries((previous) =>
      previous.some(({ id }) => id === entry.id)
        ? previous.filter(({ id }) => id !== entry.id)
        : [...previous, entry]),
    remove: (id: string) => setEntries((previous) => previous.filter((entry) => entry.id !== id)),
  };
}

export type AccionesPendientes = Pick<ReturnType<typeof usePendientes>, "isPending" | "toggle">;
