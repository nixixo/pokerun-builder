// scripts/generate-pokeapi-data.mjs
//
// Congela en disco los datos de PokéAPI que la app usaba a pedir por red en
// CADA carga de página. Todos estos datos son estáticos (tablas de tipos,
// nombres de especies/movimientos/habilidades, stats base): no cambian entre
// usuarios ni entre requests, y solo se mueven cuando sale una generación
// nueva de Pokémon.
//
// Antes, el arranque de TeamBuilder disparaba una cascada de ~22 requests
// cross-origin encadenados entre renders:
//   /type?limit=100 → (render) → 18× /type/{name} → /pokemon?limit=100000
//   → /move?limit=100000 → /ability?limit=400 → GraphQL bulk
//
// Ahora todo eso vive en public/pokeapi/ y se sirve desde el propio origen.
//
// Uso:  node scripts/generate-pokeapi-data.mjs
// Volver a correrlo solo cuando haya datos nuevos en PokéAPI.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "pokeapi");
const REST = "https://pokeapi.co/api/v2";
const GRAPHQL = "https://beta.pokeapi.co/graphql/v1beta";

// Tipos que existen en la API pero no son jugables en un equipo real.
const EXCLUDED_TYPES = new Set(["shadow", "unknown", "stellar"]);

// Formas no elegibles en un equipo normal, que distorsionarían el análisis.
// "mega" y "gmax" NO se excluyen acá: se filtran reactivamente en la UI según
// los switches "Mostrar Megas" / "Mostrar Gigamax".
const EXCLUDED_FORM_PATTERN = /-(primal|totem|cap|starter|eternamax)\b/i;

const STAT_NAME_TO_KEY = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  "special-attack": "SP.ATK",
  "special-defense": "SP.DEF",
  speed: "SPE",
};

