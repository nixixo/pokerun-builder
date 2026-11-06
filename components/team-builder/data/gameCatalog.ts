import { POKEDEX_OPTIONS, type CatalogFiles, type PokedexId } from "./gameRegistry";
import { recursoJson } from "@/components/shared/recursoJson";
import type { MoveZ, MoveZCrudo, PokemonZEntry } from "../types/pokemonZ";

export interface ItemEntry {
  id: number;
  internalName: string;
  name: string;
  nameEn?: string;
  namePlural: string;
  description: string;
  descriptionEn?: string;
  hackrom: boolean;
  sprite?: string | null;
  category?: string | null;
}

export type AbilityDescriptions = Record<string, {
  nameEn: string | null; nameEnDisplay?: string; description: string;
  descriptionEn?: string; customAbility?: boolean;
}>;

function normalizeMoves(data: MoveZCrudo[]): MoveZ[] {
  const seen = new Set<string>();
  return data.flatMap((mv) => {
    const internalName = mv.internal_name ?? "";
    if (!internalName || seen.has(internalName)) return [];
    seen.add(internalName);
    const name = (typeof mv.name === "string" ? mv.name : mv.name?.es) ?? "";
    return [{
      internalName, name,
      nameEn: (typeof mv.name === "string" ? mv.name : mv.name?.en) ?? name,
      category: mv.category ?? "",
      type: typeof mv.type === "string" ? mv.type.toLowerCase() : null,
      hackrom: !!mv.hackrom,
      power: typeof mv.power === "number" ? mv.power : null,
      accuracy: typeof mv.accuracy === "number" ? mv.accuracy : null,
      pp: typeof mv.pp === "number" ? mv.pp : null,
      descriptionEs: mv.description?.es ?? "", descriptionEn: mv.description?.en ?? "",
    }];
  });
}

/** Recursos independientes: un reintento conserva las descargas que ya terminaron. */
export function createGameCatalog(files: CatalogFiles) {
  const core = recursoJson<PokemonZEntry[]>(files.pokemon);
  const learnsets = recursoJson<Record<string, Partial<PokemonZEntry>>>(files.learnsets);
  const moves = recursoJson<MoveZ[]>(files.moves, { transformar: normalizeMoves });
  const abilities = recursoJson<AbilityDescriptions>(files.abilities);
  return {
    async pokemon() {
      const [entries, learned] = await Promise.all([core.cargar(), learnsets.cargar()]);
      return entries.map((entry) => ({ ...entry, ...learned[entry.id] }));
    },
    moves: moves.cargar,
    abilities: abilities.cargar,
    items: recursoJson<ItemEntry[]>(files.items).cargar,
  };
}

export type GameCatalog = ReturnType<typeof createGameCatalog>;

const catalogs = new Map<PokedexId, GameCatalog>();
for (const game of POKEDEX_OPTIONS) {
  if (game.source === "catalog") catalogs.set(game.id, createGameCatalog(game.files));
}

export function getGameCatalog(id: PokedexId) {
  return catalogs.get(id);
}
