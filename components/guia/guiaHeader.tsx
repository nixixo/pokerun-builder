// components/guia/GuiaHeader.tsx
//
// Header "hero" de la Guía, calcado del lenguaje visual de BuilderHeader.tsx
// (mismo gradiente de fondo, radar decorativo, trazas de circuito, grid
// blueprint y pokébola gigante de fondo) para que ambas páginas se sientan
// del mismo Design System. Sin cambios de estructura/funcionalidad respecto
// al header simple anterior: sigue recibiendo lo mismo (búsqueda global,
// toggle lista/mapa, conteo de zonas visitadas) — solo cambia la piel.
//
// Volver al Builder con la dex correcta: la Guía es siempre de Pokémon Z,
// así que al click en "Builder" se escribe POKEDEX_KEY en localStorage
// (misma clave que usa el Builder para recordar la pokédex activa) ANTES
// de navegar. Si el Builder no encuentra esa clave al montar usa lo que
// ya tenía guardado, por eso esto es un "empujón" y no un cambio de
// comportamiento del Builder en sí.

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, List, Map as MapIcon, BookOpen, Sparkles, Users, Disc3, Egg, Compass } from "lucide-react";
import { POKEDEX_KEY } from "../team-builder/utils/constants";

import { COLLECTION_TOTALS } from "./collectionTotals";

