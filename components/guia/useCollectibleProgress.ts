import { useCallback } from "react";
import {
  CONJUNTO_VACIO,
  useHidratado,
  usePreferenciaLocal,
} from "@/components/shared/preferenciaLocal";

import { collectionCodecs, type CollectionCategory } from "./progressIdentity";

const STORAGE_PREFIX = "pokemon-z-guia-progreso-";

// category: identificador estable de la colección, ej. "mts",
// "paginas-alquimia", "nidos-alfa", "habitantes-acrilico".
export function useCollectibleProgress(category: CollectionCategory) {
  const [checked, setChecked] = usePreferenciaLocal(
    STORAGE_PREFIX + category + ":v2",
    CONJUNTO_VACIO,
    collectionCodecs[category],
    STORAGE_PREFIX + category
  );
  const hydrated = useHidratado();

  const toggle = useCallback(
    (id: string) => {
      if (!id) return;
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setChecked]
  );

  const toggleMany = useCallback(
    (ids: string[]) => {
      const validIds = ids.filter(Boolean);
      if (validIds.length === 0) return;
      setChecked((prev) => {
        const next = new Set(prev);
        const remove = validIds.some((id) => prev.has(id));
        for (const id of validIds) {
          if (remove) next.delete(id);
          else next.add(id);
        }
        return next;
      });
    },
    [setChecked]
  );

  const isChecked = useCallback((id: string) => checked.has(id), [checked]);

  return { checked, hydrated, toggle, toggleMany, isChecked, checkedCount: checked.size };
}
