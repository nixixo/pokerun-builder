// components/guia/zona/piezas.tsx
//
// Las piezas sueltas que comparten todas las secciones del detalle de zona:
// la cabecera de sección, el check de coleccionable, el chip de "esto sale en
// la 2ª visita", los chips de requisitos y el aviso de lista vacía.
//
// Estaban al principio de zoneDetail.tsx. Aquí porque en cuanto una sección se
// muda a su propio archivo las necesita igual, y no tiene sentido que las
// importe del componente del que acaba de salir.

import type React from "react";
import { CheckSquare, History, KeyRound, Lock, Square } from "lucide-react";
import type { Requisito } from "../types";
import { REQUISITO_COMO, REQUISITO_LABEL } from "../requisitos";

/**
 * Progreso de colección: páginas de alquimia, MTs, nidos alfa y habitantes de
 * Pueblo Acrílico. Lo aporta la página de la Guía; el detalle de zona y sus
 * secciones solo lo consultan y lo alternan.
 *
 * Opcional en quien lo recibe, para no romper usos del componente que no lo
 * pasen (el detalle se puede renderizar sin progreso).
 */
export type ProgresoColeccion = {
  isPaginaChecked: (zoneIndex: number, pageIndex?: number) => boolean;
  togglePagina: (zoneIndex: number, pageIndex?: number) => void;
  isMtChecked: (zoneIndex: number, mtIndex: number) => boolean;
  toggleMt: (zoneIndex: number, mtIndex: number) => void;
  isNidoChecked: (zoneIndex: number) => boolean;
  toggleNido: (zoneIndex: number) => void;
  isHabitanteChecked: (zoneIndex: number) => boolean;
  toggleHabitante: (zoneIndex: number) => void;
};

// Checkbox chico reusado en los distintos coleccionables (páginas,
// MTs, nidos, habitantes). type="button" con icono en vez de <input>
// para poder estilarlo igual en todos lados sin pelear con el
// appearance nativo del navegador.
export function CollectCheck({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={checked ? `Desmarcar ${label}` : `Marcar ${label} como conseguido`}
      className={`flex shrink-0 items-center justify-center rounded-md p-0.5 transition ${
        checked ? "text-emerald-400" : "text-slate-600 hover:text-slate-400"
      }`}
    >
      {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
    </button>
  );
}

export function SectionHead({
  icon,
  color,
  title,
  count,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950/80 ring-1 ring-slate-700/50 ${color}`}>
        {icon}
      </span>
      <h3 className="text-[15px] font-bold text-slate-100">{title}</h3>
      {count !== undefined && <span className="text-[13px] font-medium text-slate-500">{count}</span>}
      <div className="h-px flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
    </div>
  );
}

/**
 * Chips de "qué necesitas para esto". Los que ya tienes a estas alturas de la
 * partida van en gris discreto; los que aún no, en ámbar y con candado, que es
 * la información que de verdad ahorra vueltas: la guía lista el objeto en la
 * zona, pero no siempre avisa de que hay que volver mucho después.
 */
export function RequisitoChips({
  requisitos,
  pendientes,
}: {
  requisitos?: Requisito[];
  pendientes: Requisito[];
}) {
  if (!requisitos?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {requisitos.map((r) => {
        const falta = pendientes.includes(r);
        return (
          <span
            key={r}
            title={falta ? `Todavía no puedes: ${REQUISITO_COMO[r]}` : undefined}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide ${
              falta
                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                : "border-slate-700/60 bg-slate-800/40 text-slate-400"
            }`}
          >
            {falta ? <Lock className="h-2.5 w-2.5" /> : <KeyRound className="h-2.5 w-2.5" />}
            {REQUISITO_LABEL[r]}
          </span>
        );
      })}
      {pendientes.length > 0 && (
        <span className="text-[12px] font-semibold text-amber-400/90">· vuelve más tarde</span>
      )}
    </div>
  );
}

/**
 * En un lugar con varias visitas, marca lo que NO está desde la primera. Sin
 * esto, juntar todo en una pantalla haría creer que la Ruta 8 entera se recorre
 * de una vez; con esto se lee de un vistazo qué te espera cuando vuelvas.
 * Silencioso para lo de la primera visita, que es la mayoría.
 */
export function VisitaChip({ n }: { n: number }) {
  if (n <= 1) return null;
  return (
    <span
      title={`Esto aparece en la ${n}ª visita a este sitio, no la primera.`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-600/50 bg-slate-800/50 px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400"
    >
      <History className="h-2.5 w-2.5" />
      {n}ª visita
    </span>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2.5 text-[13px] text-slate-500">{children}</div>;
}
