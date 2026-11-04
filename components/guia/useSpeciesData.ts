// components/guia/useSpeciesData.ts
//
// Carga /pokemon_z_completo.json (mismo archivo que usa el Builder)
// una sola vez, y arma un mapa nombre normalizado -> { types, stats },
// para poder calcular debilidades y stats del equipo rival, y puntuar
// candidatos de captura, sin repetir la data por separado en la Guía.
//
// Reusa el mismo criterio que useMoveTypes/useItemSprites: match por
// nombre exacto normalizado (minúsculas, sin tildes). Los tipos vienen
// en español en el JSON (mismo formato que usa TeamBuilder.tsx), así
// que se convierten a slugs de API con TYPE_ES_TO_API_NORMALIZED.

import { useMemo } from "react";
import type { PokeType } from "./typeChart";
import { clave as normalize } from "@/components/shared/normalizar";
import { tipoEsAApi } from "@/components/shared/tipos";
import { recursoJson } from "@/components/shared/recursoJson";

type SpeciesEntry = {
  name: string;
  types: string[];
  stats: {
    HP: number; ATK: number; DEF: number;
    "SP.ATK": number; "SP.DEF": number; SPE: number;
  } | null;
};

export type SpeciesInfo = {
  types: PokeType[];
  // Los mismos tipos tal cual vienen en la Pokédex ("Psíquico", "Veneno"), para
  // pintarlos en las tarjetas sin tener que traducir de vuelta desde el slug.
  typesEs: string[];
  stats: SpeciesEntry["stats"];
};

function normalizeTypeToApi(esType: string): PokeType | null {
  return tipoEsAApi(esType) as PokeType | null;
}

// La descarga se comparte con usePokemonZSprites, que quiere el mismo archivo:
// recursoJson va por RUTA, así que pokemon_z_completo.json se pide y se parsea
// una sola vez. Antes cada hook tenía su caché propia y hacía las dos cosas por
// su cuenta, con los 392 KB duplicados en memoria.
const PokedexZ = recursoJson<SpeciesEntry[]>("/generated/pokemon_z_completo.json", {
  etiqueta: "useSpeciesData",
});

export function useSpeciesData() {
  const { datos: species } = PokedexZ.useRecurso();

  const byName = useMemo(() => {
    const map = new Map<string, SpeciesInfo>();
    for (const p of species ?? []) {
      const typesEs = (p.types ?? []).filter((t) => normalizeTypeToApi(t) !== null).slice(0, 2);
      const types = typesEs
        .map(normalizeTypeToApi)
        .filter((t): t is PokeType => t !== null);
      if (types.length === 0) continue;
      map.set(normalize(p.name), { types, typesEs, stats: p.stats ?? null });
    }
    return map;
  }, [species]);

  // Las variantes del romhack ("Bidoof Z", "Zigzagoon Galar", "Raichu
  // Regional") no tienen entrada en la Pokédex Z, así que sin ayuda caen como
  // "sin datos" y quedan fuera del análisis de debilidades. El JSON de la guía
  // trae dos pistas para resolverlas (las escribe scripts/clean-guia-names.mjs):
  //   - `tipos`: los tipos que la guía le da a la variante. Mandan sobre los de
  //     la especie base, que es justo lo que la variante cambia.
  //   - `spriteBase`: la especie base, de la que se heredan tipos y stats.
  function getSpeciesInfo(
    speciesName: string,
    hints?: { tipos?: string[]; spriteBase?: string }
  ): SpeciesInfo | null {
    const base =
      byName.get(normalize(speciesName)) ??
      (hints?.spriteBase ? byName.get(normalize(hints.spriteBase)) : undefined) ??
      null;

    if (!hints?.tipos?.length) return base;

    const typesEs = hints.tipos.filter((t) => normalizeTypeToApi(t) !== null).slice(0, 2);
    const types = typesEs.map(normalizeTypeToApi).filter((t): t is PokeType => t !== null);
    if (types.length === 0) return base;
    return { types, typesEs, stats: base?.stats ?? null };
  }

  return { getSpeciesInfo, loaded: species !== null };
}