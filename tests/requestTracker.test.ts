import { equal } from "node:assert/strict";
import { it } from "node:test";
import { createRequestTracker } from "../components/team-builder/utils/requestTracker";

it("una respuesta antigua no reemplaza una selección posterior", async () => {
  const tracker = createRequestTracker("standard");
  let selected = "";
  let resolveFirst!: (value: string) => void;
  const first = new Promise<string>((resolve) => { resolveFirst = resolve; });
  const currentFirst = tracker.begin("pokemon:0");
  const pending = first.then((value) => { if (currentFirst()) selected = value; });
  const currentSecond = tracker.begin("pokemon:0");
  if (currentSecond()) selected = await Promise.resolve("B");
  resolveFirst("A");
  await pending;
  equal(selected, "B");
});

it("borrar o reemplazar un Pokémon invalida también sus movimientos pendientes", () => {
  const tracker = createRequestTracker("standard");
  const pokemon = tracker.begin("pokemon:0");
  const move = tracker.begin("move:0:2");
  const other = tracker.begin("pokemon:1");
  tracker.invalidateSlot(0);
  equal(pokemon(), false);
  equal(move(), false);
  equal(other(), true);
});

it("cambiar dex, importar, limpiar o desmontar invalida todas las solicitudes", () => {
  const tracker = createRequestTracker("standard");
  const old = tracker.begin("pokemon:0");
  const move = tracker.begin("move:1:2");
  tracker.invalidateAll();
  const fresh = tracker.begin("pokemon:0");
  equal(old(), false);
  equal(move(), false);
  equal(fresh(), true);
});

it("editar un movimiento no cancela solicitudes de otros espacios", () => {
  const tracker = createRequestTracker("standard");
  const edited = tracker.begin("move:0:0");
  const other = tracker.begin("move:0:1");
  tracker.invalidate("move:0:0");
  equal(edited(), false);
  equal(other(), true);
});
