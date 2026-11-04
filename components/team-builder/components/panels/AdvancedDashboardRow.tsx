import { memo } from "react";
import type { ReactNode } from "react";
import React from "react";
import type { Lang } from "../../types";
import { RoleBadge } from "../RoleBadge";
import { Compass, AlertTriangle, Turtle, Footprints, Rabbit, Zap, Target, Lightbulb } from "lucide-react";

type DashboardData = {
  offPct: number;
  defPct: number;
  defWeakCount: number;
  defResistCount: number;
  physPct: number;
  specPct: number;
  avgSpe: number;
  avgBST: number;
  speedTier: { label: string; color: string };
};

type TeamSummaryTypeEntry = { type: string; score: number; defensiveCovers: string[]; offensiveCovers: string[] };
type TeamSummaryDual = { types: string[]; score: number; defensiveCovers: string[]; offensiveCovers: string[] } | null;

export type TeamSummaryData = {
  topTypes: TeamSummaryTypeEntry[];
  bestDual: TeamSummaryDual;
  neededRole: { role: { label: string; color: string } | null } | null;
};

type AdvancedDashboardRowProps = {
  lang: Lang;
  t: Record<string, string>;
  dashboard: DashboardData | null;
  teamSummary: TeamSummaryData | null;
  coverageSupCount: number;
  totalTypes: number;
  tn: (apiKey: string) => string;
  badgeClass: (t: string) => string;
};

/** Tarjeta genérica reutilizable del Dashboard (label + tooltip + contenido). */
function DashCard({ label, children, tooltip }: { label: string; children: ReactNode; tooltip: ReactNode }) {
  return (
    <div className="group relative col-span-1 rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-1.5">
        <div className="text-[13px] uppercase tracking-[0.22em] text-slate-400 leading-tight">{label}</div>
        <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[12px] text-slate-500 cursor-help">ⓘ</span>
      </div>
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/98 p-3 text-xs text-slate-300 leading-relaxed shadow-2xl opacity-0 scale-95 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-hover:scale-100">
        {tooltip}
        <div className="absolute left-1/2 -bottom-1.5 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-slate-700 bg-slate-950" />
      </div>
    </div>
  );
}

/**
 * Fila del modo avanzado con dos paneles lado a lado (grid 2 columnas en
 * desktop): "Dashboard del equipo" (5 métricas: cobertura ofensiva/defensiva,
 * balance físico/especial, velocidad media, BST medio) y "Team Summary"
 * (mejor tipo/rol para el próximo Pokémon + tarjeta de recomendación en
 * texto). Extraído tal cual del render principal de TeamBuilder.tsx (Fase 6)
 * — ambos paneles comparten el mismo grid envolvente en el original, por eso
 * quedaron juntos acá en vez de separados en dos componentes.
 */
