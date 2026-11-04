import { deepEqual, equal, notEqual, ok, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { collectionId, collectionCodecs, visitCodec, activeZoneCodec } from "../components/guia/progressIdentity";
import { preserveGuideIds, validateGuideIds } from "../scripts/guia-identities.mjs";
import { parseMarkers } from "../components/guia/useMapMarkers";
import type { Zone } from "../components/guia/types";

const zones: Zone[] = JSON.parse(readFileSync(new URL("../data-src/pokemon_z_guia.json", import.meta.url), "utf8"));
const empty = new Set<string>();

it("los IDs publicados son únicos y sobreviven a regeneración y reordenamiento", () => {
  validateGuideIds(zones);
  const reordered = structuredClone(zones).reverse();
  preserveGuideIds(reordered, zones);
  deepEqual(new Set(reordered.map((z) => z.id)), new Set(zones.map((z) => z.id)));
});

it("las visitas antiguas con nombres duplicados conservan todas sus marcas", () => {
  const duplicates = zones.filter((z) => z.zona === zones.find((z, i) => zones.findIndex((other) => other.zona === z.zona) !== i)!.zona);
  ok(duplicates.length > 1);
  const migrated = visitCodec.leer(JSON.stringify([duplicates[0].zona]), empty);
  duplicates.forEach((z) => ok(migrated.has(z.id)));
  migrated.delete(duplicates[0].id);
  ok(migrated.has(duplicates[1].id));
  deepEqual(visitCodec.leer(visitCodec.escribir(migrated), empty), migrated);
});

it("una MT marcada sigue siendo la misma al cambiar el orden de zonas y MTs", () => {
  const index = zones.findIndex((z) => z.mts.length > 1);
  const selected = zones[index].mts[0].id;
  const migrated = collectionCodecs.mts.leer(JSON.stringify([`${index}-0`]), empty);
  ok(migrated.has(selected));
  const zone = structuredClone(zones[index]);
  zone.mts.reverse();
  equal(collectionId(zone, "mts", zone.mts.length - 1), selected);
  notEqual(collectionId(zone, "mts", 0), selected);
});

it("migra páginas adicionales, última zona y marcadores del mapa", () => {
  const index = zones.findIndex((z) => z.pagina_alquimia?.adicionales?.length);
  const zone = zones[index];
  const migrated = collectionCodecs["paginas-alquimia"].leer(JSON.stringify([`${index}-1`]), empty);
  ok(migrated.has(collectionId(zone, "paginas-alquimia", 1)));
  equal(activeZoneCodec.leer(String(index), null), zone.id);
  const markers = parseMarkers([{ id: "test", zoneIndex: index, xPct: 10, yPct: 20 }]);
  equal(markers?.[0].zoneId, zone.id);
  equal(parseMarkers([{ id: "bad", zoneIndex: index, xPct: 101, yPct: 20 }]), null);
});

it("el build rechaza datos sin IDs o con IDs repetidos", () => {
  const modified = structuredClone(zones);
  modified[0].id = modified[1].id;
  throws(() => validateGuideIds(modified), /duplicado/);
});

it("una regeneración ambigua se detiene antes de reasignar progreso", () => {
  const first = structuredClone(zones[0]);
  const second = { ...structuredClone(first), id: "another", notas_generales: ["Otra visita"] };
  const changed = { ...structuredClone(first), notas_generales: ["Cambio ambiguo"] };
  throws(() => preserveGuideIds([changed], [first, second]), /ambigua/);
});
