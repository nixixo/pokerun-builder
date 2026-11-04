import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { Slot } from "../../types";
import { buildSpriteStyle, Z_SLOT_SPRITE_ZOOM_OVERRIDES } from "../../utils/spriteHelpers";
import { SpriteImg } from "../SpriteImg";

type DragGhostPortalProps = {
  dragFromIdx: number | null;
  dragPointerPos: { x: number; y: number } | null;
  dragGhostEl: RefObject<HTMLDivElement | null>;
  dragGhostSize: RefObject<{ w: number; h: number }>;
  dragGrabOffset: RefObject<{ x: number; y: number }>;
  team: Slot[];
};

/**
 * Tarjeta fantasma que sigue al cursor/dedo mientras se arrastra un slot del
 * equipo (drag & drop de los 6 slots, no de movimientos). Extraído tal cual
 * del render principal de TeamBuilder.tsx (Fase 6) — sin cambios de lógica,
 * solo movido a su propio componente.
 */
export function DragGhostPortal({
  dragFromIdx,
  dragPointerPos,
  dragGhostEl,
  dragGhostSize,
  dragGrabOffset,
  team,
}: DragGhostPortalProps) {
  if (dragFromIdx === null || !dragPointerPos || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={dragGhostEl}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: dragGhostSize.current.w || undefined,
        height: dragGhostSize.current.h || undefined,
        pointerEvents: "none",
        zIndex: 9999,
        transform: `translate(${dragPointerPos.x - dragGrabOffset.current.x}px, ${dragPointerPos.y - dragGrabOffset.current.y}px) rotate(-2deg) scale(1.03)`,
        willChange: "transform",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
      }}
      className="rounded-lg border-2 border-blue-400/80 bg-slate-900/95 p-1.5 flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-2">
        <div className="w-12 h-12 bg-[#031421] rounded-lg overflow-hidden flex items-center justify-center shrink-0">
          <SpriteImg
            src={team[dragFromIdx]?.sprite ?? null}
            alt={team[dragFromIdx]?.name ?? ""}
            className="w-10 h-10 object-contain"
            style={buildSpriteStyle(team[dragFromIdx]?.spriteTransform, Z_SLOT_SPRITE_ZOOM_OVERRIDES[team[dragFromIdx]?.name ?? ""])}
            placeholderClassName="h-6 w-6 opacity-40"
          />
        </div>
        <span className="text-sm font-semibold text-slate-100 truncate">
          {team[dragFromIdx]?.name || "—"}
        </span>
      </div>
    </div>,
    document.body
  );
}
