// Type definitions for Team Builder

/** Las 6 stats base, con las claves tal como vienen de los JSON del proyecto. */
export type BaseStats = {
  HP: number;
  ATK: number;
  DEF: number;
  "SP.ATK": number;
  "SP.DEF": number;
  SPE: number;
};

export type TeamScorePillar = { score: number; available: boolean };
export type TeamScore = {
  total: number;
  grade: { label: string; color: string };
  offense: TeamScorePillar;
  defense: TeamScorePillar;
  stats: TeamScorePillar;
  roles: TeamScorePillar;
};

export type Lang = "es" | "en";

export type Move = {
  name: string;
  nameEs?: string;
  category: "Status" | "Physical" | "Special";
  type?: string | null;
  isFake?: boolean;
  hiddenPowerType?: string | null;
  descriptionEs?: string | null;
  descriptionEn?: string | null;
  power?: number | null;
  accuracy?: number | null;
  pp?: number | null;
};

export type BaseStatsInput = {
  [K in keyof BaseStats]: string;
};

// Resultado del análisis de tipos calculado por useTeamAnalysis.
// Necesario acá porque useRecommendations.ts lo recibe como parámetro tipado.
export type TeamAnalysis = {
  weaknesses: Record<string, number>;
  strengths: Record<string, number>;
  weakMemberIdx: Record<string, number[]>;
  resistMemberIdx: Record<string, number[]>;
};

export type SpriteTransform = {
  x: number;
  y: number;
  zoom: number;
};

export type Slot = {
  name: string;
  isFake: boolean;
  types: string[];
  sprite?: string | null;
  spriteTransform?: SpriteTransform | null;
  moves: Move[];
  stats?: BaseStats | null;
  abilities?: string[] | null;
  hiddenAbility?: string | null;
  learnableMoves?: string[] | null;
  learnMethods?: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> | null;
  manualRoleEn?: string | null;
};

export type SavedTeam = {
  id: number;
  name: string;
  team: Slot[];
  savedAt: string;
};

export type AvailablePokemon = {
  slug: string;
  name: string;
  id: number;
  dexId?: number;
  types: [string] | [string, string];
  stats?: BaseStats | null;
  isFinalEvo: boolean;
  sprite?: string | null;
  formLabel?: string | null;
  abilities?: string[] | null;
  hiddenAbility?: string | null;
  learnableMoveNames?: string[] | null;
};

export type RoleDefinition = {
  es: string;
  en: string;
  color: string;
  weights: Partial<Record<keyof BaseStats, number>>;
  descEs: string;
  descEn: string;
};

export type CandidateScoreResult = {
  score: number;
  priority1: number;
  priority2: number;
  priority3: number;
  priority4: number;
  reduces: string[];
  immunities: string[];
  newResistances: string[];
  criticalAdds: string[];
  addsWeakness: string[];
};

export type TeamDefenseProfile = Record<string, { weak: number; resist: number; immune: number; maxMult: number }>;
