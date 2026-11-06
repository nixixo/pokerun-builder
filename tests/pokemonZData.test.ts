import { deepEqual, equal, rejects } from "node:assert/strict";
import { it } from "node:test";
import { createGameCatalog } from "../components/team-builder/data/gameCatalog";

const catalogFiles = (base: string) => ({
  pokemon: `${base}/pokemon_z_completo.json`,
  learnsets: `${base}/pokemon_z_learnsets.json`,
  moves: `${base}/moves.json`,
  abilities: `${base}/abilities_descriptions.json`,
  items: `${base}/items.json`,
});

it("reintenta learnsets fallidos sin descargar de nuevo el núcleo ni otros recursos", async (t) => {
  const calls = new Map<string, number>();
  let fail = true;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const path = url.split("/").at(-1)!;
    calls.set(path, (calls.get(path) ?? 0) + 1);
    if (path === "pokemon_z_learnsets.json" && fail) return new Response("unavailable", { status: 503 });
    const body = path === "pokemon_z_completo.json" ? [{ id: 25, name: "Pikachu" }] :
      path === "pokemon_z_learnsets.json" ? { 25: { moves: [{ move: "THUNDERBOLT", level: 10 }] } } :
      path === "moves.json" ? [{ internal_name: "THUNDERBOLT", name: { es: "Rayo", en: "Thunderbolt" }, type: "ELECTRIC" }] : {};
    return Response.json(body);
  });
  const resources = createGameCatalog(catalogFiles("/test/retry"));
  const results = await Promise.allSettled([resources.pokemon(), resources.moves(), resources.abilities()]);
  equal(results[0].status, "rejected");
  equal(results[1].status, "fulfilled");
  fail = false;
  const [pokemon, moves] = await Promise.all([resources.pokemon(), resources.moves(), resources.abilities()]);
  deepEqual(pokemon[0].moves, [{ move: "THUNDERBOLT", level: 10 }]);
  equal(moves[0].name, "Rayo");
  equal(calls.get("pokemon_z_completo.json"), 1);
  equal(calls.get("pokemon_z_learnsets.json"), 2);
  equal(calls.get("moves.json"), 1);
  equal(calls.get("abilities_descriptions.json"), 1);
});

it("deduplica selecciones concurrentes y espera los movimientos aprendibles", async (t) => {
  let count = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    count++;
    return Response.json(url.endsWith("pokemon_z_completo.json") ? [{ id: 1 }] : { 1: { tmMoves: ["TACKLE"] } });
  });
  const resources = createGameCatalog(catalogFiles("/test/concurrent"));
  const [a, b] = await Promise.all([resources.pokemon(), resources.pokemon()]);
  equal(count, 2);
  deepEqual(a, b);
  deepEqual(a[0].tmMoves, ["TACKLE"]);
});

it("un HTTP fallido no se interpreta como un catálogo vacío y puede recuperarse", async (t) => {
  let fail = true;
  t.mock.method(globalThis, "fetch", async () => fail ? new Response("[]", { status: 404 }) : Response.json([]));
  const resources = createGameCatalog(catalogFiles("/test/http"));
  await rejects(resources.moves(), /404/);
  fail = false;
  deepEqual(await resources.moves(), []);
});

it("separa catálogos de juegos que reutilizan los mismos IDs", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const [, game, file] = url.split("/");
    if (file === "pokemon_z_completo.json") return Response.json([{ id: 25, name: game }]);
    if (file === "pokemon_z_learnsets.json") return Response.json({ 25: { tmMoves: [game] } });
    if (file === "items.json") return Response.json([{ id: 1, name: game }]);
    throw new Error(`Recurso inesperado: ${url}`);
  });
  const first = createGameCatalog(catalogFiles("/first"));
  const second = createGameCatalog(catalogFiles("/second"));
  const [firstPokemon, secondPokemon, firstItems, secondItems] = await Promise.all([
    first.pokemon(), second.pokemon(), first.items(), second.items(),
  ]);
  deepEqual(firstPokemon[0].tmMoves, ["first"]);
  deepEqual(secondPokemon[0].tmMoves, ["second"]);
  equal(firstItems[0].name, "first");
  equal(secondItems[0].name, "second");
});
