// components/guia/zona/badgesColeccionables.tsx
//
// La fila de badges de arriba del detalle de zona: página(s) de alquimia, nido
// alfa, habitante de Pueblo Acrílico y regalo Pokémon. Solo se pinta lo que la
// zona tenga de verdad.
//
// Los cuatro comparten forma (icono + título + check + detalle) pero cada uno
// tiene su color y sus reglas, así que van escritos uno a uno y no como una
// tabla: intentar unificarlos escondía las diferencias que importan — el
// regalo no lleva check, la alquimia puede traer dos páginas.
//
// Los índices de progreso llegan ya resueltos por props. Es a propósito: el
// check se guarda contra la ENTRADA de la guía de la que salió cada cosa, no
// contra el lugar fusionado, y esa resolución la sabe hacer solo quien conoce
// la fusión.

import { CheckCircle2, FlaskConical, Gift, Sparkles, UserPlus, XCircle } from "lucide-react";
import type { Origen } from "../lugares";
import type { Requisito, Zone } from "../types";
import { CollectCheck, RequisitoChips, type ProgresoColeccion } from "./piezas";

export function BadgesColeccionables({
  alquimia,
  paginasAlquimia,
  regalo,
  nidoAlfa,
  habitante,
  collection,
  origenPagina,
  indiceNido,
  indiceHabitante,
  pendientesDe,
}: {
  alquimia: Zone["pagina_alquimia"];
  /** Una entrada por página; el índice es el sub-id del progreso. */
  paginasAlquimia: string[];
  regalo: Zone["regalo_pokemon"];
  nidoAlfa: Zone["nido_alfa"];
  habitante: Zone["habitante_acrilico"];
  collection?: ProgresoColeccion;
  origenPagina: (i: number) => Origen;
  indiceNido: number;
  indiceHabitante: number;
  pendientesDe: (reqs?: Requisito[]) => Requisito[];
}) {
  if (!alquimia && !regalo && !nidoAlfa && !habitante) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {alquimia && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] leading-snug ${
            alquimia.presente
              ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200"
              : "border-slate-700/50 bg-slate-950/40 text-slate-500"
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-[13px]">
              {paginasAlquimia.length > 1
                ? `Páginas de alquimia (${paginasAlquimia.length})`
                : "Página de alquimia"}
              {alquimia.presente ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ) : (
                <XCircle className="h-3 w-3 text-slate-600" />
              )}
              {/* Con una sola página el check va en el título, para no
                  meter una lista de un elemento donde antes había una
                  línea suelta. Con varias, cada una lleva el suyo abajo. */}
              {paginasAlquimia.length === 1 && collection && (
                <span className="ml-auto">
                  {(() => {
                    const o = origenPagina(0);
                    return (
                      <CollectCheck
                        checked={collection.isPaginaChecked(o.zona, o.i)}
                        onToggle={() => collection.togglePagina(o.zona, o.i)}
                        label="página de alquimia"
                      />
                    );
                  })()}
                </span>
              )}
            </div>
            {paginasAlquimia.length === 1 && paginasAlquimia[0] && (
              <p className="mt-0.5 max-w-sm text-slate-300">{paginasAlquimia[0]}</p>
            )}
            <RequisitoChips requisitos={alquimia.requisitos} pendientes={pendientesDe(alquimia.requisitos)} />
            {paginasAlquimia.length > 1 && (
              <ul className="mt-1 max-w-sm space-y-1">
                {paginasAlquimia.map((descripcion, i) => {
                  const o = origenPagina(i);
                  return (
                    <li key={i} className="flex items-start gap-1.5">
                      {collection ? (
                        <CollectCheck
                          checked={collection.isPaginaChecked(o.zona, o.i)}
                          onToggle={() => collection.togglePagina(o.zona, o.i)}
                          label={`página de alquimia ${i + 1}`}
                        />
                      ) : (
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-fuchsia-400" />
                      )}
                      <p className="text-slate-300">
                        {descripcion || `Página ${i + 1} — ubicación sin detallar en la guía.`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {nidoAlfa && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[13px] leading-snug text-orange-200">
          <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-[13px]">
              Nido Alfa {nidoAlfa.tipo}
              {collection && (
                <span className="ml-auto">
                  <CollectCheck
                    checked={collection.isNidoChecked(indiceNido)}
                    onToggle={() => collection.toggleNido(indiceNido)}
                    label="nido alfa"
                  />
                </span>
              )}
            </div>
            {nidoAlfa.detalle && <p className="mt-0.5 max-w-sm text-orange-100/80">{nidoAlfa.detalle}</p>}
          </div>
        </div>
      )}

      {habitante && (
        <div className="flex items-start gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[13px] leading-snug text-indigo-200">
          <UserPlus className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-[13px]">
              Habitante: {habitante.nombre}
              {collection && (
                <span className="ml-auto">
                  <CollectCheck
                    checked={collection.isHabitanteChecked(indiceHabitante)}
                    onToggle={() => collection.toggleHabitante(indiceHabitante)}
                    label="habitante"
                  />
                </span>
              )}
            </div>
            {habitante.funcion && (
              <p className="mt-0.5 font-semibold text-indigo-300">{habitante.funcion}</p>
            )}
            {habitante.detalle && (
              <p className="mt-0.5 max-w-sm text-indigo-100/80">{habitante.detalle}</p>
            )}
          </div>
        </div>
      )}

      {regalo && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] leading-snug ${
            regalo.presente
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-slate-700/50 bg-slate-950/40 text-slate-500"
          }`}
        >
          <Gift className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-[13px]">
              Regalo Pokémon
              {regalo.presente ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ) : (
                <XCircle className="h-3 w-3 text-slate-600" />
              )}
            </div>
            {regalo.presente && regalo.detalle && (
              <p className="mt-0.5 max-w-sm text-slate-300">{regalo.detalle}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
