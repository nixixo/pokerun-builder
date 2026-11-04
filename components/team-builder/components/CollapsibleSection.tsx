"use client";

import React, { useState, useRef, useLayoutEffect, useEffect } from "react";

interface CollapsibleSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  guide?: React.ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  as?: "section" | "div";
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  headerExtra,
  guide,
  defaultOpen = true,
  storageKey,
  as = "section",
  className = "",
  headerClassName = "",
  bodyClassName = "",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return defaultOpen;
    }
    const stored = window.localStorage.getItem(`pokerun-collapse-${storageKey}`);
    if (stored !== null) {
      return stored === "1";
    }
    return defaultOpen;
  });
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(`pokerun-collapse-${storageKey}`, open ? "1" : "0");
    }
  }, [storageKey, open]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<string>(open ? "none" : "0px");
  const firstRender = useRef(true);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (open) {
      const target = el.scrollHeight;
      setMaxHeight(`${target}px`);
      const timeout = setTimeout(() => setMaxHeight("none"), 320);
      return () => clearTimeout(timeout);
    } else {
      if (maxHeight === "none") {
        setMaxHeight(`${el.scrollHeight}px`);
        requestAnimationFrame(() => setMaxHeight("0px"));
      } else {
        setMaxHeight("0px");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, children]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(`pokerun-collapse-${storageKey}`, open ? "1" : "0");
    }
  }, [open, storageKey]);

  const Wrapper = as;

  return (
    <Wrapper className={className}>
      <div className={`flex items-center justify-between gap-2 flex-wrap ${headerClassName}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 sm:gap-3 text-left flex-1 min-w-0 group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
        >
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition-transform duration-300 group-hover:text-slate-200"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▸
          </span>
          {icon}
          <span className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-semibold tracking-tight text-slate-100 min-w-0">
            {title}
          </span>
        </button>
        {/* Sin `shrink-0`: estos controles son varios botones con texto ("Solo
            aprendibles", "Plantillas", "Limpiar equipo", "Fakemon") y sumaban
            563px dentro de una pantalla de 375, sacándole scroll horizontal a
            la página entera. La fila de fuera ya envuelve, pero este grupo era
            UN solo item que se negaba a ceder; con flex-wrap y min-w-0 se parte
            en varias líneas cuando no cabe. */}
        {headerExtra && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">{headerExtra}</div>
        )}
      </div>
      <div
        style={{
          maxHeight,
          overflow: maxHeight === "none" ? "visible" : "hidden",
          transition: "max-height 300ms ease",
        }}
      >
        <div ref={contentRef} className={bodyClassName}>
          {guide && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-700/50 bg-sky-950/40 px-4 py-3 text-[14px] sm:text-[15px] leading-relaxed text-sky-200">
              <span className="shrink-0 text-xl leading-none">💡</span>
              <span>{guide}</span>
            </div>
          )}
          {children}
        </div>
      </div>
    </Wrapper>
  );
}
