// components/guia/zona/seccionObjetos.tsx
//
// La sección "Objetos" del detalle de zona: el resumen de lo que merece la pena
// y la retícula de tarjetas.
//
// Se lleva consigo las cuatro tablas de "clase de objeto destacado" (color del
// chip, borde de la tarjeta, icono y etiqueta), que solo usa esto. Estaban
// sueltas al principio de zoneDetail.tsx, a 600 líneas de donde se usan, y son
// justo el tipo de cosa que hay que editar de golpe: añadir una clase nueva
// obliga a tocar las cuatro.

import { useMemo } from "react";
import { Dna, Gem, Package, Sparkles, Swords, TrendingUp, Zap } from "lucide-react";
import type { Requisito, Zone } from "../types";
import type { Origen } from "../lugares";
import type { ClaseObjeto } from "../useItemSprites";
import { useItemSprites } from "../useItemSprites";
import { BotonPendiente } from "../listaPendientes";
import { crearPendiente, type AccionesPendientes } from "../usePendientes";
import { HoverDescription } from "../hoverDescription";
import { EmptyHint, RequisitoChips, SectionHead, VisitaChip } from "./piezas";

// Un color por clase de objeto destacado, para poder distinguirlos de un
// vistazo sin leer el chip: ámbar para lo de la historia, fucsia para las
// megapiedras, esmeralda para lo que evoluciona, cielo para lo de combate.
const CLASE_OBJETO_CHIP: Record<ClaseObjeto, string> = {
  efigie: "border-amber-400/40 bg-amber-400/15 text-amber-300",
  mega: "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-300",
  evolutivo: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
  mejora: "border-violet-400/40 bg-violet-400/15 text-violet-300",
  combate: "border-sky-400/40 bg-sky-400/15 text-sky-300",
};

const CLASE_OBJETO_TARJETA: Record<ClaseObjeto, string> = {
  efigie: "border-amber-400/40 shadow-[inset_2px_0_0_0_#fbbf24]",
  mega: "border-fuchsia-400/40 shadow-[inset_2px_0_0_0_#e879f9]",
  evolutivo: "border-emerald-400/40 shadow-[inset_2px_0_0_0_#34d399]",
  mejora: "border-violet-400/40 shadow-[inset_2px_0_0_0_#a78bfa]",
  combate: "border-sky-400/40 shadow-[inset_2px_0_0_0_#38bdf8]",
};

const CLASE_OBJETO_ICONO: Record<ClaseObjeto, typeof Package> = {
  efigie: Gem,
  mega: Zap,
  evolutivo: Dna,
  mejora: TrendingUp,
  combate: Swords,
};

const CLASE_OBJETO_LABEL: Record<ClaseObjeto, { singular: string; plural: string }> = {
  efigie: { singular: "efigie", plural: "efigies" },
  mega: { singular: "megapiedra", plural: "megapiedras" },
  evolutivo: { singular: "de evolución", plural: "de evolución" },
  mejora: { singular: "de mejora", plural: "de mejora" },
  combate: { singular: "de combate", plural: "de combate" },
};

// Mismo orden que ClaseObjeto: manda de lo más raro a lo más común, que es
// también el orden en que interesa leerlo en el resumen de la zona.
const ORDEN_CLASES: ClaseObjeto[] = ["efigie", "mega", "evolutivo", "mejora", "combate"];

