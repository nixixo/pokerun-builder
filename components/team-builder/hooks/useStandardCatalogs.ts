import { useEffect, useMemo, useState } from "react";
import type { MoveZ } from "../types/pokemonZ";
import type { FilaMovimientoGraphQL, RespuestaGraphQL } from "../types/pokeapi";
import { nombreDeCampo, primerNombreDeCampo } from "../types/pokeapi";
import { formatForDisplay } from "../utils/typeHelpers";

export function useStandardCatalogs() {
  const [movesStandardData, setMovesStandardData] = useState<MoveZ[]>([]);
  const [abilitiesStandardData, setAbilitiesStandardData] = useState<{ slug: string; nameEs: string; nameEn: string; descriptionEs: string; descriptionEn: string }[]>([]);
  useEffect(() => {
    // Dataset completo de movimientos de la Pokédex estándar (nombre, tipo,
    // categoría, potencia, precisión, PP) para alimentar el mismo modal de
    // filtros que ya existe para la dex Z, ahora también en modo normal.
    // Se carga una sola vez, independiente de la dex activa.
    let cancelled = false;
    const gqlVariants = [
      {
        url: "https://beta.pokeapi.co/graphql/v1beta",
        query: `{ pokemon_v2_move(limit: 2000) { name power pp accuracy pokemon_v2_movedamageclass { name } pokemon_v2_type { name } pokemon_v2_movenames(where: { pokemon_v2_language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        movesKey: "pokemon_v2_move",
        damageClassKey: "pokemon_v2_movedamageclass",
        typeKey: "pokemon_v2_type",
        namesKey: "pokemon_v2_movenames",
      },
      {
        url: "https://graphql.pokeapi.co/v1beta2",
        query: `{ move(limit: 2000) { name power pp accuracy damage_class: pokemon_v2_movedamageclass { name } type: pokemon_v2_type { name } move_names: pokemon_v2_movenames(where: { language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_moveflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        movesKey: "move",
        damageClassKey: "damage_class",
        typeKey: "type",
        namesKey: "move_names",
      },
    ];

    (async () => {
      for (const { url, query, movesKey, damageClassKey, typeKey, namesKey } of gqlVariants) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          if (!r.ok) continue;
          const data = (await r.json()) as RespuestaGraphQL<FilaMovimientoGraphQL>;
          if (data.errors) continue;
          const rows = data?.data?.[movesKey] ?? [];
          if (rows.length === 0) continue;
          const cleanFlavor = (txt: string) => txt.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
          const normalized = rows.map((m) => {
            const dcName = nombreDeCampo(m, damageClassKey);
            const category: "Physical" | "Special" | "Status" =
              dcName === "special" ? "Special" : dcName === "status" ? "Status" : "Physical";
            const esRaw = primerNombreDeCampo(m, namesKey);
            const nameEn = formatForDisplay(m.name);
            const descEsRaw: string | undefined = m.descEs?.[0]?.flavor_text;
            const descEnRaw: string | undefined = m.descEn?.[0]?.flavor_text;
            return {
              internalName: m.name, // slug en inglés (ej. "flamethrower"), usado para seleccionar/buscar
              name: esRaw ? esRaw.charAt(0).toUpperCase() + esRaw.slice(1) : nameEn,
              nameEn,
              category,
              type: nombreDeCampo(m, typeKey) ?? null,
              hackrom: false,
              power: typeof m.power === "number" ? m.power : null,
              accuracy: typeof m.accuracy === "number" ? m.accuracy : null,
              pp: typeof m.pp === "number" ? m.pp : null,
              descriptionEs: descEsRaw ? cleanFlavor(descEsRaw) : "",
              descriptionEn: descEnRaw ? cleanFlavor(descEnRaw) : "",
            };
          });
          if (!cancelled) setMovesStandardData(normalized);
          return;
        } catch {
          continue;
        }
      }
      console.warn("[PokeRun] Could not load standard moves dataset (filter modal disabled for standard dex)");
    })();
    return () => { cancelled = true; };
  }, []);

  // Los mapas de nombres ES<->EN de movimientos salen directamente de
  // movesStandardData (que ya trae internalName=slug EN y name=nombre ES
  // mostrado), en vez de pedirlos de nuevo con otra consulta GraphQL de
  // ~2000 movimientos. Son datos DERIVADOS, no estado: un useMemo y no un
  // useState alimentado por un efecto, que además pintaba un render de más.
  //
  // moveEsMap:     es_lower → en_slug            "lanzallamas" → "flamethrower"
  // moveEsDisplay: en_slug  → nombre ES mostrado "flamethrower" → "Lanzallamas"
  const { moveEsMap, moveEsDisplay } = useMemo(() => {
    const esToEn: Record<string, string> = {};
    const enToEs: Record<string, string> = {};
    movesStandardData.forEach((m) => {
      esToEn[m.name.toLowerCase()] = m.internalName;
      enToEs[m.internalName] = m.name;
    });
    return { moveEsMap: esToEn, moveEsDisplay: enToEs };
  }, [movesStandardData]);

  useEffect(() => {
    // Dataset de TODAS las habilidades de la Pokédex estándar (nombre ES/EN +
    // descripción ES/EN), para alimentar el mismo modal "explorar habilidades"
    // que ya existe para Pokémon Z, ahora también en modo normal. Se carga
    // una sola vez, independiente de la dex activa.
    let cancelled = false;
    const gqlVariants = [
      {
        url: "https://beta.pokeapi.co/graphql/v1beta",
        query: `{ pokemon_v2_ability(limit: 500) { name pokemon_v2_abilitynames(where: { pokemon_v2_language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        abilitiesKey: "pokemon_v2_ability",
        namesKey: "pokemon_v2_abilitynames",
      },
      {
        url: "https://graphql.pokeapi.co/v1beta2",
        query: `{ ability(limit: 500) { name ability_names: pokemon_v2_abilitynames(where: { language: { name: { _eq: "es" } } }) { name } descEs: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "es" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } descEn: pokemon_v2_abilityflavortexts(where: { pokemon_v2_language: { name: { _eq: "en" } } }, order_by: { version_group_id: desc }, limit: 1) { flavor_text } } }`,
        abilitiesKey: "ability",
        namesKey: "ability_names",
      },
    ];

    (async () => {
      for (const { url, query, abilitiesKey, namesKey } of gqlVariants) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          if (!r.ok) continue;
          const data = (await r.json()) as RespuestaGraphQL<FilaMovimientoGraphQL>;
          if (data.errors) continue;
          const rows = data?.data?.[abilitiesKey] ?? [];
          if (rows.length === 0) continue;
          const cleanFlavor = (txt: string) => txt.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
          const normalized = rows.map((a) => {
            const esRaw = primerNombreDeCampo(a, namesKey);
            const nameEn = formatForDisplay(a.name);
            const descEsRaw: string | undefined = a.descEs?.[0]?.flavor_text;
            const descEnRaw: string | undefined = a.descEn?.[0]?.flavor_text;
            return {
              slug: a.name, // slug en inglés (ej. "chlorophyll"), usado para filtrar/seleccionar
              nameEs: esRaw ? esRaw.charAt(0).toUpperCase() + esRaw.slice(1) : nameEn,
              nameEn,
              descriptionEs: descEsRaw ? cleanFlavor(descEsRaw) : "",
              descriptionEn: descEnRaw ? cleanFlavor(descEnRaw) : "",
            };
          });
          if (!cancelled) setAbilitiesStandardData(normalized);
          return;
        } catch {
          continue;
        }
      }
      console.warn("[PokeRun] Could not load standard abilities dataset (browse modal disabled for standard dex)");
    })();
    return () => { cancelled = true; };
  }, []);

  return { movesStandardData, abilitiesStandardData, moveEsMap, moveEsDisplay };
}
