import { useMemo } from "react";
import fixedMarkers from "@/mapa.json" with { type: "json" };
import type { Zone } from "./types";
import { legacyZoneId } from "./progressIdentity";

export type MarkerKind = "ciudad" | "ruta" | "secundaria";

export type MapMarker = {
  id: string;
  xPct: number; // 0-100
  yPct: number; // 0-100
  zoneIndex: number; // Solo para la vista actual.
  zoneId: string;
  kind: MarkerKind;
};

type StoredMarker = Omit<MapMarker, "zoneIndex">;
export function parseMarkers(raw: unknown): StoredMarker[] | null {
  if (!Array.isArray(raw)) return null;
  const result: StoredMarker[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const zoneId = typeof entry.zoneId === "string" ? entry.zoneId : legacyZoneId(entry.zoneIndex);
    if (!zoneId || typeof entry.id !== "string" || !Number.isFinite(entry.xPct) || !Number.isFinite(entry.yPct)
      || entry.xPct < 0 || entry.xPct > 100 || entry.yPct < 0 || entry.yPct > 100) return null;
    const kind = entry.kind ?? "secundaria";
    if (!["ciudad", "ruta", "secundaria"].includes(kind)) return null;
    result.push({ id: entry.id, zoneId, xPct: entry.xPct, yPct: entry.yPct, kind });
  }
  return result;
}
// Se valida una vez. Los marcadores publicados no dependen del almacenamiento del usuario.
const markers = parseMarkers(fixedMarkers);
if (!markers || new Set(markers.map((m) => m.id)).size !== markers.length) {
  throw new Error("mapa.json contiene marcadores inválidos o repetidos");
}
const FIXED_MARKERS = markers;

export function getMapMarkers(zones: Zone[]): MapMarker[] {
  if (zones.length === 0) return [];
  const indexes = new Map(zones.map((zone, index) => [zone.id, index]));
  return FIXED_MARKERS.map((marker) => {
    const zoneIndex = indexes.get(marker.zoneId);
    if (zoneIndex === undefined) throw new Error(`Zona desconocida en mapa.json: ${marker.zoneId}`);
    return { ...marker, zoneIndex };
  });
}

export function useMapMarkers(zones: Zone[]) {
  return useMemo(() => getMapMarkers(zones), [zones]);
}
