import type { RefObject } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Lang, Slot, TeamScore } from "../../types";
import { POKEDEX_OPTIONS, type PokedexId } from "../../utils/constants";
import { PokeballIcon } from "../PokeballIcon";
import { FloatingTooltip } from "../FloatingTooltip";
import { Sprout, Wrench, Backpack, Lock, Swords, Shield, TrendingUp, Puzzle, BookOpen } from "lucide-react";

type BuilderHeaderProps = {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  FlagES: React.ComponentType<{ className?: string }>;
  FlagGB: React.ComponentType<{ className?: string }>;
  t: Record<string, string>;

  activePokedex: PokedexId;
  onSwitchPokedex: (id: PokedexId) => void;
  pokedexDropdownOpen: boolean;
  onTogglePokedexDropdown: () => void;
  pokedexDropdownRef: RefObject<HTMLDivElement | null>;
  pokemonZCount: number;
  movesZCount: number;

  isAdvanced: boolean;
  viewMode: "simple" | "advanced";
  onViewModeChange: (mode: "simple" | "advanced") => void;

  onOpenItemsModal: () => void;

  team: Slot[];
  teamScore: TeamScore | null;
  getStatColor: (value: number) => string;
};

/**
 * Barra superior de la app: logo, selector de pokédex (estándar / Z), toggle
 * modo simple/avanzado, toggle de idioma, links a GitHub/Discord, y el bloque
 * "hero" con título, puntaje circular del equipo y resumen (equipo/tipos/con
 * stats) + botón de objetos. Extraído tal cual del render principal de
 * TeamBuilder.tsx (Fase 6) — sin cambios de lógica ni de estilos.
 */
