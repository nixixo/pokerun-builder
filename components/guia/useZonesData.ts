// components/guia/useZonesData.ts
//
// Las zonas de la guía. La descarga, la caché y la deduplicación de peticiones
// las pone recursoJson (components/shared): aquí solo queda decir qué archivo
// es y traducir los nombres del resultado a los que ya esperaba la página.

import type { Zone } from "./types";
import { recursoJson } from "@/components/shared/recursoJson";

const Zonas = recursoJson<Zone[]>("/generated/pokemon_z_guia.json", {
  etiqueta: "useZonesData",
});

type UseZonesDataResult = {
  zones: Zone[];
  loading: boolean;
  error: string | null;
};

export function useZonesData(): UseZonesDataResult {
  const { datos, cargando, error } = Zonas.useRecurso();
  return { zones: datos ?? [], loading: cargando, error };
}
