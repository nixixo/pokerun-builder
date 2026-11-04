"use client";

// components/team-builder/context/BuilderChromeContext.tsx
//
// El "chrome" del Builder: idioma, pokédex activa, modo de vista y los
// helpers de formato/etiquetado que se derivan de ellos.
//
// Por qué existe: estos ~10 valores los necesitaban LOS CINCO paneles, así
// que viajaban como props repetidas por todo el árbol (`lang`, `t`, `tn`,
// `badgeClass`, `isAdvanced`, `activePokedex`, `statLabels`, `statOrder`,
// `allTypes`, `getStatColor` — unas 40 props sumando todos los destinos).
// Además obligaban a TeamBuilder a re-renderizar el árbol entero para
// propagar un cambio de idioma.
//
// Cambian con muy baja frecuencia (cambiar idioma, cambiar pokédex, alternar
// simple/avanzado), a diferencia del estado de búsqueda — por eso son dos
// contextos separados y no uno solo: mezclarlos haría que cada tecla tipeada
// en un buscador invalidara también a los consumidores del chrome.

import { createContext, use } from "react";
import type { ReactNode } from "react";
import type { BaseStats, Lang } from "../types";
import type { PokedexId } from "../utils/constants";

export type BuilderChrome = {
  lang: Lang;
  /** Diccionario de textos de UI del idioma activo. */
  t: Record<string, string>;
  /** Traduce el nombre de un tipo (clave de API) al idioma activo. */
  tn: (apiKey: string) => string;
  /** Clases Tailwind del badge de un tipo. */
  badgeClass: (type: string) => string;
  isAdvanced: boolean;
  activePokedex: PokedexId;
  statLabels: [keyof BaseStats, string][];
  statOrder: (keyof BaseStats)[];
  statNamesI18n: Record<Lang, Record<keyof BaseStats, string>>;
  allTypes: string[];
  getStatColor: (value: number) => string;
};

const BuilderChromeContext = createContext<BuilderChrome | null>(null);

export function BuilderChromeProvider({
  value,
  children,
}: {
  value: BuilderChrome;
  children: ReactNode;
}) {
  return <BuilderChromeContext value={value}>{children}</BuilderChromeContext>;
}

/**
 * React 19: `use()` en vez de `useContext()`. Lanza si se usa fuera del
 * provider, que siempre es un bug de montaje y no un caso a manejar.
 */
export function useBuilderChrome(): BuilderChrome {
  const ctx = use(BuilderChromeContext);
  if (ctx === null) {
    throw new Error("useBuilderChrome debe usarse dentro de <BuilderChromeProvider>");
  }
  return ctx;
}
