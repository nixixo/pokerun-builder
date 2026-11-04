import type { CandidateScoreResult, TeamDefenseProfile } from "../types";

interface TypeRelation {
  double_damage_to: { name: string }[];
  half_damage_to: { name: string }[];
  no_damage_to: { name: string }[];
}

// ─── Perfil defensivo ────────────────────────────────────────────────────────

/** Multiplicadores defensivos de una combinación de tipos frente a cada tipo atacante. */
export const computeDefensiveProfile = (
  pokemonTypes: string[],
  typeRelations: Record<string, TypeRelation>
): Record<string, number> => {
  const result: Record<string, number> = {};
  Object.keys(typeRelations).forEach((atkType) => {
    const rel = typeRelations[atkType];
    if (!rel) { result[atkType] = 1; return; }
    let mult = 1;
    pokemonTypes.forEach((defType) => {
      if (rel.double_damage_to?.some((t: {name: string}) => t.name === defType)) mult *= 2;
      if (rel.half_damage_to?.some((t: {name: string}) => t.name === defType)) mult *= 0.5;
      if (rel.no_damage_to?.some((t: {name: string}) => t.name === defType)) mult *= 0;
    });
    result[atkType] = mult;
  });
  return result;
};

/**
 * Perfil defensivo agregado de un equipo: para cada tipo atacante, cuántos
 * Pokémon del equipo son débiles (≥2×), resistentes (≤0.5×, >0) o inmunes (0×).
 */
export const computeTeamDefenseProfile = (
  teamTypesList: string[][], // un array de tipos por cada miembro del equipo (incluyendo al candidato si se simula)
  typeRelations: Record<string, TypeRelation>
): TeamDefenseProfile => {
  const profile: TeamDefenseProfile = {};
  Object.keys(typeRelations).forEach((atkType) => {
    const rel = typeRelations[atkType];
    if (!rel) return;
    const doubleTo = new Set(rel.double_damage_to?.map((t: {name: string}) => t.name) ?? []);
    const halfTo = new Set(rel.half_damage_to?.map((t: {name: string}) => t.name) ?? []);
    const noTo = new Set(rel.no_damage_to?.map((t: {name: string}) => t.name) ?? []);
    let weak = 0, resist = 0, immune = 0, maxMult = 0;
    teamTypesList.forEach((pokeTypes) => {
      const types = pokeTypes.filter(Boolean);
      if (!types.length) return;
      let mult = 1;
      types.forEach((def) => {
        if (noTo.has(def)) mult *= 0;
        else if (doubleTo.has(def)) mult *= 2;
        else if (halfTo.has(def)) mult *= 0.5;
      });
      if (mult === 0) immune++;
      else if (mult >= 2) { weak++; maxMult = Math.max(maxMult, mult); }
      else if (mult <= 0.5) resist++;
    });
    profile[atkType] = { weak, resist, immune, maxMult };
  });
  return profile;
};

