import { memo, useState } from "react";
import type { Lang, Slot } from "../../types";
import { CheckCircle2, AlertTriangle, Recycle, RefreshCcw, Trash2, Lightbulb } from "lucide-react";

export type ContributionEntry = {
  idx: number;
  slot: Slot;
  bst: number;
  uniqueResistTypes: string[];
  redundantResistTypes: string[];
  dragWeaknessTypes: string[];
  value: number;
};

/**
 * Tarjeta de un miembro del equipo dentro del ranking de "a quién conviene
 * reemplazar": muestra su aporte (resistencias únicas, debilidades
 * compartidas, resistencias redundantes) y sus stats totales. Solo la usa
 * WhoToReplacePanel, así que vive co-ubicada acá (antes era una función
 * suelta a nivel de módulo en TeamBuilder.tsx).
 */
function ContributionCard({
  entry,
  rank,
  highlight,
  lang,
  tn,
  badgeClass,
  onRemove,
}: {
  entry: ContributionEntry;
  rank: number;
  highlight: boolean;
  lang: Lang;
  tn: (apiKey: string) => string;
  badgeClass: (t: string) => string;
  onRemove: (idx: number) => void;
}) {
  const { idx, slot, uniqueResistTypes, redundantResistTypes, dragWeaknessTypes, bst } = entry;
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2 h-full ${
        highlight ? "border-red-500/40 bg-red-950/20" : "border-slate-700/60 bg-slate-900/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono text-slate-500">#{rank + 1}</span>
          <span className="text-base font-semibold text-slate-100">{slot.name}</span>
          {slot.types.filter(Boolean).map((ty) => (
            <span key={ty} className={`${badgeClass(ty)} text-xs`}>{tn(ty)}</span>
          ))}
          {highlight && (
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">
              {lang === "es" ? "Menos aporta" : "Least valuable"}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-100 ring-1 ring-slate-600">
          {lang === "es" ? "Stats totales" : "Total stats"}: <span className="text-amber-300">{bst || "—"}</span>
        </span>
      </div>
      <div className="text-xs text-slate-300 leading-relaxed space-y-1 flex-1">
        {uniqueResistTypes.length > 0 && (
          <div className="flex items-center flex-wrap gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            {lang === "es" ? "Único que resiste: " : "Only one resisting: "}
            {uniqueResistTypes.map((ty) => (
              <span key={ty} className={`${badgeClass(ty)} text-xs mx-0.5`}>{tn(ty)}</span>
            ))}
          </div>
        )}
        {dragWeaknessTypes.length > 0 && (
          <div className="flex items-center flex-wrap gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            {lang === "es" ? "Comparte debilidad de equipo a: " : "Shares team weakness to: "}
            {dragWeaknessTypes.map((ty) => (
              <span key={ty} className={`${badgeClass(ty)} text-xs mx-0.5`}>{tn(ty)}</span>
            ))}
          </div>
        )}
        {redundantResistTypes.length > 0 && (
          <div className="flex items-center flex-wrap gap-1">
            <Recycle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            {lang === "es" ? "Resistencias ya cubiertas por otro miembro: " : "Resistances already covered by another member: "}
            {redundantResistTypes.map((ty) => (
              <span key={ty} className={`${badgeClass(ty)} text-xs mx-0.5`}>{tn(ty)}</span>
            ))}
          </div>
        )}
        {uniqueResistTypes.length === 0 && dragWeaknessTypes.length === 0 && redundantResistTypes.length === 0 && (
          <div>{lang === "es" ? "Sin resistencias/debilidades relevantes detectadas." : "No relevant resistances/weaknesses detected."}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="self-start inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/50 hover:border-red-400/60 hover:text-red-200 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {lang === "es" ? "Quitar" : "Remove"}
      </button>
    </div>
  );
}

type WhoToReplacePanelProps = {
  lang: Lang;
  isAdvanced: boolean;
  t: Record<string, string>;
  teamContribution: ContributionEntry[];
  onRemoveSlot: (idx: number) => void;
  tn: (apiKey: string) => string;
  badgeClass: (t: string) => string;
};

/**
 * Panel "¿Quién conviene reemplazar?": ordena el equipo de menor a mayor
 * aporte real (cobertura única, redundancia, debilidades compartidas, stats
 * totales) y muestra al peor primero, con opción de expandir el resto.
 * Extraído tal cual del render principal de TeamBuilder.tsx (Fase 6).
 */
function WhoToReplacePanelImpl({
  lang,
  isAdvanced,
  t,
  teamContribution,
  onRemoveSlot,
  tn,
  badgeClass,
}: WhoToReplacePanelProps) {
  const [showRestContribution, setShowRestContribution] = useState(false);

  return (
    <div className="pokedex-panel p-3 sm:p-4 rounded-lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 text-sm"><RefreshCcw className="h-3.5 w-3.5" /></span>
          <h2 className="text-base font-semibold tracking-tight text-slate-100">
            {lang === "es" ? "¿Quién conviene reemplazar?" : "Who should you replace?"}
          </h2>
        </div>
        {!isAdvanced && (
          <div className="flex items-start gap-3 rounded-xl border border-sky-700/50 bg-sky-950/40 px-4 py-3 text-[14px] sm:text-[15px] leading-relaxed text-sky-200">
            <Lightbulb className="h-5 w-5 shrink-0" />
            <span>{t.guideReplaceSection}</span>
          </div>
        )}
        <p className="text-xs text-slate-400 -mt-1">
          {lang === "es"
            ? "Ordenado de menor a mayor aporte real al equipo (cobertura única, redundancia, debilidades compartidas y stats totales)."
            : "Sorted from least to most real contribution to the team (unique coverage, redundancy, shared weaknesses, and total stats)."}
        </p>
        {teamContribution.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-sm gap-2 text-center">
            <RefreshCcw className="h-7 w-7 text-slate-600" />
            <span>
              {lang === "es"
                ? "Agrega al menos 3 Pokémon con tipo para ver a quién conviene reemplazar."
                : "Add at least 3 Pokémon with a type to see who's worth replacing."}
            </span>
          </div>
        ) : (
        (() => {
          const [worst, ...rest] = teamContribution;
          const isActuallyWeakest = rest.length > 0 ? worst.value < rest[0].value : true;

          return (
            <div className="space-y-3">
              <ContributionCard
                entry={worst}
                rank={0}
                highlight={isActuallyWeakest}
                lang={lang}
                tn={tn}
                badgeClass={badgeClass}
                onRemove={onRemoveSlot}
              />
              {rest.length > 0 && (
                <>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowRestContribution((v) => !v)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:border-slate-500 hover:bg-slate-800/60 transition-colors"
                    >
                      <span className={`inline-block transition-transform ${showRestContribution ? "rotate-180" : ""}`}>▾</span>
                      {showRestContribution
                        ? (lang === "es" ? "Ocultar el resto del equipo" : "Hide the rest of the team")
                        : (lang === "es" ? "Ver el resto del equipo" : "Show the rest of the team")}
                    </button>
                  </div>
                  {showRestContribution && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {rest.map((entry, i) => (
                        <ContributionCard
                          key={entry.idx}
                          entry={entry}
                          rank={i + 1}
                          highlight={false}
                          lang={lang}
                          tn={tn}
                          badgeClass={badgeClass}
                          onRemove={onRemoveSlot}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()
        )}
      </div>
    </div>
  );
}

// memo: este panel no participa de los buscadores del equipo. Sin memo, cada
// tecla tipeada en cualquiera de los 30 inputs de TeamGrid lo volvía a
// renderizar entero junto con TeamBuilder.
export const WhoToReplacePanel = memo(WhoToReplacePanelImpl);
