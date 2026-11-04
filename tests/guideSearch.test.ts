import { deepEqual, equal, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { createGlobalSearchIndex, searchGlobalIndex } from "../components/guia/useGlobalSearchIndex";
import { countCheckedInhabitants, countCheckedMachines, getMachineIdsForNumber, isMachineNumberChecked } from "../components/guia/useGuideCollections";
import { COLLECTION_TOTALS } from "../components/guia/collectionTotals";
import type { Zone } from "../components/guia/types";

const zones: Zone[] = JSON.parse(readFileSync(new URL("../data-src/pokemon_z_guia.json", import.meta.url), "utf8"));

it("la búsqueda encuentra cada categoría y no depende de tildes o mayúsculas", () => {
  const zone = structuredClone(zones[0]);
  zone.zona = "Zona Única";
  zone.conexiones = ["Cueva del Dragón"];
  zone.pokemon_salvajes = [{ nombre: "Pokémon Ágil", metodo: "hierba", porcentaje: "20%", drop: "Baya Azul", nivel: "8", nota: "Solo de noche", requisitos: ["surf"] }];
  zone.objetos = [{ nombre: "Poción Máxima", detalle: "Tras la montaña" }];
  zone.mts = [{ id: "mt-test", numero: "MT99", movimiento: "Rayo Lunar", contexto: "En el tejado" }];
  zone.entrenadores = [{ nombre: "Entrenadora Úrsula", equipo: [{ especie: "Flabébé", nivel: "12", objeto: "Baya", habilidad: "Ímpetu", naturaleza: "Mansa", movimientos: ["Rayo Lunar"], consejo: "Usa energía" }], notas: "Combate doble", procedencia: "Verificado" }];
  zone.intercambios = [{ detalle: "Cambia un Eevee por un Nidoran" }];
  zone.conversiones = [{ de: "Rattata", a: "Raticate", nota: "Con una piedra" }];
  zone.inicial_rival = [{ siTuInicial: "AGUA", detalle: "Froakie nivel 5" }];
  zone.pagina_alquimia = { presente: true, descripcion: "Receta de poción" };
  zone.regalo_pokemon = { presente: true, detalle: "Te regalan un Eevee" };
  zone.nido_alfa = { id: "nest-test", tipo: "Dragón", detalle: "Tras el río" };
  zone.habitante_acrilico = { id: "person-test", nombre: "Mariano y Luciano", funcion: "Entrenamiento" };
  zone.capturas = ["Mew"];
  zone.notas_generales = ["Lleva una cuerda" ];
  const index = createGlobalSearchIndex([zone]);
  const queries = ["zona unica", "cueva del dragon", "pokemon agil", "baya azul", "pocion maxima", "mt99", "ursula", "impetu", "rayo lunar", "nidoran", "raticate", "froakie", "receta de pocion", "regalan un eevee", "nido alfa dragon", "luciano", "mew", "cuerda"];
  for (const query of queries) ok(searchGlobalIndex(index, query).length > 0, `No se encontró «${query}»`);
  deepEqual(searchGlobalIndex(index, "  POCIÓN MÁXIMA ").map((hit) => hit.zoneIndex), [0]);
  equal(searchGlobalIndex(index, "no existe").length, 0);
});

it("los totales de colecciones coinciden con los checks publicables", () => {
  equal(new Set(zones.flatMap((zone) => zone.mts.map((mt) => mt.numero))).size, COLLECTION_TOTALS.mts);
  equal(zones.filter((zone) => zone.nido_alfa).length, COLLECTION_TOTALS.nidos);
  equal(zones.reduce((total, zone) => total + (zone.habitante_acrilico?.cantidad ?? 1) * Number(Boolean(zone.habitante_acrilico)), 0), COLLECTION_TOTALS.habitantes);
  const checked = new Set(zones.flatMap((zone) => zone.habitante_acrilico?.id ?? []));
  equal(countCheckedInhabitants(zones, checked), COLLECTION_TOTALS.habitantes);
  const allMachineIds = new Set(zones.flatMap((zone) => zone.mts.map((mt) => mt.id)));
  equal(countCheckedMachines(zones, allMachineIds), COLLECTION_TOTALS.mts);
  const duplicatedNumber = zones.flatMap((zone) => zone.mts).find((mt, _, all) => all.filter((candidate) => candidate.numero === mt.numero).length > 1)?.numero;
  ok(duplicatedNumber);
  const oneDuplicate = zones.flatMap((zone) => zone.mts).find((mt) => mt.numero === duplicatedNumber)!;
  equal(countCheckedMachines(zones, new Set([oneDuplicate.id])), 1);
  const duplicateIds = getMachineIdsForNumber(zones, duplicatedNumber);
  ok(duplicateIds.length > 1);
  equal(isMachineNumberChecked(zones, duplicatedNumber, new Set([duplicateIds[0]])), true);
});

it("la guía no publica las siete erratas de nombres corregidas", () => {
  const erratas = new Set(["Breeloom", "Vespiqueen", "Froatzel", "Honchcrow", "Mabostiff", "Golisopodt", "Overqwill"]);
  for (const zone of zones) {
    for (const mon of zone.pokemon_salvajes) ok(!erratas.has(mon.nombre));
    for (const trainer of zone.entrenadores) for (const mon of trainer.equipo) ok(!erratas.has(mon.especie));
  }
});
