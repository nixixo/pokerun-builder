import type { ReactNode } from "react";
import type { Lang } from "../types";
import { ROLES, BALANCED_ROLE } from "../utils/constants";

/**
 * Selector de rol manual por Pokémon del equipo. Extraído del bloque inline
 * que vivía en el render principal de TeamBuilder.tsx (línea ~7559-7620),
 * donde dependía del estado local `roleSelectOpenIdx` (índice del slot cuyo
 * selector está abierto) y de `setSlotManualRole` (setter que actualiza
 * `slot.manualRoleEn`, que a su vez es leído por `getEffectiveRole` en
 * roleCalculations.ts para que el cambio se propague a TODOS los cálculos
 * del equipo, no solo a esta tarjeta).
 *
 * No renderiza el badge del rol en sí (eso lo hace `RoleBadge`, que sigue
 * siendo un componente inline en TeamBuilder.tsx con su propia dependencia
 * de FloatingTooltip/getRoleDescription, fuera del alcance de esta
 * extracción). En su lugar recibe `renderBadge` como render-prop, para no
 * duplicar esa lógica ni acoplar este componente a ella.
 */
export function RoleSelector({
  role,
  manualRoleEn,
  isOpen,
  onToggleOpen,
  onSelectRole,
  lang,
  renderBadge,
}: {
  role: { label: string; color: string } | null;
  manualRoleEn?: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectRole: (roleEn: string | null) => void;
  lang: Lang;
  renderBadge: (label: string, color: string) => ReactNode;
}) {
  const isManual = !!manualRoleEn;
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={onToggleOpen}
        title={
          isManual
            ? (lang === "es" ? "Rol elegido manualmente. Clic para cambiar." : "Manually chosen role. Click to change.")
            : (lang === "es" ? "Rol automático por stats. Clic para elegir uno manual." : "Automatic role from stats. Click to set one manually.")
        }
        className="flex items-center gap-1"
      >
        {role ? renderBadge(role.label, role.color) : (
          <span className="rounded-full border border-dashed border-slate-600 px-2 py-0.5 text-[12px] text-slate-500">
            {lang === "es" ? "Elegir rol" : "Pick role"}
          </span>
        )}
        {isManual && (
          <span title={lang === "es" ? "Manual" : "Manual"} className="text-[12px] text-amber-400">✏️</span>
        )}
      </button>
      {isOpen && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-1.5 shadow-xl shadow-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onSelectRole(null)}
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
              onClick={() => onSelectRole(r.en)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-800 ${
                manualRoleEn === r.en ? "text-emerald-300" : "text-slate-300"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                {r[lang]}
              </span>
              {manualRoleEn === r.en && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