// ─── Motor de puntuación de candidatos ──────────────────────────────────────
// Simula cómo cambiaría el perfil defensivo del equipo si se añadiera cada
// Pokémon candidato, y le asigna una puntuación siguiendo, en este orden de
// prioridad:
//   1) Reducir las debilidades más graves del equipo (×3, ×4...).
//   2) Evitar crear nuevas debilidades críticas.
//   3) Aumentar resistencias e inmunidades.
//   4) Mejorar el equilibrio general del equipo.
// No siempre es posible cumplir las cuatro a la vez, así que cada prioridad
// pesa más que la suma de todas las de menor prioridad (pesos en cascada).
export const scorePokemonCandidate = (
  team: { types: string[] }[],
  candidateTypes: string[],
  typeRelations: Record<string, TypeRelation>
): CandidateScoreResult => {
  const currentTypesList = team.map((s) => s.types).filter((tt) => tt.filter(Boolean).length > 0);
  const beforeProfile = computeTeamDefenseProfile(currentTypesList, typeRelations);
  const afterProfile = computeTeamDefenseProfile([...currentTypesList, candidateTypes], typeRelations);
  const candidateProfile = computeDefensiveProfile(candidateTypes, typeRelations);

  const reduces: string[] = [];
  const immunities: string[] = [];
  const newResistances: string[] = [];
  const criticalAdds: string[] = [];
  const addsWeakness: string[] = [];

  let priority1 = 0; // reducir debilidades graves existentes (peso más alto)
  let priority2 = 0; // penalización por nuevas debilidades críticas
  let priority3 = 0; // resistencias / inmunidades nuevas
  let priority4 = 0; // equilibrio general (resto de matices)

  Object.keys(typeRelations).forEach((atkType) => {
    const before = beforeProfile[atkType] ?? { weak: 0, resist: 0, immune: 0, maxMult: 0 };
    const candidateMult = candidateProfile[atkType] ?? 1;
    const teamWasWeak = before.weak > 0;
    const teamWasSeverelyWeak = before.weak >= 2 || before.maxMult >= 4; // "debilidad grave" del equipo

    // ── Prioridad 1: reducir las debilidades más graves ──────────────────
    if (teamWasWeak && candidateMult === 0) {
      immunities.push(atkType);
      reduces.push(atkType);
      priority1 += (teamWasSeverelyWeak ? 3 : 1.6) * before.weak;
    } else if (teamWasWeak && candidateMult <= 0.5) {
      reduces.push(atkType);
      priority1 += (teamWasSeverelyWeak ? 2 : 1) * before.weak;
    }

    // ── Prioridad 2: evitar generar/empeorar debilidades críticas ────────
    // Una debilidad se considera crítica para el equipo cuando, tras añadir
    // al candidato, hay 2+ Pokémon débiles a ese tipo, o el candidato es
    // ×4 (debilidad doble) frente a un tipo, o una debilidad ×2 existente
    // del equipo se convierte en ×4 al incorporar este Pokémon.
    // También se penaliza cuando tras añadir al candidato hay ≥3 miembros
    // débiles al mismo tipo (triple debilidad de equipo = crítico absoluto).
    if (candidateMult >= 2) {
      const afterWeak = afterProfile[atkType]?.weak ?? 0;
      const becomesCritical =
        candidateMult >= 4 ||
        afterWeak >= 2;
      const becomesAbsoluteCritical = afterWeak >= 3;
      if (becomesAbsoluteCritical) {
        criticalAdds.push(atkType);
        priority2 -= 20; // penalización máxima: triple debilidad de equipo
      } else if (becomesCritical) {
        criticalAdds.push(atkType);
        priority2 -= candidateMult >= 4 ? 10 : 6;
      } else {
        addsWeakness.push(atkType);
        priority2 -= 0.8;
      }
    }

    // ── Prioridad 3: aumentar resistencias e inmunidades ──────────────────
    // Rendimientos decrecientes según cuántos miembros del equipo YA
    // resisten ese tipo (before.resist). Resistir un tipo que nadie cubre
    // todavía vale su puntaje completo; resistir un tipo que ya tiene 2-3
    // resistentes en el equipo aporta cada vez menos (la cobertura real ya
    // está resuelta, es redundancia, no progreso).
    if (!teamWasWeak) {
      const depthFactor = 1 / (1 + before.resist);
      if (candidateMult === 0) {
        newResistances.push(atkType);
        priority3 += 1.2 * depthFactor;
      } else if (candidateMult <= 0.5) {
        newResistances.push(atkType);
        priority3 += 0.6 * depthFactor;
      }
    }
  });

  // ── Prioridad 4: equilibrio general ─────────────────────────────────────
  // Pequeño ajuste por el número neto de tipos resueltos vs. número de tipos
  // de los que el candidato es débil en general (mejora la robustez global,
  // no solo frente a las debilidades actuales del equipo).
  const candidateWeakCount = Object.values(candidateProfile).filter((m) => m >= 2).length;
  const candidateResistCount = Object.values(candidateProfile).filter((m) => m <= 0.5).length;
  priority4 += (candidateResistCount - candidateWeakCount) * 0.1;

  // Pesos en cascada: cada prioridad domina sobre la suma de las siguientes.
  const score = priority1 * 1000 + priority2 * 100 + priority3 * 10 + priority4;

  return { score, priority1, priority2, priority3, priority4, reduces, immunities, newResistances, criticalAdds, addsWeakness };
};

/** Devuelve todos los tipos atacantes frente a los que el Pokémon es débil (×2 o más). */
export const getCandidateWeaknesses = (
  pokemonTypes: string[],
  typeRelations: Record<string, TypeRelation>
): string[] => {
  const types = pokemonTypes.filter(Boolean);
  if (!types.length || !Object.keys(typeRelations).length) return [];
  return Object.keys(typeRelations).filter((atkType) => {
    const rel = typeRelations[atkType];
    if (!rel) return false;
    const doubleTo = new Set(rel.double_damage_to?.map((t: {name: string}) => t.name) ?? []);
    const halfTo   = new Set(rel.half_damage_to?.map((t: {name: string}) => t.name) ?? []);
    const noTo     = new Set(rel.no_damage_to?.map((t: {name: string}) => t.name) ?? []);
    let mult = 1;
    types.forEach((def) => {
      if (noTo.has(def)) mult *= 0;
      else if (doubleTo.has(def)) mult *= 2;
      else if (halfTo.has(def)) mult *= 0.5;
    });
    return mult >= 2;
  });
};
