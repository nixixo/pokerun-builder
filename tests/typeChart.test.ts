// tests/typeChart.test.ts
//
// La tabla de tipos y su versión invertida (el combate del Regente Hibis).
//
// El caso que da nombre a todo esto sale de la propia guía, que escribe
// "Sigilyph es débil x4 a Lucha". Sigilyph es Psíquico/Volador y con la tabla
// normal resiste Lucha a 0.25x: dos resistencias de 0.5. Invertida, esas dos
// resistencias pasan a 2 y el resultado es x4. Si alguien invirtiera el
// RESULTADO en vez de la tabla, saldría x2 y nadie lo notaría a simple vista.

import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_TYPES, getEffectiveness } from "../components/guia/typeChart";

describe("getEffectiveness — tabla normal", () => {
  it("supereficaz, resistido y neutro contra un solo tipo", () => {
    strictEqual(getEffectiveness("fire", ["grass"]), 2);
    strictEqual(getEffectiveness("fire", ["water"]), 0.5);
    strictEqual(getEffectiveness("fire", ["normal"]), 1);
  });

  it("multiplica los dos tipos del defensor", () => {
    // Charizard (Fuego/Volador): Roca le pega x2 por Fuego y x2 por Volador.
    strictEqual(getEffectiveness("rock", ["fire", "flying"]), 4);
    // Sigilyph (Psíquico/Volador) resiste Lucha por los dos lados.
    strictEqual(getEffectiveness("fighting", ["psychic", "flying"]), 0.25);
  });

  it("respeta las inmunidades", () => {
    strictEqual(getEffectiveness("normal", ["ghost"]), 0);
    strictEqual(getEffectiveness("ground", ["flying"]), 0);
    strictEqual(getEffectiveness("dragon", ["fairy"]), 0);
    // Una inmunidad manda sobre cualquier otra cosa del otro tipo.
    strictEqual(getEffectiveness("electric", ["ground", "water"]), 0);
  });

  it("es la tabla moderna: Acero ya no resiste Siniestro ni Fantasma", () => {
    strictEqual(getEffectiveness("dark", ["steel"]), 1);
    strictEqual(getEffectiveness("ghost", ["steel"]), 1);
  });
});

describe("getEffectiveness — combate inverso", () => {
  it("el caso que dice la guía: Sigilyph débil x4 a Lucha", () => {
    strictEqual(getEffectiveness("fighting", ["psychic", "flying"], true), 4);
  });

  it("intercambia supereficaz y resistido", () => {
    strictEqual(getEffectiveness("fire", ["grass"], true), 0.5);
    strictEqual(getEffectiveness("fire", ["water"], true), 2);
  });

  it("el neutro se queda igual", () => {
    strictEqual(getEffectiveness("fire", ["normal"], true), 1);
    strictEqual(getEffectiveness("normal", ["water"], true), 1);
  });

  it("las inmunidades pasan a daño doble", () => {
    strictEqual(getEffectiveness("normal", ["ghost"], true), 2);
    strictEqual(getEffectiveness("ground", ["flying"], true), 2);
    strictEqual(getEffectiveness("dragon", ["fairy"], true), 2);
  });

  it("invierte TIPO A TIPO, no el resultado final", () => {
    // Esta es la diferencia de fondo. Con la tabla invertida: Roca contra
    // Fuego/Volador es 0.5 * 0.5 = 0.25. Invirtiendo el resultado (x4 -> x0.25)
    // saldría lo mismo aquí, así que hace falta un caso donde NO coincida:
    strictEqual(getEffectiveness("rock", ["fire", "flying"], true), 0.25);
    // Electric contra Ground/Water: normal es 0 (inmune).
    strictEqual(getEffectiveness("electric", ["ground", "water"]), 0);
    // Invertido tipo a tipo: inmunidad -> 2, y Agua (x2) -> 0.5. Total 1.
    // Si se invirtiera el resultado, un 0 no tendría inverso definido.
    strictEqual(getEffectiveness("electric", ["ground", "water"], true), 1);
  });

  it("nunca deja un 0: en inverso no hay inmunidades", () => {
    for (const atacante of ALL_TYPES) {
      for (const defensor of ALL_TYPES) {
        const m = getEffectiveness(atacante, [defensor], true);
        strictEqual(m > 0, true, `${atacante} -> ${defensor} dio ${m}`);
      }
    }
  });
});

describe("ALL_TYPES", () => {
  it("son los 18 tipos jugables, sin repetidos", () => {
    strictEqual(ALL_TYPES.length, 18);
    deepStrictEqual([...new Set(ALL_TYPES)].length, 18);
  });
});
