// scripts/build-data.mjs
//
// Prepara los JSON de datos del proyecto para servirlos al cliente.
//
// Las fuentes viven en data-src/ (fuera de public/, así no se sirven crudas) y
// acá se emiten a public/generated/ con dos optimizaciones:
//
//   1. Minificado. Los archivos fuente vienen pretty-printed y el espacio en
//      blanco es peso muerto: pokemon_z_completo.json pasa de 2672 KB a
//      1513 KB (-43%) sin perder un solo dato.
//
//   2. Separación del learnset de la Pokédex Z. Los campos moves/tmMoves/
//      eggMoves/tutorMoves son el 70% del archivo, pero solo hacen falta
//      cuando el usuario mira los movimientos de un Pokémon. El resto de la
//      app (tarjetas, sprites, stats, análisis de tipos, y la guía entera,
//      que solo quiere sprites) funciona sin ellos.
//
// Uso:  node scripts/build-data.mjs   — corre solo en `npm run build`.

import catalogManifest from "../data-src/builder-catalogs.json" with { type: "json" };
import { prepareCatalog } from "./prepare-catalog.mjs";
import { validateGuideIds } from "./guia-identities.mjs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SRC_DIR = join(process.cwd(), "data-src");
const OUT_DIR = join(process.cwd(), "public", "generated");
const POKEAPI_DIR = join(process.cwd(), "public", "pokeapi");

/**
 * public/pokeapi/ NO se genera acá: lo escribe `npm run data:pokeapi`, que sale
 * a la red contra PokéAPI y por eso no puede correr en cada build. Es decir, es
 * la única carpeta de datos que tiene que estar SÍ O SÍ versionada.
 *
 * Y si falta, la app no se rompe de forma visible: son cuatro `fetch` sueltos
 * en components/team-builder/data/staticPokeData.ts que fallan por su cuenta y
 * dejan el Builder sin tabla de tipos, sin autocompletado y sin candidatos —
 * con la página renderizando de lo más normal. Un 404 silencioso en producción.
 *
 * Antes que eso, que reviente el build acá y diga qué hacer.
 */
const ARCHIVOS_POKEAPI = [
  "type-relations.json",
  "name-indexes.json",
  "ability-display-names.json",
  "pokemon-core.json",
  "pokemon-learnsets.json",
];

async function verificarPokeapi() {
  const faltan = [];
  for (const nombre of ARCHIVOS_POKEAPI) {
    try {
      await access(join(POKEAPI_DIR, nombre));
    } catch {
      faltan.push(nombre);
    }
  }
  if (faltan.length === 0) return;

  throw new Error(
    `faltan ${faltan.length} archivo(s) en public/pokeapi/:\n` +
      faltan.map((f) => `      · ${f}`).join("\n") +
      `\n\n    Esa carpeta no la genera este script. Para rehacerla:\n` +
      `      npm run data:pokeapi\n` +
      `    (pide datos a pokeapi.co, así que necesita red)\n\n` +
      `    Si estás en un checkout limpio, lo más probable es que la carpeta\n` +
      `    no esté versionada. Debe estarlo.`
  );
}

async function emit(name, value) {
  const json = JSON.stringify(value);
  const target = join(OUT_DIR, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, json, "utf8");
  return json.length;
}

async function readCatalogs() {
  const catalogs = [];
  const outputPaths = new Set();
  for (const [id, files] of Object.entries(catalogManifest)) {
    if (id === "standard" || id === "catalog-test" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`ID de catálogo inválido: ${id}`);
    }
    const keys = ["pokemon", "moves", "abilities", "items", "learnsets"];
    for (const key of keys) {
      if (!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.json$/.test(files[key] ?? "")) {
        throw new Error(`Catálogo ${id}: ruta inválida para ${key}.`);
      }
    }
    for (const key of keys) {
      const path = files[key].toLowerCase();
      if (path === "builder-catalogs.json" || outputPaths.has(path)) {
        throw new Error(`Catálogo ${id}: ruta de salida duplicada o reservada ${files[key]}.`);
      }
      outputPaths.add(path);
    }
    let sourceSize = 0;
    const entries = await Promise.all(keys.slice(0, -1).map(async (key) => {
      try {
        const source = await readFile(join(SRC_DIR, files[key]), "utf8");
        sourceSize += source.length;
        return [key, JSON.parse(source)];
      } catch (error) {
        throw new Error(`Catálogo ${id}: no se pudo leer ${files[key]}: ${error.message}`);
      }
    }));
    const data = Object.fromEntries(entries);
    const prepared = prepareCatalog(id, data);
    for (const warning of prepared.warnings) console.warn(`  ⚠ ${id}: ${warning}`);
    catalogs.push({ files, data, prepared, sourceSize });
  }
  return catalogs;
}

async function main() {
  await verificarPokeapi();
  const catalogs = await readCatalogs();
  const catalogPaths = new Set(catalogs.flatMap(({ files }) =>
    [files.pokemon, files.learnsets, files.moves, files.abilities, files.items]));
  await mkdir(OUT_DIR, { recursive: true });

  // Los .raw.json son la ENTRADA de scripts/clean-guia-names.mjs, no un dato
  // que la app consuma: emitirlos duplicaría 775 KB en public/ para nada.
  const sources = (await readdir(SRC_DIR)).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".raw.json") && f !== "builder-catalogs.json" && !catalogPaths.has(f)
  );
  let rawTotal = 0;
  let outTotal = 0;

  for (const name of sources) {
    const raw = await readFile(join(SRC_DIR, name), "utf8");
    rawTotal += raw.length;
    if (name === "pokemon_z_guia.json") validateGuideIds(JSON.parse(raw));

    const size = await emit(name, JSON.parse(raw));
    outTotal += size;
    console.log(`  ${name.padEnd(30)} ${kb(raw.length)} → ${kb(size)}`);
  }

  for (const { files, data, prepared, sourceSize } of catalogs) {
    rawTotal += sourceSize;
    for (const [key, value] of Object.entries({
      ...data, pokemon: prepared.core, learnsets: prepared.learnsets,
    })) {
      const size = await emit(files[key], value);
      outTotal += size;
      console.log(`  ${files[key].padEnd(30)} ${kb(size)}`);
    }
  }
  console.log(`\n  ${"TOTAL".padEnd(30)} ${kb(rawTotal)} → ${kb(outTotal)}`);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0).padStart(5)} KB`;

main().catch((err) => {
  console.error("\n✗ Falló la preparación de datos:", err.message);
  process.exit(1);
});
