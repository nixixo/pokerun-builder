import catalogManifest from "../../../data-src/builder-catalogs.json" with { type: "json" };
import { pokemonZCatalogRules, type CatalogRules } from "./catalogRules";
import type { Lang } from "../types";

export type CatalogFiles = {
  pokemon: string;
  learnsets: string;
  moves: string;
  abilities: string;
  items: string;
};

type CatalogId = keyof typeof catalogManifest;
export type PokedexId = "standard" | CatalogId | "catalog-test";

type GameDefinition = {
  id: PokedexId;
  label: string;
  description: Record<Lang, string>;
  logo?: { src: string; width: number; height: number };
  guideHref?: string;
  accent: "blue" | "yellow";
} & ({ source: "pokeapi" } | { source: "catalog"; files: CatalogFiles; rules?: CatalogRules });

const standard: GameDefinition = {
  id: "standard",
  label: "Pokedex",
  description: { es: "Pokedex Nacional", en: "National Pokedex" },
  source: "pokeapi",
  accent: "blue",
};

const catalogs = (Object.keys(catalogManifest) as CatalogId[]).map((id): GameDefinition => {
  const { label, description, ...files } = catalogManifest[id];
  return {
    id, label, description,
    source: "catalog",
    accent: "yellow",
    files: {
      pokemon: `/generated/${files.pokemon}`,
      learnsets: `/generated/${files.learnsets}`,
      moves: `/generated/${files.moves}`,
      abilities: `/generated/${files.abilities}`,
      items: `/generated/${files.items}`,
    },
    ...(id === "pokemon-z" ? {
      rules: pokemonZCatalogRules,
      logo: { src: "/pokemon-z-logo.webp", width: 435, height: 384 },
      guideHref: "/guia",
    } : {}),
  };
});

export const POKEDEX_OPTIONS: readonly GameDefinition[] = [
  standard,
  ...catalogs,
  // El build de pruebas usa respuestas de Playwright para estas rutas.
  ...(process.env.NEXT_PUBLIC_TEST_CATALOG === "1" ? [{
    id: "catalog-test",
    label: "Catálogo de prueba",
    description: { es: "Datos ficticios", en: "Fixture data" },
    source: "catalog",
    accent: "blue",
    files: {
      pokemon: "/__catalog_test/pokemon.json",
      learnsets: "/__catalog_test/learnsets.json",
      moves: "/__catalog_test/moves.json",
      abilities: "/__catalog_test/abilities.json",
      items: "/__catalog_test/items.json",
    },
  } as const] : []),
];

export function getGame(id: PokedexId): GameDefinition {
  return POKEDEX_OPTIONS.find((game) => game.id === id) ?? POKEDEX_OPTIONS[0];
}