async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function graphql(query) {
  const data = await getJson(GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (data.errors) throw new Error(`GraphQL: ${JSON.stringify(data.errors)}`);
  return data.data;
}

/** Tabla de efectividades: { fire: { double_damage_to: [...], ... }, ... } */
async function buildTypeRelations() {
  const list = await getJson(`${REST}/type?limit=100`);
  const names = list.results
    .map((t) => t.name)
    .filter((n) => !EXCLUDED_TYPES.has(n));

  const entries = await Promise.all(
    names.map(async (name) => [name, (await getJson(`${REST}/type/${name}`)).damage_relations])
  );
  return { types: names, relations: Object.fromEntries(entries) };
}

/**
 * Mapa "NOMBREENSINGUIONES" → "Nombre Legible" (ej. WATERABSORB → Water
 * Absorb). abilities_descriptions.json guarda el nombre inglés como el slug
 * de PokéAPI sin guiones y en mayúsculas, así que la clave se deriva igual.
 */
async function buildAbilityDisplayNames() {
  const data = await getJson(`${REST}/ability?limit=1000`);
  const map = {};
  for (const { name: slug } of data.results) {
    const key = slug.replace(/-/g, "").toUpperCase();
    map[key] = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return map;
}

/** Slugs para los autocompletados de Pokémon y de movimientos. */
async function buildNameIndexes() {
  const [pokemon, moves] = await Promise.all([
    getJson(`${REST}/pokemon?limit=100000`),
    getJson(`${REST}/move?limit=100000`),
  ]);
  return {
    pokemonNames: pokemon.results.map((x) => x.name),
    moveNames: moves.results.map((x) => x.name),
  };
}

function buildStats(statRows) {
  const stats = {};
  for (const row of statRows ?? []) {
    const key = STAT_NAME_TO_KEY[row?.pokemon_v2_stat?.name];
    if (key) stats[key] = row.base_stat ?? 0;
  }
  // Incompleto: preferimos null antes que inventar valores.
  return Object.keys(stats).length === 6 ? stats : null;
}

/**
 * Dataset base del motor de recomendaciones: id, tipos, stats, habilidades y
 * learnset de toda la Pokédex nacional, en una sola consulta.
 */
async function buildPokemonDataset() {
  const data = await graphql(`{
    pokemon_v2_pokemon(
      where: { pokemon_v2_pokemonspecy: { generation_id: { _lte: 9 } } }
      limit: 2000
    ) {
      id
      name
      pokemon_v2_pokemontypes { pokemon_v2_type { name } }
      pokemon_v2_pokemonstats { base_stat pokemon_v2_stat { name } }
      pokemon_v2_pokemonspecy { id evolves_from_species_id }
      pokemon_v2_pokemonabilities { is_hidden pokemon_v2_ability { name } }
      pokemon_v2_pokemonmoves(distinct_on: move_id) { pokemon_v2_move { name } }
    }
  }`);

  const rows = data.pokemon_v2_pokemon ?? [];
  if (rows.length === 0) throw new Error("GraphQL devolvió 0 Pokémon");

  // Un Pokémon NO es última evolución si algún otro del dataset evoluciona
  // desde su species id.
  const speciesWithEvolution = [
    ...new Set(
      rows
        .map((r) => r.pokemon_v2_pokemonspecy?.evolves_from_species_id)
        .filter((id) => id !== null && id !== undefined)
    ),
  ].sort((a, b) => a - b);
  const evolvedFrom = new Set(speciesWithEvolution);

  const pokemon = rows
    .filter((row) => !EXCLUDED_FORM_PATTERN.test(row.name))
    .map((row) => {
      const types = (row.pokemon_v2_pokemontypes ?? [])
        .map((pt) => pt.pokemon_v2_type?.name)
        .filter(Boolean);
      if (types.length === 0) return null;

      const abilityRows = row.pokemon_v2_pokemonabilities ?? [];
      const abilities = abilityRows
        .filter((ar) => !ar.is_hidden)
        .map((ar) => ar.pokemon_v2_ability?.name)
        .filter(Boolean);
      const hiddenAbility =
        abilityRows.find((ar) => ar.is_hidden)?.pokemon_v2_ability?.name ?? null;

      const learnableMoveNames = [
        ...new Set(
          (row.pokemon_v2_pokemonmoves ?? [])
            .map((mr) => mr.pokemon_v2_move?.name)
            .filter(Boolean)
        ),
      ];

      const speciesId = row.pokemon_v2_pokemonspecy?.id ?? null;

      return {
        slug: row.name,
        name: row.name,
        id: row.id,
        types: types.slice(0, 2),
        stats: buildStats(row.pokemon_v2_pokemonstats),
        isFinalEvo: speciesId === null || !evolvedFrom.has(speciesId),
        abilities: abilities.length > 0 ? abilities : null,
        hiddenAbility,
        learnableMoveNames: learnableMoveNames.length > 0 ? learnableMoveNames : null,
      };
    })
    .filter(Boolean);

  return { pokemon, speciesWithEvolution };
}

async function emit(name, value) {
  const file = join(OUT_DIR, name);
  const json = JSON.stringify(value);
  await writeFile(file, json, "utf8");
  console.log(`  ✓ ${name.padEnd(28)} ${(json.length / 1024).toFixed(0)} KB`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("Descargando datos estáticos de PokéAPI...\n");

  const [typeData, abilityDisplayNames, nameIndexes, dataset] = await Promise.all([
    buildTypeRelations(),
    buildAbilityDisplayNames(),
    buildNameIndexes(),
    buildPokemonDataset(),
  ]);

  // El learnset completo (~1.1 MB) se emite aparte del resto del dataset
  // (~275 KB): solo hace falta cuando el usuario filtra recomendaciones por
  // movimiento, así que no tiene por qué estar en el camino crítico de carga.
  const core = dataset.pokemon.map((p) => {
    const rest = { ...p };
    delete rest.learnableMoveNames;
    return rest;
  });
  const learnsets = Object.fromEntries(
    dataset.pokemon
      .filter((p) => p.learnableMoveNames)
      .map((p) => [p.slug, p.learnableMoveNames])
  );

  await emit("type-relations.json", typeData);
  await emit("ability-display-names.json", abilityDisplayNames);
  await emit("name-indexes.json", nameIndexes);
  await emit("pokemon-core.json", {
    pokemon: core,
    speciesWithEvolution: dataset.speciesWithEvolution,
  });
  await emit("pokemon-learnsets.json", learnsets);

  console.log(
    `\nListo: ${typeData.types.length} tipos, ${dataset.pokemon.length} Pokémon, ` +
      `${nameIndexes.moveNames.length} movimientos, ${Object.keys(abilityDisplayNames).length} habilidades.`
  );
}

main().catch((err) => {
  console.error("\n✗ Falló la generación:", err.message);
  process.exit(1);
});
