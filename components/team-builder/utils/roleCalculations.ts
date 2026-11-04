/**
 * Utilidades para cálculos de roles basados en estadísticas
 */
import type { BaseStats, RoleDefinition } from "../types";
import { ROLES, BALANCED_ROLE, ROLE_CORE_FILTERS } from "./constants";

export type { BaseStats, RoleDefinition };

// Calcula el bulk defensivo y ofensivo
export const getBulk = (stats: BaseStats) => ({
  physical: Math.round((stats.HP * stats.DEF) / 100),
  special: Math.round((stats.HP * stats["SP.DEF"]) / 100),
  offensive: Math.round((Math.max(stats.ATK, stats["SP.ATK"]) * stats.SPE) / 100),
});

// Speed tiers (Opción D)
export const getSpeedTier = (spe: number, lang: "es" | "en"): { label: string; color: string } => {
  if (spe <= 30)  return { label: lang === "es" ? "Trick Room" : "Trick Room",  color: "#7c3aed" };
  if (spe <= 50)  return { label: lang === "es" ? "Muy lento"  : "Very slow",   color: "#6b7280" };
  if (spe <= 70)  return { label: lang === "es" ? "Lento"      : "Slow",        color: "#78716c" };
  if (spe <= 90)  return { label: lang === "es" ? "Medio"      : "Mid speed",   color: "#ca8a04" };
  if (spe <= 110) return { label: lang === "es" ? "Rápido"     : "Fast",        color: "#16a34a" };
  return               { label: lang === "es" ? "Muy rápido" : "Very fast",   color: "#0891b2" };
};

// score = promedio_normalizado × factor_de_balance (ver comentario original: solo casos casi
// perfectos como Mew/Arceus califican; divisor 25 es criterio estricto).
export const getBalanceScore = (stats: BaseStats): number => {
  const values = [stats.HP, stats.ATK, stats.DEF, stats["SP.ATK"], stats["SP.DEF"], stats.SPE];
  const avg = values.reduce((a, b) => a + b, 0) / 6;
  const spread = Math.max(...values) - Math.min(...values);

  const normAvg = Math.min(avg / 255, 1);
  const balanceFactor = Math.max(0, 1 - spread / 25);

  return Math.round(normAvg * balanceFactor * 100);
};

// Score a Pokémon against each role formula (0–100), incluyendo BALANCED_ROLE.
// Firma de un solo parámetro (usa ROLES/BALANCED_ROLE internos), igual que en
// el TeamBuilder.tsx original — así coincide con cómo la llaman los hooks
// (ej. useRecommendations.ts: `scoreAllRoles(avgStats)`).
export const scoreAllRoles = (stats: BaseStats): { role: RoleDefinition; score: number }[] => {
  const norm = (v: number) => Math.min(v / 255, 1);
  const linearScores = ROLES.map((role) => {
    const score = Object.entries(role.weights).reduce((acc, [key, w]) => {
      return acc + norm(stats[key as keyof BaseStats]) * (w ?? 0);
    }, 0);
    return { role, score: Math.round(score * 100) };
  });
  const balancedScore = { role: BALANCED_ROLE, score: getBalanceScore(stats) };
  return [...linearScores, balancedScore];
};

// Devuelve el rol dominante de un Pokémon según sus stats.
export const getRole = (
  stats: BaseStats,
  lang: "es" | "en" = "es"
): { label: string; color: string } | null => {
  const scores = scoreAllRoles(stats);
  // Con spread=0 (Mew, Arceus) el score de "Todoterreno Puro" queda
  // matemáticamente empatado con cualquier rol lineal; como scoreAllRoles
  // agrega el rol de balance al FINAL del array, en empate exacto gana el
  // último evaluado (el de balance).
  const best = scores.reduce((a, b) => (b.score >= a.score ? b : a));
  if (best.score < 20) return null;
  return { label: best.role[lang], color: best.role.color };
};

