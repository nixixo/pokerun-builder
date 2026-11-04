// components/guia/usePokemonZSprites.ts
//
// La guía solo tiene nombres de especie en texto plano ("Furfrou",
// "Mareep"...), pero getZSpriteUrl (utils/spriteHelpers.ts) necesita un
// objeto con id/dexId. Este hook carga la Pokédex Z y arma un Map
// nombre normalizado -> entrada, para poder resolver el sprite de
// cualquier especie que aparezca en la guía.
//
// Diagnóstico de sprites que no matchean: cuando un nombre de la guía no
// encuentra entrada en la Pokédex Z, no hay ningún request de red (por
// eso no aparece un 404) — simplemente getSpriteUrl devuelve null y el
// componente cae a su ícono de fallback. En desarrollo, dejamos un
// console.warn (una sola vez por nombre) para poder detectar esos casos
// sin tener que adivinar.

import { useMemo } from "react";
import { getZSpriteUrl } from "../team-builder/utils/spriteHelpers";
import { claveEspecie } from "@/components/shared/normalizar";
import { recursoJson } from "@/components/shared/recursoJson";

type PokemonZEntry = {
  name?: string;
  internalName?: string;
  id: number;
  dexId?: number;
  sprite?: string;
};

// Nombres ya avisados por consola, para no repetir el mismo warning en
// cada render/zona donde aparezca el mismo Pokémon sin match.
const warnedMissing = new Set<string>();

// La normalización agresiva (♀/♂, puntos, guiones, paréntesis) vivía aquí y
// ahora se comparte: cruzar nombres entre la guía y la Pokédex es lo que hace
// media docena de módulos más, y cada uno tenía su propia versión.
const normalize = claveEspecie;

// Mismo archivo que pide useSpeciesData. Como el registro de recursoJson va por
// RUTA, los dos hooks comparten una única descarga y un único parseo de los
// 392 KB; antes cada uno tenía su caché y hacía las dos cosas por su cuenta.
const EMPTY_ENTRIES: PokemonZEntry[] = [];

const PokedexZ = recursoJson<PokemonZEntry[]>("/generated/pokemon_z_completo.json", {
  etiqueta: "usePokemonZSprites",
});

export function usePokemonZSprites() {
  // Si falla, se queda en lista vacía: la guía sigue funcionando sin sprites.
  const entries = PokedexZ.useRecurso().datos ?? EMPTY_ENTRIES;

  const byName = useMemo(() => {
    const map = new Map<string, PokemonZEntry>();
    for (const e of entries) {
      if (e.name) map.set(normalize(e.name), e);
      if (e.internalName) map.set(normalize(e.internalName), e);
    }
    return map;
  }, [entries]);

  // `spriteBase` viene del JSON de la guía (lo escribe
  // scripts/clean-guia-names.mjs) y nombra la especie de la que tomar prestado
  // el sprite. Hace falta para las variantes del romhack — "Solosis Z",
  // "Raichu Regional", "Zigzagoon Galar" — que aparecen en la guía pero no
  // tienen entrada propia en la Pokédex Z: sin esto no hay sprite que buscar.
  function getSpriteUrl(speciesName: string, spriteBase?: string): string | null {
    const key = normalize(speciesName);
    const entry = byName.get(key) ?? (spriteBase ? byName.get(normalize(spriteBase)) : undefined);
    if (!entry) {
      if (process.env.NODE_ENV !== "production" && entries.length > 0 && !warnedMissing.has(key)) {
        warnedMissing.add(key);
         
        console.warn(`[Guía] Sin sprite para "${speciesName}" (clave normalizada: "${key}") — no está en pokemon_z_completo.json con ese nombre.`);
      }
      return null;
    }
    return getZSpriteUrl(entry);
  }

  return { getSpriteUrl, ready: entries.length > 0 };
}
