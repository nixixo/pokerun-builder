import { recursoJson } from "@/components/shared/recursoJson";
import type { MoveZ, MoveZCrudo, PokemonZEntry } from "../types/pokemonZ";

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
export function createPokemonZResources(base = "/generated") {
  const core = recursoJson<PokemonZEntry[]>(`${base}/pokemon_z_completo.json`);
  const learnsets = recursoJson<Record<string, Partial<PokemonZEntry>>>(`${base}/pokemon_z_learnsets.json`);
  const moves = recursoJson<MoveZ[]>(`${base}/moves.json`, { transformar: normalizeMoves });
  const abilities = recursoJson<AbilityDescriptions>(`${base}/abilities_descriptions.json`);
  return {
    async pokemon() {
      const [entries, learned] = await Promise.all([core.cargar(), learnsets.cargar()]);
      return entries.map((entry) => ({ ...entry, ...learned[entry.id] }));
    },
    moves: moves.cargar,
    abilities: abilities.cargar,
  };
}

export const pokemonZResources = createPokemonZResources();
