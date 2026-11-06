import { useMemo, useState } from "react";
import { GEN_RANGES, ROLES } from "../utils/constants";
import type { CatalogRules } from "../data/catalogRules";
import { isLegendary } from "../utils/pokemonHelpers";
import { normalizeApostrophe } from "../utils/stringNormalization";
import { formatForDisplay, typeMatchesRole } from "../utils/typeHelpers";
import { getEffectiveRole, getRole, matchesRole, scoreAllRoles } from "../utils/roleCalculations";
import { scorePokemonCandidate } from "../utils/defensiveCalculations";
import { useLearnsets } from "../data/staticPokeData";
import type { DamageRelations } from "../data/staticPokeData";
import { codecBooleano, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";
import type { AvailablePokemon, BaseStats, BaseStatsInput, Slot, TeamAnalysis } from "../types";

const REC_FILTER_MOVE_ONLY_Z_KEY = "pokerun-builder-rec-filter-move-only-z";

export const EMPTY_STAT_INPUT: BaseStatsInput = {
  HP: "",
  ATK: "",
  DEF: "",
  "SP.ATK": "",
  "SP.DEF": "",
  SPE: "",
};

/**
 * Motor de recomendaciones del panel "Pokémon recomendados": filtros
 * (tipo, habilidad vía parámetro externo, movimiento, generación, evolución
 * final, legendarios, originales de Z, Megas/Gigamax, rol, stats mínimas,
 * ordenar por stat) + el scoring/ranking en sí (pokemonRecommendations).
 *
 * Nota de diseño importante: el filtro por HABILIDAD (recFilterAbility) NO
 * vive acá — ya se extrajo a `useAbilityFilter`. Este hook solo LEE su valor
 * actual como parámetro (`recFilterAbility`) para aplicarlo en el scoring,
 * igual que recibe `activeCandidates`, `team`, `analysis`, `typeRelations`,
 * `abilitiesStandardData`, `lang` y `activePokedex` desde afuera: son datos
 * compartidos con otras partes de TeamBuilder.tsx (carga de datos, análisis
 * de equipo) que quedan fuera del alcance de este hook.
 *
 * El filtro por MOVIMIENTO de este panel (recFilterMoves y familia) sí vive
 * acá — es distinto del `useMoveFilter` ya extraído, que cubre el selector
 * de movimientos de un slot del equipo (otro modal, otro propósito).
 */
export function useRecommendations(
  team: Slot[],
  analysis: TeamAnalysis,
  typeRelations: Record<string, DamageRelations>,
  activeCandidates: AvailablePokemon[],
  lang: "es" | "en",
  catalogRules: CatalogRules | undefined,
  abilitiesStandardData: { slug: string; nameEs: string; nameEn: string; descriptionEs: string; descriptionEn: string }[],
  recFilterAbility: string
) {
  // ─── Descartados / expandidos ──────────────────────────────────────────
  const [recDiscarded, setRecDiscarded] = useState<Set<string>>(new Set());
  const [expandedRec, setExpandedRec] = useState<Set<string>>(new Set());
  const [recShowFilters, setRecShowFilters] = useState(false);

  // ─── Filtros básicos ────────────────────────────────────────────────────
  const [recFilterTypes, setRecFilterTypes] = useState<string[]>([]); // tipos incluidos (vacío = todos)
  const [recFilterType2, setRecFilterType2] = useState<string>(""); // segundo tipo para filtro dual
  const [recFilterGen, setRecFilterGen] = useState<number | null>(null); // null = todas las gens
  const [recFilterFinalEvo, setRecFilterFinalEvo] = useState(true); // solo últimas evoluciones
  const [recFilterLegendary, setRecFilterLegendary] = useState(false); // ocultar legendarios por defecto
  const [recFilterOnlyOriginals, setRecFilterOnlyOriginals] = useState(false); // solo originales de Pokémon Z
  const [recFilterNoDupTypes, setRecFilterNoDupTypes] = useState(true); // evitar duplicados de tipo
  const [recFilterMatchRole, setRecFilterMatchRole] = useState(false); // solo Pokémon cuyo rol REAL coincida con el recomendado
  const [recFilterPrioritizeCoverage, setRecFilterPrioritizeCoverage] = useState(true); // priorizar cobertura de debilidades en el scoring
  const [recFilterRoleManual, setRecFilterRoleManual] = useState<string | null>(null); // filtro manual de rol (null = cualquier rol)
  // Cuando está activa, esa misma stat se deshabilita en recFilterMinStats.
  const [recFilterSortStat, setRecFilterSortStat] = useState<keyof BaseStats | null>(null);
  const [recFilterMinStats, setRecFilterMinStats] = useState<BaseStatsInput>(EMPTY_STAT_INPUT);
  const [recFilterShowMega, setRecFilterShowMega] = useState(false);
  const [recFilterShowGmax, setRecFilterShowGmax] = useState(false);
  const [recFilterZShowMega, setRecFilterZShowMega] = useState(true);
  const [recFilterZShowGmax, setRecFilterZShowGmax] = useState(true);

  // ─── Filtro por movimiento (hasta 4 a la vez, AND) ─────────────────────
  // Distinto del filtro de movimiento de un slot (useMoveFilter): este es
  // el filtro "el candidato debe poder aprender estos movimientos" del
  // panel de recomendaciones, solo relevante en Pokémon Z por ahora.
  const [recFilterMoves, setRecFilterMoves] = useState<string[]>([]);

  // Los candidatos del dex estándar vienen sin learnset (son ~1.1 MB, contra
  // ~277 KB del resto del dataset). Se piden recién cuando este filtro se
  // usa de verdad, que es el único punto que los necesita.
  const learnsets = useLearnsets(recFilterMoves.length > 0);

  const [recFilterMoveModalOpen, setRecFilterMoveModalOpen] = useState(false);
  const [recFilterMoveSearch, setRecFilterMoveSearch] = useState<string>("");
  const [recFilterMoveCategories, setRecFilterMoveCategories] = useState<Set<string>>(new Set());
  const [recFilterMoveTypes, setRecFilterMoveTypes] = useState<Set<string>>(new Set());
  const [recFilterMoveOnlyZ, setRecFilterMoveOnlyZ] = usePreferenciaLocal(
    REC_FILTER_MOVE_ONLY_Z_KEY,
    false,
    codecBooleano
  );
  const [recFilterMoveSortPower, setRecFilterMoveSortPower] = useState<"asc" | "desc" | null>(null);

  const openMoveFilterModal = () => setRecFilterMoveModalOpen(true);
  const closeMoveFilterModal = () => setRecFilterMoveModalOpen(false);

  const addRecFilterMove = (moveInternalName: string) => {
    setRecFilterMoves((prev) => {
      if (prev.includes(moveInternalName) || prev.length >= 4) return prev;
      return [...prev, moveInternalName];
    });
  };

  const removeRecFilterMove = (moveInternalName: string) => {
    setRecFilterMoves((prev) => prev.filter((m) => m !== moveInternalName));
  };

  const clearRecFilterMoveFilters = () => {
    setRecFilterMoveSearch("");
    setRecFilterMoveCategories(new Set());
    setRecFilterMoveTypes(new Set());
  };

  // Limpia todos los filtros de este hook. OJO: no toca `recFilterAbility`
  // (vive en useAbilityFilter) — TeamBuilder.tsx debe llamar también a
  // `setRecFilterAbility("")` junto con esto, igual que en el original.
  const clearAllFilters = () => {
    setRecDiscarded(new Set());
    setRecFilterTypes([]);
    setRecFilterType2("");
    setRecFilterGen(null);
    setRecFilterRoleManual(null);
    setRecFilterSortStat(null);
    setRecFilterMinStats(EMPTY_STAT_INPUT);
    setRecFilterMoves([]);
  };

  // ─── Motor de scoring/ranking ───────────────────────────────────────────
  const pokemonRecommendations = useMemo(() => {
    if (!Object.keys(typeRelations).length) return [];
    if (!activeCandidates.length) return [];
    const hasTeam = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!hasTeam) return [];

    const teamWeaknesses = analysis.weaknesses;

    // Pokémon ya presentes en el equipo (no recomendar duplicados)
    const teamSlugs = new Set(team.map((s) => s.name.toLowerCase().replace(/\s+/g, "-")).filter(Boolean));

    // Rol recomendado por el análisis: se calcula aquí directamente (sin depender
    // de statsAnalysis que se declara después) usando la misma lógica: score cada rol
    // contra el promedio de stats del equipo y tomar el de menor puntuación ponderada
    // (el más carente). Si no hay suficientes Pokémon con stats, queda en null.
    const slotsWithStats = team.filter((s) => s.stats !== null && s.stats !== undefined);
    let neededRole: { label: string; color: string } | null = null;
    if (slotsWithStats.length >= 3) {
      const STAT_KEYS: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];
      const count = slotsWithStats.length;
      const avgStats = {} as BaseStats;
      STAT_KEYS.forEach((key) => {
        avgStats[key] = Math.round(slotsWithStats.reduce((sum, s) => sum + (s.stats![key] ?? 0), 0) / count);
      });
      const existingRoleCounts: Record<string, number> = {};
      slotsWithStats.forEach((s) => {
        const r = getEffectiveRole(s, lang);
        if (r) existingRoleCounts[r.label] = (existingRoleCounts[r.label] ?? 0) + 1;
      });
      const best = scoreAllRoles(avgStats)
        .map(({ role, score }) => ({
          role,
          adjustedScore: score + (existingRoleCounts[role[lang]] ?? 0) * 25,
        }))
        .sort((a, b) => a.adjustedScore - b.adjustedScore)[0];
      if (best) neededRole = { label: best.role[lang], color: best.role.color };
    }

    // Rango de IDs para el filtro de generación
    const genRange = recFilterGen !== null ? GEN_RANGES.find((g) => g.gen === recFilterGen) ?? null : null;

    // Mapa slug (inglés) → nombre en español, para que el filtro de habilidad
    // funcione escribiendo en español aunque los datos de la dex estándar
    // solo traigan el slug en inglés (ej. "clorofila" → "chlorophyll").
    const abilityEsNameBySlug = new Map<string, string>();
    abilitiesStandardData.forEach((a) => abilityEsNameBySlug.set(a.slug, a.nameEs));

    // Score todos los candidatos, aplicando filtros previos al scoring para eficiencia.
    // El rol real de cada candidato se calcula una sola vez aquí (reutilizando el
    // mismo getRole que usa el equipo) para no duplicar el cálculo entre el filtro
    // suavizado de rol y el bonus de puntuación.
    const withRealRole = activeCandidates.map((c) => ({
      candidate: c,
      realRole: c.stats ? getRole(c.stats, lang) : null,
      // Precalculamos el match del filtro manual (si hay) para reutilizarlo en
      // el bonus sin llamar a scoreAllRoles dos veces.
      roleMatch:
        c.stats && recFilterRoleManual
          ? matchesRole(c.stats, recFilterRoleManual)
          : c.stats && recFilterMatchRole && neededRole
          ? matchesRole(c.stats, neededRole.label)
          : null,
    }));

    const scored = withRealRole
      .filter(({ candidate: c, roleMatch }) => {
        // Excluir los del equipo
        if (teamSlugs.has(c.slug)) return false;
        // Excluir descartados manualmente
        if (recDiscarded.has(c.slug)) return false;
        // Filtro de generación por rango de ID
        {
          const genCheckId = c.dexId ?? c.id;
          if (genRange && (genCheckId < genRange.min || genCheckId > genRange.max)) return false;
        }
        // Filtro de tipos: soporte para tipo único o combinación de dos tipos
        // Si hay segundo tipo seleccionado, el candidato debe tener AMBOS tipos (en cualquier orden)
        if (recFilterType2 && recFilterTypes.length > 0) {
          const type1 = recFilterTypes[0];
          const type2 = recFilterType2;
          const hasType1 = c.types.includes(type1);
          const hasType2 = c.types.includes(type2);
          if (!hasType1 || !hasType2) return false;
        } else if (recFilterTypes.length > 0) {
          // Solo un tipo seleccionado: comportamiento original
          const hasType = c.types.some((ty) => recFilterTypes.includes(ty));
          if (!hasType) return false;
        }
        // Filtro por habilidad: texto libre, busca coincidencia parcial tanto
        // en las habilidades normales como en la oculta (sin distinguir
        // mayúsculas/acentos). En modo Z, los nombres ya vienen en español
        // (ej. "Adaptable"); en modo estándar vienen como slug de PokéAPI
        // (ej. "chlorophyll"), así que se compara también contra su versión
        // formateada para que "clorofila" no falle si el usuario escribe en
        // español sobre datos en inglés.
        if (recFilterAbility.trim().length > 0) {
          const q = normalizeApostrophe(recFilterAbility.trim().toLowerCase());
          const candidateAbilityNames = [...(c.abilities ?? []), c.hiddenAbility ?? ""].filter(Boolean);
          const hasMatch = candidateAbilityNames.some((ab) => {
            const raw = ab.toLowerCase();
            const display = formatForDisplay(ab).toLowerCase();
            const esName = abilityEsNameBySlug.get(ab)?.toLowerCase() ?? "";
            return raw.includes(q) || display.includes(q) || (esName.length > 0 && esName.includes(q));
          });
          if (!hasMatch) return false;
        }
        // Filtro por movimiento (solo Pokémon Z): el candidato debe poder
        // aprender TODOS los movimientos seleccionados (AND), no solo uno.
        if (recFilterMoves.length > 0) {
          // Pokémon Z trae su learnset embebido en el candidato; el dex
          // estándar lo resuelve contra el mapa cargado bajo demanda.
          const learnable = c.learnableMoveNames ?? learnsets?.[c.slug] ?? null;
          if (!learnable || !recFilterMoves.every((mv) => learnable.includes(mv))) return false;
        }
        // Filtro: solo últimas evoluciones
        if (recFilterFinalEvo && !c.isFinalEvo) return false;
        // Filtro: ocultar legendarios
        if (!recFilterLegendary && isLegendary(c)) return false;
        if (recFilterOnlyOriginals && catalogRules?.isOriginal && !catalogRules.isOriginal(c)) return false;
        if (catalogRules?.excludeRecommendation?.(c)) return false;
        if (catalogRules) {
          if (!recFilterZShowMega && catalogRules.isMega(c)) return false;
          if (!recFilterZShowGmax && c.formLabel === "Gmax") return false;
        } else {
          if (!recFilterShowMega && /-mega(-[xy])?\b/i.test(c.slug)) return false;
          if (!recFilterShowGmax && /-gmax\b/i.test(c.slug)) return false;
        }
        // Filtro de rol suavizado (Opción D):
        // manual tiene prioridad sobre el toggle automático.
        // Se usa matchesRole en vez de comparación exacta → pasan también Pokémon
        // cuyo rol seleccionado está cerca del top (margen) o supera un mínimo absoluto.
        if (recFilterRoleManual || recFilterMatchRole) {
          if (!c.stats) return false; // sin stats no podemos evaluar
          if (!roleMatch) return false; // no se pudo calcular (neededRole null)
          if (!roleMatch.passes) return false;
        }
        // Filtro: mínimos por stat. Solo se evalúan las stats con valor
        // (vacío = no se filtra). Es un AND entre todas las que tengan valor.
        // La stat activa en "ordenar por stat más alta" queda deshabilitada
        // en la UI, así que en la práctica nunca coincide con recFilterSortStat.
        {
          const minEntries = (Object.keys(recFilterMinStats) as (keyof BaseStats)[]).filter((k) => recFilterMinStats[k].trim() !== "");
          if (minEntries.length > 0) {
            if (!c.stats) return false;
            for (const k of minEntries) {
              const min = parseInt(recFilterMinStats[k], 10);
              if (!Number.isNaN(min) && c.stats[k] < min) return false;
            }
          }
        }
        return true;
      })
      .map(({ candidate, realRole, roleMatch }) => {
        const result = scorePokemonCandidate(team, candidate.types as string[], typeRelations);
        // Bonus de priorización hacia el rol que el equipo necesita.
        // Graduado según qué tan bien encaja el candidato en el rol:
        //   exact   → rol #1 del Pokémon coincide con el buscado  → bonus máximo
        //   margin  → rol muy cercano al top (≤15 pts)            → bonus alto
        //   minimum → supera el mínimo absoluto (≥28 pts)         → bonus moderado
        //   partial → cumple mínimos absolutos pero alguna stat núcleo
        //             queda fuera de su propio top-3 (ej. Xerneas)  → bonus mínimo
        //   sin stats → proxy por tipo (igual que antes)          → bonus bajo
        const roleEnLabel = neededRole ? ROLES.find((r) => r.es === neededRole!.label || r.en === neededRole!.label)?.en ?? neededRole!.label : null;
        let roleBonus = 0;
        if (neededRole) {
          const matchForBonus = roleMatch ?? (candidate.stats ? matchesRole(candidate.stats, neededRole.label) : null);
          if (matchForBonus) {
            if (matchForBonus.reason === "exact") roleBonus = 80;
            else if (matchForBonus.reason === "margin") roleBonus = 55;
            else if (matchForBonus.reason === "minimum") roleBonus = 30;
            else if (matchForBonus.reason === "partial") roleBonus = 5;
          } else if (!candidate.stats && roleEnLabel && typeMatchesRole(candidate.types as string[], roleEnLabel)) {
            roleBonus = 20;
          }
        }

        // Bonus por stats totales (BST): un Pokémon con stats brutas muy altas
        // (típicamente legendarios) puede "no encajar perfecto" en un rol
        // específico (ver matchesRole/"partial" más arriba, ej. Xerneas) pero
        // sigue siendo objetivamente más poderoso. Antes esto no se consideraba
        // en absoluto — solo importaba qué tan "puro" era el encaje de rol, no
        // cuán altas eran las stats en sí. Escala 0–80 sobre un rango de BST
        // típico (300 débil, 720 legendario tope) para que sea comparable en
        // magnitud al roleBonus, pero con más peso en la cascada final.
        const bst = candidate.stats ? Object.values(candidate.stats).reduce((sum: number, v: number) => sum + v, 0) : 0;
        const bstBonus = Math.max(0, Math.min(80, ((bst - 300) / (720 - 300)) * 80));

        // Antes: bstBonus*1000 + roleBonus*100 hacía que las stats totales
        // dominaran CASI SIEMPRE (una diferencia de 1 punto de bstBonus vale
        // lo mismo que 10 puntos de roleBonus), dejando al rol casi sin
        // influencia real — los legendarios (BST alto) terminaban saliendo
        // sí o sí, sin importar qué tan bien encajaran en el rol que el
        // equipo necesita. Ahora se combinan en un solo término ponderado
        // (70% stats / 30% rol, mismo rango 0–80 cada uno) para que ambos
        // factores realmente compitan entre sí, en vez de que uno aplaste
        // al otro por diferencia de escala. Ajustado tras feedback a 70% rol
        // / 30% stats: el encaje de rol pesa más, pero el poder bruto
        // sigue teniendo influencia real (antes tenía cero peso).
        //   priority1 (arreglar debilidades graves)      > todo lo demás
        //   priority2 (no crear debilidades críticas)    > todo lo siguiente
        //   powerRoleBonus (30% stats totales + 70% rol)  > resto
        //   priority3 (resistencias nuevas)               > priority4
        //   priority4 (equilibrio general)
        const powerRoleBonus = bstBonus * 0.3 + roleBonus * 0.7;
        const finalScore = recFilterPrioritizeCoverage
          ? result.priority1 * 100000 + result.priority2 * 10000 + powerRoleBonus * 100 + result.priority3 * 10 + result.priority4
          : powerRoleBonus * 100 + result.priority3 * 10 + result.priority4; // sin sesgo: ordena por poder bruto + rol + resistencias + equilibrio
        return { candidate, ...result, score: finalScore, realRole };
      })
      .sort((a, b) => {
        // Filtro "ordenar por stat más alta": si está activo, el orden se
        // basa directamente en esa stat (mayor a menor) en vez del score de
        // recomendación normal. Los candidatos sin stats (no debería pasar
        // en la práctica) quedan al final.
        if (recFilterSortStat) {
          const av = a.candidate.stats ? a.candidate.stats[recFilterSortStat] : -1;
          const bv = b.candidate.stats ? b.candidate.stats[recFilterSortStat] : -1;
          if (av !== bv) return bv - av;
        }
        return b.score - a.score;
      });

    // Filtro de duplicados de tipo: si está activado, no permitir dos Pokémon
    // con exactamente la misma combinación de tipos (ordenada)
    const seenTypeCombos = new Map<string, number>();
    // NOTA: antes, con el switch apagado, igual se aplicaba un tope oculto de
    // "máximo 2 por combo" como red de seguridad. Eso bloqueaba candidatos
    // (ej. Xerneas, Hada puro) que compartían combo con 4+ Pokémon mejor
    // puntuados (Florges, Aromatisse, Slurpuff, Sylveon) — nunca aparecían
    // ni descartando todo, porque el tope los cortaba en este paso, antes
    // de llegar al recorte final. Ahora, sin el switch, no hay tope alguno:
    // el único filtro es el que el usuario pide explícitamente activando
    // "Evitar tipos repetidos", y el mecanismo de "ir descartando para que
    // aparezca el siguiente mejor" queda como el único control del usuario.
    const deduplicated = recFilterNoDupTypes
      ? scored.filter(({ candidate }) => {
          const key = [...candidate.types].sort().join("/");
          const count = seenTypeCombos.get(key) ?? 0;
          if (count >= 1) return false; // solo 1 por combo exacto
          seenTypeCombos.set(key, count + 1);
          return true;
        })
      : scored;

    // Máximo 6 recomendaciones visibles — descartando las mostradas, el
    // siguiente mejor de la lista completa (ya sin tope oculto por combo)
    // ocupa el lugar automáticamente.
    const top = deduplicated.slice(0, 6);

    // Construye las explicaciones de cada recomendación
    const result = top.map(({ candidate, score, reduces, immunities, newResistances, criticalAdds, addsWeakness, realRole }) => {
      // En modo Z el slug ya viene del nombre en español; formatForDisplay lo capitaliza bien.
      // En modo estándar es el slug de PokéAPI (guiones → espacios con mayúsculas).
      const name = formatForDisplay(candidate.slug);
      const reasons: Array<{ positive: boolean; weakType: string; isImmune?: boolean }> = [];

      // Positivo: inmunidades primero, luego reducciones de debilidad,
      // cada bloque ordenado por separado por cuántos Pokémon del equipo ya
      // eran débiles a ese tipo (un sort global sobre ambos bloques juntos
      // los intercalaría cuando una inmunidad tiene menos peso que una
      // reducción, rompiendo el agrupamiento visual en la tarjeta —
      // ej. "Cubre fuego" / "Inmune tierra" / "Cubre roca" en vez de un
      // solo grupo "Cubre fuego, roca").
      const immunitiesSorted = [...immunities].sort((a, b) => (teamWeaknesses[b] ?? 0) - (teamWeaknesses[a] ?? 0));
      const reducesSorted = reduces.filter((t) => !immunities.includes(t)).sort((a, b) => (teamWeaknesses[b] ?? 0) - (teamWeaknesses[a] ?? 0));
      [...immunitiesSorted, ...reducesSorted].slice(0, 3).forEach((t) => reasons.push({ positive: true, weakType: t, isImmune: immunities.includes(t) }));

      // Negativo: solo avisar de debilidades críticas nuevas (la prioridad 2
      // del algoritmo es justamente evitarlas)
      criticalAdds.slice(0, 1).forEach((t) => reasons.push({ positive: false, weakType: t }));

      const noNewCritical = criticalAdds.length === 0;
      const addsResistances = newResistances.length > 0;

      // ¿El rol REAL del candidato coincide con el rol que el equipo necesita?
      // Se usa solo para resaltar visualmente la tarjeta — nunca para sustituir
      // la etiqueta de rol real que se muestra siempre.
      const candidateFitsRole = neededRole && realRole ? realRole.label === neededRole.label : null; // null = no se puede determinar (sin stats del candidato)

      return {
        candidate,
        name,
        score,
        reasons,
        noNewCritical,
        addsResistances,
        newResistancesCount: newResistances.length,
        hasMinorWeakness: addsWeakness.length > 0,
        immunities,
        newResistances,
        reduces,
        neededRole, // Rol que el equipo necesita (calculado por el análisis del equipo)
        realRole, // Rol REAL del candidato (mismo sistema de roles, basado en sus stats)
        candidateFitsRole, // true/false/null: si el rol real coincide con el necesitado
      };
    });
    return result;
  }, [
    team,
    analysis,
    typeRelations,
    activeCandidates,
    lang,
    recDiscarded,
    recFilterTypes,
    recFilterType2,
    recFilterAbility,
    recFilterGen,
    recFilterFinalEvo,
    recFilterLegendary,
    recFilterOnlyOriginals,
    recFilterNoDupTypes,
    recFilterMatchRole,
    recFilterPrioritizeCoverage,
    recFilterRoleManual,
    catalogRules,
    recFilterShowMega,
    recFilterShowGmax,
    recFilterZShowMega,
    recFilterZShowGmax,
    recFilterSortStat,
    recFilterMinStats,
    recFilterMoves,
    learnsets,
    abilitiesStandardData,
  ]);

  // Aquí había un useMemo sobre el objeto de retorno. No servía: seis de sus
  // dependencias son los handlers de más arriba, que se redefinen en cada
  // render, así que se recalculaba siempre. Mismo caso que useAbilityFilter.
  return {
    pokemonRecommendations,
    recDiscarded,
    setRecDiscarded,
    expandedRec,
    setExpandedRec,
    recShowFilters,
    setRecShowFilters,
    recFilterTypes,
    setRecFilterTypes,
    recFilterType2,
    setRecFilterType2,
    recFilterGen,
    setRecFilterGen,
    recFilterFinalEvo,
    setRecFilterFinalEvo,
    recFilterLegendary,
    setRecFilterLegendary,
    recFilterOnlyOriginals,
    setRecFilterOnlyOriginals,
    recFilterNoDupTypes,
    setRecFilterNoDupTypes,
    recFilterMatchRole,
    setRecFilterMatchRole,
    recFilterPrioritizeCoverage,
    setRecFilterPrioritizeCoverage,
    recFilterRoleManual,
    setRecFilterRoleManual,
    recFilterSortStat,
    setRecFilterSortStat,
    recFilterMinStats,
    setRecFilterMinStats,
    recFilterShowMega,
    setRecFilterShowMega,
    recFilterShowGmax,
    setRecFilterShowGmax,
    recFilterZShowMega,
    setRecFilterZShowMega,
    recFilterZShowGmax,
    setRecFilterZShowGmax,
    // filtro por movimiento
    recFilterMoves,
    setRecFilterMoves,
    recFilterMoveModalOpen,
    openMoveFilterModal,
    closeMoveFilterModal,
    recFilterMoveSearch,
    setRecFilterMoveSearch,
    recFilterMoveCategories,
    setRecFilterMoveCategories,
    recFilterMoveTypes,
    setRecFilterMoveTypes,
    recFilterMoveOnlyZ,
    setRecFilterMoveOnlyZ,
    recFilterMoveSortPower,
    setRecFilterMoveSortPower,
    addRecFilterMove,
    removeRecFilterMove,
    clearRecFilterMoveFilters,
    clearAllFilters,
  };
}
