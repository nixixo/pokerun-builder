import type { ReactNode } from "react";
import type { Lang } from "../types";
import { getRoleDescription } from "../utils/roleCalculations";
import { FloatingTooltip } from "./FloatingTooltip";

type RoleBadgeProps = {
  label: string;
  color: string | null | undefined;
  lang: Lang;
  size?: string;
  dimmed?: boolean;
  extra?: ReactNode;
  pokemonList?: string[];
  countBadge?: number;
};

/**
 * Badge de un rol (ej. "Muro Físico", "Barredor Especial") con tooltip que
 * muestra su descripción y, opcionalmente, la lista de Pokémon del equipo
 * que lo cumplen. Antes vivía como una función inline dentro de
 * TeamBuilder.tsx (se recreaba en cada render); se promovió a componente
 * compartido porque se usa en 9 puntos distintos del render (Fase 6).
 */
export function RoleBadge({
  label,
  color,
  lang,
  size = "text-[13px]",
  dimmed = false,
  extra,
  pokemonList,
  countBadge,
}: RoleBadgeProps) {
  return (
    <FloatingTooltip
      preferredPlacement="top"
      content={
        <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/98 p-2.5 shadow-xl text-xs text-slate-300">
          <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{label}</div>
          <div>{getRoleDescription(label, lang) ?? ""}</div>
          {pokemonList && pokemonList.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-slate-400">{pokemonList.join(", ")}</div>
          )}
          {extra}
        </div>
      }
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${size} font-semibold text-white cursor-default transition-opacity ${dimmed ? "opacity-40" : "opacity-100"}`}
        style={{ backgroundColor: (color ?? "#333") + "cc" }}
      >
        {label}
        {countBadge && countBadge > 1 && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[13px]">{countBadge}</span>
        )}
      </span>
    </FloatingTooltip>
  );
}
