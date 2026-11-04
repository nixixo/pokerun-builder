"use client";

import { useSyncExternalStore } from "react";
import { almacenLocal } from "./almacenLocal";

export function StorageNotice() {
  const pendiente = useSyncExternalStore(almacenLocal.suscribir, almacenLocal.hayPendientes, () => false);
  if (!pendiente) return null;
  return (
    <div role="alert" className="border border-amber-500/50 bg-slate-950 p-3 text-sm text-amber-200">
      No se pudieron guardar los últimos cambios. Siguen disponibles en esta pestaña, pero se perderán al cerrarla o recargar.
      <button type="button" onClick={() => almacenLocal.reintentar()} className="ml-3 underline">Reintentar guardado</button>
    </div>
  );
}
