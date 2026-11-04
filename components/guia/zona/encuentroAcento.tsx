// components/guia/zona/encuentroAcento.tsx
//
// El decorado de las tarjetas de Pokémon salvaje: a partir del texto del método
// de encuentro ("hierba alta", "pescando con caña buena", "nubes de polvo"…)
// saca un icono para el chip y una marca de agua de fondo para la tarjeta.
//
// Son ~220 líneas de SVG y tablas de color que solo usa esa tarjeta, y que
// estaban en medio de zoneDetail.tsx entre la lógica de zonas. Aquí no
// molestan y se pueden mirar juntas, que es como se editan: si cambia el color
// de una categoría, cambia en las cuatro tablas a la vez.

import { Fish, Footprints, Mountain } from "lucide-react";

/** Método de encuentro -> icono, para que el chip transmita algo más que texto. */
export function encounterIcon(metodo: string) {
  const m = metodo.toLowerCase();
  if (m.includes("pesc") || m.includes("caña")) return Fish;
  if (m.includes("surf") || m.includes("agua")) return Fish;
  if (m.includes("nube") || m.includes("polvo")) return Mountain;
  return Footprints;
}

// Método de encuentro -> categoría de watermark decorativo de fondo.
// Cubre las variantes de texto más comunes en la guía; si no matchea
// ninguna, no se dibuja watermark (mejor nada que uno incorrecto).
export type EncounterAccentKind =
  | "grass" | "water" | "fishing" | "cave" | "dust" | "surf" | "trees" | "honey" | "headbutt" | "gift";

export function encounterAccentKind(metodo: string): EncounterAccentKind | null {
  const m = metodo.toLowerCase();
  if (m.includes("pesc") || m.includes("caña")) return "fishing";
  if (m.includes("surf")) return "surf";
  // Antes que "cave": en las cuevas no hay hierba, los encuentros salen de las
  // nubes de polvo, y ese método merece su propio motivo.
  if (m.includes("nube") || m.includes("polvo")) return "dust";
  if (m.includes("cueva") || m.includes("roca") || m.includes("cristal")) return "cave";
  if (m.includes("miel") || m.includes("panal") || m.includes("honey")) return "honey";
  if (m.includes("golpe de cabeza") || m.includes("headbutt") || m.includes("árbol") && m.includes("golpe")) return "headbutt";
  if (m.includes("árbol") || m.includes("rama")) return "trees";
  if (m.includes("regalo") || m.includes("gift")) return "gift";
  if (m.includes("agua")) return "water";
  if (m.includes("hierba") || m.includes("pasto") || m.includes("césped")) return "grass";
  return null;
}

// Watermark por categoría: siluetas RELLENAS (no trazos finos), estilo
// ícono de app — pensadas para vivir a opacidad muy baja en la esquina
// inferior derecha de la tarjeta, como textura ambiental. Color por
// categoría: agua/pesca/surf en azul, cueva en gris piedra, el resto
// (hierba, árboles, miel, golpe de cabeza, regalo) en verde.
const ACCENT_COLOR: Record<EncounterAccentKind, string> = {
  grass: "text-emerald-400",
  water: "text-sky-400",
  fishing: "text-sky-400",
  surf: "text-sky-400",
  cave: "text-slate-400",
  dust: "text-stone-400",
  trees: "text-emerald-400",
  honey: "text-amber-400",
  headbutt: "text-emerald-400",
  gift: "text-emerald-400",
};

const ACCENT_OPACITY: Record<EncounterAccentKind, { base: string; hover: string }> = {
  grass: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  water: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  fishing: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  surf: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  cave: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  dust: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  trees: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  honey: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  headbutt: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
  gift: { base: "opacity-[0.1]", hover: "group-hover:opacity-[0.28]" },
};

