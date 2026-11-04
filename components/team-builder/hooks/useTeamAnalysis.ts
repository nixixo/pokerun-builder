// components/team-builder/hooks/useTeamAnalysis.ts
//
// Todo lo que el Builder deduce del equipo mirando SOLO tipos: debilidades y
// resistencias compartidas, cobertura ofensiva, qué tipo convendría añadir,
// qué movimientos se repiten y quién aporta menos.
//
// Vivía suelto en el cuerpo de TeamBuilder.tsx, ~360 líneas de useMemo entre
// medias del resto. Aquí es un hook con entradas explícitas: se ve de un
// vistazo de qué depende cada cálculo, y deja de estar mezclado con el estado
// de la interfaz.

import { useMemo } from "react";
import type { Slot } from "../types";
import type { DamageRelations } from "../data/staticPokeData";

export function useTeamAnalysis(
  team: Slot[],
  typeRelations: Record<string, DamageRelations>,
  /** Los 18 tipos jugables, en el orden de la API. */
  allTypes: string[],
) {
  // Analysis: weaknesses & strengths
  const analysis = useMemo(() => {
    const attackingTypes = Object.keys(typeRelations);
    const weaknessesCount: Record<string, number> = {};
    const strengthsCount: Record<string, number> = {};
    // Conteo aparte de inmunidades (mult === 0): NO se mezcla con
    // strengthsCount (que sigue significando específicamente "resiste 0.5x",
    // usado tal cual en el desglose de TeamAnalysisPanel y en "quién conviene
    // reemplazar"). Se agrega solo para que el Dashboard pueda calcular la
    // cobertura defensiva incluyendo inmunidades, como promete su tooltip.
    const immunesCount: Record<string, number> = {};
    // Por cada tipo atacante, qué índices del equipo (0-5) son débiles/resisten.
    // Esto permite detectar, para un miembro dado, si es EL ÚNICO que cubre
    // algo (crítico, no reemplazable) o si su cobertura es redundante
    // (ya la aporta otro miembro también) — base del sistema de "quién
    // conviene reemplazar".
    const weakMemberIdx: Record<string, number[]> = {};
    const resistMemberIdx: Record<string, number[]> = {};

    if (!attackingTypes.length) return { weaknesses: weaknessesCount, strengths: strengthsCount, immunes: immunesCount, weakMemberIdx, resistMemberIdx };

    // For each attacking type, compute how many Pokémon are >=2 multiplier (weak) or <=0.5 (resistant)
    attackingTypes.forEach((atk) => {
      const rel = typeRelations[atk];
      if (!rel) return;
      const doubleTo = new Set(rel.double_damage_to.map((t) => t.name));
      const halfTo = new Set(rel.half_damage_to.map((t) => t.name));
      const noTo = new Set(rel.no_damage_to.map((t) => t.name));

      let weak = 0;
      let resist = 0;
      let immune = 0;
      team.forEach((poke, idx) => {
        const pokeTypes = poke.types.filter(Boolean);
        if (!pokeTypes.length) return;
        let mult = 1;
        pokeTypes.forEach((def) => {
          if (noTo.has(def)) mult *= 0;
          else if (doubleTo.has(def)) mult *= 2;
          else if (halfTo.has(def)) mult *= 0.5;
        });
        if (mult >= 2) { weak++; (weakMemberIdx[atk] ??= []).push(idx); }
        if (mult <= 0.5 && mult > 0) { resist++; (resistMemberIdx[atk] ??= []).push(idx); }
        if (mult === 0) immune++;
      });

      if (weak > 0) weaknessesCount[atk] = weak;
      if (resist > 0) strengthsCount[atk] = resist;
      if (immune > 0) immunesCount[atk] = immune;
    });

    return { weaknesses: weaknessesCount, strengths: strengthsCount, immunes: immunesCount, weakMemberIdx, resistMemberIdx };
  }, [team, typeRelations]);

  // ─── Tipos recomendados para agregar (sección "Tipos") ────────────────────
  // Sugiere qué tipo(s) le convendría tener al PRÓXIMO Pokémon del equipo,
  // basado únicamente en el panorama de tipos actual (no en stats ni rol):
  //   1. Se EXCLUYEN tipos que sean débiles a una debilidad ya compartida por
  //      el equipo (≥2 miembros débiles a ese tipo), para no empeorarla.
  //      Ej.: si Fuego y Eléctrico ya dejan al equipo con 2 miembros débiles
  //      a Tierra, no se sugiere Veneno (débil a Tierra), porque subiría esa
  //      debilidad a 3.
  //   2. Se premia que el tipo candidato RESISTA tipos donde el equipo tiene
  //      poca o ninguna resistencia (0 o 1 miembro resistente), y más aún si
  //      resiste una debilidad compartida existente del equipo.
  const typeAddSuggestions = useMemo(() => {
    const attackingTypes = Object.keys(typeRelations);
    if (!attackingTypes.length) return [];
    const hasTeam = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!hasTeam) return [];

    const currentWeak = analysis.weaknesses;
    const currentResist = analysis.strengths;

    const scored = attackingTypes
      .map((candidateType) => {
        const rel = typeRelations[candidateType];
        if (!rel) return null;
        const candidateWeakTo = new Set((rel.double_damage_from ?? []).map((x) => x.name));
        const candidateResists = new Set([
          ...(rel.half_damage_from ?? []).map((x) => x.name),
          ...(rel.no_damage_from ?? []).map((x) => x.name),
        ]);

        // (1) Filtro duro: ¿este tipo es débil a alguna debilidad compartida
        // (≥2 miembros) que ya tiene el equipo? Si sí, queda descartado.
        const worsensTypes = Object.entries(currentWeak)
          .filter(([t, count]) => count >= 2 && candidateWeakTo.has(t))
          .map(([t]) => t);
        if (worsensTypes.length > 0) return null;

        // (2) Bonus: resiste tipos donde el equipo tiene poca/ninguna resistencia.
        const addsResistTypes: string[] = [];
        let resistBonus = 0;
        attackingTypes.forEach((t) => {
          if (!candidateResists.has(t)) return;
          const existingResistCount = currentResist[t] ?? 0;
          if (existingResistCount <= 1) {
            addsResistTypes.push(t);
            resistBonus += existingResistCount === 0 ? 3 : 1.5;
          }
        });

        // (3) Bonus extra: resiste una debilidad compartida actual del equipo
        // (soluciona un problema real, no solo "cubre un hueco menor").
        const coversWeaknessTypes: string[] = [];
        let coversBonus = 0;
        Object.entries(currentWeak).forEach(([t, count]) => {
          if (candidateResists.has(t)) {
            coversWeaknessTypes.push(t);
            coversBonus += count * 2;
          }
        });

        // (4) Penalización leve por fragilidad general (cuántos tipos lo debilitan).
        const fragilityPenalty = candidateWeakTo.size * 0.5;

        const score = resistBonus + coversBonus - fragilityPenalty;
        if (score <= 0) return null;

        return { type: candidateType, score, addsResistTypes, coversWeaknessTypes };
      })
      .filter((x): x is { type: string; score: number; addsResistTypes: string[]; coversWeaknessTypes: string[] } => x !== null);

    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [team, analysis, typeRelations]);

  // Offense coverage
  const coverage = useMemo(() => {
    const canHitSupereffective: Record<string, number> = {};
    const canHitReduced: Record<string, number> = {};
    Object.keys(typeRelations).forEach((t) => {
      canHitSupereffective[t] = 0;
      canHitReduced[t] = 0;
    });

    team.forEach((slot) => {
      slot.moves.forEach((m) => {
        if (!m.name || m.category === "Status") return;
        // For Hidden Power, use the chosen hiddenPowerType; otherwise use m.type
        const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
        const effectiveType = isHP ? (m.hiddenPowerType ?? null) : m.type;
        if (!effectiveType) return;
        const rel = typeRelations[effectiveType];
        if (!rel) return;
        rel.double_damage_to.forEach((d) => (canHitSupereffective[d.name]++));
        rel.half_damage_to.forEach((d) => (canHitReduced[d.name]++));
        rel.no_damage_to.forEach((d) => (canHitReduced[d.name]++));
      });
    });

    const supCount = Object.values(canHitSupereffective).filter((v) => v > 0).length;
    const redCount = Object.values(canHitReduced).filter((v) => v > 0).length;
    return { supCount, redCount, canHitSupereffective, canHitReduced };
  }, [team, typeRelations]);

  // ─── Sistema de "aporte al equipo" (quién conviene reemplazar) ───────────
  // Para cada miembro del equipo calcula qué tanto aporta de verdad, en vez
  // de asumir que "todos aportan igual". Se basa en 3 cosas objetivas,
  // reutilizando los mismos datos de analysis (weakMemberIdx/resistMemberIdx)
  // que ya se calculan para el resto de la UI, más el mismo esquema de
  // bstBonus que ya usamos en las recomendaciones (stats totales):
  //
  //   1. uniqueResistances: tipos donde ESTE es el ÚNICO miembro que resiste.
  //      Perderlo deja al equipo totalmente expuesto a ese tipo — es lo más
  //      valioso que puede aportar un Pokémon, y pesa fuerte a favor de
  //      mantenerlo.
  //   2. weaknessDrag: tipos donde el equipo YA es débil compartido (2+
  //      miembros débiles) y este es uno de ellos. Si me deshago de él y
  //      pongo algo que no sea débil a eso, esa debilidad compartida mejora.
  //      Pesa en contra.
  //   3. redundantResistances: tipos que resiste pero que 2+ miembros más
  //      también resisten — cobertura "de sobra", no se pierde nada
  //      relevante si se va. Pesa levemente en contra.
  //   4. bst (stats totales): a igual redundancia/drag, preferimos conservar
  //      al más fuerte en términos brutos.
  //
  // El resultado es un "valor de permanencia" por miembro: cuanto MÁS bajo,
  // más conviene reemplazarlo. Se ordena de menor a mayor (peor primero).
  const teamContribution = useMemo(() => {
    if (!Object.keys(typeRelations).length) return [];
    // No sugerir a quién reemplazar con menos de 3 Pokémon cargados: con tan
    // pocos miembros cualquier comparación de "aporte" es poco significativa
    // (casi siempre el equipo entero terminaría siendo "único" en algo).
    const filledSlotsCount = team.filter(
      (s) => s.name.trim() !== "" && s.types.filter(Boolean).length > 0
    ).length;
    if (filledSlotsCount < 3) return [];
    const { weakMemberIdx, resistMemberIdx, weaknesses: teamWeaknesses } = analysis;

    return team
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot }) => slot.name.trim() !== "" && slot.types.filter(Boolean).length > 0)
      .map(({ slot, idx }) => {
        const uniqueResistTypes: string[] = [];
        const redundantResistTypes: string[] = [];
        const dragWeaknessTypes: string[] = [];

        Object.entries(resistMemberIdx).forEach(([atkType, members]) => {
          if (!members.includes(idx)) return;
          if (members.length === 1) uniqueResistTypes.push(atkType);
          else redundantResistTypes.push(atkType);
        });
        Object.entries(weakMemberIdx).forEach(([atkType, members]) => {
          if (!members.includes(idx)) return;
          if ((teamWeaknesses[atkType] ?? 0) >= 2) dragWeaknessTypes.push(atkType);
        });

        const bst = slot.stats
          ? Object.values(slot.stats).reduce((sum: number, v: number) => sum + v, 0)
          : 0;
        const bstBonus = Math.max(0, Math.min(80, ((bst - 300) / (720 - 300)) * 80));

        // Ponderación: cubrir algo único vale mucho más que el resto —
        // preferimos avisar "ojo, es el único que te tapa X" antes que
        // sugerir sacarlo solo porque tiene stats bajas.
        const value =
          uniqueResistTypes.length * 30 -
          dragWeaknessTypes.length * 15 -
          redundantResistTypes.length * 5 +
          bstBonus * 0.5;

        return {
          idx,
          slot,
          bst,
          uniqueResistTypes,
          redundantResistTypes,
          dragWeaknessTypes,
          value,
        };
      })
      .sort((a, b) => a.value - b.value); // peor aporte primero
  }, [team, typeRelations, analysis]);

  // Attack type suggestions: find which move type covers the most uncovered types
  const attackSuggestions = useMemo(() => {
    if (!Object.keys(typeRelations).length) return [];
    const uncovered = Object.entries(coverage.canHitSupereffective)
      .filter(([_, v]) => v === 0)
      .map(([t]) => t);
    if (uncovered.length === 0) return [];

    const uncoveredSet = new Set(uncovered);
    // For each possible attacking type, count how many uncovered types it hits super-effectively
    const scores: Array<{ atkType: string; covers: string[]; score: number }> = [];
    Object.keys(typeRelations).forEach((atkType) => {
      const rel = typeRelations[atkType];
      if (!rel) return;
      const covers = rel.double_damage_to
        .map((d) => d.name)
        .filter((t: string) => uncoveredSet.has(t));
      if (covers.length > 0) scores.push({ atkType, covers, score: covers.length });
    });
    // Sort by coverage count desc, deduplicate by coverage set to avoid near-identical suggestions
    scores.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    return scores
      .filter((s) => { const key = s.covers.slice().sort().join(","); if (seen.has(key)) return false; seen.add(key); return true; })
      .slice(0, 3);
  }, [coverage, typeRelations]);

  // Tipos con MENOR cobertura (distinto de "sin cobertura", que ya son 0×):
  // toma el conteo mínimo mayor a 0 entre los tipos que sí golpeamos, junta
  // todos los tipos empatados en ese mínimo, y calcula qué 1 o 2 tipos de
  // ataque cubrirían la mayor cantidad posible de esos tipos débiles.
  const weakCoverageSuggestion = useMemo(() => {
    if (!Object.keys(typeRelations).length) return null;
    const nonZeroEntries = Object.entries(coverage.canHitSupereffective).filter(([, v]) => v > 0);
    if (nonZeroEntries.length === 0) return null;
    const minCount = Math.min(...nonZeroEntries.map(([, v]) => v));
    const weakTypes = nonZeroEntries.filter(([, v]) => v === minCount).map(([ty]) => ty);

    // Para cada tipo de ataque candidato, qué tipos débiles cubriría si lo agregamos
    const atkCoverage: Record<string, string[]> = {};
    Object.keys(typeRelations).forEach((atkType) => {
      const rel = typeRelations[atkType];
      if (!rel) return;
      const covers = rel.double_damage_to.map((d) => d.name).filter((ty: string) => weakTypes.includes(ty));
      if (covers.length > 0) atkCoverage[atkType] = covers;
    });
    const candidates = Object.keys(atkCoverage);
    if (candidates.length === 0) return { minCount, weakTypes, bestTypes: [] as { atkType: string; covered: string[] }[] };

    if (weakTypes.length === 1) {
      // Con un solo tipo débil, cualquier tipo de ataque que lo cubra sirve;
      // mostramos todos los candidatos (empatados, todos cubren ese único tipo).
      const sorted = candidates.slice().sort();
      return {
        minCount,
        weakTypes,
        bestTypes: sorted.map((ty) => ({ atkType: ty, covered: atkCoverage[ty] })),
      };
    }

    // Con 2+ tipos débiles: NO buscamos la mejor combinación conjunta, sino
    // el/los tipo(s) de ataque que, CADA UNO POR SU CUENTA, cubran la mayor
    // cantidad de tipos débiles. Si hay un empate (ej. 2 tipos que cubren 2
    // cada uno), se recomiendan ambos por separado.
    const maxSingle = Math.max(...candidates.map((ty) => atkCoverage[ty].length));
    const bestTypes = candidates
      .filter((ty) => atkCoverage[ty].length === maxSingle)
      .sort()
      .map((ty) => ({ atkType: ty, covered: atkCoverage[ty] }));
    return { minCount, weakTypes, bestTypes };
  }, [coverage, typeRelations]);

  // Feature 1: movimientos ofensivos repetidos por tipo. A partir de 3
  // movimientos del mismo tipo de ataque en el equipo, el/los adicionales ya
  // no suman cobertura nueva (pegan a los mismos tipos que el primero), así
  // que vale la pena marcarlo como posible desperdicio de un moveslot.
  const moveTypeRedundancy = useMemo(() => {
    const byType: Record<string, string[]> = {};
    const countByType: Record<string, number> = {};
    team.forEach((slot) => {
      slot.moves.forEach((m) => {
        if (!m.name || m.category === "Status") return;
        const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
        const effectiveType = isHP ? (m.hiddenPowerType ?? null) : m.type;
        if (!effectiveType) return;
        countByType[effectiveType] = (countByType[effectiveType] ?? 0) + 1;
        const names = (byType[effectiveType] ??= []);
        const pokemonName = slot.name || "?";
        if (!names.includes(pokemonName)) names.push(pokemonName);
      });
    });
    return Object.entries(countByType)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([atkType, count]) => ({ atkType, count, pokemonNames: byType[atkType] }));
  }, [team]);

  // Debilidades compartidas del equipo (fusiona lo que antes estaban eran dos
  // cosas separadas: el resumen "debilidad más compartida" acá en Tipos, y la
  // mitad defensiva de "Sugerencias de balance" en otra tarjeta aparte).
  // Para cada tipo al que 2+ Pokémon del equipo son débiles: cuántos son,
  // quiénes, y qué tipo(s) lo resisten como sugerencia de arreglo — todo en
  // un solo lugar en vez de repetido con distinto estilo en dos tarjetas.
  const sharedWeaknesses = useMemo(() => {
    const entries = Object.entries(analysis.weaknesses).filter(([, c]) => c >= 3);
    if (entries.length === 0) return [];
    return entries
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([weakType, count]) => {
        const names = (analysis.weakMemberIdx[weakType] || []).map((idx) => team[idx]?.name).filter(Boolean);
        const rel = typeRelations[weakType];
        const resistantTypes = rel
          ? allTypes.filter((ty) => {
              const halfTo = new Set(rel.half_damage_to.map((x) => x.name));
              const noTo = new Set(rel.no_damage_to.map((x) => x.name));
              return halfTo.has(ty) || noTo.has(ty);
            }).slice(0, 3)
          : [];
        return { weakType, count, names, resistantTypes };
      });
  }, [analysis, team, typeRelations, allTypes]);



  return {
    analysis,
    typeAddSuggestions,
    coverage,
    teamContribution,
    attackSuggestions,
    weakCoverageSuggestion,
    moveTypeRedundancy,
    sharedWeaknesses,
  };
}
