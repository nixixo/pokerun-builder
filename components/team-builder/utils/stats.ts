// components/team-builder/utils/stats.ts
//
// Nombres, orden y color de las stats base.
//
// Vivían sueltos a nivel de módulo en TeamBuilder.tsx, con una nota que decía
// "pendiente de extraer a utils/ cuando se aborde esa sección". Es esa sección.
//
// A nivel de módulo (y no dentro del componente) a propósito: su identidad es
// estable entre renders, que es lo que permite que BuilderChromeContext solo se
// invalide cuando cambia idioma/pokédex/modo de vista, y no en cada tecla.

import type { BaseStats, Lang } from "../types";

/** El orden fijo de las columnas, el mismo en toda la app. */
export const STAT_ORDER: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];

/** Etiquetas cortas para las cabeceras de tabla. */
export const STAT_LABELS: [keyof BaseStats, string][] = [
  ["HP", "HP"],
  ["ATK", "ATK"],
  ["DEF", "DEF"],
  ["SP.ATK", "SP.ATK"],
  ["SP.DEF", "SP.DEF"],
  ["SPE", "SPE"],
];

/** Nombres largos, para cuando hay sitio y hay que leerlos. */
export const STAT_NAMES_I18N: Record<Lang, Record<keyof BaseStats, string>> = {
  es: { HP: "HP", ATK: "Ataque", DEF: "Defensa", "SP.ATK": "Ataque Esp.", "SP.DEF": "Defensa Esp.", SPE: "Velocidad" },
  en: { HP: "HP", ATK: "Attack", DEF: "Defense", "SP.ATK": "Sp. Atk",    "SP.DEF": "Sp. Def",      SPE: "Speed"    },
};

/** Rojo a verde según lo alta que sea la stat (0-255). */
export const getStatColor = (value: number) => {
  const ratio = Math.min(Math.max(value / 255, 0), 1);
  return `hsl(${Math.round(ratio * 120)}, 78%, 52%)`;
};
