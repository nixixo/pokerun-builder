import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

interface AnchoredDropdownProps {
  /** Mapa de nodos del DOM que se completa con los refs del componente padre. */
  anchorRefs: React.RefObject<Record<string | number, HTMLElement | null>>;
  anchorKey: string | number;
  open: boolean;
  children: React.ReactNode;
}

export function AnchoredDropdown({ anchorRefs, anchorKey, open, children }: AnchoredDropdownProps) {
  const [position, setPosition] = useState<React.CSSProperties | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // El ancla envuelve al desplegable. Su callback ref se adjunta después
  // de los efectos de layout del hijo, especialmente si cambia en cada render.
  // Leerlo en un efecto pasivo espera a que React termine de adjuntar los refs.
  // Se vuelve a leer en cada commit por si la fila reemplaza su ancla.
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sin deps a propósito
  useEffect(() => {
    const actual = anchorRefs.current[anchorKey] ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver arriba
    setAnchorEl((prev) => (prev === actual ? prev : actual));
  });

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      // Borrar la posición al cerrar: si no, al reabrir sobre otra fila se
      // pintaría un frame en el sitio de la anterior. Misma excepción que
      // arriba (medir el DOM va después del commit, por definición).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition(null);
      return;
    }
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const gap = 6;
      const spaceAbove = r.top - gap;
      const spaceBelow = window.innerHeight - r.bottom - gap;
      const openAbove = spaceBelow < 224 && spaceAbove > spaceBelow;
      setPosition({
        top: openAbove ? undefined : r.bottom + gap,
        bottom: openAbove ? window.innerHeight - r.top + gap : undefined,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(0, openAbove ? spaceAbove : spaceBelow),
        overflowY: "auto",
      });
    };
    update();
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (portalRef.current && target && portalRef.current.contains(target)) return;
      update();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorEl]);

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <div ref={portalRef} data-move-dropdown="true" style={{ position: "fixed", zIndex: 9999, ...position }}>
      {children}
    </div>,
    document.body
  );
}
