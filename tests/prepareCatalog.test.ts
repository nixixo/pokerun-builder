import { deepEqual, equal, throws } from "node:assert/strict";
import { it } from "node:test";
import { prepareCatalog } from "../scripts/prepare-catalog.mjs";
import fixture from "./fixtures/third-catalog.json" with { type: "json" };

it("prepara el núcleo y las listas de aprendizaje sin cambiar los IDs", () => {
  const result = prepareCatalog("fixture", fixture);
  equal(result.core[0].id, 25);
  equal(Object.hasOwn(result.core[0], "moves"), false);
  deepEqual(Object.entries(result.learnsets)[0], ["25", { moves: [{ move: "ECODEPRUEBA", level: 5 }] }]);
});

it("rechaza IDs duplicados y referencias a movimientos inexistentes", () => {
  const duplicate = structuredClone(fixture);
  duplicate.pokemon[1].id = duplicate.pokemon[0].id;
  throws(() => prepareCatalog("fixture", duplicate), /ID duplicado 25/);

  const missing = structuredClone(fixture);
  missing.pokemon[0].moves![0].move = "NOEXISTE";
  throws(() => prepareCatalog("fixture", missing), /Nimbo.*NOEXISTE/);

  const duplicateMove = { ...fixture, moves: [...fixture.moves, fixture.moves[0]] };
  throws(() => prepareCatalog("fixture", duplicateMove), /movimiento duplicado ECODEPRUEBA/);
});
