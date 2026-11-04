import { equal, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { FAKEDEX_SPRITES_BASE, normalizeSpriteUrl } from "../components/shared/spriteUrls";
import { getZSpriteUrl } from "../components/team-builder/utils/spriteHelpers";

const old = "https://minio-p0ogk8cks8sc0k0coksoccco.195.200.15.5.sslip.io/fakedex/z/sprites";
it("migra sprites guardados sin cambiar su forma ni archivos de otros proveedores", () => {
  equal(normalizeSpriteUrl(`${old}/Battlers/006_1.png`), `${FAKEDEX_SPRITES_BASE}/Battlers/006_1.png`);
  for (const url of ["data:image/png;base64,abc", "https://other.example/sprite.png"]) equal(normalizeSpriteUrl(url), url);
});
it("resuelve especies base, formas especiales y URLs antiguas en el servidor actual", () => {
  equal(getZSpriteUrl({ id: 1 }), `${FAKEDEX_SPRITES_BASE}/Battlers/001.png`);
  equal(getZSpriteUrl({ id: 90009, dexId: 6 }), `${FAKEDEX_SPRITES_BASE}/Battlers/006_1.png`);
  equal(getZSpriteUrl({ id: 25, sprite: `${old}/Battlers/025.png` }), `${FAKEDEX_SPRITES_BASE}/Battlers/025.png`);
});
it("los catálogos de Pokémon y objetos ya publican URLs actuales", () => {
  for (const name of ["pokemon_z_completo", "items_pokemon_z"]) {
    const entries = JSON.parse(readFileSync(new URL(`../data-src/${name}.json`, import.meta.url), "utf8"));
    for (const entry of entries) if (entry.sprite) ok(entry.sprite.startsWith(`${FAKEDEX_SPRITES_BASE}/`));
  }
});