export function BuilderHeader({
  lang,
  onLangChange,
  FlagES,
  FlagGB,
  t,
  activePokedex,
  onSwitchPokedex,
  pokedexDropdownOpen,
  onTogglePokedexDropdown,
  pokedexDropdownRef,
  pokemonZCount,
  movesZCount,
  isAdvanced,
  viewMode,
  onViewModeChange,
  onOpenItemsModal,
  team,
  teamScore,
  getStatColor,
}: BuilderHeaderProps) {
  // Cuántos Pokémon cumplen ya la condición para que se calcule la puntuación.
  //
  // El requisito real (ver teamScore en hooks/useTeamSummary.ts) son 3 Pokémon
  // CON SUS 4 MOVIMIENTOS puestos, no 3 Pokémon a secas. El cartel decía "Se
  // calcula con 3+ Pokémon", así que con tres puestos y sin movimientos se
  // quedaba bloqueado sin explicar qué faltaba — se nota sobre todo en la
  // Pokédex normal, donde los movimientos se eligen a mano uno por uno.
  const listosParaPuntuar = team.filter(
    (s) => s.name.trim() !== "" && s.moves.filter((m) => m.name && m.name.trim() !== "").length >= 4
  ).length;

  return (
    <header className="mb-6 sm:mb-8">
      {/* Top bar.
          Envuelve en las dos filas: la marca y el bloque de controles (selector
          de Pokédex + Sencillo/Avanzado + idioma) sumaban 463px dentro de una
          pantalla de 375, y sin envolver le sacaban scroll horizontal a la
          página entera. En pantalla ancha caben de sobra en una línea y no
          cambia nada. Mismo arreglo que ya lleva la cabecera de la Guía. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mb-4 sm:mb-5">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/logo.png"
            alt="Pokerun Builder"
            width={512}
            height={512}
            className="h-14 w-14 shrink-0 object-contain drop-shadow"
          />
          <span className="truncate text-[13px] uppercase tracking-[0.25em] text-slate-500 font-medium">PokeRun Builder</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Pokedex selector — dropdown personalizado con opciones "gordas" */}
          <div className="relative" ref={pokedexDropdownRef}>
            <button
              type="button"
              onClick={onTogglePokedexDropdown}
              // El rótulo de al lado va en `hidden xs:inline`, así que por
              // debajo de ese ancho este botón es SOLO un icono y se queda sin
              // nombre que anunciar. La etiqueta dice además cuál está activa,
              // que es justo lo que el icono no puede decir.
              aria-label={`${lang === "es" ? "Pokédex" : "Pokédex"}: ${POKEDEX_OPTIONS.find((p) => p.id === activePokedex)?.label}`}
              aria-expanded={pokedexDropdownOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activePokedex === "pokemon-z"
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                  : "border-slate-700/60 bg-slate-900/70 text-slate-200"
              } hover:brightness-110`}
            >
              {activePokedex === "pokemon-z" ? (
                <Image
                  src="/pokemon-z-logo.webp"
                  alt="Pokémon Z"
                  width={435}
                  height={384}
                  className="h-6 w-6 shrink-0 object-contain drop-shadow"
                />
              ) : (
                <PokeballIcon className="h-5 w-5 shrink-0" />
              )}
              <span className="hidden xs:inline">
                {POKEDEX_OPTIONS.find((p) => p.id === activePokedex)?.label}
              </span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${pokedexDropdownOpen ? "rotate-180" : ""}`}
              >
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {pokedexDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 rounded-2xl border border-slate-700/70 bg-slate-950/98 p-2 shadow-2xl shadow-black/60 z-50">
                <button
                  type="button"
                  onClick={() => onSwitchPokedex("standard")}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    activePokedex === "standard"
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-transparent hover:bg-slate-800/70"
                  }`}
                >
                  <PokeballIcon className="h-9 w-9 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-100">Pokedex</span>
                    <span className="block text-[13px] text-slate-500 leading-snug">
                      {lang === "es" ? "Pokedex Nacional" : "National Pokedex"}
                    </span>
                  </span>
                  {activePokedex === "standard" && (
                    <span className="ml-auto shrink-0 text-blue-400">✓</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSwitchPokedex("pokemon-z")}
                  className={`mt-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    activePokedex === "pokemon-z"
                      ? "border-yellow-500/50 bg-yellow-500/10"
                      : "border-transparent hover:bg-slate-800/70"
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                    <Image
                      src="/pokemon-z-logo.webp"
                      alt="Pokémon Z"
                      width={435}
                      height={384}
                      className="h-full w-full object-contain drop-shadow"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-100">Pokémon Z</span>
                    {pokemonZCount > 0 && movesZCount > 0 ? (
                      <span className="block text-[13px] text-slate-500 leading-snug">
                        {`${pokemonZCount} Pokémon · ${movesZCount} ${lang === "es" ? "movimientos" : "moves"}`}
                      </span>
                    ) : pokemonZCount > 0 ? (
                      <span className="mt-1 block h-2.5 w-24 rounded bg-slate-700/60 animate-pulse" aria-hidden="true" />
                    ) : (
                      <span className="block text-[13px] text-slate-500 leading-snug">
                        {lang === "es" ? "Pokémon Customizados" : "Custom Pokemon"}
                      </span>
                    )}
                  </span>
                  {activePokedex === "pokemon-z" && (
                    <span className="ml-auto shrink-0 text-yellow-400">✓</span>
                  )}
                </button>
              </div>
            )}
          </div>
          {/* Mode toggle: simple / advanced */}
          <FloatingTooltip
            preferredPlacement="bottom"
            content={
              <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-xl text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-100 mb-1">{isAdvanced ? t.modeAdvanced : t.modeSimple}</p>
                <p>{isAdvanced ? t.modeAdvancedDesc : t.modeSimpleDesc}</p>
              </div>
            }
          >
            <div className="flex items-center rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5 gap-0.5">
              {([
                ["simple", Sprout],
                ["advanced", Wrench],
              ] as const).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  // Igual que el selector de Pokédex: el rótulo desaparece por
                  // debajo de `xs` y deja el botón mudo. `aria-pressed` además
                  // dice cuál de los dos está activo, que aquí solo lo cuenta
                  // el color de fondo.
                  aria-label={mode === "simple" ? t.modeSimple : t.modeAdvanced}
                  aria-pressed={viewMode === mode}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${viewMode === mode ? "bg-emerald-700 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span className="hidden xs:inline">{mode === "simple" ? t.modeSimple : t.modeAdvanced}</span>
                </button>
              ))}
            </div>
          </FloatingTooltip>
          {/* Language toggle */}
          <div className="flex items-center rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5 gap-0.5">
            {(["es", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLangChange(l)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${lang === l ? "bg-blue-700 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
              >
                {l === "es" ? <FlagES /> : <FlagGB />}
                {l === "es" ? "ES" : "EN"}
              </button>
            ))}
          </div>
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
        </div>
      </div>

      {/* Main hero block — compact */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-[#050f1f] to-[#03091a] px-4 py-3 sm:px-8 sm:py-4 shadow-xl shadow-black/40">
        {/* Radar decorativo (esquina sup. derecha): anillas concéntricas +
            cruz de mira, más marcado que el grid de fondo para que se sienta
            "instrumento" en vez de solo ruido visual. */}
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

        {/* Grid tipo blueprint (más notorio que antes) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,#7dd3fc 0,#7dd3fc 1px,transparent 1px,transparent 28px),repeating-linear-gradient(90deg,#7dd3fc 0,#7dd3fc 1px,transparent 1px,transparent 28px)",
          }}
        />

        {/* Pokebola grande de fondo, centrada en el hero: a propósito más
            grande que el alto del header para que el overflow-hidden del
            contenedor le recorte arriba y abajo, ocupando visualmente todo
            el centro en vez de ir metida adentro del gauge del puntaje. */}
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
          {/* Fila 1 en mobile: título + botón Objetos. En sm:+ el wrapper
              desaparece (sm:contents) y el título pasa a ser el item
              izquierdo del header; el botón Objetos de esta fila se oculta
              y reaparece agrupado junto a las stats (ver más abajo). */}
          <div className="flex items-start justify-between gap-3 sm:contents">
            {/* Title + subtitle */}
            <div className="min-w-0 sm:flex-1">
              <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
                <PokeballIcon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 self-center drop-shadow" />
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none">PokeRun</h1>
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent leading-none">Builder</span>
              </div>
              <p className="text-[12px] sm:text-[13px] uppercase tracking-[0.2em] text-sky-400/70 font-semibold leading-snug">
                {lang === "es" ? "Arma · Analiza · Mejora" : "Build · Analyze · Improve"}
              </p>
              <p className="text-[13px] sm:text-xs text-slate-400 max-w-md leading-snug hidden sm:block mt-0.5">{t.appSubtitle}</p>
            </div>

            {/* Botón Objetos — versión mobile (1ra fila, junto al título) */}
            <div className="flex sm:hidden items-center gap-1.5 shrink-0">
              {activePokedex === "pokemon-z" && (
                <Link
                  href="/guia"
                  className="flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sky-300 transition hover:border-sky-400/70 hover:bg-sky-500/20 hover:text-sky-200"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
                    {lang === "es" ? "Guía" : "Guide"}
                  </span>
                </Link>
              )}
              <button
                type="button"
                onClick={onOpenItemsModal}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700/40 bg-slate-900/60 px-3 py-1.5 text-slate-200 transition hover:border-amber-500/60 hover:text-amber-300"
              >
                <Backpack className="h-4 w-4 shrink-0" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
                  {lang === "es" ? "Objetos" : "Items"}
                </span>
              </button>
            </div>
          </div>

          {/* Team score — destacado, centro del hero.
              Se enseña SIEMPRE, también con el equipo vacío. Antes esperaba a
              que hubiera al menos un Pokémon puesto, así que quien entraba de
              cero no veía nada en el centro del banner y no llegaba a enterarse
              de que la puntuación existe — se notaba sobre todo en la Pokédex
              normal, donde no arrastras un equipo guardado de la guía.

              `order-first` (subirlo por encima del título en móvil) se reserva
              para cuando HAY nota: ahí es el dato protagonista y merece el sitio
              de honor. Bloqueado no, que sería un candado de 145px tapando el
              título del propio sitio; en ese caso se queda debajo, discreto. */}
          <div
            className={`flex justify-center shrink-0 sm:flex-1 ${teamScore ? "order-first sm:order-none" : ""}`}
          >
              {!teamScore ? (
                <div className="flex flex-col items-center gap-1 cursor-default">
                  <div className="relative h-[88px] w-[88px] sm:h-[104px] sm:w-[104px] flex items-center justify-center">
                    {/* El mismo anillo que la puntuación, pero midiendo el
                        avance hacia poder calcularla: así se ve de un vistazo
                        cuánto falta, con el mismo lenguaje visual. */}
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 absolute inset-0">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="9" />
                      {listosParaPuntuar > 0 && (
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          stroke="rgba(148,163,184,0.5)"
                          strokeWidth="9"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(listosParaPuntuar / 3, 1) * 263.9} 263.9`}
                          style={{ transition: "stroke-dasharray 0.6s ease-out" }}
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Lock className="h-5 w-5 text-slate-500" />
                      <span className="mt-1 text-[13px] font-bold tabular-nums text-slate-400">
                        {listosParaPuntuar}/3
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500 max-w-[130px] text-center leading-tight">
                    {t.teamScoreLocked}
                  </span>
                </div>
              ) : (
              <FloatingTooltip
                preferredPlacement="bottom"
                content={
                  <div className="w-80 rounded-2xl border border-slate-700 bg-slate-950/98 p-5 shadow-xl shadow-black/50 text-base text-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm uppercase tracking-[0.2em] text-slate-500">{t.teamScoreTitle}</div>
                      <div className="text-2xl font-extrabold tabular-nums" style={{ color: teamScore.grade.color }}>{teamScore.total}<span className="text-slate-500 text-sm font-medium">/100</span></div>
                    </div>
                    <div className="space-y-3.5">
                      {[
                        { key: "offense", label: t.teamScoreOffense, desc: t.teamScoreOffenseDesc, data: teamScore.offense, Icon: Swords },
                        { key: "defense", label: t.teamScoreDefense, desc: t.teamScoreDefenseDesc, data: teamScore.defense, Icon: Shield },
                        { key: "stats",   label: t.teamScoreStats,   desc: t.teamScoreStatsDesc,   data: teamScore.stats,   Icon: TrendingUp },
                        { key: "roles",   label: t.teamScoreRoles,   desc: t.teamScoreRolesDesc,   data: teamScore.roles,   Icon: Puzzle },
                      ].map(({ key, label, desc, data, Icon }) => (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-slate-300 flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 shrink-0" />{label}
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-slate-300">
                              {data.available ? `${data.score}/100` : t.teamScoreNotEnoughData}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full transition-[width,background-color]"
                              style={{ width: data.available ? `${data.score}%` : "0%", backgroundColor: getStatColor(data.score * 2.55) }}
                            />
                          </div>
                          <p className="text-[13px] text-slate-500 leading-snug">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              >
                <div className="flex flex-col items-center gap-1 cursor-default">
                  <div className="relative h-[88px] w-[88px] sm:h-[104px] sm:w-[104px]">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="9" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={teamScore.grade.color}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={`${(teamScore.total / 100) * 263.9} 263.9`}
                        style={{ transition: "stroke-dasharray 0.6s ease-out", filter: `drop-shadow(0 0 6px ${teamScore.grade.color}66)` }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none" style={{ color: teamScore.grade.color }}>{teamScore.total}</span>
                      <span className="text-[11px] text-slate-500 leading-none mt-0.5">/100</span>
                    </div>
                  </div>
                  <div
                    className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide"
                    style={{ color: teamScore.grade.color, backgroundColor: `${teamScore.grade.color}18`, border: `1px solid ${teamScore.grade.color}40` }}
                  >
                    {teamScore.grade.label}
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t.teamScore}</span>
                </div>
              </FloatingTooltip>
              )}
          </div>

          {/* Botón Objetos (versión desktop), a la derecha del header.
              sm:flex-1 + sm:justify-end equilibra este bloque con el título
              (que también es sm:flex-1), dejando el team score realmente
              centrado entre ambos. */}
          <div className="flex flex-col sm:flex-row sm:flex-1 sm:items-end sm:justify-end gap-2 shrink-0">
            {/* Botón Guía: solo visible con la Pokédex Z activa, ya que la
                guía es específica del walkthrough de Pokémon Z. */}
            {activePokedex === "pokemon-z" && (
              <Link
                href="/guia"
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 shrink-0 text-sky-300 transition hover:border-sky-400/70 hover:bg-sky-500/20 hover:text-sky-200"
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
                  {lang === "es" ? "Guía" : "Guide"}
                </span>
              </Link>
            )}
            {/* Botón Objetos: abre el buscador de objetos (nombre/descripción
                + filtro de originales Z). Oculto en mobile porque ahí se
                muestra en la 1ra fila, junto al título. */}
            <button
              type="button"
              onClick={onOpenItemsModal}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-700/40 bg-slate-900/60 px-3 py-1.5 shrink-0 text-slate-200 transition hover:border-amber-500/60 hover:text-amber-300"
            >
              <Backpack className="h-4 w-4 shrink-0" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
                {lang === "es" ? "Objetos" : "Items"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Pokedex movido arriba, a la barra superior del header */}
    </header>
  );
}