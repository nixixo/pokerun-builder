import { useMemo } from "react";
import type { Zone } from "./types";

export type SearchKind =
  | "zona" | "salvaje" | "objeto" | "mt" | "entrenador" | "equipo"
  | "intercambio" | "conversion" | "inicial" | "alquimia" | "regalo"
  | "nido" | "habitante" | "nota";

export type SearchHit = {
  key: string;
  zoneIndex: number;
  zoneName: string;
  kind: SearchKind;
  label: string;
  detail: string;
};

export function normalizarBusqueda(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

/** Arma un índice de cada sección y campo visible de la guía. */
export function createGlobalSearchIndex(zones: Zone[]): SearchHit[] {
  const hits: SearchHit[] = [];
  const add = (zoneIndex: number, kind: SearchKind, label: string | undefined, detail: string, suffix: string) => {
    if (!label?.trim()) return;
    const zone = zones[zoneIndex];
    hits.push({
      key: `${zone.id}:${kind}:${suffix}:${hits.length}`,
      zoneIndex,
      zoneName: zone.zona,
      kind,
      label: label.trim(),
      detail,
    });
  };

  zones.forEach((zone, zoneIndex) => {
    add(zoneIndex, "zona", zone.zona, "Zona de la guía", "zone");
    zone.conexiones.forEach((value, i) => add(zoneIndex, "zona", value, "Conexión", `connection-${i}`));
    zone.pokemon_salvajes.forEach((p, i) => {
      const context = [p.metodo, p.porcentaje, p.nivel && `Nv. ${p.nivel}`, p.drop && `Objeto: ${p.drop}`, p.nota, ...(p.tipos ?? []), ...(p.requisitos ?? [])].filter(Boolean).join(" · ");
      add(zoneIndex, "salvaje", p.nombre, context || "Pokémon salvaje", `wild-${i}`);
      for (const [j, field] of [p.metodo, p.porcentaje, p.nivel, p.drop, p.nota, p.spriteBase, ...(p.tipos ?? []), ...(p.requisitos ?? [])].entries()) {
        add(zoneIndex, "salvaje", field, `Dato de ${p.nombre}`, `wild-${i}-field-${j}`);
      }
    });
    zone.objetos.forEach((o, i) => {
      add(zoneIndex, "objeto", o.nombre, o.detalle || "Objeto", `item-${i}`);
      add(zoneIndex, "objeto", [o.detalle, ...(o.requisitos ?? [])].join(" · "), `Detalle y requisitos de ${o.nombre}`, `item-${i}-detail`);
    });
    zone.mts.forEach((mt, i) => {
      add(zoneIndex, "mt", `${mt.numero} ${mt.movimiento}`, [mt.contexto, ...(mt.requisitos ?? [])].join(" · "), `mt-${i}`);
      add(zoneIndex, "mt", [mt.contexto, ...(mt.requisitos ?? [])].join(" · "), `${mt.numero} · ${mt.movimiento}`, `mt-${i}-context`);
    });
    zone.entrenadores.forEach((trainer, i) => {
      add(zoneIndex, "entrenador", trainer.nombre, trainer.notas ?? "Entrenador", `trainer-${i}`);
      add(zoneIndex, "entrenador", [trainer.tipo, trainer.secuencia, trainer.equipo_fuente].filter(Boolean).join(" · "), `Datos del combate de ${trainer.nombre}`, `trainer-${i}-metadata`);
      add(zoneIndex, "entrenador", trainer.notas, `Notas de ${trainer.nombre}`, `trainer-${i}-notes`);
      add(zoneIndex, "entrenador", trainer.procedencia, `Procedencia del equipo de ${trainer.nombre}`, `trainer-${i}-source`);
      trainer.equipo.forEach((mon, j) => {
        const context = [`Nv. ${mon.nivel}`, mon.objeto && `Objeto: ${mon.objeto}`, mon.habilidad && `Habilidad: ${mon.habilidad}`, mon.naturaleza && `Naturaleza: ${mon.naturaleza}`, mon.movimientos.length ? `Movimientos: ${mon.movimientos.join(", ")}` : "", mon.nota, mon.consejo].filter(Boolean).join(" · ");
        add(zoneIndex, "equipo", mon.especie, `Equipo de ${trainer.nombre} · ${context}`, `trainer-${i}-mon-${j}`);
        for (const [k, field] of [mon.objeto, mon.habilidad, mon.naturaleza ?? undefined, mon.condicion, mon.spriteBase, ...(mon.tipos ?? []), ...mon.movimientos, mon.nota, mon.consejo, mon.consejoAviso].entries()) {
          add(zoneIndex, "equipo", field, `${trainer.nombre} · ${mon.especie}`, `trainer-${i}-mon-${j}-field-${k}`);
        }
      });
    });
    zone.intercambios.forEach((trade, i) => add(zoneIndex, "intercambio", trade.detalle, "Intercambio", `trade-${i}`));
    (zone.conversiones ?? []).forEach((conversion, i) => {
      add(zoneIndex, "conversion", `${conversion.de} → ${conversion.a}`, conversion.nota ?? "Conversión de Pokémon", `conversion-${i}`);
      add(zoneIndex, "conversion", conversion.nota, `${conversion.de} → ${conversion.a}`, `conversion-${i}-note`);
    });
    (zone.inicial_rival ?? []).forEach((initial, i) => add(zoneIndex, "inicial", initial.detalle, `Inicial rival si eliges ${initial.siTuInicial}`, `initial-${i}`));
    if (zone.pagina_alquimia?.presente) {
      add(zoneIndex, "alquimia", [zone.pagina_alquimia.descripcion, ...(zone.pagina_alquimia.requisitos ?? [])].join(" · "), "Página de alquimia", "alchemy");
      zone.pagina_alquimia.adicionales?.forEach((page, i) => add(zoneIndex, "alquimia", [page, ...(zone.pagina_alquimia?.requisitos ?? [])].join(" · "), `Página de alquimia ${i + 2}`, `alchemy-${i}`));
    }
    if (zone.regalo_pokemon?.presente) add(zoneIndex, "regalo", zone.regalo_pokemon.detalle ?? "Regalo Pokémon", "Pokémon de regalo", "gift");
    if (zone.nido_alfa) add(zoneIndex, "nido", `Nido Alfa ${zone.nido_alfa.tipo}`, zone.nido_alfa.detalle ?? "Nido Alfa", "nest");
    if (zone.habitante_acrilico) {
      add(zoneIndex, "habitante", zone.habitante_acrilico.nombre, zone.habitante_acrilico.funcion ?? "Habitante de Pueblo Acrílico", "inhabitant");
      add(zoneIndex, "habitante", zone.habitante_acrilico.funcion, zone.habitante_acrilico.nombre, "inhabitant-service");
      add(zoneIndex, "habitante", zone.habitante_acrilico.detalle, zone.habitante_acrilico.nombre, "inhabitant-detail");
    }
    zone.capturas?.forEach((name, i) => add(zoneIndex, "regalo", name, "Pokémon que se puede conseguir", `capture-${i}`));
    zone.notas_generales.forEach((note, i) => add(zoneIndex, "nota", note, "Nota de la guía", `note-${i}`));
  });
  return hits;
}

export function searchGlobalIndex(index: SearchHit[], query: string, limit = 20): SearchHit[] {
  const q = normalizarBusqueda(query);
  if (!q || limit <= 0) return [];
  const results: SearchHit[] = [];
  for (const hit of index) {
    if (normalizarBusqueda(hit.label).includes(q)) results.push(hit);
    if (results.length >= limit) break;
  }
  return results;
}

export function useGlobalSearchIndex(zones: Zone[]) {
  const index = useMemo(() => createGlobalSearchIndex(zones), [zones]);
  return { search: (query: string, limit?: number) => searchGlobalIndex(index, query, limit) };
}
