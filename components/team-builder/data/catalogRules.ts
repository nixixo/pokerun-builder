import type { AvailablePokemon } from "../types";
import type { PokemonZEntry } from "../types/pokemonZ";
import { getZDisplayName, getZSpriteUrl } from "../utils/spriteHelpers";
import {
  POKEMON_Z_ORIGINALS, POKEMON_Z_PRE_EVOS, Z_MEGA_OFFICIAL_DUPLICATE_SPECIES, Z_MEGA_ONLY_SPECIES,
} from "../utils/pokemonDefinitions";
import { normalizeApostrophe, stripZFormPrefixSuffix } from "../utils/stringNormalization";

export type CatalogRules = {
  displayName: (pokemon: PokemonZEntry) => string;
  spriteUrl: (pokemon: PokemonZEntry) => string | null;
  isFinalEvolution: (pokemon: PokemonZEntry, speciesWithEvolution: ReadonlySet<number>) => boolean;
  isMega: (pokemon: AvailablePokemon) => boolean;
  includeStandardForms?: boolean;
  isOriginal?: (pokemon: AvailablePokemon) => boolean;
  excludeRecommendation?: (pokemon: AvailablePokemon) => boolean;
};

export const defaultCatalogRules: CatalogRules = {
  displayName: (pokemon) => pokemon.name ?? pokemon.internalName ?? "",
  spriteUrl: (pokemon) => pokemon.sprite ?? null,
  isFinalEvolution: (pokemon, speciesWithEvolution) => !speciesWithEvolution.has(pokemon.dexId ?? pokemon.id),
  isMega: (pokemon) => pokemon.formLabel === "Mega",
};

const isZMega = (pokemon: AvailablePokemon) => pokemon.formLabel === "Mega" && pokemon.id >= 90000;
const baseName = (pokemon: AvailablePokemon) => stripZFormPrefixSuffix(normalizeApostrophe(pokemon.name));

export const pokemonZCatalogRules: CatalogRules = {
  displayName: getZDisplayName,
  spriteUrl: getZSpriteUrl,
  isFinalEvolution: (pokemon, speciesWithEvolution) =>
    pokemon.id >= 899 || !(speciesWithEvolution.has(pokemon.id) || POKEMON_Z_PRE_EVOS.has(pokemon.id)),
  isMega: isZMega,
  includeStandardForms: true,
  isOriginal: (pokemon) => {
    const base = baseName(pokemon);
    const key = base.toLowerCase();
    const mega = isZMega(pokemon);
    const officialDuplicate = mega && Z_MEGA_OFFICIAL_DUPLICATE_SPECIES.has(key) && !/\s+Z$/.test(pokemon.name);
    return (POKEMON_Z_ORIGINALS.has(base) && !officialDuplicate) || (mega && Z_MEGA_ONLY_SPECIES.has(key));
  },
  excludeRecommendation: (pokemon) => isZMega(pokemon) && baseName(pokemon).toLowerCase() === "ditto",
};
