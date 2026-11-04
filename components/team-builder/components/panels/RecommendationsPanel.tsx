import { memo, useState } from "react";
import dynamic from "next/dynamic";
import type { Dispatch, SetStateAction } from "react";
import type { AvailablePokemon, BaseStats, Lang, Slot } from "../../types";
import type { DamageRelations } from "../../data/staticPokeData";
import type { MoveZ } from "../../types/pokemonZ";
import type { PokedexId } from "../../utils/constants";
import {
  GEN_RANGES,
  ROLES,
  BALANCED_ROLE,
  POKEDEX_OPTIONS,
  TYPE_COLORS,
} from "../../utils/constants";
import { getCandidateWeaknesses } from "../../utils/defensiveCalculations";
import type { useRecommendations } from "../../hooks/useRecommendations";
import type { useAbilityFilter } from "../../hooks/useAbilityFilter";
import { FloatingTooltip } from "../FloatingTooltip";
import {
  Star, Search, Lightbulb, BookOpen, Sparkles, Shield, Ban, Crown, Diamond,
  RefreshCw, X, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { RoleBadge } from "../RoleBadge";
import type { MoveFilterEntry } from "../MoveFilterModal";

// Ambos modales arrancan cerrados: su código se pide al abrirlos. `ssr: false`
// es lo que hace efectivo el split (ver nota en TeamBuilder.tsx).
const MoveFilterModal = dynamic(
  () => import("../MoveFilterModal").then((m) => m.MoveFilterModal),
  { ssr: false }
);
const AbilityFilterModal = dynamic(
  () => import("../AbilityFilterModal").then((m) => m.AbilityFilterModal),
  { ssr: false }
);

// Ajuste de zoom para sprites de candidatos con mucho espacio vacío (distinto
// de Z_SLOT_SPRITE_ZOOM_OVERRIDES, que es para tarjetas de slots del equipo).
// Solo lo usa este panel, así que quedó co-ubicado acá (antes vivía suelto en
// TeamBuilder.tsx).
const Z_SPRITE_ZOOM_OVERRIDES: Record<number, number> = {
  90005: 1.4, // Mega Delphox Z: se ve notablemente más chico que el resto
};

type RecommendationsPanelProps = {
  rec: ReturnType<typeof useRecommendations>;
  ability: ReturnType<typeof useAbilityFilter>;
  lang: Lang;
  t: Record<string, string>;
  tn: (apiKey: string) => string;
  badgeClass: (t: string) => string;
  isAdvanced: boolean;
  activePokedex: PokedexId;
  team: Slot[];
  typeRelations: Record<string, DamageRelations>;
  statLabels: [keyof BaseStats, string][];
  allTypes: string[];
  statNamesI18n: Record<Lang, Record<keyof BaseStats, string>>;
  statOrder: (keyof BaseStats)[];
  toggleRecFilterSortStat: (key: keyof BaseStats) => void;
  movesZData: MoveZ[];
  movesStandardData: MoveZ[];
  getStatColor: (value: number) => string;
  getAbilityDisplayName: (esName: string) => string;
  getStdAbilityLabel: (slug: string) => string;
  getStdAbilityDescription: (slug: string) => string;
  abilitiesZDescData: Record<string, { nameEn: string | null; nameEnDisplay?: string; description: string; descriptionEn?: string; customAbility?: boolean }>;
  zSpritesCache: Record<string, string>;
  zSpriteNaturalSizes: Record<string, number>;
  zSpritesTrimmed: Record<string, string>;
  setZSpriteNaturalSizes: Dispatch<SetStateAction<Record<string, number>>>;
  setZSpritesTrimmed: Dispatch<SetStateAction<Record<string, string>>>;
  addCandidateToTeam: (candidate: AvailablePokemon) => void;
  loadingAllPokemonData: boolean;
};

/**
 * Panel "Pokémon recomendados": el motor de recomendaciones completo — panel
 * de filtros (tipo, habilidad, movimiento, generación, rol, stats mínimas,
 * Megas/Gigamax) + grid de tarjetas de candidatos con razones/resistencias/
 * debilidades, más los dos modales que abre (filtro por movimiento y
 * exploración de habilidades). Extraído tal cual del render principal de
 * TeamBuilder.tsx (Fase 6) — es, con diferencia, la sección más grande y la
 * que más depende de useRecommendations/useAbilityFilter, por eso esos dos
 * hooks se reciben agrupados (`rec`/`ability`) en vez de como props sueltas:
 * evita ~60 props individuales y mantiene el tipo sincronizado si el hook
 * cambia.
 */
function RecommendationsPanelImpl(props: RecommendationsPanelProps) {
  const {
    rec: {
      pokemonRecommendations,
      recDiscarded, setRecDiscarded,
      expandedRec, setExpandedRec,
      recShowFilters, setRecShowFilters,
      recFilterTypes, setRecFilterTypes,
      recFilterType2, setRecFilterType2,
      recFilterGen, setRecFilterGen,
      recFilterFinalEvo, setRecFilterFinalEvo,
      recFilterLegendary, setRecFilterLegendary,
      recFilterOnlyOriginals, setRecFilterOnlyOriginals,
      recFilterNoDupTypes, setRecFilterNoDupTypes,
      recFilterPrioritizeCoverage, setRecFilterPrioritizeCoverage,
      recFilterRoleManual, setRecFilterRoleManual,
      recFilterSortStat, setRecFilterSortStat,
      recFilterMinStats, setRecFilterMinStats,
      recFilterShowMega, setRecFilterShowMega,
      recFilterShowGmax, setRecFilterShowGmax,
      recFilterZShowMega, setRecFilterZShowMega,
      recFilterMoves,
      recFilterMoveModalOpen, openMoveFilterModal, closeMoveFilterModal,
      recFilterMoveSearch, setRecFilterMoveSearch,
      recFilterMoveCategories, setRecFilterMoveCategories,
      recFilterMoveTypes, setRecFilterMoveTypes,
      recFilterMoveOnlyZ, setRecFilterMoveOnlyZ,
      recFilterMoveSortPower, setRecFilterMoveSortPower,
      addRecFilterMove, removeRecFilterMove, clearRecFilterMoveFilters, clearAllFilters,
    },
    ability: {
      recFilterAbility, setRecFilterAbility,
      recFilterAbilityOpen,
      recFilterAbilitySelectedIdx, setRecFilterAbilitySelectedIdx,
      recFilterAbilitySuggestions,
      handleAbilityInputChange, handleAbilityInputFocus, handleAbilityInputBlur, handleAbilityInputKeyDown,
      selectAbilitySuggestion,
      recAbilityModalOpen, openAbilityModal, closeAbilityModal,
      recAbilityModalSearch, setRecAbilityModalSearch,
      recAbilityModalDescSearch, setRecAbilityModalDescSearch,
      recAbilityModalOnlyZ, toggleAbilityModalOnlyZ,
      abilityModalEntries, selectAbilityFromModal,
    },
    lang, t, tn, badgeClass, isAdvanced, activePokedex, team, typeRelations, statLabels,
    allTypes, statNamesI18n: STAT_NAMES_I18N, statOrder: STAT_ORDER, toggleRecFilterSortStat,
    movesZData, movesStandardData, getStatColor, getAbilityDisplayName, getStdAbilityLabel, getStdAbilityDescription,
    abilitiesZDescData, zSpritesCache, zSpriteNaturalSizes, zSpritesTrimmed, setZSpriteNaturalSizes, setZSpritesTrimmed,
    addCandidateToTeam, loadingAllPokemonData,
  } = props;

  const [roleFilterLegendOpen, setRoleFilterLegendOpen] = useState(false);

  return (
    <>
      <div className="pokedex-panel p-3 sm:p-4 rounded-lg">
            {/* ── Pokémon recomendados ── */}
            <div className="space-y-3">
              {/* Header: título a la izquierda, botones de filtro a la derecha, todo en la misma fila */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 text-sm"><Star className="h-3.5 w-3.5" /></span>
                  <h2 className="text-base font-semibold tracking-tight text-slate-100">{t.recommendedPokemon}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(recDiscarded.size > 0 || recFilterTypes.length > 0 || recFilterType2 || recFilterAbility.trim() !== "" || recFilterGen !== null || (isAdvanced && recFilterRoleManual !== null) || recFilterSortStat !== null || Object.values(recFilterMinStats).some((v) => v.trim() !== "") || recFilterMoves.length > 0) && (
                    <button
                      type="button"
                      onClick={() => { clearAllFilters(); setRecFilterAbility(""); }}
                      className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition"
                    >
                      {t.recFilterReset}
                      {recDiscarded.size > 0 && ` (${recDiscarded.size} ${t.recFilterDiscarded})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRecShowFilters((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${recShowFilters || recFilterTypes.length > 0 || recFilterType2 || recFilterAbility.trim() !== "" || recFilterGen !== null || recFilterSortStat !== null || Object.values(recFilterMinStats).some((v) => v.trim() !== "") || recFilterMoves.length > 0 ? "border-sky-600 bg-sky-900/40 text-sky-300" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                  >
                    <Search className="h-3.5 w-3.5 shrink-0" /> {t.recFilterTitle}
                    {(recFilterTypes.length > 0 || recFilterType2 || recFilterAbility.trim() !== "" || recFilterGen !== null || recFilterSortStat !== null || Object.values(recFilterMinStats).some((v) => v.trim() !== "") || recFilterMoves.length > 0) && (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[11px] text-white font-bold">
                        {recFilterTypes.length + (recFilterType2 ? 1 : 0) + (recFilterAbility.trim() !== "" ? 1 : 0) + (recFilterGen !== null ? 1 : 0) + (recFilterSortStat !== null ? 1 : 0) + Object.values(recFilterMinStats).filter((v) => v.trim() !== "").length + recFilterMoves.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              {!isAdvanced && (
                <div className="flex items-start gap-3 rounded-xl border border-sky-700/50 bg-sky-950/40 px-4 py-3 text-[14px] sm:text-[15px] leading-relaxed text-sky-200">
                  <Lightbulb className="h-5 w-5 shrink-0" />
                  <span>{t.guideRecommendedSection}</span>
                </div>
              )}

              {/* Panel de filtros desplegable */}
              {recShowFilters && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                    {/* ══════════ COLUMNA IZQUIERDA ══════════ */}
                    <div className="space-y-2 md:pr-2 md:border-r md:border-slate-800">
                      {/* Switches rápidos */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pb-2 border-b border-slate-800/80">
                        {[
                          ...(activePokedex === "pokemon-z" ? [{ key: "onlyOriginals", Icon: BookOpen, label: lang === "es" ? `${POKEDEX_OPTIONS.find(p => p.id === activePokedex)?.label ?? activePokedex} ${t.recFilterOnlyOriginals}` : `Original ${POKEDEX_OPTIONS.find(p => p.id === activePokedex)?.label ?? activePokedex}`, value: recFilterOnlyOriginals, setter: setRecFilterOnlyOriginals as (v: boolean) => void }] : []),
                          { key: "finalEvo", Icon: Sparkles, label: t.recFilterFinalEvo, value: recFilterFinalEvo, setter: setRecFilterFinalEvo },
                          { key: "prioritizeCoverage", Icon: Shield, label: t.recFilterPrioritizeCoverage, value: recFilterPrioritizeCoverage, setter: setRecFilterPrioritizeCoverage },
                          { key: "noDup", Icon: Ban, label: t.recFilterNoDupTypes, value: recFilterNoDupTypes, setter: setRecFilterNoDupTypes },
                          { key: "legendary", Icon: Crown, label: t.recFilterLegendary, value: recFilterLegendary, setter: setRecFilterLegendary },
                          ...(activePokedex === "pokemon-z"
                            ? [
                                { key: "zMega", Icon: Diamond, label: lang === "es" ? "Mostrar Megas" : "Show Megas", value: recFilterZShowMega, setter: setRecFilterZShowMega },
                              ]
                            : [
                                { key: "stdMega", Icon: Diamond, label: lang === "es" ? "Mostrar Megas" : "Show Megas", value: recFilterShowMega, setter: setRecFilterShowMega },
                                { key: "stdGmax", Icon: RefreshCw, label: lang === "es" ? "Mostrar Gigamax" : "Show Gigantamax", value: recFilterShowGmax, setter: setRecFilterShowGmax },
                              ]),
                        ]
                          .filter((sw) => isAdvanced || (sw.key !== "noDup" && sw.key !== "prioritizeCoverage"))
                          .map(({ key, Icon, label, value, setter }) => (
                          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={value}
                              onClick={() => setter(!value)}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${value ? "bg-gradient-to-r from-sky-500 to-sky-400" : "bg-slate-700"}`}
                            >
                              <span
                                className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${value ? "translate-x-[22px]" : "translate-x-1"}`}
                              />
                            </button>
                            <span className="text-[15px] text-slate-300 leading-none whitespace-nowrap flex items-center gap-1">
                              <Icon className="h-3.5 w-3.5 shrink-0" />{label}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* Filtro por tipo — doble tipo */}
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterType}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {allTypes.map((type) => {
                            const active = recFilterTypes.includes(type);
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  setRecFilterTypes((prev) =>
                                    active ? prev.filter((t) => t !== type) : [type]
                                  );
                                  if (active) setRecFilterType2("");
                                }}
                                className={`${badgeClass(type)} text-[14px] leading-none px-2.5 py-2 transition ${active ? "ring-2 ring-white/40 scale-105" : "opacity-50 hover:opacity-80"}`}
                              >
                                {tn(type)}
                              </button>
                            );
                          })}
                        </div>
                        {recFilterTypes.length > 0 && (
                          <div className="mt-1.5">
                            <div className="text-[13px] uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                              {lang === "es" ? "Segundo tipo (opcional)" : "Second type (optional)"}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {allTypes
                                .filter((type) => type !== recFilterTypes[0])
                                .map((type) => {
                                  const active = recFilterType2 === type;
                                  return (
                                    <button
                                      key={type}
                                      type="button"
                                      onClick={() => setRecFilterType2(active ? "" : type)}
                                      className={`${badgeClass(type)} text-[14px] leading-none px-2.5 py-2 transition ${active ? "ring-2 ring-white/40 scale-105" : "opacity-40 hover:opacity-70"}`}
                                    >
                                      {tn(type)}
                                    </button>
                                  );
                                })}
                            </div>
                            {recFilterType2 && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-400">
                                <span>{lang === "es" ? "Mostrando:" : "Showing:"}</span>
                                <span className={`${badgeClass(recFilterTypes[0])} text-[12px] leading-none px-1.5 py-1`}>{tn(recFilterTypes[0])}</span>
                                <span className="text-slate-500">/</span>
                                <span className={`${badgeClass(recFilterType2)} text-[12px] leading-none px-1.5 py-1`}>{tn(recFilterType2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Filtro por habilidad — con autocompletado (modo avanzado, columna izquierda) */}
                      {isAdvanced && (
                      <div className="relative">
                        <div className="mb-1.5 text-[13px] uppercase tracking-[0.15em] text-slate-500">
                          {lang === "es" ? "Buscar por habilidad" : "Search by ability"}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={recFilterAbility}
                            maxLength={50}
                            onChange={(e) => handleAbilityInputChange(e.target.value)}
                            onFocus={handleAbilityInputFocus}
                            onBlur={handleAbilityInputBlur}
                            onKeyDown={(e) => handleAbilityInputKeyDown(e.key, () => e.preventDefault())}
                            placeholder={lang === "es" ? "Ej. Adaptable, Intimidación…" : "E.g. Adaptability, Intimidate…"}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-3 pr-9 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                          />
                          <button
                            type="button"
                            onClick={openAbilityModal}
                            title={lang === "es" ? "Explorar habilidades" : "Browse abilities"}
                            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                          >
                            <Search className="h-4 w-4" />
                          </button>
                        </div>
                        {recFilterAbilityOpen && recFilterAbilitySuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 text-sm shadow-xl" onMouseDown={(e) => e.preventDefault()}>
                            {recFilterAbilitySuggestions.map((ab, i) => (
                              <button
                                key={ab}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); selectAbilitySuggestion(ab); }}
                                onMouseEnter={() => setRecFilterAbilitySelectedIdx(i)}
                                className={`w-full px-3 py-2 text-left ${
                                  recFilterAbilitySelectedIdx === i ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                                }`}
                              >
                                {ab}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Filtro por movimiento — hasta 4 a la vez, el candidato debe
                          aprenderlos TODOS (modo avanzado, ambas pokédex) */}
                      {isAdvanced && (activePokedex === "pokemon-z" ? movesZData.length > 0 : movesStandardData.length > 0) && (
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">
                          {lang === "es" ? "Buscar por movimiento" : "Search by move"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recFilterMoves.map((mvName) => {
                            const mv = (activePokedex === "pokemon-z" ? movesZData : movesStandardData).find((m) => m.internalName === mvName);
                            const label = mv ? (lang === "es" ? mv.name : mv.nameEn) : mvName;
                            return (
                              <span
                                key={mvName}
                                className="inline-flex items-center gap-1.5 rounded-full border border-sky-700/50 bg-sky-900/30 px-2.5 py-1.5 text-[14px] leading-none text-sky-200"
                              >
                                {label}
                                <button
                                  type="button"
                                  onClick={() => removeRecFilterMove(mvName)}
                                  className="text-sky-400 hover:text-sky-100"
                                  aria-label={lang === "es" ? "Quitar" : "Remove"}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            );
                          })}
                          {recFilterMoves.length < 4 && (
                            <button
                              type="button"
                              onClick={openMoveFilterModal}
                              className="rounded-full border border-dashed border-slate-600 px-2.5 py-1.5 text-[14px] leading-none text-slate-400 transition hover:border-sky-500 hover:text-sky-300"
                            >
                              + {lang === "es" ? "Añadir movimiento" : "Add move"}
                            </button>
                          )}
                        </div>
                        {recFilterMoves.length > 0 && (
                          <div className="mt-1.5 text-[12px] text-slate-500">
                            {lang === "es" ? "Debe poder aprender todos los movimientos seleccionados." : "Must be able to learn all selected moves."}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Filtro por generación (modo avanzado, columna izquierda) — al final de la columna */}
                      {isAdvanced && (
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterGen}</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRecFilterGen(null)}
                            className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                          >
                            {t.recFilterGenAll}
                          </button>
                          {GEN_RANGES.map(({ gen, label }) => (
                            <button
                              key={gen}
                              type="button"
                              onClick={() => setRecFilterGen(recFilterGen === gen ? null : gen)}
                              className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === gen ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      )}
                    </div>

                    {/* ══════════ COLUMNA DERECHA ══════════ */}
                    <div className="space-y-2">
                      {/* Filtro por rol */}
                      {isAdvanced && (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500">
                            {lang === "es" ? "Filtrar por rol" : "Filter by role"}
                          </div>
                          <button
                            type="button"
                            onClick={() => setRoleFilterLegendOpen((v) => !v)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${roleFilterLegendOpen ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-sky-700/60 bg-sky-950/40 text-sky-300 hover:border-sky-500 hover:bg-sky-900/50 hover:text-sky-100"}`}
                          >
                            <span className="text-[14px]">ⓘ</span>
                            {lang === "es" ? "¿Qué significa cada rol?" : "What does each role mean?"}
                            <span className={`text-[12px] transition-transform ${roleFilterLegendOpen ? "rotate-180" : ""}`}>▾</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRecFilterRoleManual(null)}
                            className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterRoleManual === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                          >
                            {lang === "es" ? "Cualquier rol" : "Any role"}
                          </button>
                          {[...ROLES, BALANCED_ROLE].map((role) => {
                            const label = role[lang as "es" | "en"];
                            const active = recFilterRoleManual === label;
                            return (
                              <button
                                key={role.en}
                                type="button"
                                onClick={() => setRecFilterRoleManual(active ? null : label)}
                                className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${active ? "" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                                style={active ? { borderColor: role.color, backgroundColor: `${role.color}22`, color: role.color } : {}}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {roleFilterLegendOpen && (
                          <div className="mt-2 space-y-1.5 rounded-lg border border-slate-700/60 bg-slate-900/70 p-2.5">
                            {[...ROLES, BALANCED_ROLE].map((role) => {
                              const label = role[lang as "es" | "en"];
                              const keyStats = (Object.entries(role.weights) as [keyof BaseStats, number][])
                                .filter(([, w]) => (w ?? 0) > 0)
                                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
                              const statNames = STAT_NAMES_I18N[lang];
                              return (
                                <div key={role.en} className="text-[14px] leading-snug">
                                  <div className="flex flex-wrap items-baseline gap-1.5">
                                    <span className="font-semibold" style={{ color: role.color }}>{label}:</span>
                                    <span className="text-slate-400">{lang === "es" ? role.descEs : role.descEn}</span>
                                  </div>
                                  {keyStats.length > 0 && (
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                      {keyStats.map(([statKey]) => (
                                        <span
                                          key={statKey}
                                          className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-slate-200"
                                        >
                                          {statNames[statKey]}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Ordenar por stat más alta */}
                      <div>
                        <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterSortStatTitle}</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRecFilterSortStat(null)}
                            className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterSortStat === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                          >
                            {t.recFilterSortStatNone}
                          </button>
                          {statLabels.map(([key, label]) => {
                            const active = recFilterSortStat === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => toggleRecFilterSortStat(key)}
                                className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${active ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* En modo sencillo: habilidad y generación se muestran acá, a la derecha */}
                      {!isAdvanced && (
                        <>
                          <div className="relative">
                            <div className="mb-1.5 text-[13px] uppercase tracking-[0.15em] text-slate-500">
                              {lang === "es" ? "Buscar por habilidad" : "Search by ability"}
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={recFilterAbility}
                                maxLength={50}
                                onChange={(e) => handleAbilityInputChange(e.target.value)}
                                onFocus={handleAbilityInputFocus}
                                onBlur={handleAbilityInputBlur}
                                onKeyDown={(e) => handleAbilityInputKeyDown(e.key, () => e.preventDefault())}
                                placeholder={lang === "es" ? "Ej. Adaptable, Intimidación…" : "E.g. Adaptability, Intimidate…"}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-3 pr-9 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                              />
                              <button
                                type="button"
                                onClick={openAbilityModal}
                                title={lang === "es" ? "Explorar habilidades" : "Browse abilities"}
                                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                              >
                                <Search className="h-4 w-4" />
                              </button>
                            </div>
                            {recFilterAbilityOpen && recFilterAbilitySuggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 text-sm shadow-xl" onMouseDown={(e) => e.preventDefault()}>
                                {recFilterAbilitySuggestions.map((ab, i) => (
                                  <button
                                    key={ab}
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); selectAbilitySuggestion(ab); }}
                                    onMouseEnter={() => setRecFilterAbilitySelectedIdx(i)}
                                    className={`w-full px-3 py-2 text-left ${
                                      recFilterAbilitySelectedIdx === i ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                                    }`}
                                  >
                                    {ab}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">{t.recFilterGen}</div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setRecFilterGen(null)}
                                className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === null ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                              >
                                {t.recFilterGenAll}
                              </button>
                              {GEN_RANGES.map(({ gen, label }) => (
                                <button
                                  key={gen}
                                  type="button"
                                  onClick={() => setRecFilterGen(recFilterGen === gen ? null : gen)}
                                  className={`rounded-full border px-2.5 py-1.5 text-[14px] leading-none font-medium transition ${recFilterGen === gen ? "border-sky-500 bg-sky-800/50 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Mínimos por stat — 2 filas de 3, compacto (solo modo avanzado) */}
                      {isAdvanced && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="flex items-baseline justify-between">
                          <div className="text-[13px] uppercase tracking-[0.15em] text-slate-500 mb-1">{t.recFilterMinStatsTitle}</div>
                          <div className="text-[12px] text-slate-500 mb-1">{t.recFilterMinStatsNote}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {statLabels.map(([key, label]) => {
                            const disabled = recFilterSortStat === key;
                            return (
                              <label key={key} className={`text-[13px] ${disabled ? "opacity-40" : ""}`}>
                                <span className="text-slate-400 block leading-none mb-1">{label}</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={255}
                                  disabled={disabled}
                                  value={recFilterMinStats[key]}
                                  onChange={(e) => setRecFilterMinStats((prev) => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="-"
                                  className="w-full rounded-md border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-[14px] text-slate-100 outline-none transition focus:border-sky-500 disabled:cursor-not-allowed"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de recomendaciones — grid compacto */}
              {pokemonRecommendations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 items-stretch">
                  {pokemonRecommendations.map(({ candidate, name, reasons, noNewCritical, immunities, newResistances, neededRole, realRole }) => {
                    const allCandidateWeaknesses = getCandidateWeaknesses(candidate.types as string[], typeRelations);
                    const reasonWeakTypes = new Set(reasons.filter((r) => !r.positive).map((r) => r.weakType));
                    const candidateWeaknesses = allCandidateWeaknesses.filter((ty) => !reasonWeakTypes.has(ty));

                    const groupedReasons: Array<{ positive: boolean; isImmune?: boolean; types: string[] }> = [];
                    reasons.forEach((r) => {
                      const last = groupedReasons[groupedReasons.length - 1];
                      if (last && last.positive === r.positive && !!last.isImmune === !!r.isImmune) {
                        last.types.push(r.weakType);
                      } else {
                        groupedReasons.push({ positive: r.positive, isImmune: r.isImmune, types: [r.weakType] });
                      }
                    });

                    // Filas fijas Inmune / Cubre / Añade, siempre en el mismo orden
                    // y siempre presentes (aunque vacías) para que todas las tarjetas
                    // midan lo mismo sin depender de items-stretch.
                    const immuneTypes: string[] = [];
                    const coverTypes: string[] = [];
                    const addTypes: string[] = [];
                    groupedReasons.forEach((g) => {
                      const arr = g.isImmune ? immuneTypes : g.positive ? coverTypes : addTypes;
                      g.types.forEach((ty) => { if (!arr.includes(ty)) arr.push(ty); });
                    });
                    const fixedReasonRows = [
                      { key: "immune", label: lang === "es" ? "Inmune" : "Immune", Icon: Shield, labelCl: "text-blue-400", types: immuneTypes },
                      { key: "cover", label: lang === "es" ? "Cubre" : "Covers", Icon: CheckCircle2, labelCl: "text-emerald-400", types: coverTypes },
                      { key: "add", label: lang === "es" ? "Añade" : "Adds", Icon: AlertTriangle, labelCl: "text-amber-400", types: addTypes },
                    ];

                    const isExpanded = expandedRec.has(candidate.slug);
                    const toggleExpanded = () => setExpandedRec((prev) => {
                      const next = new Set(prev);
                      if (next.has(candidate.slug)) next.delete(candidate.slug);
                      else next.add(candidate.slug);
                      return next;
                    });

                    // Todas las resistencias e inmunidades del candidato (para el panel expandido)
                    const allResistances = newResistances.filter((ty) => !immunities.includes(ty));

                    return (
                      <div key={candidate.slug} className="h-full flex flex-col rounded-xl border border-blue-800/20 bg-slate-900/75 overflow-hidden min-w-0">

                        {/* ── CUERPO PRINCIPAL: sprite izq + info der ── */}
                        <div className="flex flex-1 min-h-0">

                          {/* Columna izquierda: sprite cuadrado fijo con fondo de color del tipo primario */}
                          <div className="shrink-0 w-44 self-stretch bg-[#031421] flex items-center justify-center rounded-tl-xl overflow-hidden relative">
                            {/* Círculo de color del tipo primario como fondo */}
                            <div
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              aria-hidden="true"
                            >
                              <div
                                className="w-36 h-36 rounded-full opacity-15"
                                style={{ background: TYPE_COLORS[candidate.types[0]] ?? "#334155" }}
                              />
                            </div>
                            {/* Spinner mientras carga y se ajusta el sprite Z */}
                            {activePokedex === "pokemon-z" && zSpriteNaturalSizes[String(candidate.id)] === undefined && (
                              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="#334155" strokeWidth="3" />
                                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                              </div>
                            )}
                            <img
                              src={
                                activePokedex === "pokemon-z"
                                  ? (zSpritesTrimmed[String(candidate.id)] ?? zSpritesCache[String(candidate.id)] ?? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
                                  : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${candidate.id}.png`
                              }
                              alt={name}
                              className="relative z-10"
                              style={{
                                imageRendering: "pixelated",
                                // Modo Z: se mantiene invisible (pero sigue cargando y disparando
                                // onLoad de fondo) hasta que el tamaño/recorte real esté resuelto,
                                // para evitar el flash del sprite sin ajustar.
                                opacity:
                                  activePokedex === "pokemon-z" && zSpriteNaturalSizes[String(candidate.id)] === undefined
                                    ? 0
                                    : 1,
                                transition: "opacity 120ms ease-out",
                                ...(activePokedex === "pokemon-z"
                                  ? (() => {
                                      const size = zSpriteNaturalSizes[String(candidate.id)];
                                      // Escalar al doble del tamaño trimmeado, con techo en 112px,
                                      // para que los sprites pequeños no queden diminutos.
                                      const base = size ? Math.min(size * 2, 112) : 80;
                                      // Zoom extra puntual para sprites cuyo arte deja margen
                                      // vacío dentro del bounding box (ver Z_SPRITE_ZOOM_OVERRIDES).
                                      const zoom = Z_SPRITE_ZOOM_OVERRIDES[candidate.id] ?? 1;
                                      const display = Math.min(base * zoom, 128);
                                      return { width: display, height: display, objectFit: "contain" as const };
                                    })()
                                  : { width: 128, height: 128, objectFit: "contain" as const }),
                              }}
                              onLoad={(e) => {
                                if (activePokedex !== "pokemon-z") return;
                                const key = String(candidate.id);
                                // Si ya está trimmeado, solo actualizar el tamaño
                                if (zSpritesTrimmed[key]) {
                                  const img = e.target as HTMLImageElement;
                                  setZSpriteNaturalSizes((prev) => ({ ...prev, [key]: img.naturalHeight }));
                                  return;
                                }
                                const img = e.target as HTMLImageElement;
                                const w = img.naturalWidth;
                                const h = img.naturalHeight;
                                if (w === 0 || h === 0) return;
                                try {
                                  // Dibujar en canvas para leer píxeles
                                  const canvas = document.createElement("canvas");
                                  canvas.width = w;
                                  canvas.height = h;
                                  const ctx = canvas.getContext("2d");
                                  if (!ctx) return;
                                  ctx.drawImage(img, 0, 0);
                                  const data = ctx.getImageData(0, 0, w, h).data;

                                  // Estos sprites no siempre tienen transparencia real (canal
                                  // alpha): muchos usan un color de fondo sólido tipo "chroma
                                  // key" (ej. verde). Por eso, además de excluir píxeles con
                                  // alpha bajo, muestreamos el color de las 4 esquinas (donde
                                  // siempre debería estar el fondo, nunca el dibujo) y también
                                  // excluimos cualquier píxel parecido a alguno de esos colores.
                                  const pixelAt = (x: number, y: number) => {
                                    const i = (y * w + x) * 4;
                                    return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const;
                                  };
                                  const corners = [
                                    pixelAt(0, 0),
                                    pixelAt(w - 1, 0),
                                    pixelAt(0, h - 1),
                                    pixelAt(w - 1, h - 1),
                                  ];
                                  const COLOR_TOLERANCE = 30; // distancia máxima por canal para considerar "igual al fondo"
                                  const isBackground = (r: number, g: number, b: number, a: number) => {
                                    if (a <= 10) return true; // transparencia real
                                    for (const [cr, cg, cb, ca] of corners) {
                                      if (ca <= 10) continue; // esa esquina era transparente, no sirve como referencia de color
                                      if (
                                        Math.abs(r - cr) <= COLOR_TOLERANCE &&
                                        Math.abs(g - cg) <= COLOR_TOLERANCE &&
                                        Math.abs(b - cb) <= COLOR_TOLERANCE
                                      ) {
                                        return true;
                                      }
                                    }
                                    return false;
                                  };

                                  // Detectar bounding box de píxeles que NO son fondo
                                  let minX = w, minY = h, maxX = 0, maxY = 0;
                                  for (let y = 0; y < h; y++) {
                                    for (let x = 0; x < w; x++) {
                                      const i = (y * w + x) * 4;
                                      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                                      if (!isBackground(r, g, b, a)) {
                                        if (x < minX) minX = x;
                                        if (x > maxX) maxX = x;
                                        if (y < minY) minY = y;
                                        if (y > maxY) maxY = y;
                                      }
                                    }
                                  }
                                  if (maxX < minX || maxY < minY) return; // sprite vacío
                                  // Salvaguarda: si el bounding box detectado es absurdamente
                                  // chico (ruido puntual) o casi toda la imagen (el chroma key
                                  // no se pudo distinguir del dibujo), no confiar en el trim y
                                  // usar la imagen completa sin recortar en su lugar.
                                  const bboxW = maxX - minX + 1;
                                  const bboxH = maxY - minY + 1;
                                  if (bboxW < w * 0.05 || bboxH < h * 0.05 || (bboxW > w * 0.97 && bboxH > h * 0.97)) {
                                    setZSpriteNaturalSizes((prev) => ({ ...prev, [key]: h }));
                                    return;
                                  }
                                  // Además de recortar el borde exterior, volver transparente
                                  // cualquier pixel de fondo que haya quedado DENTRO de la
                                  // silueta (ej. entre brazos/patas), para que no se vean
                                  // parches de color sólido ahí.
                                  for (let y = 0; y < h; y++) {
                                    for (let x = 0; x < w; x++) {
                                      const i = (y * w + x) * 4;
                                      if (isBackground(data[i], data[i + 1], data[i + 2], data[i + 3])) {
                                        data[i + 3] = 0;
                                      }
                                    }
                                  }
                                  ctx.putImageData(new ImageData(data, w, h), 0, 0);
                                  // Recortar al bounding box con 2px de padding
                                  const PAD = 2;
                                  const cx = Math.max(0, minX - PAD);
                                  const cy = Math.max(0, minY - PAD);
                                  const cw = Math.min(w, maxX + PAD + 1) - cx;
                                  const ch = Math.min(h, maxY + PAD + 1) - cy;
                                  // Centrar en un canvas cuadrado (lado = max(cw, ch))
                                  const side = Math.max(cw, ch);
                                  const out = document.createElement("canvas");
                                  out.width = side;
                                  out.height = side;
                                  const octx = out.getContext("2d");
                                  if (!octx) return;
                                  octx.drawImage(canvas, cx, cy, cw, ch,
                                    Math.floor((side - cw) / 2), Math.floor((side - ch) / 2), cw, ch);
                                  const trimmedUrl = out.toDataURL("image/png");
                                  setZSpritesTrimmed((prev) => ({ ...prev, [key]: trimmedUrl }));
                                  setZSpriteNaturalSizes((prev) => ({ ...prev, [key]: side }));
                                } catch {
                                  // CORS u otro error: usar tamaño original sin trim
                                  setZSpriteNaturalSizes((prev) => ({ ...prev, [key]: h }));
                                }
                              }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>

                          {/* Columna derecha: toda la info */}
                          <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">

                            {/* Fila 1: Nombre + tooltip de stats + botón descartar */}
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[15px] font-bold text-white leading-tight truncate">{name}</span>
                                {candidate.stats && isAdvanced && (
                                  <FloatingTooltip
                                    preferredPlacement="right"
                                    content={
                                      <div className="w-64 rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-xl shadow-black/50 text-sm text-slate-100">
                                        <div className="text-[13px] uppercase tracking-[0.25em] text-slate-500 mb-2">
                                          {lang === "es" ? "Stats base" : "Base stats"}
                                        </div>
                                        <div className="space-y-1.5">
                                          {statLabels.map(([key]) => {
                                            const value = candidate.stats![key];
                                            const statNames = STAT_NAMES_I18N[lang];
                                            return (
                                              <div key={key} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-[12px] text-slate-300">
                                                  <span className="uppercase tracking-wide">{statNames[key]}</span>
                                                  <span className="font-semibold tabular-nums">{value}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-slate-800">
                                                  <div
                                                    className="h-full rounded-full transition-[width,background-color]"
                                                    style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }}
                                                  />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[13px] text-slate-500">
                                          <span>{lang === "es" ? "Total" : "Total"}</span>
                                          <span className="font-semibold text-slate-300 tabular-nums">
                                            {STAT_ORDER.reduce((sum, k) => sum + (candidate.stats![k] ?? 0), 0)}
                                          </span>
                                        </div>
                                      </div>
                                    }
                                  >
                                    <span
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[12px] text-slate-300 cursor-pointer"
                                    >ⓘ</span>
                                  </FloatingTooltip>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => addCandidateToTeam(candidate)}
                                  title={lang === "es" ? "Agregar al equipo" : "Add to team"}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/40 hover:bg-emerald-500 hover:text-white hover:ring-emerald-400 transition text-[14px] leading-none font-semibold"
                                >+</button>
                                <button
                                  type="button"
                                  onClick={() => setRecDiscarded((prev) => new Set([...prev, candidate.slug]))}
                                  title={t.recFilterDiscard}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition text-[13px]"
                                >×</button>
                              </div>
                            </div>

                            {/* Fila 2: Tipos del Pokémon */}
                            <div className="flex flex-wrap gap-1">
                              {candidate.types.map((ty) => (
                                <span key={ty} className={`${badgeClass(ty)} text-[13px] px-2 py-0.5`}>{tn(ty)}</span>
                              ))}
                            </div>

                            {/* Fila 2.5: Habilidades del candidato (normales + oculta, si tiene) */}
                            {((candidate.abilities && candidate.abilities.length > 0) || candidate.hiddenAbility) && (
                              <div className="flex flex-wrap gap-1">
                                {(candidate.abilities ?? []).map((ab) => (
                                  <FloatingTooltip
                                    key={ab}
                                    preferredPlacement="top"
                                    content={
                                      <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                        <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                          {activePokedex === "pokemon-z" ? getAbilityDisplayName(ab) : getStdAbilityLabel(ab)}
                                        </div>
                                        <div>
                                          {activePokedex === "pokemon-z"
                                            ? (lang === "es" ? abilitiesZDescData[ab]?.description : (abilitiesZDescData[ab]?.descriptionEn ?? abilitiesZDescData[ab]?.description)) ?? ""
                                            : getStdAbilityDescription(ab)}
                                        </div>
                                      </div>
                                    }
                                  >
                                    <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[12px] font-medium text-slate-300 cursor-default">
                                      {activePokedex === "pokemon-z" ? getAbilityDisplayName(ab) : getStdAbilityLabel(ab)}
                                    </span>
                                  </FloatingTooltip>
                                ))}
                                {candidate.hiddenAbility && (
                                  <FloatingTooltip
                                    preferredPlacement="top"
                                    content={
                                      <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                        <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                          {activePokedex === "pokemon-z" ? getAbilityDisplayName(candidate.hiddenAbility) : getStdAbilityLabel(candidate.hiddenAbility)}
                                          {" "}({lang === "es" ? "oculta" : "hidden"})
                                        </div>
                                        <div>
                                          {activePokedex === "pokemon-z"
                                            ? (lang === "es" ? abilitiesZDescData[candidate.hiddenAbility]?.description : (abilitiesZDescData[candidate.hiddenAbility]?.descriptionEn ?? abilitiesZDescData[candidate.hiddenAbility]?.description)) ?? ""
                                            : getStdAbilityDescription(candidate.hiddenAbility)}
                                        </div>
                                      </div>
                                    }
                                  >
                                    <span
                                      className="rounded-full border border-dashed border-slate-600 bg-slate-800/30 px-2 py-0.5 text-[12px] font-medium text-slate-400 cursor-default"
                                    >
                                      {activePokedex === "pokemon-z" ? getAbilityDisplayName(candidate.hiddenAbility) : getStdAbilityLabel(candidate.hiddenAbility)}
                                    </span>
                                  </FloatingTooltip>
                                )}
                              </div>
                            )}

                            {/* Fila 3: Rol del candidato (solo modo avanzado; requiere entender el sistema de roles) */}
                            {isAdvanced && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {realRole ? (
                                <>
                                  <span className="text-[12px] uppercase tracking-[0.15em] text-slate-500 shrink-0">{t.recRealRole}</span>
                                  <RoleBadge lang={lang} label={realRole.label} color={realRole.color} size="text-[12px]" />
                                </>
                              ) : neededRole ? (
                                <>
                                  <span className="text-[12px] uppercase tracking-[0.15em] text-slate-500 shrink-0">{t.recRole}</span>
                                  <RoleBadge lang={lang} label={neededRole.label} color={neededRole.color} size="text-[12px]" />
                                </>
                              ) : null}
                            </div>
                            )}

                            {/* Separador */}
                            <div className="border-t border-slate-800/60" />

                            {/* Fila 4: Razones — etiqueta corta fija + badges.
                                Siempre se reservan 3 filas de altura (Inmune/Cubre/Añade) para
                                que todas las tarjetas midan lo mismo sin depender de
                                items-stretch, pero las filas CON contenido real se muestran
                                primero (arriba) y el relleno invisible va al final — así nunca
                                queda un hueco vacío antes de "Cubre"/"Añade". */}
                            <div className="flex flex-col gap-1">
                              {noNewCritical && groupedReasons.length === 0 && (
                                // Sin ninguna razón real: el check ocupa la 1ª de las 3
                                // filas reservadas (va arriba), y solo quedan 2 filas
                                // fantasma de relleno debajo — así el total sigue siendo
                                // 3 filas, igual que en las demás tarjetas. Los badges reales
                                // usan la clase CSS propia `type-badge` (con su padding y
                                // line-height particulares), así que un <span> de texto plano
                                // con px/py de Tailwind NO alcanza la misma altura. Por eso acá
                                // se agrega un badge invisible real (misma clase que el resto)
                                // solo para forzar que la fila mida exactamente lo mismo.
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-semibold text-emerald-500 inline-flex items-center gap-1">
                                    ✓ {t.recNoNewCritical}
                                  </span>
                                  <span className={`${badgeClass("normal")} invisible text-[13px] px-1.5 py-0.5 shrink-0`} aria-hidden="true">·</span>
                                </div>
                              )}
                              {(noNewCritical && groupedReasons.length === 0 ? fixedReasonRows.slice(1) : [...fixedReasonRows]
                                .sort((a, b) => (b.types.length > 0 ? 1 : 0) - (a.types.length > 0 ? 1 : 0)))
                                .map((row) => (
                                <div key={row.key} className="flex items-center gap-2">
                                  <span className={`${row.labelCl} text-[13px] font-semibold shrink-0 w-16 inline-flex items-center gap-1 ${row.types.length === 0 ? "invisible" : ""}`}>
                                    <row.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />{row.label}
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {row.types.length > 0 ? (
                                      row.types.map((ty) => (
                                        <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                      ))
                                    ) : (
                                      // Badge fantasma: mismas clases/paddings que un badge real
                                      // pero invisible, para que la fila mida exactamente lo mismo
                                      // que una fila con contenido real.
                                      <span className={`${badgeClass("normal")} invisible text-[13px] px-1.5 py-0.5`} aria-hidden="true">·</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Fila 5: botón expandible — solo modo avanzado */}
                            {isAdvanced && (immunities.length > 0 || allResistances.length > 0 || candidateWeaknesses.length > 0) && (
                              <button
                                type="button"
                                onClick={toggleExpanded}
                                className={`self-start mt-auto pt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition ${isExpanded ? "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border-sky-700/60 bg-sky-900/30 text-sky-300 hover:bg-sky-900/60 hover:border-sky-600"}`}
                              >
                                <span className="text-[12px]">{isExpanded ? "▲" : "▼"}</span>
                                <span>{isExpanded ? (lang === "es" ? "Ocultar detalle" : "Hide detail") : (lang === "es" ? "Ver resistencias y debilidades" : "See resistances & weaknesses")}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ── PANEL EXPANDIDO: todas las resistencias y debilidades (solo modo avanzado) ── */}
                        {isAdvanced && (
                        <div
                          className="overflow-hidden transition-[max-height,opacity] duration-200"
                          style={{ maxHeight: isExpanded ? "300px" : "0px", opacity: isExpanded ? 1 : 0 }}
                        >
                          <div className="border-t border-slate-700/50 px-3 py-2.5 bg-slate-950/50 flex flex-col gap-2">
                            {immunities.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-[14px] font-semibold text-blue-400 shrink-0 w-16 mt-0.5">{lang === "es" ? "Inmune" : "Immune"}</span>
                                <div className="flex flex-wrap gap-1">
                                  {immunities.map((ty) => (
                                    <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {allResistances.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-[14px] font-semibold text-emerald-500 shrink-0 w-16 mt-0.5">{lang === "es" ? "Resiste" : "Resists"}</span>
                                <div className="flex flex-wrap gap-1">
                                  {allResistances.map((ty) => (
                                    <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {candidateWeaknesses.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-[14px] font-semibold text-red-400 shrink-0 w-16 mt-0.5">{lang === "es" ? "Débil a" : "Weak to"}</span>
                                <div className="flex flex-wrap gap-1">
                                  {candidateWeaknesses.map((ty) => (
                                    <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5`}>{tn(ty)}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : loadingAllPokemonData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 items-stretch" aria-busy="true" aria-label={t.loadingRecommendations}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-full flex rounded-xl border border-blue-800/20 bg-slate-900/75 overflow-hidden min-w-0 animate-pulse"
                    >
                      {/* Placeholder del sprite, mismo ancho que la columna real (w-44) */}
                      <div className="shrink-0 w-44 self-stretch bg-slate-800/60 rounded-tl-xl" />
                      {/* Placeholder del contenido: nombre, badges de tipo, rol, líneas de resistencias */}
                      <div className="flex-1 min-w-0 p-2.5 flex flex-col gap-2">
                        <div className="h-3.5 w-2/3 rounded bg-slate-700/60" />
                        <div className="flex gap-1.5">
                          <div className="h-4 w-14 rounded-full bg-slate-700/50" />
                          <div className="h-4 w-14 rounded-full bg-slate-700/50" />
                        </div>
                        <div className="h-3 w-1/2 rounded bg-slate-700/40" />
                        <div className="mt-auto flex flex-col gap-1.5">
                          <div className="h-3 w-full rounded bg-slate-800/60" />
                          <div className="h-3 w-4/5 rounded bg-slate-800/60" />
                          <div className="h-3 w-3/5 rounded bg-slate-800/60" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !team.some((s) => s.name.trim() !== "") ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-sm gap-2 text-center">
                  <Star className="h-7 w-7 text-slate-600" />
                  <span>
                    {lang === "es"
                      ? "Agrega al menos 1 Pokémon a tu equipo para ver recomendaciones."
                      : "Add at least 1 Pokémon to your team to see recommendations."}
                  </span>
                </div>
              ) : (
                <div className="text-[13px] text-slate-500 text-center py-2">{t.recFilterNoResults}</div>
              )}
            </div>
          </div>

      {recFilterMoveModalOpen && (
        <MoveFilterModal
          moves={(activePokedex === "pokemon-z" ? movesZData : movesStandardData) as MoveFilterEntry[]}
          lang={lang}
          search={recFilterMoveSearch}
          onSearchChange={setRecFilterMoveSearch}
          categories={recFilterMoveCategories}
          onToggleCategory={(c) =>
            setRecFilterMoveCategories((prev) => {
              const next = new Set(prev);
              if (next.has(c)) next.delete(c); else next.add(c);
              return next;
            })
          }
          types={recFilterMoveTypes}
          onToggleType={(ty) =>
            setRecFilterMoveTypes((prev) => {
              const next = new Set(prev);
              if (next.has(ty)) next.delete(ty); else next.add(ty);
              return next;
            })
          }
          onlyZOriginals={recFilterMoveOnlyZ}
          onToggleOnlyZOriginals={() => setRecFilterMoveOnlyZ(!recFilterMoveOnlyZ)}
          showOnlyZFilter={activePokedex === "pokemon-z"}
          onClearFilters={clearRecFilterMoveFilters}
          sortPower={recFilterMoveSortPower}
          onSortPowerChange={setRecFilterMoveSortPower}
          learnMethods={null}
          onlyLearnable={false}
          learnableSet={null}
          badgeClass={badgeClass}
          tn={tn}
          onSelect={(move) => addRecFilterMove(move.internalName)}
          onClose={closeMoveFilterModal}
        />
      )}

      {recAbilityModalOpen && (
        <AbilityFilterModal
          abilities={abilityModalEntries}
          lang={lang}
          search={recAbilityModalSearch}
          onSearchChange={setRecAbilityModalSearch}
          descSearch={recAbilityModalDescSearch}
          onDescSearchChange={setRecAbilityModalDescSearch}
          onlyZOriginals={recAbilityModalOnlyZ}
          onToggleOnlyZOriginals={toggleAbilityModalOnlyZ}
          showOnlyZFilter={activePokedex === "pokemon-z"}
          onSelect={selectAbilityFromModal}
          onClose={closeAbilityModal}
        />
      )}
    </>
  );
}

// memo: este panel no participa de los buscadores del equipo. Sin memo, cada
// tecla tipeada en cualquiera de los 30 inputs de TeamGrid lo volvía a
// renderizar entero junto con TeamBuilder.
export const RecommendationsPanel = memo(RecommendationsPanelImpl);
