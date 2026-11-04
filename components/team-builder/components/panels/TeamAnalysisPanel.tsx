import { memo } from "react";
import type { BaseStats, Lang } from "../../types";
import type { DamageRelations } from "../../data/staticPokeData";
import { CollapsibleSection } from "../CollapsibleSection";
import { FloatingTooltip } from "../FloatingTooltip";
import { RoleBadge } from "../RoleBadge";
import { BarChart3, Swords, TriangleAlert, AlertTriangle, Shield, Puzzle, Zap, Target, TrendingUp } from "lucide-react";

type SpriteMult = { name: string; sprite?: string | null; mult?: number };
type TypeDetailEntry = { weak: SpriteMult[]; resist: SpriteMult[]; immune: SpriteMult[] };
type SharedWeakness = { weakType: string; count: number; names: string[]; resistantTypes: string[] };
type TypeAddSuggestion = { type: string; score: number; addsResistTypes: string[]; coversWeaknessTypes: string[] };
type CoverageData = { supCount: number; canHitSupereffective: Record<string, number> };
type AttackSuggestion = { atkType: string; covers: string[] };
type WeakCoverageSuggestion = {
  weakTypes: string[];
  minCount: number;
  bestTypes: { atkType: string; covered: string[] }[];
} | null;
type MoveTypeRedundancyEntry = { atkType: string; count: number; pokemonNames: string[] };
type StatsAnalysis = {
  STAT_KEYS: (keyof BaseStats)[];
  STAT_NAMES: Record<keyof BaseStats, string>;
  averages: Record<keyof BaseStats, number>;
  levels: Record<keyof BaseStats, "alto" | "medio" | "bajo">;
  gaps: Record<keyof BaseStats, number>;
  count: number;
  allBalanced: boolean;
  redundantRoles: { role: { label: string; color: string }; count: number; pokemon: string[] }[];
  topSuggestions: { role: { label: string; color: string }; statA: keyof BaseStats; statB: keyof BaseStats; existingCount: number }[];
} | null;
type RolesSummaryEntry = { label: string; color: string; count: number; pokemon: string[] };

export type TeamAnalysisWeaknessStrength = { weaknesses: Record<string, number>; strengths: Record<string, number> };

type TeamAnalysisPanelProps = {
  lang: Lang;
  t: Record<string, string>;
  tn: (apiKey: string) => string;
  badgeClass: (t: string) => string;
  isAdvanced: boolean;
  loadingRelations: boolean;
  analysis: TeamAnalysisWeaknessStrength;
  typeRelations: Record<string, DamageRelations>;
  typeDetail: Record<string, TypeDetailEntry>;
  sharedWeaknesses: SharedWeakness[];
  typeAddSuggestions: TypeAddSuggestion[];
  coverage: CoverageData;
  attackSuggestions: AttackSuggestion[];
  weakCoverageSuggestion: WeakCoverageSuggestion;
  moveTypeRedundancy: MoveTypeRedundancyEntry[];
  statsAnalysis: StatsAnalysis;
  rolesSummary: RolesSummaryEntry[];
  getStatColor: (value: number) => string;
};

/**
 * Panel "Análisis del equipo": cobertura de tipos (debilidades/resistencias
 * compartidas, sugerencias de tipo a agregar), cobertura ofensiva (tipos sin
 * cubrir, movimientos repetidos) y, en modo avanzado, balance de stats +
 * roles del equipo. Extraído tal cual del render principal de
 * TeamBuilder.tsx (Fase 6).
 *
 * Nota: en el original este panel comparte un grid de 2 columnas con
 * TeamGrid (todavía sin extraer) — por eso el wrapper `<div className="grid
 * grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-4">` sigue viviendo en
 * TeamBuilder.tsx en vez de acá; este componente es solo el `<section>`.
 */
