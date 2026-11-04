import { useCallback } from "react";
import {
  CONJUNTO_VACIO,
  useHidratado,
  usePreferenciaLocal,
} from "@/components/shared/preferenciaLocal";

import { visitCodec } from "./progressIdentity";

const STORAGE_KEY = "pokemon-z-guia-zonas-visitadas";

export function useZoneProgress() {
  const [visited, setVisited] = usePreferenciaLocal(`${STORAGE_KEY}:v2`, CONJUNTO_VACIO, visitCodec, STORAGE_KEY);
  const hydrated = useHidratado();

  const toggleVisited = useCallback(
    (zoneId: string) => {
      setVisited((prev) => {
        const next = new Set(prev);
        if (next.has(zoneId)) next.delete(zoneId);
        else next.add(zoneId);
        return next;
      });
    },
    [setVisited]
  );

  const isVisited = useCallback((zoneId: string) => visited.has(zoneId), [visited]);

  return { visited, hydrated, toggleVisited, isVisited, visitedCount: visited.size };
}
