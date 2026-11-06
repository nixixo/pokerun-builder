import { equal } from "node:assert/strict";
import { it } from "node:test";
import { defaultCatalogRules, pokemonZCatalogRules } from "../components/team-builder/data/catalogRules";
import type { AvailablePokemon } from "../components/team-builder/types";
import type { PokemonZEntry } from "../components/team-builder/types/pokemonZ";

it("un catálogo nuevo usa su nombre y sprite aunque el ID coincida con una forma de Z", () => {
  const pokemon: PokemonZEntry = {
    id: 90009, name: "Pikachu", internalName: "PIKACHU", dexId: 25,
    types: ["Eléctrico"], sprite: "/other/pikachu.png",
    stats: { HP: 35, ATK: 55, DEF: 40, "SP.ATK": 50, "SP.DEF": 50, SPE: 90 },
  };
  equal(defaultCatalogRules.displayName(pokemon), "Pikachu");
  equal(defaultCatalogRules.spriteUrl(pokemon), "/other/pikachu.png");
  equal(pokemonZCatalogRules.displayName(pokemon), "Gigamax Pikachu");
  equal(pokemonZCatalogRules.spriteUrl(pokemon)?.endsWith("/025_1.png"), true);
});

it("conserva las excepciones de Megas en recomendaciones de Pokémon Z", () => {
  const candidate: AvailablePokemon = {
    id: 91021, name: "Mega Chesnaught Z", slug: "mega-chesnaught-z",
    types: ["grass", "fighting"], formLabel: "Mega", isFinalEvo: true,
  };
  equal(pokemonZCatalogRules.isOriginal?.(candidate), true);
  equal(pokemonZCatalogRules.isOriginal?.({ ...candidate, name: "Mega Chesnaught" }), false);
  equal(pokemonZCatalogRules.isMega({ ...candidate, id: 652 }), false);
  equal(pokemonZCatalogRules.excludeRecommendation?.({ ...candidate, name: "Mega Ditto" }), true);
});
