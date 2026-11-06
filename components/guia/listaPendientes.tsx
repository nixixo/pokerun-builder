import { Bookmark, ChevronDown, MapPin } from "lucide-react";
import { nombreZona } from "./formato";
import { REQUISITO_LABEL } from "./requisitos";
import type { AccionesPendientes, Pendiente } from "./usePendientes";

export function BotonPendiente({ entry, actions }: { entry: Pendiente; actions: AccionesPendientes }) {
  const saved = actions.isPending(entry.id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`Guardar pendiente: ${entry.nombre}`}
      onClick={() => actions.toggle(entry)}
      className={`mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
        saved ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-slate-700 text-slate-300 hover:border-amber-500/40"
      }`}
    >
      <Bookmark size={14} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
      {saved ? "Guardado" : "Guardar pendiente"}
    </button>
  );
}

export function ListaPendientes({ entries, onNavigate, onRemove }: {
  entries: Pendiente[];
  onNavigate: (zoneId: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <details className="group mb-4 rounded-xl border border-slate-700/60 bg-slate-900/70">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
        <Bookmark size={16} className="text-amber-300" aria-hidden="true" />
        Pendientes <span className="text-sm tabular-nums text-slate-400">({entries.length})</span>
        <ChevronDown size={16} className="ml-auto group-open:rotate-180" aria-hidden="true" />
      </summary>
      {entries.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-slate-400">Guarda un objeto o encuentro para recordarlo cuando vuelvas a la zona.</p>
      ) : (
        <ul className="divide-y divide-slate-700/50 border-t border-slate-700/50 px-4">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1 basis-56 space-y-1">
                <p className="font-semibold">{entry.nombre}</p>
                <p className="text-xs text-slate-400">{entry.tipo} · {nombreZona(entry.zonaNombre)}</p>
                {entry.detalle && <p className="break-words text-sm text-slate-300">{entry.detalle}</p>}
                {entry.requisitos.length > 0 && (
                  <p className="text-xs text-amber-200">Requiere {entry.requisitos.map((r) => REQUISITO_LABEL[r]).join(", ")}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onNavigate(entry.zonaId)} aria-label={`Ir a la zona de ${entry.nombre}`}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-700 px-2 text-xs text-sky-200 hover:border-sky-400">
                  <MapPin size={14} aria-hidden="true" /> Ir a la zona
                </button>
                <button type="button" onClick={() => onRemove(entry.id)} aria-label={`Marcar como hecho: ${entry.nombre}`}
                  className="min-h-8 rounded-md border border-slate-700 px-2 text-xs text-slate-200 hover:border-emerald-400">
                  Marcar como hecho
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
