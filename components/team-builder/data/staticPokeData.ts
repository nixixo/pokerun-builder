// components/team-builder/data/staticPokeData.ts
//
// Carga de los datos estáticos de PokéAPI congelados en public/pokeapi/
// por scripts/generate-pokeapi-data.mjs.
//
// Antes esto era una cascada de ~22 requests cross-origin encadenados ENTRE
// RENDERS (la lista de tipos tenía que resolver y re-renderizar antes de que
// arrancaran los 18 fetches de relaciones, etc.). Ahora es un único lote
// paralelo contra el propio origen.
//
// Patrón de caché: igual que components/guia/useZonesData.ts — cache a nivel
// de módulo + deduplicación de la promesa en vuelo, para que dos consumidores
// simultáneos (o volver a montar el componente) no repitan la descarga.

import { useEffect, useState } from "react";
import type { AvailablePokemon, BaseStats } from "../types";

export type DamageRelations = {
  double_damage_from: { name: string }[];
  double_damage_to: { name: string }[];
  half_damage_from: { name: string }[];
  half_damage_to: { name: string }[];
  no_damage_from: { name: string }[];
  no_damage_to: { name: string }[];
};

export type StaticPokeData = {
  /** Tipos jugables, en el orden de la API (sin shadow/unknown/stellar). */
  allTypes: string[];
  /** Tabla de efectividades por tipo. */
  typeRelations: Record<string, DamageRelations>;
  /** Slugs para el autocompletado de Pokémon. */
  pokemonNames: string[];
  /** Slugs para el autocompletado de movimientos. */
  moveNames: string[];
  /** "WATERABSORB" → "Water Absorb". */
  abilityDisplayNames: Record<string, string>;
  /** Dataset base del motor de recomendaciones (sin learnsets). */
  allPokemonData: AvailablePokemon[];
  /** Species ids desde los que evoluciona algún otro Pokémon. */
  speciesWithEvolution: Set<number>;
};

type RawCore = {
  pokemon: {
    slug: string;
    name: string;
    id: number;
    types: string[];
    stats: BaseStats | null;
    isFinalEvo: boolean;
    abilities: string[] | null;
    hiddenAbility: string | null;
  }[];
  speciesWithEvolution: number[];
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

let cache: StaticPokeData | null = null;
let inflight: Promise<StaticPokeData> | null = null;

export function loadStaticPokeData(): Promise<StaticPokeData> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = Promise.all([
      getJson<{ types: string[]; relations: Record<string, DamageRelations> }>(
        "/pokeapi/type-relations.json"
      ),
      getJson<{ pokemonNames: string[]; moveNames: string[] }>("/pokeapi/name-indexes.json"),
      getJson<Record<string, string>>("/pokeapi/ability-display-names.json"),
      getJson<RawCore>("/pokeapi/pokemon-core.json"),
    ])
      .then(([typeData, names, abilityDisplayNames, core]) => {
        const data: StaticPokeData = {
          allTypes: typeData.types,
          typeRelations: typeData.relations,
          pokemonNames: names.pokemonNames,
          moveNames: names.moveNames,
          abilityDisplayNames,
          allPokemonData: core.pokemon.map((p) => ({
            ...p,
            types: (p.types.length === 1 ? [p.types[0]] : [p.types[0], p.types[1]]) as
              | [string]
              | [string, string],
          })),
          speciesWithEvolution: new Set(core.speciesWithEvolution),
        };
        cache = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

const EMPTY: StaticPokeData = {
  allTypes: [],
  typeRelations: {},
  pokemonNames: [],
  moveNames: [],
  abilityDisplayNames: {},
  allPokemonData: [],
  speciesWithEvolution: new Set(),
};

export function useStaticPokeData(): { data: StaticPokeData; loading: boolean } {
  // Lazy init desde la caché: si los datos ya están, el primer render los
  // tiene y no hay flash de estado vacío.
  const [data, setData] = useState<StaticPokeData>(() => cache ?? EMPTY);
  const [loading, setLoading] = useState(() => cache === null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadStaticPokeData()
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[PokeRun] Error cargando datos estáticos de PokéAPI:", err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

// ─── Learnsets (carga diferida) ──────────────────────────────────────────────
// ~1.1 MB, contra ~277 KB del resto del dataset. Solo hacen falta cuando el
// usuario filtra recomendaciones por movimiento, así que se quedan fuera del
// camino crítico y se piden recién cuando ese filtro se activa.

let learnsetsCache: Record<string, string[]> | null = null;
let learnsetsInflight: Promise<Record<string, string[]>> | null = null;

export function loadLearnsets(): Promise<Record<string, string[]>> {
  if (learnsetsCache) return Promise.resolve(learnsetsCache);
  if (!learnsetsInflight) {
    learnsetsInflight = getJson<Record<string, string[]>>("/pokeapi/pokemon-learnsets.json")
      .then((data) => {
        learnsetsCache = data;
        return data;
      })
      .finally(() => {
        learnsetsInflight = null;
      });
  }
  return learnsetsInflight;
}

/**
 * Learnsets del dex estándar, cargados solo cuando `enabled` pasa a true
 * (es decir, cuando hay al menos un filtro por movimiento activo).
 */
export function useLearnsets(enabled: boolean): Record<string, string[]> | null {
  const [learnsets, setLearnsets] = useState<Record<string, string[]> | null>(
    () => learnsetsCache
  );

  useEffect(() => {
    if (!enabled || learnsetsCache) return;
    let cancelled = false;
    loadLearnsets()
      .then((data) => {
        if (!cancelled) setLearnsets(data);
      })
      .catch((err) => console.error("[PokeRun] Error cargando learnsets:", err));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return learnsets;
}
