"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** El diálogo nativo confina el foco, vuelve inerte el fondo y admite modales anidados. */
export function Modal({ children, label, onClose, className = "" }: {
  children: ReactNode; label: string; onClose: () => void; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // Foco en el contenedor: no abre el teclado virtual al mostrar un buscador.
    dialog.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog ref={ref} tabIndex={-1} aria-label={label} aria-modal="true"
      className={`m-0 h-dvh w-screen max-h-none max-w-none border-0 text-inherit outline-none ${className}`}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const dialog = event.currentTarget;
        const controls = [...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
        )].filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {children}
    </dialog>, document.body
  );
}