function AdvancedDashboardRowImpl({
  lang,
  t,
  dashboard,
  teamSummary,
  coverageSupCount,
  totalTypes,
  tn,
  badgeClass,
}: AdvancedDashboardRowProps) {
  if (!dashboard && !teamSummary) return null;

  return (
    <div className={`grid grid-cols-1 gap-4 items-stretch ${dashboard && teamSummary ? "md:grid-cols-[1.05fr_0.95fr]" : ""}`}>
      {dashboard && (
        <div className="pokedex-panel p-3 sm:p-4 rounded-lg h-full flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200"><Compass className="h-3.5 w-3.5" /></span>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-100">
              {lang === "es" ? "Dashboard del equipo" : "Team Dashboard"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
            {/* Cobertura ofensiva */}
            <DashCard
              label={lang === "es" ? "Cob. ofensiva" : "Off. coverage"}
              tooltip={<>
                <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Cobertura ofensiva" : "Offensive coverage"}</p>
                <p>{lang === "es" ? "% de tipos contra los que tu equipo puede golpear de forma supereficaz con sus movimientos actuales." : "% of types your team can hit super-effectively with its current moves."}</p>
                <p className="mt-1.5 text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />{lang === "es" ? "+80% excelente" : "+80% great"}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />{lang === "es" ? "55–79% aceptable" : "55–79% decent"}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />{lang === "es" ? "<55% hay huecos importantes" : "<55% significant gaps"}</span>
                </p>
              </>}
            >
              <div className="text-2xl font-bold text-slate-100">{dashboard.offPct}<span className="text-base text-slate-400 ml-0.5">%</span></div>
              <div className="h-1.5 rounded-full bg-slate-800">
                <div className="h-full rounded-full transition-[width,background-color]" style={{ width: `${dashboard.offPct}%`, background: dashboard.offPct >= 80 ? "#16a34a" : dashboard.offPct >= 55 ? "#ca8a04" : "#dc2626" }} />
              </div>
              <div className="text-xs text-slate-400">{coverageSupCount}/{totalTypes} {lang === "es" ? "tipos" : "types"}</div>
            </DashCard>

            {/* Cobertura defensiva */}
            <DashCard
              label={lang === "es" ? "Cob. defensiva" : "Def. coverage"}
              tooltip={<>
                <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Cobertura defensiva" : "Defensive coverage"}</p>
                <p>{lang === "es" ? "% de tipos cubiertos por resistencias o inmunidades del equipo. Cuanto más alto, menos flancos expuestos." : "% of types covered by team resistances or immunities. Higher means fewer exposed flanks."}</p>
                <p className="mt-1.5 text-slate-400">{lang === "es" ? `${dashboard.defResistCount} tipos cubiertos (resiste o es inmune) · ${dashboard.defWeakCount} tipos con debilidad expuesta` : `${dashboard.defResistCount} types covered (resists or immune) · ${dashboard.defWeakCount} types with an exposed weakness`}</p>
              </>}
            >
              <div className="text-2xl font-bold text-slate-100">{dashboard.defPct}<span className="text-base text-slate-400 ml-0.5">%</span></div>
              <div className="h-1.5 rounded-full bg-slate-800">
                <div className="h-full rounded-full transition-[width,background-color]" style={{ width: `${dashboard.defPct}%`, background: dashboard.defPct >= 60 ? "#16a34a" : dashboard.defPct >= 40 ? "#ca8a04" : "#dc2626" }} />
              </div>
              <div className="text-xs text-slate-400">
                <span className="text-emerald-400">{dashboard.defResistCount} {lang === "es" ? "cubre" : "covered"}</span>
                {" · "}
                <span className="text-red-400">{dashboard.defWeakCount} {lang === "es" ? "deb." : "weak"}</span>
              </div>
            </DashCard>

            {/* Balance físico / especial */}
            <DashCard
              label={lang === "es" ? "Fís. / Esp." : "Phys / Spec"}
              tooltip={<>
                <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Balance físico / especial" : "Physical / Special balance"}</p>
                <p>{lang === "es" ? "Distribución del daño entre movimientos físicos y especiales. Un equipo equilibrado dificulta que el rival se defienda con un solo stat." : "Distribution of damage between physical and special moves. A balanced team is harder to wall with a single defensive stat."}</p>
                <p className="mt-1.5 text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />{lang === "es" ? ">65% en un lado = predecible" : ">65% one side = predictable"}</span>
                  <span>{lang === "es" ? "✓ 35–65% = equilibrado" : "✓ 35–65% = balanced"}</span>
                </p>
              </>}
            >
              <div className="flex items-end gap-1">
                <span className="text-xl font-bold text-orange-400">{dashboard.physPct}%</span>
                <span className="text-slate-500 text-base pb-0.5">/</span>
                <span className="text-xl font-bold text-indigo-400">{dashboard.specPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-indigo-900/60 overflow-hidden">
                <div className="h-full rounded-full bg-orange-500 transition-[width]" style={{ width: `${dashboard.physPct}%` }} />
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                {dashboard.physPct > 65 ? (
                  <><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{lang === "es" ? "Muy físico" : "Very physical"}</>
                ) : dashboard.specPct > 65 ? (
                  <><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{lang === "es" ? "Muy especial" : "Very special"}</>
                ) : (
                  <>{lang === "es" ? "✓ Equilibrado" : "✓ Balanced"}</>
                )}
              </div>
            </DashCard>

            {/* Velocidad media */}
            <DashCard
              label={lang === "es" ? "Vel. media" : "Avg speed"}
              tooltip={<>
                <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "Velocidad media del equipo" : "Average team speed"}</p>
                <p>{lang === "es" ? "Promedio del stat de Velocidad base de todos los Pokémon con stats definidos. Determina quién ataca primero en combate." : "Average base Speed stat across all Pokémon with defined stats. Determines who attacks first in battle."}</p>
                <p className="mt-1.5 text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Turtle className="h-3 w-3 shrink-0" />{lang === "es" ? "<70 lento" : "<70 slow"}</span>
                  <span className="inline-flex items-center gap-1"><Footprints className="h-3 w-3 shrink-0" />{lang === "es" ? "70–90 medio" : "70–90 mid"}</span>
                  <span className="inline-flex items-center gap-1"><Rabbit className="h-3 w-3 shrink-0" />{lang === "es" ? "91–110 rápido" : "91–110 fast"}</span>
                  <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3 shrink-0" />{lang === "es" ? ">110 muy rápido" : ">110 very fast"}</span>
                </p>
              </>}
            >
              <div className="text-2xl font-bold text-slate-100">{dashboard.avgSpe}</div>
              <div className="h-1.5 rounded-full bg-slate-800">
                <div className="h-full rounded-full transition-[width,background-color]" style={{ width: `${Math.round((dashboard.avgSpe / 180) * 100)}%`, backgroundColor: dashboard.speedTier.color }} />
              </div>
              <div className="text-xs font-semibold" style={{ color: dashboard.speedTier.color }}>{dashboard.speedTier.label}</div>
            </DashCard>

            {/* BST medio */}
            <DashCard
              label={lang === "es" ? "BST medio" : "Avg BST"}
              tooltip={<>
                <p className="font-semibold text-slate-100 mb-1">{lang === "es" ? "BST medio del equipo" : "Average team BST"}</p>
                <p>{lang === "es" ? "Promedio del Base Stat Total (suma de los 6 stats base) de todos los Pokémon. Referencia del poder general del equipo, aunque no determina por sí solo su calidad competitiva." : "Average Base Stat Total (sum of 6 base stats) across the team. A reference for overall power, though it doesn't determine competitive quality on its own."}</p>
                <p className="mt-1.5 text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />{lang === "es" ? "<480 bajo" : "<480 low"}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />{lang === "es" ? "480–539 medio" : "480–539 mid"}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />{lang === "es" ? "540+ alto (pseudo-legendario+)" : "540+ high (pseudo-legendary+)"}</span>
                </p>
              </>}
            >
              <div className="text-2xl font-bold text-slate-100">{dashboard.avgBST}</div>
              <div className="h-1.5 rounded-full bg-slate-800">
                <div className="h-full rounded-full transition-[width,background-color]" style={{ width: `${Math.round((dashboard.avgBST / 720) * 100)}%`, background: dashboard.avgBST >= 540 ? "#0891b2" : dashboard.avgBST >= 480 ? "#ca8a04" : "#6b7280" }} />
              </div>
              <div className="text-xs text-slate-400">
                {dashboard.avgBST >= 540 ? (lang === "es" ? "Alto" : "High") : dashboard.avgBST >= 480 ? (lang === "es" ? "Medio" : "Mid") : (lang === "es" ? "Bajo" : "Low")}
              </div>
            </DashCard>
          </div>
        </div>
      )}

      {teamSummary && (
        <div className="p-3 sm:p-4 pokedex-panel rounded-lg h-full flex flex-col">
          <div className="flex items-center gap-2 mb-3 text-slate-100">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 text-sm"><Target className="h-3.5 w-3.5" /></span>
            <h2 className="text-base font-semibold tracking-tight">{t.summaryTitle}</h2>
          </div>
          {/* ── Análisis de tipo ideal ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            {teamSummary.topTypes.length > 0 && (
              <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 space-y-2">
                <div className="text-[14px] uppercase tracking-[0.2em] text-slate-500">{t.bestSingle}</div>
                {teamSummary.topTypes.slice(0, 2).map(({ type, defensiveCovers, offensiveCovers }) => (
                  <div key={type} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${badgeClass(type)} text-xs`}>{tn(type)}</span>
                      {teamSummary.neededRole?.role?.label && (
                        <RoleBadge lang={lang} label={teamSummary.neededRole.role.label} color={teamSummary.neededRole.role.color} size="text-[14px]" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                      {defensiveCovers.length > 0 && (
                        <span className="flex items-center gap-1 flex-wrap">{t.summaryResists}{defensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                      )}
                      {offensiveCovers.length > 0 && (
                        <span className="flex items-center gap-1 flex-wrap">{t.summaryCovers}{offensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0) && (
              <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-3 space-y-2">
                <div className="text-[14px] uppercase tracking-[0.2em] text-blue-400">{t.bestDual}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {teamSummary.bestDual.types.map((ty) => (
                    <span key={ty} className={`${badgeClass(ty)} text-xs`}>{tn(ty)}</span>
                  ))}
                  {teamSummary.neededRole?.role?.label && (
                    <RoleBadge lang={lang} label={teamSummary.neededRole.role.label} color={teamSummary.neededRole.role.color} size="text-[14px]" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                  {teamSummary.bestDual.defensiveCovers.length > 0 && (
                    <span className="flex items-center gap-1 flex-wrap">{t.summaryResists}{teamSummary.bestDual.defensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                  )}
                  {teamSummary.bestDual.offensiveCovers.length > 0 && (
                    <span className="flex items-center gap-1 flex-wrap">{t.summaryCovers}{teamSummary.bestDual.offensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Tarjeta de recomendación */}
          <div className="mt-3 rounded-2xl border border-amber-600/30 bg-gradient-to-br from-amber-950/25 via-slate-900/60 to-slate-900/50 p-3.5 flex gap-3 shadow-sm shadow-black/20">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 text-lg">
              <Lightbulb className="h-4 w-4 text-amber-400" />
            </span>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="text-[13px] uppercase tracking-[0.25em] text-amber-400 font-semibold">
                {lang === "es" ? "Recomendación" : "Recommendation"}
              </div>
              <div className="text-sm text-slate-100 leading-relaxed">
                {(() => {
                  const primaryType = teamSummary.topTypes[0]?.type;
                  const hasDual = !!(teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0));
                  const dualTypes = teamSummary.bestDual?.types ?? [];
                  const role = teamSummary.neededRole?.role;
                  const TypeBadge = ({ ty }: { ty: string }) => (
                    <span className={`${badgeClass(ty)} text-xs mx-0.5 align-middle whitespace-nowrap`}>{tn(ty)}</span>
                  );
                  const DualTypeBadges = () => (
                    <>
                      {dualTypes.map((ty, i) => (
                        <React.Fragment key={ty}>
                          <TypeBadge ty={ty} />
                          {i < dualTypes.length - 1 && <span className="text-slate-500 mx-0.5">/</span>}
                        </React.Fragment>
                      ))}
                    </>
                  );

                  if (role?.label) {
                    return (
                      <>
                        {lang === "es" ? "Tu equipo se beneficiaría de un Pokémon con rol de " : "Your team would benefit from a Pokémon with the "}
                        <span className="inline-flex align-middle mx-0.5">
                          <RoleBadge lang={lang} label={role.label} color={role.color} size="text-[13px]" />
                        </span>
                        {lang === "en" ? " role" : ""}
                        {primaryType && (
                          <>
                            {lang === "es" ? ", preferiblemente de tipo " : ", ideally "}
                            <TypeBadge ty={primaryType} />
                            {lang === "en" ? " type" : ""}
                            {hasDual && (
                              <>
                                {lang === "es" ? " o doble tipo " : " or dual "}
                                <DualTypeBadges />
                              </>
                            )}
                          </>
                        )}
                        {"."}
                      </>
                    );
                  }

                  return (
                    <>
                      {lang === "es" ? "Considera añadir un Pokémon de tipo " : "Consider adding a "}
                      {primaryType && <TypeBadge ty={primaryType} />}
                      {lang === "en" ? " type Pokémon" : ""}
                      {hasDual && (
                        <>
                          {lang === "es" ? " o doble tipo " : " or dual "}
                          <DualTypeBadges />
                        </>
                      )}
                      {lang === "es" ? " para equilibrar el equipo." : " to balance the team."}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// memo: este panel no participa de los buscadores del equipo. Sin memo, cada
// tecla tipeada en cualquiera de los 30 inputs de TeamGrid lo volvía a
// renderizar entero junto con TeamBuilder.
export const AdvancedDashboardRow = memo(AdvancedDashboardRowImpl);
