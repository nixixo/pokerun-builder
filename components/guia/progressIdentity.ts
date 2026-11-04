import legacy from "./data/legacyProgress.json" with { type: "json" };
import type { Codec } from "@/components/shared/preferenciaLocal";
import type { Zone } from "./types";

export type CollectionCategory = "mts" | "paginas-alquimia" | "nidos-alfa" | "habitantes-acrilico";
export function progressCodec(mapping: Record<string, string | string[]>): Codec<Set<string>> {
  return {
    leer(raw, fallback) {
      if (raw === null) return fallback;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return fallback;
        return new Set(parsed.flatMap((key) => {
          if (typeof key !== "string") return [];
          // v2 ya contiene IDs. La tabla v1 es inmutable, incluso si se reordenan los datos.
          const mapped = Object.hasOwn(mapping, key) ? mapping[key] : undefined;
          return mapped === undefined ? [key] : Array.isArray(mapped) ? mapped : [mapped];
        }));
      } catch { return fallback; }
    },
    escribir: (value) => JSON.stringify([...value]),
  };
}

export const visitCodec = progressCodec(legacy.visits);
export const collectionCodecs = {
  mts: progressCodec(legacy.mts),
  "paginas-alquimia": progressCodec(legacy["paginas-alquimia"]),
  "nidos-alfa": progressCodec(legacy["nidos-alfa"]),
  "habitantes-acrilico": progressCodec(legacy["habitantes-acrilico"]),
};

export function collectionId(zone: Zone | undefined, category: CollectionCategory, index = 0): string {
  if (!zone) return "";
  if (category === "mts") return zone.mts[index]?.id ?? "";
  if (category === "nidos-alfa") return zone.nido_alfa?.id ?? "";
  if (category === "habitantes-acrilico") return zone.habitante_acrilico?.id ?? "";
  const page = zone.pagina_alquimia;
  const description = index === 0 ? page?.descripcion ?? "" : page?.adicionales?.[index - 1] ?? "";
  return page?.progressIds?.[description] ?? "";
}

export const activeZoneCodec: Codec<string | null> = {
  leer: (raw) => raw === null ? null : (legacy.zones as Record<string, string>)[raw] ?? raw,
  escribir: (value) => value ?? "",
};

export const legacyZoneId = (index: number) => (legacy.zones as Record<string, string>)[String(index)];
