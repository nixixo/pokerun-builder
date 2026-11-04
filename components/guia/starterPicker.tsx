// components/guia/starterPicker.tsx
//
// Selector de inicial que aparece en las tarjetas de rival. La elección es
// global (ver useStarterChoice), así que basta con marcarla una vez: el resto
// de combates de rival y el análisis de debilidades la respetan solos.

import { ZoneSpriteImg } from "./zoneSpriteImage";
import { typeEsChipStyle } from "./typeColors";
import { STARTERS, STARTER_TIPO, useStarterChoice } from "./useStarterChoice";

export function StarterPicker({
  getSpriteUrl,
}: {
  getSpriteUrl?: (speciesName: string, spriteBase?: string) => string | null;
}) {
  const { inicial, setInicial } = useStarterChoice();

  return (
    <div className="mb-2 rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-sky-300/80">
          Tu inicial
        </span>
        {inicial ? (
          <button
            type="button"
            onClick={() => setInicial(null)}
            className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-300"
          >
            Quitar
          </button>
        ) : (
          <span className="text-[12px] text-slate-500">Elige para ver el equipo exacto</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STARTERS.map((s) => {
          const activo = inicial === s;
          const sprite = getSpriteUrl?.(s);
          return (
            <button
              key={s}
              type="button"
              // Volver a pulsar el que ya está marcado lo desmarca: sin esto la
              // única salida sería el botón "Quitar", que solo existe cuando ya
              // hay algo elegido.
              onClick={() => setInicial(activo ? null : s)}
              aria-pressed={activo}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition ${
                activo
                  ? "border-sky-400/60 bg-sky-400/15 text-slate-100"
                  : "border-slate-700/60 bg-slate-950/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {sprite ? (
                <ZoneSpriteImg
                  rawUrl={sprite}
                  alt={s}
                  className={`h-7 w-7 object-contain [image-rendering:pixelated] ${activo ? "" : "opacity-60"}`}
                  placeholderClassName="h-4 w-4 opacity-40 animate-pulse"
                />
              ) : null}
              <span className="text-[12px] font-bold">{s}</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                style={typeEsChipStyle(STARTER_TIPO[s])}
              >
                {STARTER_TIPO[s]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
