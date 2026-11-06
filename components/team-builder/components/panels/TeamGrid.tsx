import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { BaseStats, Move, SavedTeam, Slot } from "../../types";
import type { MoveZ } from "../../types/pokemonZ";
import { useBuilderChrome } from "../../context/BuilderChromeContext";
import { useSlotSearch } from "../../context/SlotSearchContext";

import { ROLES, BALANCED_ROLE, TYPE_COLORS } from "../../utils/constants";
import { EMPTY_MOVE, normalizeMoveSearch } from "../../utils/moveHelpers";
import { getBulk, getSpeedTier, scoreAllRoles, getEffectiveRole, getRoleDescription } from "../../utils/roleCalculations";
import { buildSpriteStyle, Z_SLOT_SPRITE_ZOOM_OVERRIDES } from "../../utils/spriteHelpers";
import { formatForDisplay, formatForAPI } from "../../utils/typeHelpers";
import { normalizeTypeToApi } from "../../utils/stringNormalization";
import type { useMoveFilter } from "../../hooks/useMoveFilter";
import { EMPTY_SLOT } from "../../hooks/useTeamStorage";
import { SpriteImg } from "../SpriteImg";
import { AnchoredDropdown } from "../AnchoredDropdown";
import { CollapsibleSection } from "../CollapsibleSection";
import { FloatingTooltip } from "../FloatingTooltip";
import { RoleBadge } from "../RoleBadge";
import type { MoveFilterEntry } from "../MoveFilterModal";
import { codecJson, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";

// Qué ranuras del equipo están plegadas. Se guarda como array de 6 booleanos,
// posicional: el índice ES la ranura.
const SLOTS_COLAPSADOS_KEY = "pokerun-slot-collapsed-v2";
const NINGUNO_COLAPSADO: boolean[] = Array.from({ length: 6 }, () => false);
const codecColapsados = codecJson<boolean[]>((crudo) =>
  Array.isArray(crudo) && crudo.length === 6 && crudo.every((v) => typeof v === "boolean")
    ? (crudo as boolean[])
    : null
);

// Solo se monta cuando el usuario abre el filtro de movimientos de un slot.
// `ssr: false` es lo que hace efectivo el split (ver nota en TeamBuilder.tsx).
const MoveFilterModal = dynamic(
  () => import("../MoveFilterModal").then((m) => m.MoveFilterModal),
  { ssr: false }
);
import {
  BookOpen, Brain, Bug, CheckCircle2, Circle, Clipboard, Diamond, Droplet,
  Feather, Flame, Ghost, HandFist, Leaf, Moon, Mountain, Pencil, Save,
  Search, Shield, Skull, Snowflake, Sparkles, Waves, X, Zap,
  type LucideIcon,
} from "lucide-react";

const SLOT_TYPE_ICONS: Readonly<Partial<Record<string, LucideIcon>>> = {
  normal: Circle,
  fire: Flame,
  water: Droplet,
  electric: Zap,
  grass: Leaf,
  ice: Snowflake,
  fighting: HandFist,
  poison: Skull,
  ground: Waves,
  flying: Feather,
  psychic: Brain,
  bug: Bug,
  rock: Mountain,
  ghost: Ghost,
  dragon: Diamond,
  dark: Moon,
  steel: Shield,
  fairy: Sparkles,
};

type TeamGridProps = {
  team: Slot[];
  updateSlot: (idx: number, patch: Partial<Slot>) => void;

  // El estado de los 30 buscadores (6 de Pokémon + 24 de movimientos) llega
  // por SlotSearchContext, no por props: eran 21 props que atravesaban el
  // árbol solo para llegar a este componente. Ver context/SlotSearchContext.
  //
  // Idioma, pokédex, modo de vista y helpers de formato llegan por
  // BuilderChromeContext, por el mismo motivo.

  setSlotManualRole: (slotIdx: number, roleEn: string | null) => void;
  moveEsMap: Record<string, string>;
  moveEsDisplay: Record<string, string>;
  getMoveLearnBadge: (slotIdx: number, name: string) => string | null;
  activeMoves: MoveZ[];

  // modal de filtros de movimientos (Pokémon Z / estándar) — agrupado
  moveFilter: ReturnType<typeof useMoveFilter>;

  // drag & drop (slots del equipo + movimientos de un slot) — viene de
  // useDragDrop en TeamBuilder.tsx, junto a DragGhostPortal
  teamCardRefs: RefObject<Array<HTMLDivElement | null>>;
  dragFromIdx: number | null;
  dragOverIdx: number | null;
  startSlotDrag: (idx: number, clientX: number, clientY: number, cardEl: HTMLElement) => void;
  captureSlotRects: () => void;
  dragMoveFrom: { slotIdx: number; moveIdx: number } | null;
  moveDragOverIdx: { slotIdx: number; moveIdx: number } | null;
  handleMoveDragStart: (slotIdx: number, moveIdx: number, e: React.DragEvent) => void;
  handleMoveDragEnd: () => void;
  handleMoveDragOver: (slotIdx: number, moveIdx: number, e: React.DragEvent) => void;
  handleMoveDrop: (slotIdx: number, moveIdx: number, e: React.DragEvent) => void;

  // habilidades (descripciones + display name)
  abilitiesZDescData: Record<string, { nameEn: string | null; nameEnDisplay?: string; description: string; descriptionEn?: string; customAbility?: boolean }>;
  getAbilityDisplayName: (esName: string) => string;

  // config Fakemon (useSpriteEditor)
  fakemonModeOn: boolean;
  setFakemonModeOn: Dispatch<SetStateAction<boolean>>;
  openFakemonConfig: (idx: number) => void;

  // plantillas guardadas / limpiar equipo
  savedTeams: SavedTeam[];
  setShowPlantillas: Dispatch<SetStateAction<boolean>>;
  setTeam: Dispatch<SetStateAction<Slot[]>>;
};

/**
 * Panel "Mi Equipo": las 6 tarjetas del equipo — sprite, buscador de nombre,
 * tipos, habilidades, movimientos (con su propio buscador + drag&drop +
 * filtro), selector de rol manual, tooltip de stats/aptitud por rol, drag
 * handle para reordenar slots, y el botón de configurar Fakemon. Extraído
 * tal cual del render principal de TeamBuilder.tsx (Fase 6) — es la última
 * de las 9 secciones del plan original.
 *
 * A diferencia de RecommendationsPanel, buena parte del estado de búsqueda
 * (moveInputDraft, moveResults, pokemonResults, etc.) NO pudo moverse acá
 * adentro: un useEffect en TeamBuilder.tsx también lo puebla/consume (el
 * cálculo de sugerencias), así que sigue viviendo ahí y se recibe como
 * props. Lo que sí es exclusivo de este panel (colapsar tarjeta, tooltips de
 * stats, selectores de tipo/rol abiertos) quedó como estado local acá.
 */
export function TeamGrid(props: TeamGridProps) {
  const {
    team, updateSlot, setSlotManualRole,
    moveEsMap, moveEsDisplay, getMoveLearnBadge, activeMoves,
    teamCardRefs, dragFromIdx, dragOverIdx, startSlotDrag, captureSlotRects,
    dragMoveFrom, moveDragOverIdx, handleMoveDragStart, handleMoveDragEnd, handleMoveDragOver, handleMoveDrop,
    abilitiesZDescData, getAbilityDisplayName,
    fakemonModeOn, setFakemonModeOn, openFakemonConfig,
    savedTeams, setShowPlantillas, setTeam,
  } = props;

  const {
    lang, t, tn, badgeClass, isAdvanced, activePokedex,
    statLabels, allTypes, getStatColor, statNamesI18n: STAT_NAMES_I18N,
  } = useBuilderChrome();

  const {
    pokemonInputDraft, setPokemonInputDraft, pokemonOpen, setPokemonOpen,
    pokemonResults, pokemonSelectedIdx, setPokemonSelectedIdx,
    setPokemonSearch, fetchPokemon, selectPokemonSuggestion,
    moveInputDraft, setMoveInputDraft, moveResults, moveOpen, setMoveOpen,
    moveSelectedIdx, setMoveSelectedIdx, updateMove, fetchMove, selectMoveSuggestion,
  } = useSlotSearch();

  const {
    moveFilterSearch, setMoveFilterSearch,
    moveFilterCategories, moveFilterTypes, moveFilterOnlyZ, moveFilterSortPower, setMoveFilterSortPower,
    moveFilterTarget, onlyLearnableMoves, setOnlyLearnableMoves,
    openMoveFilter, closeMoveFilter, toggleMoveFilterCategory, toggleMoveFilterType, toggleMoveFilterOnlyZ,
    clearMoveFilters, selectMoveFromFilter,
  } = props.moveFilter;

  const moveInputWrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pokemonInputWrapRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Estado puramente de UI, exclusivo de este panel (no lo lee/escribe nada
  // más en TeamBuilder.tsx), por eso vive acá en vez de recibirse por props.
  const [failedSpriteUrls, setFailedSpriteUrls] = useState<Set<string>>(new Set());
  const markSpriteFailed = (url: string) =>
    setFailedSpriteUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  const [roleSelectOpenIdx, setRoleSelectOpenIdx] = useState<number | null>(null);

  const [slotCollapsed, setSlotCollapsed] = usePreferenciaLocal(
    SLOTS_COLAPSADOS_KEY,
    NINGUNO_COLAPSADO,
    codecColapsados
  );
  const toggleSlotCollapsed = (idx: number) => {
    captureSlotRects();
    setSlotCollapsed((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const [openRoleKeys, setOpenRoleKeys] = useState<Set<string>>(new Set());
  const toggleRoleOpen = (key: string) => {
    setOpenRoleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [statsTooltipOpen, setStatsTooltipOpen] = useState<boolean[]>(() => Array(6).fill(false));
  const statsTooltipCloseTimers = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({});
  const openStatsTooltip = (idx: number) => {
    if (statsTooltipCloseTimers.current[idx]) {
      clearTimeout(statsTooltipCloseTimers.current[idx]);
      statsTooltipCloseTimers.current[idx] = undefined;
    }
    setStatsTooltipOpen((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };
  const scheduleCloseStatsTooltip = (idx: number) => {
    if (statsTooltipCloseTimers.current[idx]) clearTimeout(statsTooltipCloseTimers.current[idx]);
    statsTooltipCloseTimers.current[idx] = setTimeout(() => {
      setStatsTooltipOpen((prev) => prev.map((v, i) => (i === idx ? false : v)));
    }, 180);
  };

  const [hpTypeOpen, setHpTypeOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const [fakeTypeOpen, setFakeTypeOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const toggleHpType = (si: number, mi: number) =>
    setHpTypeOpen((prev) => prev.map((arr, i) => i === si ? arr.map((v, j) => j === mi ? !v : v) : arr));
  const toggleFakeType = (si: number, mi: number) =>
    setFakeTypeOpen((prev) => prev.map((arr, i) => i === si ? arr.map((v, j) => j === mi ? !v : v) : arr));

  /** Bg style de una tarjeta de movimiento: color de tipo + patrón por categoría. */
  const moveBgStyle = (category: Move["category"], moveType: string | null | undefined): React.CSSProperties => {
    const base = TYPE_COLORS[moveType ?? ""] ?? "#334155";
    if (category === "Physical") {
      return {
        background: `repeating-linear-gradient(
          -45deg,
          ${base}0d 0px,
          ${base}0d 1.5px,
          transparent 1.5px,
          transparent 14px
        )`,
        backgroundColor: base + "12",
      };
    }
    if (category === "Special") {
      return {
        backgroundImage: `radial-gradient(${base}18 1px, transparent 1px)`,
        backgroundSize: "12px 12px",
        backgroundColor: base + "0e",
      };
    }
    return {
      background: `repeating-linear-gradient(
        180deg,
        ${base}0d 0px,
        ${base}0d 1px,
        transparent 1px,
        transparent 12px
      )`,
      backgroundColor: base + "0e",
    };
  };

  return (
    <>
        <CollapsibleSection
          as="section"
          className={`pokedex-panel p-3 sm:p-4 rounded-lg h-full relative ${moveOpen.some((s) => s?.some(Boolean)) ? "z-40" : ""}`}
          headerClassName="mb-4"
          icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200"><Clipboard className="h-3.5 w-3.5" /></span>}
          title={t.myTeam}
          guide={!isAdvanced ? t.guideTeamSection : undefined}
          storageKey="my-team"
          headerExtra={
            <>
              <button
                type="button"
                onClick={() => setOnlyLearnableMoves((v) => !v)}
                title={t.onlyLearnableMovesTitle}
                aria-pressed={onlyLearnableMoves}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  onlyLearnableMoves
                    ? "bg-emerald-700/80 text-white hover:bg-emerald-600"
                    : "bg-slate-700/60 text-slate-300 hover:bg-slate-600/60"
                }`}
              >
                {onlyLearnableMoves ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <BookOpen className="h-4 w-4 shrink-0" />} <span>{t.onlyLearnableMoves}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPlantillas(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-700/80 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <Save className="h-4 w-4 shrink-0" /> <span className="hidden xs:inline">{t.saveTemplates}</span><span className="xs:hidden">Plantillas</span> {savedTeams.length > 0 && <span className="inline-flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-white/20 text-xs">{savedTeams.length}</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleared = Array.from({ length: 6 }, EMPTY_SLOT);
                  setTeam(cleared);
                  setPokemonInputDraft(Array.from({ length: 6 }, () => null));
                  setPokemonSearch(Array.from({ length: 6 }, () => ""));
                }}
                className="inline-flex items-center justify-center rounded-full bg-red-600/90 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {t.clearTeam}
              </button>
              <div className="fm-switch-wrap rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 sm:px-3 py-1.5 sm:py-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-300 whitespace-nowrap">{t.fakemonModeLabel}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fakemonModeOn}
                  aria-label={t.fakemonModeLabel}
                  data-on={fakemonModeOn}
                  onClick={() => setFakemonModeOn((v) => !v)}
                  className="fm-switch"
                >
                  <span className="fm-switch-thumb" />
                </button>
              </div>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {team.map((slot, idx) => {
              const hasOpenMoveDropdown = moveOpen[idx]?.some(Boolean);
              const primaryType = normalizeTypeToApi(slot.types.find((type) => type.trim()) ?? "");
              const TypeIcon = Object.hasOwn(SLOT_TYPE_ICONS, primaryType) ? SLOT_TYPE_ICONS[primaryType] : undefined;
              const typeColor = TypeIcon ? TYPE_COLORS[primaryType] : undefined;
              return (
              <div
                key={idx}
                data-slot-idx={idx}
                ref={(el) => { teamCardRefs.current[idx] = el; }}
                style={typeColor ? {
                  backgroundImage: `radial-gradient(ellipse 12rem 7rem at top left, ${typeColor}45, transparent 100%), linear-gradient(180deg, rgba(8,10,20,0.6), rgba(3,7,18,0.7))`,
                } : undefined}
                className={`pokedex-card relative hover:z-20 ${hasOpenMoveDropdown ? "z-30" : ""} p-1.5 rounded-lg border-blue-800/30 hover:shadow-lg btn-interactive flex flex-col gap-1.5 transition-[box-shadow,border-color] ${dragOverIdx === idx && dragFromIdx !== idx ? "ring-2 ring-blue-400/70 bg-blue-950/30 scale-[1.02]" : ""} ${dragFromIdx === idx ? "opacity-30" : ""}`}
              >
                {/* Drag handle */}
                <div
                  onPointerDown={(e) => {
                    e.preventDefault();
                    startSlotDrag(idx, e.clientX, e.clientY, e.currentTarget);
                  }}
                  className="touch-drag-handle flex items-center justify-between text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing select-none py-0.5"
                  title="Arrastra para reordenar"
                  style={{ touchAction: "none" }}
                >
                  <span className="flex items-center gap-1.5">
                    {TypeIcon && (
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-slate-950/70" style={{ color: typeColor }} title={tn(primaryType)}>
                        <TypeIcon className="size-3.5" role="img" aria-label={tn(primaryType)} />
                      </span>
                    )}
                    <span className="text-lg tracking-widest">⠿</span>
                  </span>
                  <span className="text-[13px] sm:text-[13px] uppercase tracking-widest opacity-50">{t.dragHandle}</span>
                </div>
                {/* Fila compacta: siempre visible, sprite chico + nombre. Click para expandir/colapsar. */}
                <button
                  type="button"
                  onClick={() => toggleSlotCollapsed(idx)}
                  className="flex items-center gap-2 w-full text-left rounded-md px-1 py-1 -mx-1 transition hover:bg-slate-800/40"
                >
                  <div className="w-9 h-9 bg-[#031421] rounded-md overflow-hidden flex items-center justify-center shrink-0">
                    <SpriteImg
                      src={slot.sprite && !failedSpriteUrls.has(slot.sprite) ? slot.sprite : null}
                      alt={slot.name}
                      className="w-8 h-8 object-contain"
                      style={buildSpriteStyle(slot.spriteTransform, Z_SLOT_SPRITE_ZOOM_OVERRIDES[slot.name])}
                      onError={() => markSpriteFailed(slot.sprite!)}
                      placeholderClassName="h-5 w-5 opacity-40"
                    />
                  </div>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-slate-100 capitalize truncate">
                    {slot.name || "Pokémon"}
                  </span>
                  <span className={`shrink-0 text-slate-500 text-xs transition-transform ${slotCollapsed[idx] ? "" : "rotate-180"}`}>▾</span>
                </button>
                {!slotCollapsed[idx] && (
                <>
                <div className="flex gap-2 items-start">
                  <div className="w-16 h-16 sm:w-32 sm:h-32 bg-[#031421] flex items-center justify-center rounded-lg shrink-0 overflow-hidden">
                    <SpriteImg
                      src={slot.sprite && !failedSpriteUrls.has(slot.sprite) ? slot.sprite : null}
                      alt={slot.name}
                      className="w-14 h-14 sm:w-28 sm:h-28 object-contain"
                      style={buildSpriteStyle(slot.spriteTransform, Z_SLOT_SPRITE_ZOOM_OVERRIDES[slot.name])}
                      onError={() => markSpriteFailed(slot.sprite!)}
                      placeholderClassName="h-8 w-8 sm:h-12 sm:w-12 opacity-40"
                    />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-nowrap min-w-0">
                        <div className="text-base font-semibold text-slate-100 capitalize truncate min-w-0" title={slot.name || "Pokémon"}>{slot.name || "Pokémon"}</div>
                        {slot.stats && isAdvanced ? (
                          <div
                            className="relative inline-flex items-center group shrink-0"
                            onMouseEnter={() => openStatsTooltip(idx)}
                            onMouseLeave={() => scheduleCloseStatsTooltip(idx)}
                          >
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[14px] text-slate-300 cursor-pointer"
                              onClick={() => setStatsTooltipOpen((prev) => prev.map((v, i) => i === idx ? !v : v))}
                            >ⓘ</span>
                            {/* Desktop: hover con margen de gracia (onMouseEnter/Leave arriba); Mobile: tap toggle */}
                            <div className={`absolute top-0 z-50 w-72 sm:w-80 rounded-2xl border border-slate-700 bg-slate-950/97 p-4 text-sm text-slate-100 shadow-xl shadow-black/50 ${statsTooltipOpen[idx] ? "block" : "hidden"} ${idx % 2 === 0 ? "left-full ml-2" : "right-full mr-2"}`}
                              style={{ maxHeight: "70vh", overflowY: "auto" }}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Stats base" : "Base stats"}</div>
                                {/* Solo existe en móvil (`sm:hidden`) y solo lleva una X:
                                    sin aria-label un lector de pantalla lo anuncia como
                                    "botón" y nada más. */}
                                <button type="button" aria-label={lang === "es" ? "Cerrar stats base" : "Close base stats"} className="sm:hidden text-slate-500 hover:text-slate-300 text-xs px-1" onClick={() => { if (statsTooltipCloseTimers.current[idx]) clearTimeout(statsTooltipCloseTimers.current[idx]); setStatsTooltipOpen((prev) => prev.map((v, i) => i === idx ? false : v)); }}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                              </div>
                              <div className="space-y-2 mb-4">
                                {statLabels.map(([key, _label]) => {
                                  const value = slot.stats![key];
                                  const statNames = STAT_NAMES_I18N[lang];
                                  return (
                                    <div key={key} className="space-y-0.5">
                                      <div className="flex items-center justify-between text-[13px] text-slate-300">
                                        <span className="uppercase tracking-wide">{statNames[key]}</span>
                                        <span className="font-semibold tabular-nums">{value}</span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-slate-800">
                                        <div className="h-full rounded-full transition-[width,background-color]" style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Bulk metrics (Opción B) */}
                              {(() => {
                                const bulk = getBulk(slot.stats!);
                                const speedTier = getSpeedTier(slot.stats!.SPE, lang);
                                return (
                                  <div className="mb-4 space-y-2">
                                    <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Métricas" : "Metrics"}</div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {[
                                        { label: lang === "es" ? "Bulk fís." : "Phys. bulk", value: bulk.physical,  color: "#0369a1" },
                                        { label: lang === "es" ? "Bulk esp." : "Spec. bulk", value: bulk.special,   color: "#1d4ed8" },
                                        { label: lang === "es" ? "Poder of." : "Offense",    value: bulk.offensive, color: "#ea580c" },
                                      ].map(({ label, value, color }) => (
                                        <div key={label} className="rounded-lg bg-slate-900/80 border border-slate-700/50 px-2 py-1.5 text-center">
                                          <div className="text-[12px] text-slate-500 mb-0.5">{label}</div>
                                          <div className="text-sm font-bold" style={{ color }}>{value}</div>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Speed tier (Opción D) */}
                                    <div className="flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-700/50 px-3 py-1.5">
                                      <span className="text-[13px] uppercase tracking-[0.2em] text-slate-500">{lang === "es" ? "Tier velocidad" : "Speed tier"}</span>
                                      <span className="text-xs font-bold" style={{ color: speedTier.color }}>{speedTier.label} ({slot.stats!.SPE})</span>
                                    </div>
                                  </div>
                                );
                              })()}
                              {/* Role radar (Opción A) */}
                              <div className="space-y-1.5">
                                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Aptitud por rol" : "Role aptitude"}</div>
                                {scoreAllRoles(slot.stats!)
                                  .sort((a, b) => b.score - a.score)
                                  .slice(0, 5)
                                  .map(({ role, score }) => {
                                    const roleKey = `${idx}:${role.en}`;
                                    const isOpen = openRoleKeys.has(roleKey);
                                    // Stats que definen el rol (weights > 0), ordenadas de mayor a menor peso.
                                    const keyStats = (Object.entries(role.weights) as [keyof BaseStats, number][])
                                      .filter(([, w]) => (w ?? 0) > 0)
                                      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
                                    const statNames = STAT_NAMES_I18N[lang];
                                    return (
                                      <div key={role.en} className="rounded-lg overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => toggleRoleOpen(roleKey)}
                                          className="flex items-center gap-2 w-full text-left py-0.5"
                                        >
                                          <span className="text-[13px] text-slate-400 w-32 shrink-0 truncate">{role[lang]}</span>
                                          <span className="flex-1 h-1.5 rounded-full bg-slate-800">
                                            <span className="block h-full rounded-full transition-[width,background-color]" style={{ width: `${score}%`, backgroundColor: role.color }} />
                                          </span>
                                          <span className="text-[13px] text-slate-500 w-8 text-right tabular-nums">{score}%</span>
                                          <span className={`shrink-0 text-slate-500 text-[12px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                                        </button>
                                        {isOpen && (
                                          <div className="mt-1 mb-1.5 rounded-lg border border-slate-700/60 bg-slate-900/70 p-2 text-[13px] text-slate-300 space-y-1.5">
                                            <div>{getRoleDescription(role[lang], lang) ?? ""}</div>
                                            <div className="flex flex-wrap gap-1">
                                              {keyStats.map(([statKey]) => (
                                                <span
                                                  key={statKey}
                                                  className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-slate-200"
                                                >
                                                  {statNames[statKey]}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {slot.stats && isAdvanced && (() => {
                          const role = getEffectiveRole(slot, lang);
                          const isManual = !!slot.manualRoleEn;
                          const isOpen = roleSelectOpenIdx === idx;
                          return (
                            <span className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setRoleSelectOpenIdx(isOpen ? null : idx)}
                                title={
                                  isManual
                                    ? (lang === "es" ? "Rol elegido manualmente. Clic para cambiar." : "Manually chosen role. Click to change.")
                                    : (lang === "es" ? "Rol automático por stats. Clic para elegir uno manual." : "Automatic role from stats. Click to set one manually.")
                                }
                                className={`flex items-center gap-1 rounded-full border px-1 py-0.5 transition ${
                                  isOpen
                                    ? "border-sky-500/70 bg-sky-950/40"
                                    : "border-transparent hover:border-slate-600 hover:bg-slate-800/60"
                                }`}
                              >
                                {role ? <RoleBadge lang={lang} label={role.label} color={role.color} /> : (
                                  <span className="rounded-full border border-dashed border-slate-600 px-2 py-0.5 text-[12px] text-slate-500">
                                    {lang === "es" ? "Elegir rol" : "Pick role"}
                                  </span>
                                )}
                                {isManual && (
                                  <span
                                    title={lang === "es" ? "Elegido a mano" : "Manually set"}
                                    className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400"
                                  >
                                    <Pencil className="h-2.5 w-2.5 shrink-0" /> {lang === "es" ? "manual" : "manual"}
                                  </span>
                                )}
                                <span className={`text-[11px] text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                              </button>
                              {isOpen && (
                                <div
                                  className="absolute right-0 top-full z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-1.5 shadow-xl shadow-black/60"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => { setSlotManualRole(idx, null); setRoleSelectOpenIdx(null); }}
                                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-800 ${
                                      !isManual ? "text-emerald-300" : "text-slate-300"
                                    }`}
                                  >
                                    <span>{lang === "es" ? "Automático (por stats)" : "Automatic (by stats)"}</span>
                                    {!isManual && <span>✓</span>}
                                  </button>
                                  <div className="my-1 border-t border-slate-800" />
                                  {[...ROLES, BALANCED_ROLE].map((r) => (
                                    <button
                                      key={r.en}
                                      type="button"
                                      onClick={() => { setSlotManualRole(idx, r.en); setRoleSelectOpenIdx(null); }}
                                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-800 ${
                                        slot.manualRoleEn === r.en ? "text-emerald-300" : "text-slate-300"
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                                        {r[lang]}
                                      </span>
                                      {slot.manualRoleEn === r.en && <span>✓</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                      {!isAdvanced && (
                        <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500">{t.guideTypes}</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {slot.types.filter(Boolean).length ? (
                          slot.types.filter(Boolean).map((t_) => (
                            <span key={t_} className={badgeClass(t_)}>
                              {tn(t_)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">{t.noTypes}</span>
                        )}
                      </div>
                      {(slot.abilities && slot.abilities.length > 0) || slot.hiddenAbility ? (
                        <div className="space-y-1">
                        {!isAdvanced && (
                          <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500">{t.guideAbilities}</div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(slot.abilities ?? []).map((ab) => (
                            <FloatingTooltip
                              key={ab}
                              preferredPlacement="top"
                              content={
                                <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                  <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{getAbilityDisplayName(ab)}</div>
                                  <div>{(lang === "es" ? abilitiesZDescData[ab]?.description : (abilitiesZDescData[ab]?.descriptionEn ?? abilitiesZDescData[ab]?.description)) ?? ""}</div>
                                </div>
                              }
                            >
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-800/90 px-2 py-0.5 text-[13px] font-semibold text-slate-200 cursor-default">
                                {getAbilityDisplayName(ab)}
                              </span>
                            </FloatingTooltip>
                          ))}
                          {slot.hiddenAbility ? (
                            <FloatingTooltip
                              preferredPlacement="top"
                              content={
                                <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
                                  <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{getAbilityDisplayName(slot.hiddenAbility)} ({lang === "es" ? "oculta" : "hidden"})</div>
                                  <div>{(lang === "es" ? abilitiesZDescData[slot.hiddenAbility]?.description : (abilitiesZDescData[slot.hiddenAbility]?.descriptionEn ?? abilitiesZDescData[slot.hiddenAbility]?.description)) ?? ""}</div>
                                </div>
                              }
                            >
                              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-500 bg-slate-800/60 px-2 py-0.5 text-[13px] font-semibold text-slate-300 cursor-default">
                                {getAbilityDisplayName(slot.hiddenAbility)}
                              </span>
                            </FloatingTooltip>
                          ) : null}
                        </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-wrap items-center gap-2 text-sm text-slate-300" ref={(el) => { pokemonInputWrapRefs.current[idx] = el; }}>
                  <input
                    value={pokemonInputDraft[idx] !== null ? pokemonInputDraft[idx]! : slot.name}
                    onFocus={() => {
                      setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? slot.name : d)));
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? value : d)));
                      setPokemonSearch((prev) => prev.map((current, i) => (i === idx ? value : current)));
                      // Solo tocamos el nombre "real" del slot cuando se borra por completo
                      // (esto ya dispara el reseteo a EMPTY_SLOT dentro de updateSlot). Mientras
                      // se está escribiendo/editando, el nombre confirmado NO cambia — así el
                      // ajuste de sprite por nombre (ej. Mega Delphox Z) no se pierde a mitad de tipeo.
                      if (value.trim() === "") {
                        updateSlot(idx, { name: "" });
                      }
                    }}
                    onBlur={() => {
                      // Sin selección confirmada: se descarta el borrador y el input
                      // vuelve a mostrar el nombre ya confirmado (cancela la edición).
                      setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? null : d)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setPokemonInputDraft((prev) => prev.map((d, i) => (i === idx ? null : d)));
                        setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
                        return;
                      }
                      if (!pokemonOpen[idx] || pokemonResults[idx].length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setPokemonSelectedIdx((prev) =>
                          prev.map((sel, i) =>
                            i === idx ? Math.min(sel + 1, pokemonResults[idx].length - 1) : sel
                          )
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setPokemonSelectedIdx((prev) =>
                          prev.map((sel, i) => (i === idx ? Math.max(sel - 1, -1) : sel))
                        );
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (pokemonSelectedIdx[idx] >= 0 && pokemonSelectedIdx[idx] < pokemonResults[idx].length) {
                          selectPokemonSuggestion(idx, pokemonResults[idx][pokemonSelectedIdx[idx]]);
                        }
                      }
                    }}
                    placeholder={slot.isFake ? t.searchFakemon : t.searchPokemon}
                    className="min-w-0 flex-1 bg-transparent border border-blue-800/40 text-slate-100 placeholder-slate-500 px-2 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-700 text-[13px] sm:text-sm"
                  />
                  {!slot.isFake && (
                    <button
                      type="button"
                      onClick={() => fetchPokemon(pokemonInputDraft[idx] ?? slot.name, idx)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 px-2.5 sm:px-3.5 py-1.5 text-white btn-interactive whitespace-nowrap text-xs sm:text-sm font-semibold shadow-sm shadow-blue-950/40 transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="2" />
                        <path d="M13.6 13.6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span className="hidden xs:inline">{t.btnSearch}</span>
                    </button>
                  )}
                  <div className="inline-flex items-center gap-2 sm:gap-3">
                    {fakemonModeOn && (
                      <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm cursor-pointer select-none">
                        <span className="pr-checkbox">
                          <input
                            type="checkbox"
                            checked={slot.isFake}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (!checked) {
                                // Al dejar de ser Fakemon, los movimientos inventados
                                // ya no aplican: se limpian para que no queden
                                // "escondidos" con isFake=true fuera de contexto.
                                updateSlot(idx, {
                                  isFake: false,
                                  moves: slot.moves.map((m) =>
                                    m.isFake ? EMPTY_MOVE() : m
                                  ),
                                });
                              } else {
                                updateSlot(idx, { isFake: true });
                              }
                            }}
                          />
                          <span className="pr-checkbox-box" />
                        </span>
                        {t.checkFakemon}
                      </label>
                    )}
                    {slot.isFake ? (
                      <button
                        type="button"
                        onClick={() => openFakemonConfig(idx)}
                        className="rounded-full bg-slate-800/90 px-2.5 sm:px-3 py-1 text-[13px] sm:text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:bg-slate-700"
                      >
                        {t.btnConfigure}
                      </button>
                    ) : null}
                  </div>
                </div>
                {!slot.isFake && (
                  <AnchoredDropdown
                    anchorRefs={pokemonInputWrapRefs}
                    anchorKey={idx}
                    open={pokemonOpen[idx] && pokemonResults[idx].length > 0}
                  >
                    <div data-move-dropdown="true" className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 shadow-lg text-sm" onMouseDown={(e) => e.stopPropagation()}>
                      {pokemonResults[idx].map((name, resultIdx) => {
                        // El value interno puede venir codificado como "Label#id"
                        // (formas/megas Z); separamos para mostrar solo el label limpio.
                        const hashIdx = name.lastIndexOf("#");
                        const displayLabel = hashIdx >= 0 ? name.slice(0, hashIdx) : name;
                        return (
                        <button
                          key={name}
                          type="button"
                          ref={(el) => {
                            if (el && pokemonSelectedIdx[idx] === resultIdx) {
                              el.scrollIntoView({ block: "nearest" });
                            }
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectPokemonSuggestion(idx, name);
                          }}
                          onMouseEnter={() =>
                            setPokemonSelectedIdx((prev) =>
                              prev.map((sel, i) => (i === idx ? resultIdx : sel))
                            )
                          }
                          className={`w-full text-left px-3 py-2 ${
                            pokemonSelectedIdx[idx] === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                          } focus:bg-slate-700/80`}
                        >
                          {formatForDisplay(displayLabel)}
                        </button>
                        );
                      })}
                    </div>
                  </AnchoredDropdown>
                )}
                {slot.isFake ? (
                  <div className="mt-3 rounded-2xl border border-slate-800/60 bg-slate-950/60 p-3 text-slate-300">
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">{t.fakemonConfigured}</div>
                    <div className="flex flex-wrap gap-2">
                      {slot.types.filter(Boolean).length ? (
                        slot.types.filter(Boolean).map((type) => (
                          <span key={type} className={badgeClass(type)}>
                            {tn(type)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">{t.noTypesSet}</span>
                      )}
                    </div>
                  </div>
                ) : null}

                {!isAdvanced && (
                  <div className="mt-3 mb-1 text-[12px] uppercase tracking-[0.2em] text-slate-500">{t.guideMoves}</div>
                )}
                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                  {slot.moves.map((m, mi) => {
                    const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
                    const CategoryIcon = ({ cat, size = 18 }: { cat: string; size?: number }) => {
                      if (cat === "Physical") return (
                        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#C03028" stroke="#7f1010" strokeWidth="1"/>
                          <path d="M5 13L9 5L13 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <circle cx="9" cy="5" r="1.5" fill="white"/>
                        </svg>
                      );
                      if (cat === "Special") return (
                        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#6890F0" stroke="#1e3a8a" strokeWidth="1"/>
                          <path d="M9 4L10.2 7.5H14L11 9.8L12.2 13.2L9 11L5.8 13.2L7 9.8L4 7.5H7.8L9 4Z" fill="white"/>
                        </svg>
                      );
                      return (
                        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#705898" stroke="#3b1e6b" strokeWidth="1"/>
                          <circle cx="9" cy="9" r="3.5" fill="white" opacity="0.9"/>
                          <circle cx="9" cy="9" r="1.5" fill="#705898"/>
                        </svg>
                      );
                    };
                    const moveDescription = lang === "es"
                      ? (m.descriptionEs || m.descriptionEn)
                      : (m.descriptionEn || m.descriptionEs);
                    const isDraggingThisMove = dragMoveFrom?.slotIdx === idx && dragMoveFrom?.moveIdx === mi;
                    const isDragOverThisMove = moveDragOverIdx?.slotIdx === idx && moveDragOverIdx?.moveIdx === mi;
                    return (
                      <div
                        key={mi}
                        className={`pokedex-card rounded-xl border-blue-800/30 p-2 sm:p-2.5 transition ${isDraggingThisMove ? "opacity-40" : ""} ${isDragOverThisMove ? "ring-2 ring-sky-400/70" : ""}`}
                        style={moveBgStyle(m.category, m.type)}
                        onDragOver={(e) => handleMoveDragOver(idx, mi, e)}
                        onDrop={(e) => handleMoveDrop(idx, mi, e)}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Handle simple de drag & drop: solo reordena movimientos dentro del mismo Pokémon */}
                            <span
                              draggable
                              onDragStart={(e) => handleMoveDragStart(idx, mi, e)}
                              onDragEnd={handleMoveDragEnd}
                              title={lang === "es" ? "Arrastrar para reordenar" : "Drag to reorder"}
                              className="cursor-grab active:cursor-grabbing select-none text-slate-500 hover:text-slate-300 text-sm leading-none px-0.5"
                            >
                              ⠿
                            </span>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t.attackSlot} {mi + 1}</div>
                          </div>
                          {slot.isFake && (
                            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
                              <span className="pr-checkbox">
                                <input
                                  type="checkbox"
                                  checked={!!m.isFake}
                                  onChange={(e) => updateMove(idx, mi, { isFake: e.target.checked })}
                                />
                                <span className="pr-checkbox-box" />
                              </span>
                              {t.moveInvented}
                            </label>
                          )}
                        </div>

                        {m.isFake ? (
                          <div className="space-y-3">
                            <input
                              placeholder={t.fakeMovePlaceholder}
                              value={m.name}
                              onChange={(e) => updateMove(idx, mi, { name: e.target.value })}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                            />
                            <select
                              value={m.category}
                              onChange={(e) => updateMove(idx, mi, { category: e.target.value as Move["category"] })}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                            >
                              <option value="Physical">{t.catPhysical}</option>
                              <option value="Special">{t.catSpecial}</option>
                              <option value="Status">{t.catStatus}</option>
                            </select>
                            <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-2">
                              <button
                                type="button"
                                onClick={() => toggleFakeType(idx, mi)}
                                className="flex w-full items-center justify-between gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200"
                              >
                                <span>{t.fakeTypeLabel}{m.type ? `: ${tn(m.type)}` : ""}</span>
                                <span>{fakeTypeOpen[idx][mi] ? "▾" : "▸"}</span>
                              </button>
                              {fakeTypeOpen[idx][mi] && (
                                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {allTypes.map((ty) => (
                                    <button
                                      key={ty}
                                      type="button"
                                      onClick={() => updateMove(idx, mi, { type: m.type === ty ? null : ty })}
                                      className={`${badgeClass(ty)} type-picker-badge min-h-8 w-full px-2 py-1 opacity-75 transition hover:opacity-100 ${m.type === ty ? "ring-2 ring-white/70 opacity-100" : ""}`}
                                    >
                                      {tn(ty)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="relative" ref={(el) => { moveInputWrapRefs.current[`${idx}-${mi}`] = el; }}>
                            <input
                              placeholder={t.movePlaceholder}
                              value={moveInputDraft[idx][mi] !== null
                                ? moveInputDraft[idx][mi]!
                                : (() => {
                                    if (lang !== "es") return m.name;
                                    // Priority: stored nameEs → bulk-loaded ES map → EN name
                                    return m.nameEs || moveEsDisplay[m.name] || m.name;
                                  })()
                              }
                              onFocus={() => {
                                // Enter edit mode: pre-fill with the current translated display name
                                const display = lang === "es"
                                  ? (m.nameEs || moveEsDisplay[m.name] || m.name)
                                  : m.name;
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? display : d) : s)
                                );
                              }}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Update draft only — never touch m.name/m.nameEs while typing
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? value : d) : s)
                                );
                              }}
                              onKeyDown={(e) => {
                                if (!moveOpen[idx][mi] || moveResults[idx][mi].length === 0) return;
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setMoveSelectedIdx((prev) =>
                                    prev.map((s, si) => si === idx
                                      ? s.map((sel, mj) => mj === mi ? Math.min(sel + 1, moveResults[idx][mi].length - 1) : sel)
                                      : s)
                                  );
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setMoveSelectedIdx((prev) =>
                                    prev.map((s, si) => si === idx
                                      ? s.map((sel, mj) => mj === mi ? Math.max(sel - 1, -1) : sel)
                                      : s)
                                  );
                                } else if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (moveSelectedIdx[idx][mi] >= 0 && moveSelectedIdx[idx][mi] < moveResults[idx][mi].length) {
                                    selectMoveSuggestion(idx, mi, moveResults[idx][mi][moveSelectedIdx[idx][mi]]);
                                  }
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  // Cancel edit: revert to display mode
                                  setMoveInputDraft((prev) =>
                                    prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? null : d) : s)
                                  );
                                  setMoveOpen((prev) =>
                                    prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s)
                                  );
                                }
                              }}
                              onBlur={() => {
                                const draft = moveInputDraft[idx][mi];
                                if (draft === null) return;
                                // Resolve: try ES map first, then use draft as English slug
                                const normalized = normalizeMoveSearch(draft);

const enSlug =
  Object.entries(moveEsMap).find(
    ([es]) => normalizeMoveSearch(es) === normalized
  )?.[1] ?? formatForAPI(draft);
                                // Clear draft → back to display mode
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? null : d) : s)
                                );
                                setMoveOpen((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s)
                                );
                                if (enSlug) {
                                  updateMove(idx, mi, { name: enSlug });
                                  fetchMove(enSlug, idx, mi);
                                }
                              }}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-950/50 py-2 pl-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                              style={{
                                paddingRight:
                                  moveDescription ? "4.2rem" : "2.25rem",
                              }}
                            />
                            {!m.isFake && m.name && moveDescription && (
                              <div className="absolute right-9 top-1/2 -translate-y-1/2">
                                <FloatingTooltip
                                  preferredPlacement="right"
                                  content={
                                    <div className="w-64 rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-xl shadow-black/50 text-sm text-slate-100">
                                      <div className="text-[13px] uppercase tracking-[0.25em] text-slate-500 mb-1.5">
                                        {lang === "es" ? "Descripción" : "Description"}
                                      </div>
                                      <p className="text-[13px] leading-snug text-slate-200">{moveDescription}</p>
                                      {(m.power != null || m.accuracy != null || m.pp != null) && (
                                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-3 text-[13px] text-slate-400">
                                          <span>{lang === "es" ? "Poder" : "Power"}: <span className="text-slate-200 font-semibold">{m.power ?? "—"}</span></span>
                                          <span>{lang === "es" ? "Precisión" : "Accuracy"}: <span className="text-slate-200 font-semibold">{m.accuracy ?? "—"}</span></span>
                                          <span>PP: <span className="text-slate-200 font-semibold">{m.pp ?? "—"}</span></span>
                                        </div>
                                      )}
                                    </div>
                                  }
                                >
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                                    title={lang === "es" ? "Descripción del movimiento" : "Move description"}
                                  >
                                    ⓘ
                                  </button>
                                </FloatingTooltip>
                              </div>
                            )}                            {activeMoves.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openMoveFilter(idx, mi)}
                                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-300"
                                title={lang === "es" ? "Filtrar movimientos" : "Filter moves"}
                              >
                                <Search className="h-4 w-4" />
                              </button>
                            )}
                            <AnchoredDropdown
                              anchorRefs={moveInputWrapRefs}
                              anchorKey={`${idx}-${mi}`}
                              open={moveOpen[idx][mi] && moveResults[idx][mi].length > 0}
                            >
                              <div data-move-dropdown="true" className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 text-sm shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
                                {moveResults[idx][mi].map((name, resultIdx) => {
                                  // Mostrar solo el nombre en el idioma activo, igual que en la dex Z
                                  const esDisplay = moveEsDisplay[name];
                                  const label = lang === "es" && esDisplay ? esDisplay : formatForDisplay(name);
                                  const learnBadge = getMoveLearnBadge(idx, name);
                                  return (
                                    <button
                                      key={name}
                                      type="button"
                                      ref={(el) => {
                                        if (el && moveSelectedIdx[idx][mi] === resultIdx) {
                                          el.scrollIntoView({ block: "nearest" });
                                        }
                                      }}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectMoveSuggestion(idx, mi, name);
                                      }}
                                      onMouseEnter={() =>
                                        setMoveSelectedIdx((prev) =>
                                          prev.map((s, si) => si === idx
                                            ? s.map((sel, mj) => mj === mi ? resultIdx : sel)
                                            : s)
                                        )
                                      }
                                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 ${
                                        moveSelectedIdx[idx][mi] === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                                      }`}
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        <span className="truncate">{label}</span>
                                      </span>
                                      {learnBadge && (
                                        <span className="shrink-0 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[13px] font-semibold text-emerald-300">
                                          {learnBadge}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </AnchoredDropdown>
                            </div>
                            {isHP && isAdvanced && (
                              <div className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/20 p-2 animate-[fadeSlideDown_0.18s_ease-out]">
                                <button
                                  type="button"
                                  onClick={() => toggleHpType(idx, mi)}
                                  className="flex w-full items-center justify-between gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200"
                                >
                                  <span>{t.hpTypeLabel}{m.hiddenPowerType ? `: ${tn(m.hiddenPowerType)}` : ""}</span>
                                  <span>{hpTypeOpen[idx][mi] ? "▾" : "▸"}</span>
                                </button>
                                {hpTypeOpen[idx][mi] && (
                                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                    {allTypes.filter((ty) => ty !== "normal" && ty !== "fairy").map((ty) => (
                                      <button
                                        key={ty}
                                        type="button"
                                        onClick={() => updateMove(idx, mi, { hiddenPowerType: m.hiddenPowerType === ty ? null : ty })}
                                        className={`${badgeClass(ty)} min-h-7 px-2 py-1 text-[12px] opacity-75 transition hover:opacity-100 ${m.hiddenPowerType === ty ? "ring-2 ring-white/70 opacity-100" : ""}`}
                                      >
                                        {tn(ty)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800/70 pt-3">
                          {isAdvanced ? (
                          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                            <span className="shrink-0"><CategoryIcon cat={m.category} size={22} /></span>
                            <span className="text-[12px] leading-none font-medium uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">
                              {m.category === "Physical" ? t.catPhysical : m.category === "Special" ? t.catSpecial : t.catStatus}
                            </span>
                          </div>
                          ) : <span />}
                          <span className="flex-1 min-w-0" />
                          {isHP && m.hiddenPowerType ? (
                            <span className={`${badgeClass(m.hiddenPowerType)} ml-auto min-h-7 px-2.5 py-0.5 text-[12px] whitespace-nowrap shrink-0`}>{tn(m.hiddenPowerType)}</span>
                          ) : m.type ? (
                            <span className={`${badgeClass(m.type)} ml-auto min-h-7 px-2.5 py-0.5 text-[12px] whitespace-nowrap shrink-0`}>{tn(m.type)}</span>
                          ) : (
                            <span className="ml-auto inline-flex min-h-7 items-center rounded-full border border-slate-700 px-2.5 py-0.5 text-[12px] text-slate-500 whitespace-nowrap shrink-0">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
                )}
              </div>
              );
            })}
          </div>
        </CollapsibleSection>

      {/* ── Modal de filtros de movimientos ── */}
      {moveFilterTarget && (
        <MoveFilterModal
          moves={activeMoves as MoveFilterEntry[]}
          lang={lang}
          search={moveFilterSearch[moveFilterTarget.slotIdx] ?? ""}
          onSearchChange={(v) => {
            const slotIdx = moveFilterTarget.slotIdx;
            setMoveFilterSearch((prev) => prev.map((s, i) => (i === slotIdx ? v : s)));
          }}
          categories={moveFilterCategories[moveFilterTarget.slotIdx] ?? new Set<string>()}
          onToggleCategory={toggleMoveFilterCategory}
          types={moveFilterTypes[moveFilterTarget.slotIdx] ?? new Set<string>()}
          onToggleType={toggleMoveFilterType}
          onlyZOriginals={moveFilterOnlyZ}
          onToggleOnlyZOriginals={toggleMoveFilterOnlyZ}
          showOnlyZFilter={activePokedex === "pokemon-z"}
          onClearFilters={clearMoveFilters}
          sortPower={moveFilterSortPower[moveFilterTarget.slotIdx] ?? null}
          onSortPowerChange={(v) => {
            const slotIdx = moveFilterTarget.slotIdx;
            setMoveFilterSortPower((prev) => prev.map((s, i) => (i === slotIdx ? v : s)));
          }}
          learnMethods={team[moveFilterTarget.slotIdx]?.learnMethods}
          onlyLearnable={onlyLearnableMoves}
          learnableSet={
            team[moveFilterTarget.slotIdx]?.learnableMoves
              ? new Set(team[moveFilterTarget.slotIdx]!.learnableMoves as string[])
              : null
          }
          badgeClass={badgeClass}
          tn={tn}
          onSelect={selectMoveFromFilter}
          onClose={closeMoveFilter}
        />
      )}

    </>
  );
}
