"use client";

import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface FloatingTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  preferredPlacement?: TooltipPlacement;
  className?: string;
  tooltipClassName?: string;
}

export function FloatingTooltip({
  content,
  children,
  preferredPlacement = "top",
  className = "",
  tooltipClassName = "",
}: FloatingTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // `ready` es "ya está medido y colocado": hasta entonces el tooltip se pinta
  // transparente para que no se vea saltar de una esquina a su sitio. Se apaga
  // al ocultar, en el mismo sitio donde se oculta — antes lo hacía un efecto,
  // que es un render de más y además esconde el porqué.
  const [ready, setReady] = useState(false);

  const mostrar = () => setVisible(true);
  const ocultar = () => {
    setVisible(false);
    setReady(false);
  };
  const [coords, setCoords] = useState<{ top: number; left: number; placement: TooltipPlacement }>({
    top: 0,
    left: 0,
    placement: preferredPlacement,
  });

  const computePosition = () => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tr = trigger.getBoundingClientRect();
    const tt = tooltip.getBoundingClientRect();

    const space = {
      top: tr.top,
      bottom: vh - tr.bottom,
      left: tr.left,
      right: vw - tr.right,
    };

    // Orden de preferencia: la solicitada primero, luego el resto por espacio disponible.
    const order: TooltipPlacement[] = [
      preferredPlacement,
      ...(["top", "bottom", "left", "right"] as TooltipPlacement[]).filter((p) => p !== preferredPlacement),
    ];

    let placement = order.find((p) => {
      if (p === "top") return space.top >= tt.height + margin;
      if (p === "bottom") return space.bottom >= tt.height + margin;
      if (p === "left") return space.left >= tt.width + margin;
      return space.right >= tt.width + margin;
    });

    // Si no hay espacio perfecto en ninguna dirección, usamos la que tenga más espacio disponible.
    if (!placement) {
      placement = (Object.entries(space).sort((a, b) => b[1] - a[1])[0][0] as TooltipPlacement);
    }

    let top = 0;
    let left = 0;

    if (placement === "top" || placement === "bottom") {
      top = placement === "top" ? tr.top - tt.height - margin : tr.bottom + margin;
      left = tr.left + tr.width / 2 - tt.width / 2;
      left = Math.min(Math.max(left, margin), vw - tt.width - margin);
    } else {
      left = placement === "left" ? tr.left - tt.width - margin : tr.right + margin;
      top = tr.top + tr.height / 2 - tt.height / 2;
      top = Math.min(Math.max(top, margin), vh - tt.height - margin);
    }

    setCoords({ top, left, placement });
  };

  useLayoutEffect(() => {
    if (!visible) return;
    computePosition();
    // Pequeño frame extra para asegurar medidas correctas tras el primer render.
    const raf = requestAnimationFrame(() => {
      computePosition();
      setReady(true);
    });
    const onScrollOrResize = () => computePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleOutside = (e: Event) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        ocultar();
      }
    };
    document.addEventListener("touchstart", handleOutside);
    return () => document.removeEventListener("touchstart", handleOutside);
  }, [visible]);

  const offsetClass =
    coords.placement === "top" ? "translate-y-1" :
    coords.placement === "bottom" ? "-translate-y-1" :
    coords.placement === "left" ? "translate-x-1" : "-translate-x-1";

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={mostrar}
      onMouseLeave={ocultar}
      onClick={() => (visible ? ocultar() : mostrar())}
    >
      {children}
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
            className={`pointer-events-none transition-[opacity,transform] duration-150 ease-out ${ready ? "opacity-100 translate-x-0 translate-y-0" : `opacity-0 ${offsetClass}`} ${tooltipClassName}`}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}
