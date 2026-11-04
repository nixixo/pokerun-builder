// tests/typeRelations.test.ts
//
// Hay DOS tablas de tipos en la app y ninguna sabe de la otra:
//
//   - components/guia/typeChart.ts, escrita a mano, la que usa la Guía.
//   - public/pokeapi/type-relations.json, congelada de PokéAPI, la que usa el
//     Builder para su análisis defensivo.
//
// Mientras coincidan, la Guía y el Builder dicen lo mismo del mismo equipo. Si
// alguien regenera el JSON con `npm run data:pokeapi` y PokéAPI ha cambiado
// algo, empezarían a discrepar sin que nada falle: los dos seguirían
// calculando, cada uno su verdad. Este test es lo que lo impide.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_TYPES } from "../components/guia/typeChart";
import {
  TIPOS,
  TYPE_RELATIONS,
  TYPE_RELATIONS_INVERSAS,
  relacionesSegunReglas,
} from "../components/guia/typeRelations";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

type RelacionesApi = {
  relations: Record<
    string,
    { double_damage_to: { name: string }[]; half_damage_to: { name: string }[]; no_damage_to: { name: string }[] }
  >;
};

const nombres = (lista: { name: string }[]) => [...lista.map((x) => x.name)].sort();

describe("las dos tablas de tipos dicen lo mismo", () => {
  const api: RelacionesApi = JSON.parse(
    readFileSync(join(RAIZ, "public", "pokeapi", "type-relations.json"), "utf8")
  );

  for (const tipo of ALL_TYPES) {
    it(`${tipo}: x2 / x0.5 / x0 coinciden con PokéAPI`, () => {
      const guia = TYPE_RELATIONS[tipo];
      const builder = api.relations[tipo];
      strictEqual(Boolean(builder), true, `${tipo} no está en type-relations.json`);

      deepStrictEqual(nombres(guia.double_damage_to), nombres(builder.double_damage_to));
      deepStrictEqual(nombres(guia.half_damage_to), nombres(builder.half_damage_to));
      deepStrictEqual(nombres(guia.no_damage_to), nombres(builder.no_damage_to));
    });
  }
});

describe("tabla invertida", () => {
  it("no le queda ninguna inmunidad", () => {
    for (const tipo of TIPOS) {
      deepStrictEqual(TYPE_RELATIONS_INVERSAS[tipo].no_damage_to, []);
    }
  });

  it("lo que era inmune ahora recibe daño doble", () => {
    // Normal no hacía nada a Fantasma; invertido le pega x2.
    strictEqual(TYPE_RELATIONS_INVERSAS.normal.double_damage_to.some((t) => t.name === "ghost"), true);
    strictEqual(TYPE_RELATIONS_INVERSAS.dragon.double_damage_to.some((t) => t.name === "fairy"), true);
  });

  it("cada tipo tiene tantos x2 como x0.5 tenía (más sus inmunidades)", () => {
    for (const tipo of TIPOS) {
      const normal = TYPE_RELATIONS[tipo];
      const inversa = TYPE_RELATIONS_INVERSAS[tipo];
      strictEqual(
        inversa.double_damage_to.length,
        normal.half_damage_to.length + normal.no_damage_to.length,
        `${tipo}`
      );
      strictEqual(inversa.half_damage_to.length, normal.double_damage_to.length, `${tipo}`);
    }
  });

  it("relacionesSegunReglas devuelve la tabla que toca", () => {
    strictEqual(relacionesSegunReglas(false), TYPE_RELATIONS);
    strictEqual(relacionesSegunReglas(true), TYPE_RELATIONS_INVERSAS);
  });
});
