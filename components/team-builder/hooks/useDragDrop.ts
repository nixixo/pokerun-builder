import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { Slot } from "../types";

export interface MoveDragTarget {
  slotIdx: number;
  moveIdx: number;
}

/**
 * Encapsula los DOS sistemas de drag & drop de TeamBuilder:
 *
 * 1) Drag & drop de Pokémon del equipo (reordenar los 6 slots): unificado
 *    mouse + touch vía Pointer Events, con tarjeta fantasma flotante que
 *    sigue al cursor/dedo (movida directo por DOM, sin pasar por React
 *    state, para no re-renderizar todo el árbol en cada pixel) y animación
 *    FLIP al soltar.
 * 2) Drag & drop de movimientos (reordenar los 4 ataques de un mismo
 *    Pokémon): drag&drop nativo de HTML5, mucho más simple porque solo
 *    reordena un array corto dentro del mismo slot.
 *
 * Nota de diseño: `onSwapSlots` y `onSwapMove` se reciben como callbacks en
 * vez de implementarse acá. `swapSlots` en el original solo necesita
 * `setTeam`, pero `swapMoves` además resetea estado de autocompletado de
 * movimientos (`moveInputDraft`, `moveResults`, `moveOpen`, `moveSelectedIdx`)
 * que vive fuera de este hook — mezclar esos setters acá acoplaría el drag
 * & drop con la lógica de autocompletado, dos cosas que no tienen relación
 * entre sí.
 *
 * `teamCardRefs` y `captureSlotRects` se exponen porque también los usa
 * `toggleSlotCollapsed` en TeamBuilder.tsx (animar el FLIP al colapsar una
 * tarjeta, no solo al arrastrar), así que quedan afuera del hook en el
 * componente principal si se prefiere — pero como nacieron acá junto al
 * resto del sistema FLIP, se exponen para reutilizar la misma instancia.
 */
export function useDragDrop(team: Slot[], onSwapSlots: (fromIdx: number, toIdx: number) => void, onSwapMove: (slotIdx: number, fromMoveIdx: number, toMoveIdx: number) => void) {
  // ─── Drag & drop de Pokémon del equipo (pointer events) ────────────────
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number } | null>(null);
  const dragGhostSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dragGrabOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const teamCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const prevSlotRects = useRef<Map<number, DOMRect>>(new Map());
  const dragGhostEl = useRef<HTMLDivElement | null>(null);
  const dragRafId = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  // Captura la posición actual de cada tarjeta antes de reordenar el array,
  // para poder animar (FLIP) desde la posición vieja a la nueva después del
  // re-render. Se expone porque `toggleSlotCollapsed` (fuera de este hook)
  // también la necesita para animar el colapso/expansión de una tarjeta.
  const captureSlotRects = () => {
    const map = new Map<number, DOMRect>();
    teamCardRefs.current.forEach((el, idx) => {
      if (el) map.set(idx, el.getBoundingClientRect());
    });
    prevSlotRects.current = map;
  };

  const startSlotDrag = (idx: number, clientX: number, clientY: number, target: HTMLElement) => {
    setDragFromIdx(idx);
    setDragPointerPos({ x: clientX, y: clientY });
    const card = target.closest("[data-slot-idx]") as HTMLElement | null;
    const rect = card?.getBoundingClientRect();
    if (rect) {
      dragGhostSize.current = { w: rect.width, h: rect.height };
      dragGrabOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    }
  };

  // Encuentra la tarjeta cuyo centro está más cerca del cursor/dedo. Esto
  // hace que soltar sea mucho más tolerante: ya no hace falta acertar en un
  // punto exacto, con estar "cerca" de una tarjeta alcanza.
  const findNearestSlot = (clientX: number, clientY: number): number | null => {
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    teamCardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  };

  const swapFromEffect = useEffectEvent(onSwapSlots);

  useEffect(() => {
    if (dragFromIdx === null) return;

    let pendingX = 0;
    let pendingY = 0;

    const applyFrame = () => {
      dragRafId.current = null;
      // Mueve el fantasma directo por DOM: nada de setState aquí.
      if (dragGhostEl.current) {
        dragGhostEl.current.style.transform = `translate(${pendingX - dragGrabOffset.current.x}px, ${pendingY - dragGrabOffset.current.y}px) rotate(-2deg) scale(1.03)`;
      }
      const overIdx = findNearestSlot(pendingX, pendingY);
      if (overIdx !== null && overIdx !== dragOverIdxRef.current) {
        dragOverIdxRef.current = overIdx;
        setDragOverIdx(overIdx);
      }
    };

    const handleMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (dragRafId.current === null) {
        dragRafId.current = requestAnimationFrame(applyFrame);
      }
    };
    const finishDrag = () => {
      if (dragRafId.current !== null) {
        cancelAnimationFrame(dragRafId.current);
        dragRafId.current = null;
      }
      const overIdx = dragOverIdxRef.current;
      if (overIdx !== null && dragFromIdx !== overIdx) {
        captureSlotRects();
        swapFromEffect(dragFromIdx, overIdx);
      }
      setDragFromIdx(null);
      dragOverIdxRef.current = null;
      setDragOverIdx(null);
      setDragPointerPos(null);
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      if (dragRafId.current !== null) cancelAnimationFrame(dragRafId.current);
    };
  }, [dragFromIdx]);

  // Animación FLIP: cuando `team` cambia por un swap, cada tarjeta "salta"
  // desde su posición anterior hasta la nueva con una transición suave.
  useLayoutEffect(() => {
    const prevRects = prevSlotRects.current;
    if (prevRects.size === 0) return;
    teamCardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const prev = prevRects.get(idx);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (dx || dy) {
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 0.28s cubic-bezier(0.22,0.9,0.3,1)";
          el.style.transform = "";
        });
      }
    });
    prevSlotRects.current = new Map();
  }, [team]);

  // ─── Drag & drop de movimientos (HTML5 nativo, dentro de un mismo slot) ─
  const [dragMoveFrom, setDragMoveFrom] = useState<MoveDragTarget | null>(null);
  const [moveDragOverIdx, setMoveDragOverIdx] = useState<MoveDragTarget | null>(null);

  const handleMoveDragStart = (slotIdx: number, moveIdx: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    setDragMoveFrom({ slotIdx, moveIdx });
  };

  const handleMoveDragEnd = () => {
    setDragMoveFrom(null);
    setMoveDragOverIdx(null);
  };

  const handleMoveDragOver = (slotIdx: number, moveIdx: number, e: React.DragEvent) => {
    if (dragMoveFrom && dragMoveFrom.slotIdx === slotIdx) {
      e.preventDefault();
      setMoveDragOverIdx({ slotIdx, moveIdx });
    }
  };

  const handleMoveDrop = (slotIdx: number, moveIdx: number, e: React.DragEvent) => {
    if (dragMoveFrom && dragMoveFrom.slotIdx === slotIdx) {
      e.preventDefault();
      onSwapMove(slotIdx, dragMoveFrom.moveIdx, moveIdx);
    }
    setDragMoveFrom(null);
    setMoveDragOverIdx(null);
  };

  return {
    // Slots del equipo
    dragFromIdx,
    dragOverIdx,
    dragPointerPos,
    teamCardRefs,
    dragGhostEl,
    dragGhostSize,
    dragGrabOffset,
    captureSlotRects,
    startSlotDrag,
    // Movimientos
    dragMoveFrom,
    moveDragOverIdx,
    handleMoveDragStart,
    handleMoveDragEnd,
    handleMoveDragOver,
    handleMoveDrop,
  };
}
