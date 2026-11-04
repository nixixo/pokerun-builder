import { deepEqual, equal, rejects } from "node:assert/strict";
import { it } from "node:test";
import { createPokemonZResources } from "../components/team-builder/data/pokemonZData";

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
  const resources = createPokemonZResources("/test/retry");
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
  const resources = createPokemonZResources("/test/concurrent");
  const [a, b] = await Promise.all([resources.pokemon(), resources.pokemon()]);
  equal(count, 2);
  deepEqual(a, b);
  deepEqual(a[0].tmMoves, ["TACKLE"]);
});

it("un HTTP fallido no se interpreta como un catálogo vacío y puede recuperarse", async (t) => {
  let fail = true;
  t.mock.method(globalThis, "fetch", async () => fail ? new Response("[]", { status: 404 }) : Response.json([]));
  const resources = createPokemonZResources("/test/http");
  await rejects(resources.moves(), /404/);
  fail = false;
  deepEqual(await resources.moves(), []);
});
