// tests/reglasCombate.test.ts
//
// El combate inverso se detecta LEYENDO EL DATO, no con una lista de nombres a
// mano: la guía escribe "Combate inverso" en las notas. Estos tests fijan dónde
// se mira, porque el volcado del .docx no siempre deja el texto en el mismo
// campo y perderlo significa que la Guía diga justo lo contrario de la verdad.

import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { REGLAS_NORMALES, reglasDeCombate } from "../components/guia/reglasCombate";
import type { Zone } from "../components/guia/types";

type Trainer = Zone["entrenadores"][number];

/** Un entrenador mínimo al que ir colgando campos. */
function entrenador(campos: Partial<Trainer> = {}): Trainer {
  return { nombre: "Fulano", equipo: [], ...campos } as Trainer;
}

describe("reglasDeCombate", () => {
  it("sin entrenador, reglas normales", () => {
    strictEqual(reglasDeCombate(null).inverso, false);
    strictEqual(reglasDeCombate(undefined).inverso, false);
    strictEqual(REGLAS_NORMALES.inverso, false);
  });

  it("un combate corriente no es inverso", () => {
    strictEqual(reglasDeCombate(entrenador({ notas: "Lleva pociones." })).inverso, false);
  });

  it("lo detecta en las notas del entrenador", () => {
    strictEqual(
      reglasDeCombate(entrenador({ notas: "Ojo: combate inverso en este gimnasio." })).inverso,
      true
    );
  });

  it("lo detecta en la procedencia", () => {
    strictEqual(reglasDeCombate(entrenador({ procedencia: "Combate Inverso" })).inverso, true);
  });

  it("lo detecta en la nota o el consejo de cualquier Pokémon del equipo", () => {
    const enNota = entrenador({
      equipo: [{ especie: "Sigilyph", nota: "combate inverso" }],
    } as Partial<Trainer>);
    strictEqual(reglasDeCombate(enNota).inverso, true);

    const enConsejo = entrenador({
      equipo: [
        { especie: "Uno" },
        { especie: "Dos", consejo: "Recuerda que es un COMBATE INVERSO." },
      ],
    } as Partial<Trainer>);
    strictEqual(reglasDeCombate(enConsejo).inverso, true);
  });

  it("no le importan mayúsculas ni cuántos espacios haya", () => {
    strictEqual(reglasDeCombate(entrenador({ notas: "COMBATE   INVERSO" })).inverso, true);
    strictEqual(reglasDeCombate(entrenador({ notas: "combate\ninverso" })).inverso, true);
  });

  it("no se dispara con 'inverso' a secas", () => {
    strictEqual(reglasDeCombate(entrenador({ notas: "El orden inverso del equipo." })).inverso, false);
  });
});
