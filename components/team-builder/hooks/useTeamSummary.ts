// components/team-builder/hooks/useTeamSummary.ts
//
// La lectura "de arriba" del equipo: balance de stats con sugerencias de rol,
// reparto de roles, el dashboard del modo avanzado, el desglose por tipo, el
// resumen para el usuario y la nota global de 0 a 100.
//
// A diferencia de useTeamAnalysis (que solo mira tipos), esto mezcla stats,
// roles y movimientos, y necesita el idioma porque parte de lo que devuelve
// son frases para enseñar tal cual.

import { useMemo } from "react";
import type { BaseStats, Lang, Slot } from "../types";
import type { DamageRelations } from "../data/staticPokeData";
import { BALANCED_ROLE } from "../utils/constants";
import { getEffectiveRole, getSpeedTier, scoreAllRoles } from "../utils/roleCalculations";
import { STAT_NAMES_I18N } from "../utils/stats";
import { UI } from "../utils/i18n";
import type { useTeamAnalysis } from "./useTeamAnalysis";

type Analisis = ReturnType<typeof useTeamAnalysis>;

export function useTeamSummary(
  team: Slot[],
  typeRelations: Record<string, DamageRelations>,
  allTypes: string[],
  lang: Lang,
  /** Vienen de useTeamAnalysis: este hook parte de lo que aquel ya calculó. */
  analysis: Analisis["analysis"],
  coverage: Analisis["coverage"],
) {
  // `t` sale del idioma, así que no hace falta pasarlo aparte.
  const t = UI[lang];
  // Stats balance analysis with role-based suggestions
  const statsAnalysis = useMemo(() => {
    const STAT_KEYS: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];
    const slotsWithStats = team.filter((s) => s.stats !== null && s.stats !== undefined);
    if (slotsWithStats.length < 3) return null;

    const count = slotsWithStats.length;
    const averages = {} as BaseStats;
    STAT_KEYS.forEach((key) => {
      const total = slotsWithStats.reduce((sum, s) => sum + (s.stats![key] ?? 0), 0);
      averages[key] = Math.round(total / count);
    });

    // More realistic thresholds for competitive Pokémon
    // ALTO ≥ 90, MEDIO 75–89, BAJO < 75
    const level = (v: number): "alto" | "medio" | "bajo" =>
      v >= 90 ? "alto" : v >= 75 ? "medio" : "bajo";

    const levels = {} as Record<keyof BaseStats, "alto" | "medio" | "bajo">;
    STAT_KEYS.forEach((k) => { levels[k] = level(averages[k]); });

    const STAT_NAMES = STAT_NAMES_I18N[lang];

    // Gap score: how far below the team's best stat each stat is
    const teamMax = Math.max(...STAT_KEYS.map((k) => averages[k]));
    const gaps = {} as Record<keyof BaseStats, number>;
    STAT_KEYS.forEach((k) => { gaps[k] = teamMax - averages[k]; });

    // Pre-compute which roles the team already has and how many
    const existingRoleCounts: Record<string, number> = {};
    slotsWithStats.forEach((s) => {
      const r = getEffectiveRole(s, lang);
      if (!r) return;
      existingRoleCounts[r.label] = (existingRoleCounts[r.label] ?? 0) + 1;
    });

    // Build role suggestions: score each ROLE against team average stats
    // Prefer roles the team lacks most.
    // Se excluye BALANCED_ROLE ("Todoterreno Puro") de esta sugerencia: su
    // score depende de qué tan PAREJO está el promedio de stats del equipo
    // (ver getBalanceScore), y cualquier equipo real con Pokémon especializados
    // va a tener un promedio con bastante dispersión — por eso este rol casi
    // siempre queda con el score más bajo y "gana" como sugerencia, aunque en
    // la práctica solo un puñado de legendarios (Mew, Arceus) lo cumplen. No
    // tiene sentido recomendarle al usuario que consiga uno de esos como
    // "el rol que le falta al equipo". Sigue detectándose normalmente para
    // Pokémon individuales vía getRole (ej. si ya tienes un Mew en el equipo).
    const avgStats: BaseStats = averages;
    const allRoleScores = scoreAllRoles(avgStats).filter((r) => r.role.es !== BALANCED_ROLE.es);

    // Sort by score ascending (weakest roles in the team avg = most needed)
    // But penalize roles already heavily covered
    const suggestions = allRoleScores
      .map(({ role, score }) => {
        const existingCount = existingRoleCounts[role[lang]] ?? 0;
        // Penalize roles the team already has plenty of: since lower score = "more needed",
        // we must ADD points (push it away from the minimum), not subtract.
        const adjustedScore = score + existingCount * 25;
        // Find which stats are weakest for this role
        const statEntries = Object.entries(role.weights) as [keyof BaseStats, number][];
        const [statA, statB] = statEntries
          .sort(([, a], [, b]) => b - a)
          .map(([k]) => k);
        return { role: { label: role[lang], color: role.color }, statA, statB: statB ?? statA, existingCount, score: adjustedScore };
      })
      .sort((a, b) => a.score - b.score); // lowest score = most needed

    const seen = new Set<string>();
    const topSuggestions = suggestions
      .filter((s) => { if (seen.has(s.role.label)) return false; seen.add(s.role.label); return true; })
      .slice(0, 2);

    // Role redundancy: flag any role with 3+ Pokémon
    const roleCounts: Record<string, { role: { label: string; color: string }; count: number; pokemon: string[] }> = {};
    slotsWithStats.forEach((s) => {
      if (!s.name) return;
      const r = getEffectiveRole(s, lang);
      if (!r) return;
      if (!roleCounts[r.label]) roleCounts[r.label] = { role: r, count: 0, pokemon: [] };
      roleCounts[r.label].count++;
      roleCounts[r.label].pokemon.push(s.isFake ? `${s.name} ★` : s.name);
    });
    const redundantRoles = Object.values(roleCounts).filter((r) => r.count >= 3);

    // allBalanced: no stat is BAJO AND no big gap (>25 pts from max) AND no redundancy
    const hasLow = STAT_KEYS.some((k) => levels[k] === "bajo");
    const hasBigGap = STAT_KEYS.some((k) => gaps[k] > 25);
    const allBalanced = !hasLow && !hasBigGap && redundantRoles.length === 0;

    return { averages, levels, gaps, STAT_KEYS, STAT_NAMES, count, topSuggestions, allBalanced, redundantRoles };
  }, [team, lang]);

  // Roles summary — includes Fakemon with stats
  const rolesSummary = useMemo(() => {
    const counts: Record<string, { label: string; color: string; count: number; pokemon: string[] }> = {};
    team.forEach((slot) => {
      if (!slot.name) return;
      if (!slot.stats) return;
      const role = getEffectiveRole(slot, lang);
      if (!role) return;
      if (!counts[role.label]) counts[role.label] = { ...role, count: 0, pokemon: [] };
      counts[role.label].count++;
      counts[role.label].pokemon.push(slot.isFake ? `${slot.name} ★` : slot.name);
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [team, lang]);

  // Dashboard: all team-level metrics in one place
  const dashboard = useMemo(() => {
    const total = Object.keys(typeRelations).length;
    const filledSlots = team.filter((s) => s.types.filter(Boolean).length > 0);
    if (!filledSlots.length || !total) return null;

    // Offensive coverage %
    const offPct = total > 0 ? Math.round((coverage.supCount / total) * 100) : 0;

    // Defensive breakdown: for each type, how many Pokémon are weak / resist / immune
    const defWeakCount = Object.values(analysis.weaknesses).filter((v) => v > 0).length;
    // "Cubierto" = resiste (0.5x) O es inmune (0x) a ese tipo — unión de
    // ambos conjuntos, sin contar dos veces un tipo que tenga de las dos.
    const coveredTypes = new Set([
      ...Object.keys(analysis.strengths).filter((t) => analysis.strengths[t] > 0),
      ...Object.keys(analysis.immunes).filter((t) => analysis.immunes[t] > 0),
    ]);
    const defResistCount = coveredTypes.size;
    const defTotal = total;
    const defPct = defTotal > 0 ? Math.round((defResistCount / defTotal) * 100) : 0;

    // Phys vs Special balance (based on move categories)
    let physMoves = 0, specMoves = 0;
    team.forEach((s) => s.moves.forEach((m) => {
      if (!m.name) return;
      if (m.category === "Physical") physMoves++;
      if (m.category === "Special") specMoves++;
    }));
    const totalMoves = physMoves + specMoves;
    const physPct = totalMoves > 0 ? Math.round((physMoves / totalMoves) * 100) : 50;
    const specPct = totalMoves > 0 ? 100 - physPct : 50;

    // Average speed + BST
    const slotsWithStats = team.filter((s) => s.stats);
    const avgSpe = slotsWithStats.length
      ? Math.round(slotsWithStats.reduce((a, s) => a + s.stats!.SPE, 0) / slotsWithStats.length) : 0;
    const avgBST = slotsWithStats.length
      ? Math.round(slotsWithStats.reduce((a, s) => {
          const st = s.stats!;
          return a + st.HP + st.ATK + st.DEF + st["SP.ATK"] + st["SP.DEF"] + st.SPE;
        }, 0) / slotsWithStats.length) : 0;

    // Speed tier label for team
    const speedTier = getSpeedTier(avgSpe, lang);

    // Role distribution
    const roleDist = rolesSummary;

    return { offPct, defPct, defWeakCount, defResistCount, physPct, specPct, avgSpe, avgBST, speedTier, roleDist, filledCount: filledSlots.length };
  }, [team, typeRelations, coverage, analysis, rolesSummary, lang]);

  // Per-type breakdown: which Pokémon are weak/resist/immune to each type
  const typeDetail = useMemo(() => {
    const result: Record<string, { weak: { name: string; sprite?: string | null; mult: number }[]; resist: { name: string; sprite?: string | null; mult: number }[]; immune: { name: string; sprite?: string | null }[] }> = {};
    Object.keys(typeRelations).forEach((atk) => {
      const rel = typeRelations[atk];
      if (!rel) return;
      const doubleTo = new Set(rel.double_damage_to.map((t) => t.name));
      const halfTo   = new Set(rel.half_damage_to.map((t) => t.name));
      const noTo     = new Set(rel.no_damage_to.map((t) => t.name));
      const weak: { name: string; sprite?: string | null; mult: number }[] = [];
      const resist: { name: string; sprite?: string | null; mult: number }[] = [];
      const immune: { name: string; sprite?: string | null }[] = [];
      team.forEach((poke) => {
        const types = poke.types.filter(Boolean);
        if (!types.length || !poke.name) return;
        let mult = 1;
        types.forEach((def) => {
          if (noTo.has(def)) mult *= 0;
          else if (doubleTo.has(def)) mult *= 2;
          else if (halfTo.has(def)) mult *= 0.5;
        });
        if (mult === 0) immune.push({ name: poke.name, sprite: poke.sprite });
        else if (mult >= 2) weak.push({ name: poke.name, sprite: poke.sprite, mult });
        else if (mult <= 0.5) resist.push({ name: poke.name, sprite: poke.sprite, mult });
      });
      result[atk] = { weak, resist, immune };
    });
    return result;
  }, [team, typeRelations]);

  // Team summary: combine type gaps + stat role gaps → suggest a Pokémon type + role
  const teamSummary = useMemo(() => {
    if (!Object.keys(typeRelations).length) return null;
    const hasTeam = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!hasTeam) return null;

    // 1. Collect defensive needs: types the team is weak to (≥2 Pokémon)
    const defensiveNeeds = Object.entries(analysis.weaknesses)
      .filter(([_, c]) => c >= 2)
      .sort(([, a], [, b]) => b - a)
      .map(([t]) => t);

    // 2. Collect offensive gaps: types with 0 supereffective coverage
    const offensiveGaps = Object.entries(coverage.canHitSupereffective)
      .filter(([_, v]) => v === 0)
      .map(([t]) => t);

    // 3. Stat role needed (top suggestion from statsAnalysis)
    const neededRole = statsAnalysis?.topSuggestions?.[0] ?? null;

    if (defensiveNeeds.length === 0 && offensiveGaps.length === 0 && !neededRole) return null;

    // 4. Score each candidate type (and dual combos) by how many needs they address
    // Single types
    const candidateScores: Record<string, { score: number; defensiveCovers: string[]; offensiveCovers: string[] }> = {};

    allTypes.forEach((candidateType) => {
      const rel = typeRelations[candidateType];
      if (!rel) return;
      // Defensive: does this type RESIST the team's weak types?
      const resistedByCandidate = new Set([
        ...rel.half_damage_from?.map((x) => x.name) ?? [],
        ...rel.no_damage_from?.map((x) => x.name) ?? [],
      ]);
      const defensiveCovers = defensiveNeeds.filter((t) => resistedByCandidate.has(t));

      // Offensive: does this type hit the gaps super-effectively?
      const superEffTo = new Set(rel.double_damage_to?.map((x) => x.name) ?? []);
      const offensiveCovers = offensiveGaps.filter((t) => superEffTo.has(t));

      // Severidad: pesa cada debilidad resuelta según CUÁNTOS miembros del
      // equipo son débiles a ese tipo (analysis.weaknesses[t]), en vez de un
      // punto fijo por tipo. Así, resolver una debilidad que afecta a 4
      // miembros vale mucho más que una que solo afecta a 2 — mismo criterio
      // de severidad (before.weak) que usa scorePokemonCandidate en priority1,
      // para que este resumen y el ranking de candidatos no se contradigan.
      const defensiveWeight = defensiveCovers.reduce((sum, t) => sum + (analysis.weaknesses[t] ?? 0), 0);
      const score = defensiveWeight * 2 + offensiveCovers.length;
      if (score > 0) {
        candidateScores[candidateType] = { score, defensiveCovers, offensiveCovers };
      }
    });

    // Pick top 3 single types
    const topTypes = Object.entries(candidateScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 3)
      .map(([t, data]) => ({ type: t, ...data, isDouble: false }));

    // 5. Try top dual-type combos from top candidates
    const topCandidates = Object.entries(candidateScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 5)
      .map(([t]) => t);

    let bestDual: { types: string[]; score: number; defensiveCovers: string[]; offensiveCovers: string[] } | null = null;
    for (let i = 0; i < topCandidates.length; i++) {
      for (let j = i + 1; j < topCandidates.length; j++) {
        const t1 = topCandidates[i], t2 = topCandidates[j];
        const d1 = candidateScores[t1], d2 = candidateScores[t2];
        const combinedDef = [...new Set([...d1.defensiveCovers, ...d2.defensiveCovers])];
        const combinedOff = [...new Set([...d1.offensiveCovers, ...d2.offensiveCovers])];
        const combinedDefWeight = combinedDef.reduce((sum, t) => sum + (analysis.weaknesses[t] ?? 0), 0);
        const score = combinedDefWeight * 2 + combinedOff.length;
        if (!bestDual || score > bestDual.score) {
          bestDual = { types: [t1, t2], score, defensiveCovers: combinedDef, offensiveCovers: combinedOff };
        }
      }
    }

    return {
      topTypes,
      bestDual,
      neededRole,
      defensiveNeeds: defensiveNeeds.slice(0, 3),
      offensiveGaps: offensiveGaps.slice(0, 3),
    };
  }, [team, analysis, coverage, typeRelations, allTypes, statsAnalysis]);

  // ─── Puntuación general del equipo (0-100) ──────────────────────────────────
  // Combina 4 pilares ya calculados en otras partes de la app (mismas fuentes
  // que alimentan el resto de la UI, para que el número sea consistente con
  // lo que el usuario ya ve en pantalla):
  //   1. Cobertura ofensiva  (coverage.supCount / nº de tipos)
  //   2. Solidez defensiva   (analysis.weaknesses / analysis.strengths)
  //   3. Balance de stats    (statsAnalysis: niveles + brechas)
  //   4. Diversidad de roles (rolesSummary: redundancia de roles)
  // Cada pilar puntúa 0-100. Si un pilar no tiene datos suficientes (p.ej.
  // menos de 3 Pokémon con stats) se omite del promedio final y su peso se
  // redistribuye entre los pilares restantes, para no penalizar equipos
  // incompletos con un número injustamente bajo.
  const teamScore = useMemo(() => {
    const totalTypes = Object.keys(typeRelations).length;
    const hasTeamWithTypes = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!totalTypes || !hasTeamWithTypes) return null;

    // No mostrar puntuación hasta que al menos 3 Pokémon del equipo tengan
    // los 4 movimientos cargados (evita puntuar equipos a medio armar).
    const slotsWithFullMoves = team.filter(
      (s) => s.moves.filter((m) => m.name && m.name.trim() !== "").length >= 4
    );
    if (slotsWithFullMoves.length < 3) return null;

    const pillars: { key: "offense" | "defense" | "stats" | "roles"; score: number; available: boolean }[] = [];

    // 1. Cobertura ofensiva: % de tipos que el equipo golpea superefectivamente
    const offenseScore = Math.round((coverage.supCount / totalTypes) * 100);
    pillars.push({ key: "offense", score: offenseScore, available: true });

    // 2. Solidez defensiva: penaliza debilidades compartidas por 2+ Pokémon,
    // más fuerte cuantos más Pokémon comparten esa debilidad; premia resistencias.
    let defenseScore = 100;
    Object.values(analysis.weaknesses).forEach((count) => {
      if (count >= 3) defenseScore -= 16;
      else if (count >= 2) defenseScore -= 8;
    });
    const coveredTypesForScore = new Set([
      ...Object.keys(analysis.strengths).filter((tp) => analysis.strengths[tp] > 0),
      ...Object.keys(analysis.immunes).filter((tp) => analysis.immunes[tp] > 0),
    ]);
    const resistBonus = Math.min(coveredTypesForScore.size * 2, 20);
    defenseScore = Math.max(0, Math.min(100, defenseScore + resistBonus));
    pillars.push({ key: "defense", score: defenseScore, available: true });

    // 3. Balance de stats: solo si hay suficientes Pokémon con stats (mismo
    // umbral que statsAnalysis, que ya exige 3+).
    if (statsAnalysis) {
      const STAT_KEYS = statsAnalysis.STAT_KEYS;
      let statsScore = 100;
      STAT_KEYS.forEach((k) => {
        const lv = statsAnalysis.levels[k];
        if (lv === "bajo") statsScore -= 12;
        else if (lv === "medio") statsScore -= 4;
        const gap = statsAnalysis.gaps[k];
        if (gap > 25) statsScore -= 6;
      });
      statsScore -= statsAnalysis.redundantRoles.length * 10;
      statsScore = Math.max(0, Math.min(100, statsScore));
      pillars.push({ key: "stats", score: statsScore, available: true });
    } else {
      pillars.push({ key: "stats", score: 0, available: false });
    }

    // 4. Diversidad de roles: más roles distintos = mejor; penaliza
    // concentración (muchos Pokémon en el mismo rol).
    if (rolesSummary.length > 0) {
      const totalWithRole = rolesSummary.reduce((sum, r) => sum + r.count, 0);
      const distinctRoles = rolesSummary.length;
      const maxShare = Math.max(...rolesSummary.map((r) => r.count)) / totalWithRole;
      // Bono por variedad (hasta 6 roles distintos = ideal para un equipo de 6)
      const varietyScore = Math.min((distinctRoles / Math.min(totalWithRole, 6)) * 100, 100);
      // Penalización por concentración: si todo el equipo comparte 1-2 roles, baja fuerte
      const concentrationPenalty = maxShare > 0.5 ? (maxShare - 0.5) * 100 : 0;
      const rolesScore = Math.max(0, Math.min(100, Math.round(varietyScore - concentrationPenalty)));
      pillars.push({ key: "roles", score: rolesScore, available: true });
    } else {
      pillars.push({ key: "roles", score: 0, available: false });
    }

    const availablePillars = pillars.filter((p) => p.available);
    if (!availablePillars.length) return null;

    const total = Math.round(
      availablePillars.reduce((sum, p) => sum + p.score, 0) / availablePillars.length
    );

    const grade =
      total >= 90 ? { label: t.teamScoreGradeS, color: "#10b981" } :
      total >= 75 ? { label: t.teamScoreGradeA, color: "#38bdf8" } :
      total >= 55 ? { label: t.teamScoreGradeB, color: "#facc15" } :
      total >= 35 ? { label: t.teamScoreGradeC, color: "#fb923c" } :
                     { label: t.teamScoreGradeD, color: "#f87171" };

    return {
      total,
      grade,
      offense: pillars.find((p) => p.key === "offense")!,
      defense: pillars.find((p) => p.key === "defense")!,
      stats: pillars.find((p) => p.key === "stats")!,
      roles: pillars.find((p) => p.key === "roles")!,
    };
  }, [team, typeRelations, coverage, analysis, statsAnalysis, rolesSummary, t]);

  // Nota: RoleBadge ahora es components/RoleBadge.tsx (compartido, se usa en
  // 9 puntos del render: slots del equipo, resumen, recomendaciones, etc.)

  // moveBgStyle, moveCategoryClass y moveCategoryDot: se fueron con el resto
  // del render de movimientos a TeamGrid.


  return { statsAnalysis, rolesSummary, dashboard, typeDetail, teamSummary, teamScore };
}