export function GuiaHeader({
  visitedCount,
  totalZones,
  view,
  onViewChange,
  collection,
  children, // slot para el buscador global (GlobalSearch), se renderiza a la derecha
}: {
  visitedCount: number;
  totalZones: number;
  view: "lista" | "mapa";
  onViewChange: (v: "lista" | "mapa") => void;
  // Conteos EN VIVO del progreso guardado por el usuario (mismos
  // valores que alimentan el resumen de Colección en el sidebar) —
  // no se recalculan acá para evitar que se desincronicen.
  collection: { paginas: number; mts: number; nidos: number; habitantes: number };
  children?: React.ReactNode;
}) {
  const pct = totalZones > 0 ? Math.round((visitedCount / totalZones) * 100) : 0;

  const statBadges = [
    {
      label: "Páginas",
      value: collection.paginas,
      total: COLLECTION_TOTALS.paginas,
      Icon: Sparkles,
      className: "border-violet-500/40 bg-violet-500/10 text-violet-300",
    },
    {
      label: "Habitantes",
      value: collection.habitantes,
      total: COLLECTION_TOTALS.habitantes,
      Icon: Users,
      className: "border-teal-500/40 bg-teal-500/10 text-teal-300",
    },
    {
      label: "MTs",
      value: collection.mts,
      total: COLLECTION_TOTALS.mts,
      Icon: Disc3,
      className: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
    },
    {
      label: "Nidos Alfa",
      value: collection.nidos,
      total: COLLECTION_TOTALS.nidos,
      Icon: Egg,
      className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    },
  ];

  // Antes de volver al Builder, forzamos la pokédex activa a "Pokémon Z"
  // (la Guía es 100% de ese juego, no tiene sentido volver con otra dex
  // seleccionada). Guardamos en el mismo localStorage key que usa el
  // Builder para persistir la pokédex entre sesiones.
  function handleBackToBuilder() {
    try {
      localStorage.setItem(POKEDEX_KEY, "pokemon-z");
    } catch {
      // localStorage no disponible (SSR/modo privado): la navegación
      // sigue funcionando igual, solo no se fuerza la dex.
    }
  }

  return (
    <header className="mb-6 sm:mb-8">
      {/* Top bar — logo + marca a la izquierda (igual que el Builder), controles propios de la Guía a la derecha.
          Con flex-wrap porque en un móvil de 375px la marca (203px) y los
          controles (289px) no caben en la misma línea, y sin envolver sacaban
          scroll horizontal a la página entera. En pantalla ancha no cambia
          nada: caben de sobra en una línea. */}
      <div className="mb-4 flex flex-col items-stretch gap-2 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3">
        <div className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo.png"
            alt="Pokerun Builder"
            width={512}
            height={512}
            className="h-14 w-14 shrink-0 object-contain drop-shadow"
          />
          <span className="text-[13px] uppercase tracking-[0.25em] text-slate-500 font-medium">
            PokeRun Guía
          </span>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-start sm:gap-3">
          {children}

          {/* Toggle lista / mapa — mismo patrón que el toggle simple/advanced del Builder */}
          <div className="flex items-center rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5 gap-0.5 shrink-0">
            {([
              ["lista", List],
              ["mapa", MapIcon],
            ] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewChange(mode)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition ${
                  view === mode ? "bg-sky-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{mode === "lista" ? "Lista" : "Mapa"}</span>
              </button>
            ))}
          </div>

          {/* GitHub / Discord — mismos íconos, mismo lugar y estilo que en BuilderHeader */}
          <div className="hidden sm:flex items-center gap-2">
            <a
              href="https://github.com/nixixo"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub: nixixo"
              className="flex items-center justify-center h-7 w-7 rounded-full border border-slate-700/60 bg-slate-900/70 text-slate-400 transition hover:text-slate-100 hover:border-slate-500"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
            </a>
            <a
              href="https://discord.com/users/436280183977279500"
              target="_blank"
              rel="noopener noreferrer"
              title="Discord: .nixixo"
              className="flex items-center justify-center h-7 w-7 rounded-full border border-slate-700/60 bg-slate-900/70 text-slate-400 transition hover:text-slate-100 hover:border-slate-500"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.26a18.27 18.27 0 0 0-5.48 0 12.6 12.6 0 0 0-.62-1.26.08.08 0 0 0-.08-.04c-1.7.29-3.36.8-4.89 1.52a.07.07 0 0 0-.03.03C.53 8.6-.32 12.7.1 16.76a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.28a.07.07 0 0 1 .08 0c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08 0c.12.1.24.19.37.28a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.11c.36.7.78 1.37 1.23 2a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6.01-3.03.08.08 0 0 0 .03-.06c.5-4.7-.83-8.76-3.5-12.36a.06.06 0 0 0-.03-.03ZM8.02 14.34c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z" />
              </svg>
            </a>
          </div>

          {/* Volver al Builder — fuerza la pokédex a "Pokémon Z" antes de navegar */}
          <Link
            href="/"
            onClick={handleBackToBuilder}
            className="flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-1.5 text-slate-300 transition hover:border-sky-500/50 hover:text-sky-300 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline text-[13px] font-semibold uppercase tracking-[0.14em]">Builder</span>
          </Link>
        </div>
      </div>

      {/* Hero block — idéntico en técnica decorativa al de BuilderHeader */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-[#050f1f] to-[#03091a] px-4 py-3 sm:px-8 sm:py-4 shadow-xl shadow-black/40">
        {/* Radar decorativo (esquina sup. derecha) */}
        <svg
          className="pointer-events-none absolute -right-6 -top-6 h-56 w-56 opacity-[0.16]"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="94" fill="none" stroke="#38bdf8" strokeWidth="1" />
          <circle cx="100" cy="100" r="68" fill="none" stroke="#38bdf8" strokeWidth="1" />
          <circle cx="100" cy="100" r="42" fill="none" stroke="#38bdf8" strokeWidth="1" />
          <circle cx="100" cy="100" r="16" fill="none" stroke="#38bdf8" strokeWidth="1" />
          <line x1="100" y1="4" x2="100" y2="196" stroke="#38bdf8" strokeWidth="1" />
          <line x1="4" y1="100" x2="196" y2="100" stroke="#38bdf8" strokeWidth="1" />
        </svg>

        {/* Trazas tipo circuito (esquina sup. izquierda) */}
        <svg
          className="pointer-events-none absolute -left-4 -top-4 h-28 w-40 opacity-[0.18]"
          viewBox="0 0 160 112"
          aria-hidden="true"
        >
          <path d="M0 24 L28 24 L44 8 L72 8" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M0 56 L16 56 L32 72 L64 72 L80 56 L112 56" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M0 90 L40 90 L52 102" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          <circle cx="72" cy="8" r="3" fill="#38bdf8" />
          <circle cx="112" cy="56" r="3" fill="#38bdf8" />
          <circle cx="52" cy="102" r="3" fill="#38bdf8" />
        </svg>

        {/* Grid tipo blueprint */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,#7dd3fc 0,#7dd3fc 1px,transparent 1px,transparent 28px),repeating-linear-gradient(90deg,#7dd3fc 0,#7dd3fc 1px,transparent 1px,transparent 28px)",
          }}
        />

        {/* Pokébola grande de fondo, centrada */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 sm:h-80 sm:w-80 -translate-x-1/2 -translate-y-1/2 opacity-[0.14]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle cx="100" cy="100" r="96" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <line x1="4" y1="100" x2="196" y2="100" stroke="#e2e8f0" strokeWidth="3" />
            <circle cx="100" cy="100" r="20" fill="#050f1f" stroke="#e2e8f0" strokeWidth="3" />
            <circle cx="100" cy="100" r="9" fill="none" stroke="#e2e8f0" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Title + subtitle */}
          <div className="min-w-0 sm:flex-1">
            <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 self-center text-sky-300 drop-shadow" />
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none">PokeRun</h1>
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent leading-none">
                Guía
              </span>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-400/70 font-semibold leading-snug">
              Zonas · Pokémon · Objetos · Entrenadores
            </p>
            <p className="text-[13px] sm:text-xs text-slate-400 max-w-lg leading-snug hidden sm:block mt-0.5">
              Walkthrough completo de Pokémon Z, zona por zona.
            </p>
          </div>

          {/* Todo el bloque de estadísticas pegado a la derecha: grid
              fijo de 2 columnas x 3 filas. Fila 1 = zonas exploradas
              (ocupa las 2 columnas), filas 2 y 3 = los 4 labels de
              colección, 2 por fila. */}
          <div className="ml-auto grid grid-cols-2 grid-rows-3 gap-x-5 gap-y-1.5 shrink-0">
            {/* Fila 1 — Zonas Exploradas, ocupa las 2 columnas */}
            <div className="col-span-2 flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Zonas Exploradas</span>
              <span className="text-sm font-extrabold tabular-nums leading-none text-emerald-300">{visitedCount}</span>
              <span className="text-[12px] font-medium text-emerald-400/60 leading-none">
                / {totalZones} · {pct}%
              </span>
              <div className="ml-1 h-1.5 w-16 shrink-0 rounded-full bg-emerald-950/60">
                <div
                  className="h-full rounded-full bg-emerald-400 shadow-[0_0_5px_#34d39999]"
                  style={{ width: `${pct}%`, transition: "width 0.6s ease-out" }}
                />
              </div>
            </div>

            {/* Filas 2 y 3 — 4 labels de colores, 2 por fila (el grid
                los acomoda solo en orden: fila 2 = índices 0 y 1,
                fila 3 = índices 2 y 3). */}
            {statBadges.map(({ label, value, total, Icon, className }) => (
              <span
                key={label}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${className}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">
                  {value}/{total}
                </span>
                <span className="uppercase tracking-wide opacity-80">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
