// tests/normalizar.test.ts
//
// Estas cuatro funciones sustituyeron a doce copias escritas a mano que NO
// hacían todas lo mismo. Cruzan nombres entre JSON de orígenes distintos, así
// que un cambio aquí no rompe nada visible: deja un Pokémon sin sprite o un
// objeto sin descripción, y a saber cuándo se nota. Por eso están fijadas.

import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { clave, claveEspacios, claveEspecie, sinTildes } from "../components/shared/normalizar";

describe("sinTildes", () => {
  it("quita tildes y diéresis sin tocar nada más", () => {
    strictEqual(sinTildes("Eléctrico"), "Electrico");
    strictEqual(sinTildes("PSÍQUICO"), "PSIQUICO");
    strictEqual(sinTildes("  Pingüino  "), "  Pinguino  ");
  });

  it("la ñ TAMBIÉN se descompone, y eso es lo que se quiere", () => {
    // NFD parte la ñ en n + tilde combinante (U+0303), que cae dentro del
    // rango que se borra. No es un descuido: las tablas de alias del proyecto
    // están escritas contando con ello — ver ALIAS_ITEM en useItemSprites,
    // cuya clave es "flor repelente pequena", sin eñe, para casar con
    // "Flor Rep. Pequeña".
    strictEqual(sinTildes("Peña"), "Pena");
    strictEqual(clave("Flor Rep. Pequeña"), "flor rep. pequena");
  });
});

describe("clave", () => {
  it("minúsculas, sin tildes, sin espacios en los extremos", () => {
    strictEqual(clave("  Torre Oscura  "), "torre oscura");
    strictEqual(clave("PSÍQUICO"), "psiquico");
  });

  it("respeta los espacios de dentro", () => {
    strictEqual(clave("Torre  Oscura"), "torre  oscura");
  });
});

describe("claveEspacios", () => {
  it("además colapsa los espacios interiores", () => {
    strictEqual(claveEspacios("Torre  Oscura"), "torre oscura");
    strictEqual(claveEspacios("  MANANTIAL   PROFUNDO "), "manantial profundo");
  });
});

describe("claveEspecie", () => {
  it("los símbolos de género pasan a letra", () => {
    strictEqual(claveEspecie("Nidoran♀"), "nidoranf");
    strictEqual(claveEspecie("Nidoran♂"), "nidoranm");
  });

  it("puntos y apóstrofos fuera", () => {
    strictEqual(claveEspecie("Mr. Mime"), "mr mime");
    strictEqual(claveEspecie("Sirfetch'd"), "sirfetchd");
    strictEqual(claveEspecie("Sirfetch’d"), "sirfetchd", "el apóstrofo curvo también");
  });

  it("guiones y paréntesis pasan a espacio, y se colapsan", () => {
    strictEqual(claveEspecie("Raichu-Alola"), "raichu alola");
    strictEqual(claveEspecie("Raichu (Alola)"), "raichu alola");
    strictEqual(claveEspecie("Porygon-Z"), "porygon z");
  });

  it("las tres grafías de Raichu de Alola caen en la misma clave", () => {
    const esperado = "raichu alola";
    strictEqual(claveEspecie("Raichu-Alola"), esperado);
    strictEqual(claveEspecie("Raichu (Alola)"), esperado);
    strictEqual(claveEspecie("  RAICHU   ALOLA  "), esperado);
  });
});
