// components/guia/statsHover.tsx
//
// Tooltip con las stats base de un Pokémon de entrenador, colgado del nombre
// en su tarjeta. Sirve para lo que la tarjeta no dice: si al rival le pegas por
// el lado físico o el especial, y si le vas a ganar la iniciativa.
//
// Solo stats a propósito — la habilidad y el objeto ya tienen su propio hover
// (ver hoverDescription.tsx), y meterlo todo en el mismo globo lo volvería
// ilegible.
//
// Las stats salen de la Pokédex Z, así que son las del romhack, no las
// oficiales. Cuando una especie no matchea (variantes sin entrada propia) no
// hay tooltip: se devuelven los children tal cual, sin cursor de ayuda.
//
// Por qué `position: fixed` y no un absolute como hoverDescription: tanto el
// banner de batalla como la tarjeta de entrenador son `overflow-hidden`, y un
// globo de 160 px colgado hacia arriba se corta contra el borde del contenedor.
// Fijo escapa del recorte (ningún ancestro tiene transform, que es lo único que
// lo volvería a atrapar) y además puede decidir si abre arriba o abajo según lo
// que quede de pantalla.

import { useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import type { SpeciesInfo } from "./useSpeciesData";

type Stats = NonNullable<SpeciesInfo["stats"]>;

const FILAS: { key: keyof Stats; label: string }[] = [
  { key: "HP", label: "PS" },
  { key: "ATK", label: "Ataque" },
  { key: "DEF", label: "Defensa" },
  { key: "SP.ATK", label: "At. Esp." },
  { key: "SP.DEF", label: "Def. Esp." },
  { key: "SPE", label: "Velocidad" },
];

// La barra se mide contra 200, no contra el máximo real del juego (255 de
// Blissey): con 255 casi todo queda en un tercio del ancho y las diferencias
// que importan — entre un 70 y un 110 — dejan de verse.
const ESCALA = 200;
const ANCHO = 176;
const ALTO_APROX = 160; // solo para decidir si abre hacia arriba o hacia abajo

/** Verde alto, ámbar medio, rojo bajo: el color solo, sin número, ya ordena. */
function colorStat(valor: number): string {
  if (valor >= 120) return "#34d399";
  if (valor >= 90) return "#a3e635";
  if (valor >= 65) return "#fbbf24";
  return "#f87171";
}

export function StatsHover({ stats, children }: { stats: Stats | null; children: React.ReactNode }) {
  const anclaRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const abrir = () => {
    const r = anclaRef.current?.getBoundingClientRect();
    if (!r) return;
    const arriba = r.top - ALTO_APROX - 6;
    setPos({
      // Arriba si cabe; si no, debajo del nombre. Y sin salirse por los lados,
      // que en la columna de la derecha se iba fuera de la ventana.
      top: arriba > 8 ? arriba : r.bottom + 6,
      left: Math.min(Math.max(8, r.left), window.innerWidth - ANCHO - 8),
    });
  };

  if (!stats) return <>{children}</>;

  const total = FILAS.reduce((suma, f) => suma + (stats[f.key] ?? 0), 0);

  return (
    // inline-flex y no inline a secas: el nombre que va dentro lleva `truncate`,
    // y overflow:hidden no hace nada sobre una caja inline. Como ítem flex sí
    // recorta, y el min-w-0 evita que empuje al nivel fuera de la tarjeta.
    //
    // El icono no es adorno: sin él nadie descubre que el nombre esconde algo,
    // porque el cursor de ayuda solo aparece cuando ya estás encima. Va con
    // `shrink-0` para que lo que se recorte al faltar sitio sea el nombre y no
    // la señal de que hay algo que mirar.
    <span
      ref={anclaRef}
      onMouseEnter={abrir}
      onMouseLeave={() => setPos(null)}
      className="relative inline-flex min-w-0 cursor-help items-center gap-1"
    >
      {children}
      <CircleAlert className="h-3 w-3 shrink-0 text-slate-500" />
      {pos && (
        <span
          className="pointer-events-none fixed z-50 block rounded-lg border border-slate-700/70 bg-slate-950/95 p-2 shadow-xl shadow-black/50"
          style={{ top: pos.top, left: pos.left, width: ANCHO }}
        >
          {FILAS.map((f) => {
            const valor = stats[f.key] ?? 0;
            return (
              <span key={f.key} className="mb-1 flex items-center gap-1.5 last:mb-0">
                <span className="w-[52px] shrink-0 text-[11px] uppercase tracking-wide text-slate-500">{f.label}</span>
                <span className="w-6 shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-200">{valor}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.min(100, (valor / ESCALA) * 100)}%`, backgroundColor: colorStat(valor) }}
                  />
                </span>
              </span>
            );
          })}
          <span className="mt-1.5 flex items-center justify-between border-t border-slate-800 pt-1.5 text-[11px] uppercase tracking-wide text-slate-500">
            Total
            <span className="text-[12px] font-bold tabular-nums text-slate-300">{total}</span>
          </span>
        </span>
      )}
    </span>
  );
}
