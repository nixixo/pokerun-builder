import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

interface AnchoredDropdownProps {
  /**
   * Mapa de anclas (el que llena el `ref` de cada fila) más la clave de esta.
   *
   * Antes esto era `anchorEl: HTMLElement | null` y el padre lo sacaba leyendo
   * `refs.current[idx]` EN PLENO RENDER. Además de romper las Reglas de React,
   * daba mal el primer render: en la pasada en la que el ancla se monta,
   * `.current` todavía es null, así que el desplegable no tenía dónde
   * colocarse y solo acertaba cuando algo más forzaba un repintado.
   *
   * Pasando el ref, la lectura ocurre dentro del useLayoutEffect de abajo —
   * después del commit, cuando el elemento ya existe de verdad.
   */
  anchorRefs: React.RefObject<Record<string | number, HTMLElement | null>>;
  anchorKey: string | number;
  open: boolean;
  children: React.ReactNode;
}

export function AnchoredDropdown({ anchorRefs, anchorKey, open, children }: AnchoredDropdownProps) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Sin array de dependencias A PROPÓSITO: se re-lee el ancla en cada commit,
  // que es lo que hacía la versión anterior leyendo el ref en pleno render —
  // solo que aquí ocurre después del commit, cuando el elemento ya está.
  //
  // Hace falta porque el ancla no siempre existe en el momento en que `open`
  // pasa a true: el input de movimiento vive dentro de un ternario y se monta
  // en el mismo commit. Con dependencias estables el efecto se ejecutaba una
  // vez, no encontraba nada y no volvía a intentarlo nunca.
  //
  // No hay bucle: si el elemento es el mismo, setAnchorEl devuelve el estado
  // anterior y React corta el re-render ahí.
  //
  // `set-state-in-effect` marca esto y no debería: el DOM ES el sistema externo
  // con el que hay que sincronizarse, y medirlo solo se puede después del
  // commit. Es justo para lo que existe useLayoutEffect, y React lo hace antes
  // de pintar, así que el render de más no se ve.
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sin deps a propósito
  useLayoutEffect(() => {
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
      setRect(null);
      return;
    }
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      setRect({ top: r.bottom + 6, left: r.left, width: r.width });
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

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <div ref={portalRef} data-move-dropdown="true" style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 9999 }}>
      {children}
    </div>,
    document.body
  );
}
