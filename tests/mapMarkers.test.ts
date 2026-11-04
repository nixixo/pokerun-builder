import { deepEqual, equal, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { getMapMarkers } from "../components/guia/useMapMarkers";
import type { Zone } from "../components/guia/types";

const zones: Zone[] = JSON.parse(readFileSync(new URL("../data-src/pokemon_z_guia.json", import.meta.url), "utf8"));
const source = JSON.parse(readFileSync(new URL("../mapa.json", import.meta.url), "utf8"));

it("publica todos los puntos del JSON con sus coordenadas originales y una zona válida", () => {
  const markers = getMapMarkers(zones);
  equal(markers.length, source.length);
  ok(markers.length > 0);
  for (const marker of markers) {
    const original = source.find((m: { id: string }) => m.id === marker.id);
    equal(marker.xPct, original.xPct);
    equal(marker.yPct, original.yPct);
    equal(zones[marker.zoneIndex].id, original.zoneId);
  }
});

it("reordenar zonas conserva los destinos y modificar el resultado no altera el mapa publicado", () => {
  const before = getMapMarkers(zones);
  const reordered = getMapMarkers([...zones].reverse());
  deepEqual(before.map((m) => m.zoneId), reordered.map((m) => m.zoneId));
  before[0].xPct = -1;
  equal(getMapMarkers(zones)[0].xPct, source[0].xPct);
});