export const ACCENT_CHIP_CLASS: Record<EncounterAccentKind, string> = {
  grass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  water: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  fishing: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  surf: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  cave: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  dust: "border-stone-400/30 bg-stone-400/10 text-stone-300",
  trees: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  honey: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  headbutt: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  gift: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

export const DEFAULT_CHIP_CLASS = "border-sky-500/30 bg-sky-500/5 text-sky-300";

const ACCENT_SIZE: Record<EncounterAccentKind, string> = {
  grass: "-bottom-2 -right-2 h-24 w-24",
  water: "-bottom-3 -right-3 h-28 w-28",
  fishing: "-bottom-2 -right-2 h-24 w-24",
  surf: "-bottom-2 -right-2 h-24 w-24",
  cave: "-bottom-2 -right-2 h-24 w-24",
  dust: "-bottom-2 -right-2 h-24 w-24",
  trees: "-bottom-2 -right-2 h-24 w-24",
  honey: "-bottom-2 -right-2 h-24 w-24",
  headbutt: "-bottom-2 -right-2 h-24 w-24",
  gift: "-bottom-2 -right-2 h-24 w-24",
};

export function EncounterAccent({ kind }: { kind: EncounterAccentKind }) {
  const { base, hover } = ACCENT_OPACITY[kind];
  const common = `pointer-events-none absolute z-0 ${ACCENT_SIZE[kind]} ${base} transition-opacity duration-300 ${hover} ${ACCENT_COLOR[kind]}`;

  switch (kind) {
    case "grass":
      // Cuatro hojas de pasto rellenas, alturas alternadas — mismo
      // lenguaje visual que el ícono de referencia.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <path d="M8 100C8 100 6 60 30 40C40 60 34 85 24 100Z" opacity="0.75" />
          <path d="M38 100C38 100 32 45 58 12C66 45 56 80 52 100Z" />
          <path d="M60 100C60 100 58 68 82 48C88 70 78 92 72 100Z" opacity="0.6" />
          <path d="M78 100C78 100 78 78 96 62C100 78 92 94 88 100Z" opacity="0.4" />
        </svg>
      );
    case "water":
      // Olas de mar rellenas, apiladas — distinto del motivo de
      // corrientes finas que ahora usa "fishing".
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <path d="M0 32C10 22 20 22 30 32C40 42 50 42 60 32C70 22 80 22 90 32C93 34.7 96 37.3 100 40V52C96 49.3 93 46.7 90 44C80 34 70 34 60 44C50 54 40 54 30 44C20 34 10 34 0 44Z" opacity="0.9" />
          <path d="M0 58C10 48 20 48 30 58C40 68 50 68 60 58C70 48 80 48 90 58C93 60.7 96 63.3 100 66V78C96 75.3 93 72.7 90 70C80 60 70 60 60 70C50 80 40 80 30 70C20 60 10 60 0 70Z" opacity="0.6" />
          <path d="M0 84C10 74 20 74 30 84C40 94 50 94 60 84C70 74 80 74 90 84C93 86.7 96 89.3 100 92V100H0Z" opacity="0.35" />
        </svg>
      );
    case "surf":
      // Olas más grandes y dinámicas, curva única y pronunciada.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <path d="M0 45C20 20 35 20 50 45C65 70 80 70 100 45V95H0Z" opacity="0.85" />
          <path d="M0 68C20 50 35 50 50 68C65 86 80 86 100 68V95H0Z" opacity="0.5" />
        </svg>
      );
    case "fishing":
      // Esto es lo que pediste para "caña": un motivo de corriente
      // marina grande y estilizado — 4 líneas curvas finas y elegantes,
      // inspiradas en corrientes tranquilas del mar. Watermark sutil,
      // ~5% opacidad, sin relleno, minimalista.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M-5 30C15 15 25 45 45 30C65 15 75 45 95 30" opacity="0.9" />
          <path d="M-5 48C15 33 25 63 45 48C65 33 75 63 95 48" opacity="0.75" />
          <path d="M-5 66C15 51 25 81 45 66C65 51 75 81 95 66" opacity="0.55" />
          <path d="M-5 84C15 69 25 99 45 84C65 69 75 99 95 84" opacity="0.35" />
        </svg>
      );
    case "dust":
      // Nube de polvo levantándose sobre un peñasco: dos bloques de roca
      // facetados abajo y tres bocanadas de polvo encima, cada vez más tenues
      // conforme suben. Mismo lenguaje de siluetas rellenas que hierba y agua.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <circle cx="30" cy="34" r="13" opacity="0.3" />
          <circle cx="52" cy="24" r="10" opacity="0.22" />
          <circle cx="69" cy="36" r="8" opacity="0.16" />
          <path d="M26 100L50 52L68 74L82 56L100 100Z" opacity="0.9" />
          <path d="M0 100L14 72L28 86L34 100Z" opacity="0.55" />
        </svg>
      );
    case "cave":
      // Formación de roca/cristal rellena.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <path d="M6 100L28 48L46 66L62 30L80 58L98 100Z" opacity="0.85" />
          <path d="M58 100L68 76L80 88L88 100Z" opacity="0.55" />
        </svg>
      );
    case "trees":
      // Silueta simple de copa + tronco.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <circle cx="50" cy="34" r="28" opacity="0.85" />
          <circle cx="26" cy="52" r="18" opacity="0.6" />
          <circle cx="74" cy="52" r="18" opacity="0.6" />
          <rect x="43" y="55" width="14" height="45" rx="3" />
        </svg>
      );
    case "honey":
      // Panal: cluster de hexágonos rellenos.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          {[
            [32, 30, 0.9],
            [68, 30, 0.55],
            [50, 62, 0.75],
            [32, 92, 0.45],
            [68, 92, 0.4],
          ].map(([cx, cy, op], i) => (
            <polygon key={i} points={hexPoints(cx, cy, 20)} opacity={op} />
          ))}
        </svg>
      );
    case "headbutt":
      // Tronco con textura de corteza (líneas onduladas verticales).
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <rect x="10" y="0" width="80" height="100" rx="10" opacity="0.5" />
          <path
            d="M25 0C25 0 32 20 25 40C32 60 25 80 25 100M50 0C50 0 57 20 50 40C57 60 50 80 50 100M75 0C75 0 82 20 75 40C82 60 75 80 75 100"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            opacity="0.9"
          />
        </svg>
      );
    case "gift":
      // Caja de regalo rellena con moño.
      return (
        <svg viewBox="0 0 100 100" className={common} fill="currentColor">
          <rect x="15" y="42" width="70" height="58" rx="4" opacity="0.85" />
          <rect x="15" y="42" width="70" height="16" opacity="1" />
          <rect x="44" y="42" width="12" height="58" opacity="0.55" />
          <path d="M50 42C50 42 30 15 16 22C4 29 16 42 50 42Z" opacity="0.7" />
          <path d="M50 42C50 42 70 15 84 22C96 29 84 42 50 42Z" opacity="0.7" />
        </svg>
      );
  }
}

// Helper para el patrón de panal: hexágono regular centrado en (cx,cy).
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
