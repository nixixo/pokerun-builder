import { Bookmark, ChevronDown, Disc, Leaf, MapPin, Package } from "lucide-react";
import { useItemSprites } from "./useItemSprites";
import { ZoneSpriteImg } from "./zoneSpriteImage";
import { IconoTarjetaObjeto } from "./zona/iconoTarjetaObjeto";
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

export function ListaPendientes({ entries, onNavigate, onRemove, getSpriteUrl }: {
  entries: Pendiente[];
  onNavigate: (zoneId: string) => void;
  onRemove: (id: string) => void;
  getSpriteUrl: (species: string) => string | null;
}) {
  const { getItemSpriteUrl } = useItemSprites();
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
        <ul className="grid grid-cols-1 gap-2.5 border-t border-slate-700/50 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {entries.map((entry) => {
            const encounterSprite = entry.tipo === "Encuentro" ? getSpriteUrl(entry.nombre) : null;
            return (
              <li key={entry.id} className="flex min-w-0 gap-3 rounded-xl border border-slate-700/50 bg-slate-950/45 p-3 hover:border-amber-500/30">
                {entry.tipo === "Encuentro" ? (
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    {encounterSprite ? (
                      <ZoneSpriteImg rawUrl={encounterSprite} alt="" className="h-7 w-7 object-contain [image-rendering:pixelated]" />
                    ) : <Leaf className="h-4 w-4 text-emerald-400" />}
                  </span>
                ) : (
                  <IconoTarjetaObjeto
                    sprite={getItemSpriteUrl(entry.tipo === "MT" ? entry.nombre.split(" · ")[0] : entry.nombre)}
                    fallback={entry.tipo === "MT" ? <Disc className="h-4 w-4 text-sky-300" /> : <Package className="h-4 w-4 text-amber-400" />}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="space-y-1">
                    <p className="text-[13px] font-bold leading-snug">{entry.nombre}</p>
                    <p className="text-xs text-slate-400">{entry.tipo} · {nombreZona(entry.zonaNombre)}</p>
                    {entry.detalle && <p className="break-words text-xs leading-snug text-slate-400">{entry.detalle}</p>}
                    {entry.requisitos.length > 0 && (
                      <p className="text-xs text-amber-200">Requiere {entry.requisitos.map((r) => REQUISITO_LABEL[r]).join(", ")}</p>
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <button type="button" onClick={() => onNavigate(entry.zonaId)} aria-label={`Ir a la zona de ${entry.nombre}`}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-700 px-2 text-xs text-sky-200 hover:border-sky-400">
                      <MapPin size={14} aria-hidden="true" /> Ir a la zona
                    </button>
                    <button type="button" onClick={() => onRemove(entry.id)} aria-label={`Marcar como hecho: ${entry.nombre}`}
                      className="min-h-8 rounded-md border border-slate-700 px-2 text-xs text-slate-200 hover:border-emerald-400">
                      Marcar como hecho
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