// Igual que getRole, pero respeta el rol manual elegido por el usuario para
// ESE Pokémon del equipo (slot.manualRoleEn), si existe.
export const getEffectiveRole = (
  slot: { stats?: BaseStats | null; manualRoleEn?: string | null },
  lang: "es" | "en" = "es"
): { label: string; color: string } | null => {
  if (slot.manualRoleEn) {
    const roleDef = [...ROLES, BALANCED_ROLE].find((r) => r.en === slot.manualRoleEn);
    if (roleDef) return { label: roleDef[lang], color: roleDef.color };
  }
  if (!slot.stats) return null;
  return getRole(slot.stats, lang);
};

// Devuelve el ranking (1 = más alta) de cada stat DENTRO del propio Pokémon.
export const statRank = (stats: BaseStats, stat: keyof BaseStats): number => {
  const sorted = (Object.keys(stats) as (keyof BaseStats)[])
    .sort((a, b) => stats[b] - stats[a]);
  return sorted.indexOf(stat) + 1; // 1-indexed
};

// Cuántas stats como máximo pueden estar "por delante" de la stat núcleo
// dentro del propio Pokémon para que el rol siga siendo válido.
export const ROLE_CORE_TOP_N = 3;

export type RoleMatchResult = {
  passes: boolean;
  score: number;      // score del rol pedido (0–100), para debug
  topScore: number;   // score del rol #1 del Pokémon, para debug
  reason: "exact" | "margin" | "minimum" | "partial" | "fail";
};

export const matchesRole = (stats: BaseStats, roleLabel: string): RoleMatchResult => {
  // Desempate: en un empate exacto de score (ej. Mew/Arceus con spread=0),
  // BALANCED_ROLE queda empatado con CUALQUIER rol lineal. Este comparador
  // prioriza BALANCED_ROLE en los empates, igual que getRole, para que
  // ambas funciones coincidan.
  const scores = scoreAllRoles(stats).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aBal = a.role.es === BALANCED_ROLE.es;
    const bBal = b.role.es === BALANCED_ROLE.es;
    if (aBal && !bBal) return -1;
    if (bBal && !aBal) return 1;
    return 0;
  });
  const topScore = scores[0].score;
  const entryIdx = scores.findIndex((s) => s.role.es === roleLabel || s.role.en === roleLabel);
  const score = entryIdx >= 0 ? scores[entryIdx].score : 0;

  const roleDef = ROLES.find((r) => r.es === roleLabel || r.en === roleLabel);
  const filter = roleDef ? (ROLE_CORE_FILTERS[roleDef.es] ?? null) : null;

  if (!filter) {
    // Sin filtro definido: fallback conservador (solo pasa si es rol #1)
    const passes = entryIdx === 0;
    return { passes, score, topScore, reason: passes ? "exact" : "fail" };
  }

  // (A) El Pokémon debe cumplir TODOS los umbrales absolutos del rol.
  const passesAbsolute = filter.required.every((req) => stats[req.stat] >= req.min);
  if (!passesAbsolute) return { passes: false, score, topScore, reason: "fail" };

  // (B) Cada stat núcleo debe estar entre el top-N de las 6 stats DEL PROPIO
  // Pokémon. Si no, pasa igual pero como "partial" (queda relegado, no excluido).
  const passesRelative = filter.required.every(
    (req) => statRank(stats, req.stat) <= ROLE_CORE_TOP_N
  );
  if (!passesRelative) return { passes: true, score, topScore, reason: "partial" };

  const reason = entryIdx === 0 ? "exact" : score >= 28 ? "margin" : "minimum";
  return { passes: true, score, topScore, reason };
};

// Devuelve la descripción ("por qué es este rol") a partir de su label
// (en cualquiera de los dos idiomas), para el tooltip de hover.
export const getRoleDescription = (label: string, lang: "es" | "en"): string | null => {
  const role = [...ROLES, BALANCED_ROLE].find((r) => r.es === label || r.en === label);
  if (!role) return null;
  return lang === "es" ? role.descEs : role.descEn;
};
