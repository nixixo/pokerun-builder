"use client";

// components/guia/zona/opcional.tsx
//
// Las marcas de "esto no es obligatorio".
//
// 59 de las 204 entradas de la guía llevan "(Opcional)" en el título, y 18 de
// ellas no son ni un sitio: son un objetivo de captura ("Atrapar a Raikou").
// Hasta ahora eso solo se sabía leyendo el nombre entero, así que un tercio de
// la guía se recorría sin saber qué se podía dejar para después.
//
// La marca sale del dato (`zona.opcional` / `zona.capturas`, ver
// scripts/clean-guia-names.mjs), no de volver a leer el título aquí.

import { CircleDashed } from "lucide-react";
import { PokeballIcon } from "../../team-builder/components/PokeballIcon";
import { ZoneSpriteImg } from "../zoneSpriteImage";

const AVISO = "Opcional: la guía la marca así, saltársela no bloquea la historia.";

/**
 * En la lista va sin borde y en pequeño (hay 59 filas con esto, y un chip con
 * caja en cada una tapa la lista); en el detalle, con caja, que es donde se
 * mira una zona concreta y la marca tiene que pesar.
 */
export function ChipOpcional({ tamano = "lista" }: { tamano?: "lista" | "detalle" }) {
  if (tamano === "lista") {
    return (
      <span
        title={AVISO}
        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-400/70"
      >
        <CircleDashed className="h-2.5 w-2.5" />
        Opc.
      </span>
    );
  }
  return (
    <span
      title={AVISO}
      className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-violet-300"
    >
      <CircleDashed className="h-2.5 w-2.5" />
      Opcional
    </span>
  );
}

/**
 * El bloque de arriba del detalle cuando la entrada es un objetivo de captura.
 * Es lo que convierte "Atrapar a los Tapus" en algo que se puede leer de un
 * vistazo: los cuatro con su cara, en vez de un título y cinco párrafos.
 */
export function BloqueCapturas({
  especies,
  getSpriteUrl,
}: {
  especies: string[];
  getSpriteUrl?: (speciesName: string, spriteBase?: string) => string | null;
}) {
  if (especies.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.15em] text-violet-300/80">
        <PokeballIcon className="h-3.5 w-3.5" />
        {especies.length === 1 ? "Objetivo de captura" : `Objetivos de captura · ${especies.length}`}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {especies.map((especie) => (
          <span
            key={especie}
            className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-slate-950/50 py-1 pl-1 pr-2.5"
          >
            <ZoneSpriteImg
              rawUrl={getSpriteUrl?.(especie)}
              alt={especie}
              className="h-7 w-7 shrink-0 [image-rendering:pixelated]"
              placeholderClassName="h-5 w-5 opacity-40"
            />
            <span className="text-[13px] font-semibold text-slate-100">{especie}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
