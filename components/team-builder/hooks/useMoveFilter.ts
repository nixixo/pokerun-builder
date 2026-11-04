import { useState } from "react";
import { MOVE_FILTER_ONLY_Z_KEY, ONLY_LEARNABLE_MOVES_KEY } from "../utils/constants";
import { codecBooleano, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";

/**
 * Estado y handlers del modal de filtro de movimientos (MoveFilterModal),
 * extraído de TeamBuilder.tsx (declaraciones ~3717-3764, handlers ~5195-5239).
 * El estado de búsqueda/categorías/tipos/orden se guarda por slot (array de
 * 6), porque cada Pokémon del equipo puede tener un filtro distinto abierto
 * en paralelo sin pisarse entre sí (ej. Pokémon 1 filtrando "Físico + Fuego"
 * mientras el Pokémon 2 tiene otro filtro). `onlyZOriginals` y
 * `onlyLearnable` sí son globales (no por slot) y se persisten en
 * localStorage entre visitas.
 *
 * Nota de diseño: `selectMoveFromFilter` en el original llamaba directo a
 * `selectMoveSuggestion` (función de autocompletado de movimientos, fuera
 * del alcance de este hook). Acá se recibe como `onSelectMove` para no
 * acoplar el hook a esa lógica.
 */
export function useMoveFilter(
  onSelectMove: (slotIdx: number, moveIdx: number, internalNameOrName: string) => void
) {
  const [moveFilterSearch, setMoveFilterSearch] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  const [moveFilterCategories, setMoveFilterCategories] = useState<Set<string>[]>(() => Array.from({ length: 6 }, () => new Set<string>()));
  const [moveFilterTypes, setMoveFilterTypes] = useState<Set<string>[]>(() => Array.from({ length: 6 }, () => new Set<string>()));
  const [moveFilterOnlyZ, setMoveFilterOnlyZ] = usePreferenciaLocal(
    MOVE_FILTER_ONLY_Z_KEY,
    false,
    codecBooleano
  );
  const [moveFilterSortPower, setMoveFilterSortPower] = useState<("asc" | "desc" | null)[]>(() => Array.from({ length: 6 }, () => null));
  // Índice del slot/movimiento para el que está abierto el modal (null = cerrado).
  const [moveFilterTarget, setMoveFilterTarget] = useState<{ slotIdx: number; moveIdx: number } | null>(null);

  // Si está activo, el buscador de movimientos solo sugiere los que cada
  // Pokémon puede aprender de verdad (nivel, tutor o huevo).
  const [onlyLearnableMoves, setOnlyLearnableMoves] = usePreferenciaLocal(
    ONLY_LEARNABLE_MOVES_KEY,
    true,
    codecBooleano
  );

  // (la lectura y la escritura las lleva usePreferenciaLocal, arriba)

  // ── Handlers del modal de filtros de movimientos ──────────────────────────
  const openMoveFilter = (slotIdx: number, moveIdx: number) => {
    setMoveFilterTarget({ slotIdx, moveIdx });
  };
  const closeMoveFilter = () => setMoveFilterTarget(null);

  const toggleMoveFilterCategory = (c: string) => {
    const slotIdx = moveFilterTarget?.slotIdx;
    if (slotIdx == null) return;
    setMoveFilterCategories((prev) =>
      prev.map((set, i) => {
        if (i !== slotIdx) return set;
        const next = new Set(set);
        if (next.has(c)) next.delete(c); else next.add(c);
        return next;
      })
    );
  };

  const toggleMoveFilterType = (ty: string) => {
    const slotIdx = moveFilterTarget?.slotIdx;
    if (slotIdx == null) return;
    setMoveFilterTypes((prev) =>
      prev.map((set, i) => {
        if (i !== slotIdx) return set;
        const next = new Set(set);
        if (next.has(ty)) next.delete(ty); else next.add(ty);
        return next;
      })
    );
  };

  const toggleMoveFilterOnlyZ = () => {
    setMoveFilterOnlyZ((v) => !v);
  };

  const clearMoveFilters = () => {
    const slotIdx = moveFilterTarget?.slotIdx;
    if (slotIdx == null) return;
    setMoveFilterSearch((prev) => prev.map((v, i) => (i === slotIdx ? "" : v)));
    setMoveFilterCategories((prev) => prev.map((v, i) => (i === slotIdx ? new Set<string>() : v)));
    setMoveFilterTypes((prev) => prev.map((v, i) => (i === slotIdx ? new Set<string>() : v)));
    setMoveFilterSortPower((prev) => prev.map((v, i) => (i === slotIdx ? null : v)));
  };

  const selectMoveFromFilter = (mv: { name: string; internalName?: string }) => {
    if (!moveFilterTarget) return;
    onSelectMove(moveFilterTarget.slotIdx, moveFilterTarget.moveIdx, mv.internalName ?? mv.name);
    setMoveFilterTarget(null);
  };

  return {
    moveFilterSearch,
    setMoveFilterSearch,
    moveFilterCategories,
    moveFilterTypes,
    moveFilterOnlyZ,
    moveFilterSortPower,
    setMoveFilterSortPower,
    moveFilterTarget,
    onlyLearnableMoves,
    setOnlyLearnableMoves,
    openMoveFilter,
    closeMoveFilter,
    toggleMoveFilterCategory,
    toggleMoveFilterType,
    toggleMoveFilterOnlyZ,
    clearMoveFilters,
    selectMoveFromFilter,
  };
}