function TeamAnalysisPanelImpl({
  lang, t, tn, badgeClass, isAdvanced, loadingRelations, analysis, typeRelations,
  typeDetail, sharedWeaknesses, typeAddSuggestions, coverage, attackSuggestions,
  weakCoverageSuggestion, moveTypeRedundancy, statsAnalysis, rolesSummary, getStatColor,
}: TeamAnalysisPanelProps) {
  return (
        <section className="pokedex-panel p-3 sm:p-4 rounded-lg h-full flex flex-col gap-3 min-h-0 overflow-hidden">
          <h2 className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-semibold tracking-tight text-slate-100">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200"><BarChart3 className="h-3.5 w-3.5" /></span>
            {lang === "es" ? "Análisis del equipo" : "Team Analysis"}
          </h2>
          <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
          <div className="w-px bg-gradient-to-b from-blue-700/40 via-slate-700/20 to-transparent shrink-0 mr-3 ml-1" />
          <div className="grid gap-2 flex-1 min-h-0 overflow-hidden">
            <CollapsibleSection
              as="div"
              className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 h-full min-h-0 overflow-hidden"
              headerClassName="mb-2 sm:mb-3"
              icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200"><Swords className="h-3.5 w-3.5" /></span>}
              title={lang === "es" ? "Tipos" : "Types"}
              guide={!isAdvanced ? t.guideDefenseSection : undefined}
              storageKey="defensive-coverage"
            >
              {loadingRelations ? (
                <div className="grid grid-cols-1 gap-2 animate-pulse" aria-busy="true" aria-label={lang === "es" ? "Cargando relaciones de tipos…" : "Loading type chart…"}>
                  {/* Placeholder de "debilidades compartidas" */}
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2.5 space-y-2">
                    <div className="h-2.5 w-40 rounded bg-slate-700/50" />
                    <div className="flex gap-1.5">
                      <div className="h-5 w-16 rounded-full bg-slate-700/50" />
                      <div className="h-5 w-16 rounded-full bg-slate-700/50" />
                      <div className="h-4 w-24 rounded bg-slate-800/60 self-center" />
                    </div>
                  </div>
                  {/* Placeholder de las dos columnas debilidades/resistencias */}
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 items-stretch">
                    {[0, 1].map((i) => (
                      <div key={i} className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 h-full flex flex-col gap-2">
                        <div className="h-3 w-28 rounded bg-slate-700/50" />
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} className="h-6 w-14 rounded-full bg-slate-800/60" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {sharedWeaknesses.length > 0 && (
                    <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2.5">
                      <div className="text-[13px] uppercase tracking-[0.2em] text-red-400 mb-1.5 font-medium">
                        {lang === "es" ? "Debilidades compartidas del equipo" : "Team's shared weaknesses"}
                      </div>
                      <div className="space-y-2.5">
                        {sharedWeaknesses.map(({ weakType, count, names, resistantTypes }) => (
                          <div key={weakType}>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className={`${badgeClass(weakType)} text-[13px] px-2 py-0.5`}>{tn(weakType)}</span>
                              <span className="text-red-300 font-semibold">
                                {count}× {lang === "es" ? "en el equipo" : "on the team"}
                              </span>
                              {names.length > 0 && <span className="text-slate-500">({names.join(", ")})</span>}
                            </div>
                            {resistantTypes.length > 0 && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-slate-600">{lang === "es" ? "resistido por:" : "resisted by:"}</span>
                                {resistantTypes.map((ty) => (
                                  <span key={ty} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5 opacity-80`}>{tn(ty)}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 items-stretch">
                    <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <TriangleAlert className="h-4 w-4 text-red-400 shrink-0" />
                        <span className="font-semibold text-slate-100">{t.weaknesses} (×2+)</span>
                        {Object.values(analysis.weaknesses).some(c => c >= 4) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-950/60 border border-red-500/40 px-1.5 py-0.5 text-[12px] font-bold text-red-300 uppercase tracking-wider"><AlertTriangle className="h-2.5 w-2.5" /> ×4</span>
                        )}
                      </div>
                    <div className="flex flex-wrap content-start gap-2 flex-1">
                        {Object.entries(analysis.weaknesses).length ? (
                          Object.entries(analysis.weaknesses)
                            .sort(([, a], [, b]) => b - a)
                            .map(([ty, c]) => {
                              const detail = typeDetail[ty];
                              const hasDetail = isAdvanced && detail && (detail.weak.length > 0 || detail.resist.length > 0 || detail.immune.length > 0);
                              return (
                                <FloatingTooltip
                                  key={ty}
                                  preferredPlacement="top"
                                  content={
                                    hasDetail ? (
                                      <div className="w-52 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs">
                                        <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500 mb-2">{tn(ty)}</div>
                                        {detail.weak.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[12px] text-red-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Débiles" : "Weak"}</div>
                                            {detail.weak.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-red-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.resist.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[12px] text-emerald-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Resisten" : "Resist"}</div>
                                            {detail.resist.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-emerald-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.immune.length > 0 && (
                                          <div>
                                            <div className="text-[12px] text-blue-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Inmunes" : "Immune"}</div>
                                            {detail.immune.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-blue-300 font-bold shrink-0">0×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : null
                                  }
                                >
                                  <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-slate-200 whitespace-nowrap w-fit cursor-default transition-[height,background-color,border-color,box-shadow]
                                    ${c >= 4
                                      ? "h-11 bg-red-950/60 border border-red-500/50 shadow shadow-red-900/40 ring-1 ring-red-500/20"
                                      : c >= 3
                                      ? "h-10 bg-red-950/30 border border-red-700/40"
                                      : "h-9 bg-slate-900/80 border border-slate-800/60"
                                    }`}>
                                    <span className={`${badgeClass(ty)} ${c >= 4 ? "text-[15px]" : "text-[13px]"}`}>{tn(ty)}</span>
                                    <span className={`font-bold tabular-nums ${c >= 4 ? "text-sm text-red-300" : c >= 3 ? "text-xs text-red-400/80" : "text-xs text-slate-400"}`}>{c}×</span>
                                  </div>
                                </FloatingTooltip>
                              );
                            })
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-slate-900/80 px-3 py-8 text-slate-500 text-sm gap-2 w-full min-h-[96px]">
                            <span className="text-lg">∘</span>
                            <span>{lang === "es" ? "No hay datos de debilidades aún" : "No weakness data yet"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="font-semibold text-slate-100">{t.strengths} (≤×0.5)</span>
                      </div>
                      <div className="flex flex-wrap content-start gap-2 flex-1">
                        {Object.entries(analysis.strengths).length ? (
                          Object.entries(analysis.strengths)
                            .sort(([, a], [, b]) => b - a)
                            .map(([ty, c]) => {
                              const detail = typeDetail[ty];
                              const hasDetail = isAdvanced && detail && (detail.weak.length > 0 || detail.resist.length > 0 || detail.immune.length > 0);
                              return (
                                <FloatingTooltip
                                  key={ty}
                                  preferredPlacement="top"
                                  content={
                                    hasDetail ? (
                                      <div className="w-52 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs">
                                        <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500 mb-2">{tn(ty)}</div>
                                        {detail.weak.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[12px] text-red-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Débiles" : "Weak"}</div>
                                            {detail.weak.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-red-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.resist.length > 0 && (
                                          <div className="mb-2">
                                            <div className="text-[12px] text-emerald-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Resisten" : "Resist"}</div>
                                            {detail.resist.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-emerald-300 font-bold shrink-0">{p.mult}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {detail.immune.length > 0 && (
                                          <div>
                                            <div className="text-[12px] text-blue-400 uppercase tracking-[0.15em] mb-1">{lang === "es" ? "Inmunes" : "Immune"}</div>
                                            {detail.immune.map((p) => (
                                              <div key={p.name} className="flex items-center gap-1.5 mb-1">
                                                {p.sprite && <img src={p.sprite} alt={p.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-slate-300 truncate">{p.name}</span>
                                                <span className="ml-auto text-blue-300 font-bold shrink-0">0×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : null
                                  }
                                >
                                  <div className={`flex items-center gap-1.5 h-10 rounded-lg bg-slate-900/80 px-2.5 py-1 text-slate-200 whitespace-nowrap w-fit cursor-default ${c >= 3 ? "border border-emerald-500/30 shadow-sm shadow-emerald-500/10" : ""}`}>
                                    <span className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                                    <span className={`text-xs font-semibold ${c >= 3 ? "text-emerald-200" : "text-slate-300"}`}>{c}×</span>
                                  </div>
                                </FloatingTooltip>
                              );
                            })
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-slate-900/80 px-3 py-8 text-slate-500 text-sm gap-2 w-full min-h-[96px]">
                            <span className="text-lg">∘</span>
                            <span>No hay datos de resistencias aún</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {typeAddSuggestions.length > 0 && (
                    <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/10 px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Puzzle className="h-4 w-4 shrink-0" />
                        <span className="text-[13px] uppercase tracking-[0.2em] text-emerald-400 font-medium">
                          {lang === "es" ? "Tipos recomendados para agregar" : "Recommended types to add"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {typeAddSuggestions.map(({ type, addsResistTypes, coversWeaknessTypes }) => (
                          <div key={type} className="flex flex-wrap items-center gap-1.5 text-xs rounded-lg bg-slate-950/60 border border-emerald-900/30 px-2.5 py-1.5">
                            <span className={`${badgeClass(type)} text-[13px] px-2 py-0.5`}>{tn(type)}</span>
                            {coversWeaknessTypes.length > 0 && (
                              <span className="flex flex-wrap items-center gap-1">
                                <span className="text-slate-600">{lang === "es" ? "cubre:" : "covers:"}</span>
                                {coversWeaknessTypes.map((ty) => (
                                  <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 opacity-90`}>{tn(ty)}</span>
                                ))}
                              </span>
                            )}
                            {addsResistTypes.length > 0 && (
                              <span className="flex flex-wrap items-center gap-1">
                                <span className="text-slate-600">{lang === "es" ? "resiste:" : "resists:"}</span>
                                {addsResistTypes.map((ty) => (
                                  <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 opacity-70`}>{tn(ty)}</span>
                                ))}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              as="div"
              className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 h-full min-h-0 flex flex-col overflow-hidden"
              headerClassName="mb-2 sm:mb-3"
              icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200"><Zap className="h-3.5 w-3.5" /></span>}
              title={t.coverageTitle}
              guide={!isAdvanced ? t.guideCoverageSection : undefined}
              storageKey="offensive-coverage"
              bodyClassName="flex-1 grid gap-3 min-h-0 overflow-hidden"
            >
                <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 text-slate-200">
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-1">{t.coverageTypesCovered}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">{coverage.supCount}</span>
                    <span className="text-slate-500 text-sm">/ {Object.keys(typeRelations).length} {t.coverageOf}</span>
                  </div>
                </div>
                {/* Tipos NO cubiertos — ahora es su propia tarjeta hermana (antes
                    quedaba anidada dentro del cuadro de arriba, mientras que
                    "Tipos con menor cobertura" ya era una tarjeta aparte; así
                    las dos quedan al mismo nivel y con el mismo tratamiento). */}
                {Object.keys(typeRelations).length > 0 && (() => {
                    const hasAnyOffensiveData = Object.values(coverage.canHitSupereffective).some((v) => v > 0);
                    if (!hasAnyOffensiveData) {
                      return (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-6 text-center">
                          <Target className="h-6 w-6 text-slate-600" />
                          <span className="text-sm text-slate-500">
                            {lang === "es" ? "Añade movimientos para ver cobertura" : "Add moves to see coverage"}
                          </span>
                        </div>
                      );
                    }
                    const uncovered = Object.keys(typeRelations).filter(
                      (ty) => !coverage.canHitSupereffective[ty] || coverage.canHitSupereffective[ty] === 0
                    );
                    return uncovered.length > 0 ? (
                      <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-2.5 py-2">
                        <div className="text-[13px] uppercase tracking-[0.2em] text-red-400 mb-1.5 font-medium">
                          {lang === "es" ? "Sin cobertura frente a" : "No coverage against"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {uncovered.map((ty) => (
                            <span key={ty} className={`${badgeClass(ty)} text-[13px] px-2 py-0.5 ring-1 ring-red-500/30`}>{tn(ty)}</span>
                          ))}
                        </div>
                        {attackSuggestions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-red-900/30 space-y-1.5">
                            {attackSuggestions.map(({ atkType, covers }) => {
                              const allSuperEffective = typeRelations[atkType]?.double_damage_to?.map((d) => d.name) ?? [];
                              const secondaryCoverage = allSuperEffective.filter((ty: string) => !covers.includes(ty));
                              return (
                                <div key={atkType} className="text-xs">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`${badgeClass(atkType)} text-[13px] shrink-0`}>{tn(atkType)}</span>
                                    <span className="text-slate-400">{t.atkSuggCovers} {covers.length} {t.atkSuggUncovered}</span>
                                    {covers.map((ty: string) => (
                                      <span key={ty} className={`${badgeClass(ty)} text-[13px]`}>{tn(ty)}</span>
                                    ))}
                                  </div>
                                  {secondaryCoverage.length > 0 && (
                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-600">{t.atkSuggAlso}</span>
                                      {secondaryCoverage.map((ty: string) => (
                                        <span key={ty} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5 opacity-50`}>{tn(ty)}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-2.5 py-1.5 text-[13px] text-emerald-400">
                        ✓ {lang === "es" ? "Cobertura completa" : "Full coverage"}
                      </div>
                    );
                })()}
                {weakCoverageSuggestion && weakCoverageSuggestion.weakTypes.length > 0 && (
                  <div className="rounded-lg border border-amber-800/40 bg-amber-950/10 px-3 py-2.5">
                    <div className="text-[13px] uppercase tracking-[0.2em] text-amber-400 mb-1.5 font-medium">
                      {lang === "es" ? "Tipos con menor cobertura" : "Types with least coverage"}
                      <span className="text-amber-500/70 normal-case tracking-normal font-normal">
                        {" "}({weakCoverageSuggestion.minCount}× {lang === "es" ? "cada uno" : "each"})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {weakCoverageSuggestion.weakTypes.map((ty) => (
                        <span key={ty} className={`${badgeClass(ty)} text-[13px] px-2 py-0.5`}>{tn(ty)}</span>
                      ))}
                    </div>
                    {weakCoverageSuggestion.bestTypes.length > 0 ? (
                      <div className="space-y-1 pt-1.5 border-t border-amber-900/30">
                        <div className="text-xs text-slate-400 mb-0.5">
                          {lang === "es" ? "Tipo(s) de ataque recomendados:" : "Recommended attack type(s):"}
                        </div>
                        {weakCoverageSuggestion.bestTypes.map(({ atkType, covered }) => (
                          <div key={atkType} className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                            <span className={`${badgeClass(atkType)} text-[13px]`}>{tn(atkType)}</span>
                            <span className="text-slate-600">
                              {lang === "es" ? "cubre" : "covers"} {covered.length}/{weakCoverageSuggestion.weakTypes.length}
                            </span>
                            {covered.map((ty) => (
                              <span key={ty} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5 opacity-70`}>{tn(ty)}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 pt-1.5 border-t border-amber-900/30">
                        {lang === "es" ? "No hay ningún tipo de ataque que refuerce esto." : "No attack type would help here."}
                      </div>
                    )}
                  </div>
                )}
                {isAdvanced && (
                <div>
                  <div className="font-semibold text-slate-100 mb-2 text-sm">{t.superEffective}</div>
                  {Object.values(coverage.canHitSupereffective).every((v) => v === 0) ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-6 text-center">
                      <Swords className="h-6 w-6 text-slate-600" />
                      <span className="text-sm text-slate-500">{lang === "es" ? "Añade movimientos para ver cobertura" : "Add moves to see coverage"}</span>
                    </div>
                  ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(coverage.canHitSupereffective)
                      .filter(([_, v]) => v > 0)
                      .map(([ty]) => (
                        <div key={ty} className="flex items-center gap-1.5 h-8 rounded-lg bg-slate-900/80 px-2 py-1 text-slate-200 whitespace-nowrap w-fit">
                          <span className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                          <span className="text-xs font-semibold text-slate-300">{coverage.canHitSupereffective[ty]}×</span>
                        </div>
                      ))}
                  </div>
                  )}
                </div>
                )}
                {isAdvanced && moveTypeRedundancy.length > 0 && (
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 px-3 py-2.5">
                    <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500 mb-1.5 font-medium">
                      {lang === "es" ? "Movimientos ofensivos repetidos" : "Repeated offensive moves"}
                    </div>
                    <div className="space-y-2">
                      {moveTypeRedundancy.map(({ atkType, count, pokemonNames }) => (
                        <div key={atkType} className="flex flex-wrap items-center gap-1.5">
                          <span className={`${badgeClass(atkType)} text-[13px] px-2 py-0.5`}>{tn(atkType)}</span>
                          <span className="text-sm font-semibold text-slate-300">×{count}</span>
                          {pokemonNames.map((name) => (
                            <span key={name} className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[12px] font-medium text-slate-200 capitalize">
                              {name}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[13px] text-slate-500">
                      {lang === "es"
                        ? "Del segundo movimiento del mismo tipo en adelante no suman cobertura nueva: pegan a los mismos tipos que el primero."
                        : "From the second move of the same type onward, they don't add new coverage: they hit the same types as the first."}
                    </div>
                  </div>
                )}
            </CollapsibleSection>

            {isAdvanced && (<>
            <CollapsibleSection
              as="div"
              className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 min-h-0 flex flex-col"
              headerClassName="mb-2 sm:mb-3"
              icon={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200"><TrendingUp className="h-3.5 w-3.5" /></span>}
              title={t.statsBalance}
              storageKey="stats-balance"
            >
              {statsAnalysis ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {statsAnalysis.STAT_KEYS.map((key) => {
                      const value = statsAnalysis.averages[key];
                      const lv = statsAnalysis.levels[key];
                      const lvColor = lv === "alto" ? "text-emerald-400" : lv === "medio" ? "text-yellow-400" : "text-red-400";
                      const lvLabel = lv === "alto" ? t.statLevelHigh : lv === "medio" ? t.statLevelMid : t.statLevelLow;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-[14px] uppercase tracking-[0.15em]">
                            <span className="text-slate-300 w-16">{statsAnalysis.STAT_NAMES[key]}</span>
                            <span className="text-slate-400 w-8 text-center">{value}</span>
                            <span className={`font-semibold w-12 text-right ${lvColor}`}>{lvLabel}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full transition-[width,background-color] duration-500"
                              style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {statsAnalysis.allBalanced ? (
                    <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/30 px-3 py-2.5 text-xs text-emerald-300 leading-relaxed">
                      {t.balancedOk}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {statsAnalysis.redundantRoles.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[13px] uppercase tracking-[0.2em] text-amber-500">{t.redundantRoles}</div>
                          {statsAnalysis.redundantRoles.map(({ role, count: rc, pokemon }) => (
                            <div key={role.label} className="flex items-center gap-3 rounded-xl border border-amber-800/40 bg-amber-950/30 px-3 py-2.5">
                              <RoleBadge lang={lang} label={role.label} color={role.color} size="text-[14px]" pokemonList={pokemon} />
                              <div className="text-xs text-amber-300 leading-relaxed">
                                <span className="font-semibold">{rc} {lang === "es" ? "Pokémon" : "Pokémon"} {t.redundantDesc}</span> ({pokemon.join(", ")}) {t.redundantNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {statsAnalysis.topSuggestions.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500">{t.roleSuggTitle}</div>
                          {statsAnalysis.topSuggestions.map(({ role, statA, statB, existingCount }) => {
                            const gapA = statsAnalysis.gaps[statA];
                            const gapB = statsAnalysis.gaps[statB];
                            const isUrgent = statsAnalysis.levels[statA] === "bajo" || statsAnalysis.levels[statB] === "bajo";
                            return (
                              <div key={role.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isUrgent ? "border-red-800/40 bg-red-950/20" : "border-slate-700/40 bg-slate-900/60"}`}>
                                <RoleBadge lang={lang} label={role.label} color={role.color} size="text-[14px]" />
                                <div className="text-xs text-slate-300 leading-relaxed">
                                  {existingCount > 0
                                    ? <>{t.roleExisting} <span className="font-semibold text-yellow-300">{existingCount}</span> {t.roleExistingMid} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statA]}</span> ({gapA} {t.rolesBelowBest}) {lang === "es" ? "y" : "and"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statB]}</span> ({gapB} {t.rolesBelowBest})</>
                                    : <>{isUrgent ? <span className="text-red-300 font-semibold">{t.roleNew}</span> : t.roleNewAlt} {lang === "es" ? "en" : "in"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statA]}</span> {lang === "es" ? "y" : "and"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statB]}</span> — {t.roleNewEnd} {role.label}</>
                                  }
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {rolesSummary.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500">{t.teamRoles}</div>
                      <div className="flex flex-wrap gap-2">
                        {rolesSummary.map((r) => (
                          <RoleBadge lang={lang} key={r.label} label={r.label} color={r.color} size="text-[14px]" countBadge={r.count} pokemonList={r.pokemon} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-[13px] text-slate-500 text-right">{t.basedOn} {statsAnalysis.count} {t.basedOnEnd}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-sm gap-2">
                  <BarChart3 className="h-7 w-7 text-slate-600" />
                  <span>{t.loadStats}</span>
                </div>
              )}
            </CollapsibleSection>
            </>)}
          </div>
          </div>{/* end flex conductor */}
        </section>
  );
}

// memo: este panel no participa de los buscadores del equipo. Sin memo, cada
// tecla tipeada en cualquiera de los 30 inputs de TeamGrid lo volvía a
// renderizar entero junto con TeamBuilder.
export const TeamAnalysisPanel = memo(TeamAnalysisPanelImpl);
