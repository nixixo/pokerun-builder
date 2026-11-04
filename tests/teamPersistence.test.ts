import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizarEquipo, normalizarPlantillas } from "../components/team-builder/utils/validation";
import { crearAlmacenLocal } from "../components/shared/almacenLocal";

const team = () => Array.from({ length: 6 }, () => ({
  name: "Pikachu", isFake: false, types: ["electric"],
  moves: Array.from({ length: 4 }, () => ({ name: "", category: "Physical", type: null })),
}));

describe("equipos importados y persistidos", () => {
  it("restaura y normaliza un equipo histórico con un tipo sin modificar su origen", () => {
    const original = team();
    const result = normalizarEquipo(JSON.parse(JSON.stringify(original)));
    ok(result);
    deepEqual(result[0].types, ["electric", ""]);
    equal(result[0].sprite, null);
    deepEqual(original[0].types, ["electric"]);
    deepEqual(normalizarEquipo(JSON.parse(JSON.stringify(result))), result);
  });
  it("rechaza seis valores nulos y estructuras incompletas", () => {
    for (const invalid of [null, {}, [], Array(6).fill(null), Array(6).fill({}), team().slice(1)]) {
      equal(normalizarEquipo(invalid), null);
    }
  });
  it("valida también campos opcionales usados por los cálculos y la interfaz", () => {
    const valid = team();
    for (const patch of [
      { stats: {} }, { stats: "invalid" }, { abilities: [null] },
      { sprite: 42 }, { spriteTransform: { x: 0, y: 0, zoom: Infinity } },
      { learnMethods: { tackle: { type: "unknown" } } },
      { moves: [{ name: "x", category: "wrong", type: "normal" }, ...valid[0].moves.slice(1)] },
    ]) equal(normalizarEquipo([{ ...valid[0], ...patch }, ...valid.slice(1)]), null);
  });
  it("valida y migra equipos dentro de plantillas", () => {
    const saved = { id: 1, name: "Equipo", savedAt: "2026-11-04", team: team() };
    const normalized = normalizarPlantillas([saved]);
    ok(normalized);
    deepEqual(normalized[0].team[0].types, ["electric", ""]);
    equal(normalizarPlantillas([{ ...saved, team: Array(6).fill(null) }]), null);
    equal(normalizarPlantillas([{ ...saved, name: null }]), null);
  });
});

describe("almacenamiento recuperable", () => {
  it("conserva cambios en memoria ante cuota agotada y reintenta el último valor", () => {
    const disk = new Map([["team", "old"]]);
    let blocked = true;
    const store = crearAlmacenLocal(() => ({
      getItem: (key) => disk.get(key) ?? null,
      setItem: (key, value) => { if (blocked) throw new Error("quota"); disk.set(key, value); },
    }));
    let notices = 0;
    const unsubscribe = store.suscribir(() => notices++);
    store.escribir("team", "first");
    store.escribir("team", "latest");
    equal(store.leer("team"), "latest");
    equal(disk.get("team"), "old");
    equal(store.hayPendientes(), true);
    store.reintentar();
    equal(store.hayPendientes(), true);
    blocked = false;
    store.reintentar();
    equal(disk.get("team"), "latest");
    equal(store.hayPendientes(), false);
    equal(notices, 4);
    unsubscribe();
  });
  it("permite editar aunque el acceso mismo a localStorage esté bloqueado", () => {
    const store = crearAlmacenLocal(() => { throw new Error("SecurityError"); });
    equal(store.leer("key"), null);
    store.escribir("key", "changed");
    equal(store.leer("key"), "changed");
    equal(store.hayPendientes(), true);
  });
  it("separa las pokédex y recupera la clave antigua sin escribir al leer", () => {
    const disk = new Map([["legacy", JSON.stringify(team())]]);
    const store = crearAlmacenLocal(() => ({
      getItem: (key) => disk.get(key) ?? null,
      setItem: (key, value) => { disk.set(key, value); },
    }));
    const standard = normalizarEquipo(JSON.parse(store.leer("standard", "legacy")!));
    ok(standard);
    equal(disk.has("standard"), false);
    equal(store.leer("pokemon-z"), null);
    store.escribir("pokemon-z", JSON.stringify(standard.map((s) => ({ ...s, name: "Z" }))));
    equal(JSON.parse(store.leer("standard", "legacy")!)[0].name, "Pikachu");
    equal(JSON.parse(store.leer("pokemon-z")!)[0].name, "Z");
    // Limpiar guarda un equipo vacío: no elimina la clave y no resucita el legado.
    store.escribir("standard", JSON.stringify(standard.map((s) => ({ ...s, name: "" }))));
    equal(JSON.parse(store.leer("standard", "legacy")!)[0].name, "");
  });
  it("observa cambios externos y mantiene la última lectura si luego se bloquea el acceso", () => {
    let value = "first";
    let blocked = false;
    const store = crearAlmacenLocal(() => {
      if (blocked) throw new Error("blocked");
      return { getItem: () => value, setItem: () => {} };
    });
    equal(store.leer("key"), "first");
    value = "external";
    store.avisar();
    equal(store.leer("key"), "external");
    blocked = true;
    equal(store.leer("key"), "external");
  });
});