export function SeccionObjetos({
  objetos,
  zonaDe,
  pendientes,
  origenDe,
  visitaDe,
  pendientesDe,
}: {
  objetos: Zone["objetos"];
  zonaDe: (index: number) => Zone;
  pendientes?: AccionesPendientes;
  /** De qué entrada de la guía salió el objeto i (en un lugar fusionado). */
  origenDe: (i: number) => Origen;
  visitaDe: (o: Origen) => number;
  pendientesDe: (reqs: Requisito[] | undefined, zonaOrigen: number) => Requisito[];
}) {
  const { getItemSpriteUrl, getItemDescription, getItemHighlight } = useItemSprites();

  // Cuántos objetos destacados hay de cada clase, en el orden de ORDEN_CLASES.
  const destacadosDeZona = useMemo(() => {
    const cuenta = new Map<ClaseObjeto, number>();
    for (const o of objetos) {
      const d = getItemHighlight(o.nombre);
      if (d) cuenta.set(d.clase, (cuenta.get(d.clase) ?? 0) + 1);
    }
    return ORDEN_CLASES.filter((c) => cuenta.has(c)).map((c) => [c, cuenta.get(c)!] as const);
  }, [objetos, getItemHighlight]);

  return (
    <div className="mb-6">
      <SectionHead icon={<Package className="h-3.5 w-3.5" />} color="text-amber-400" title="Objetos" count={objetos.length} />
      {/* Resumen de lo que merece la pena en la zona. En zonas de veinte
          objetos el recuento evita tener que barrer la lista entera para ver
          si hay algo aprovechable. */}
      {destacadosDeZona.length > 0 && (
        <div className="-mt-1 mb-2.5 flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
          <Sparkles className="h-3 w-3 text-amber-400" />
          {destacadosDeZona.map(([clase, n]) => (
            <span key={clase} className={`rounded-full border px-1.5 py-0.5 font-semibold ${CLASE_OBJETO_CHIP[clase]}`}>
              {n} {n === 1 ? CLASE_OBJETO_LABEL[clase].singular : CLASE_OBJETO_LABEL[clase].plural}
            </span>
          ))}
        </div>
      )}
      {objetos.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {objetos.map((o, i) => {
            const destacado = getItemHighlight(o.nombre);
            const Icono = destacado ? CLASE_OBJETO_ICONO[destacado.clase] : null;
            const desde = origenDe(i);
            return (
              <div
                key={`${o.nombre}-${i}`}
                className={`flex gap-3 rounded-xl border p-3 transition ${
                  destacado
                    ? `${CLASE_OBJETO_TARJETA[destacado.clase]} bg-slate-950/60`
                    : "border-slate-700/50 bg-slate-950/45 hover:border-amber-500/30 hover:bg-slate-950/60"
                }`}
              >
                {/* Sprite real del objeto cuando se puede resolver; si no, el
                    icono genérico. Los nombres los escribe la guía a mano, así
                    que hay un 20% largo que no casa con ningún ítem — muchos ni
                    siquiera son objetos, sino equipos de entrenador mal
                    volcados en este campo. */}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                  {getItemSpriteUrl(o.nombre) ? (
                    <img
                      src={getItemSpriteUrl(o.nombre)!}
                      alt=""
                      aria-hidden
                      className="h-6 w-6 object-contain [image-rendering:pixelated]"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-amber-400" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold leading-snug">
                    {getItemDescription(o.nombre) ? (
                      <HoverDescription description={getItemDescription(o.nombre)!}>
                        <span className="cursor-help border-b border-dotted border-slate-600">{o.nombre}</span>
                      </HoverDescription>
                    ) : (
                      o.nombre
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 empty:mt-0">
                    {destacado && Icono && (
                      <span
                        title={destacado.motivo}
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide ${CLASE_OBJETO_CHIP[destacado.clase]}`}
                      >
                        <Icono className="h-2.5 w-2.5" />
                        {destacado.etiqueta}
                      </span>
                    )}
                    <VisitaChip n={visitaDe(desde)} />
                  </div>
                  {o.detalle && <div className="mt-0.5 text-xs leading-snug text-slate-400">{o.detalle}</div>}
                  <RequisitoChips requisitos={o.requisitos} pendientes={pendientesDe(o.requisitos, desde.zona)} />
                  {pendientes && (
                    <BotonPendiente actions={pendientes} entry={crearPendiente(zonaDe(desde.zona), "Objeto", o.nombre, o.detalle, o.requisitos)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyHint>Sin objetos registrados en esta zona.</EmptyHint>
      )}
    </div>
  );
}
