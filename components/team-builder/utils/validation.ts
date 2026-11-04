import type { Move, SavedTeam, Slot } from "../types";
import { TEAM_SIZE } from "./constants";
import { normalizeSpriteUrl } from "@/components/shared/spriteUrls";

// ─── Validación / type guards ────────────────────────────────────────────────

/** Estrecha `unknown` a un objeto indexable, para poder mirar sus campos. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (v: unknown) => typeof v === "string";
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const optional = (v: unknown, check: (v: unknown) => boolean) => v == null || check(v);
const texts = (v: unknown) => Array.isArray(v) && v.every(text);

/**
 * Type guard para verificar que un valor arbitrario (ej. parseado de
 * localStorage) tiene la forma de un Move válido antes de confiar en él.
 */
export const isValidMove = (value: unknown): value is Move => {
  if (!isRecord(value)) return false;
  if (typeof value.name !== "string") return false;
  return ["Status", "Physical", "Special"].includes(String(value.category))
    && optional(value.type, text)
    && (value.nameEs === undefined || text(value.nameEs))
    && (value.isFake === undefined || typeof value.isFake === "boolean")
    && ["hiddenPowerType", "descriptionEs", "descriptionEn"].every((k) => optional(value[k], text))
    && ["power", "accuracy", "pp"].every((k) => optional(value[k], finite));
};

/**
 * Type guard para verificar que un valor arbitrario (ej. parseado de
 * localStorage) tiene la forma de un Slot válido: nombre, flag isFake,
 * uno o dos tipos, sprite opcional, y exactamente 4 movimientos válidos.
 * Se usa al restaurar el equipo guardado para no crashear con datos corruptos
 * o de una versión anterior del schema.
 */
export const isValidSlot = (value: unknown): value is Slot => {
  if (!isRecord(value)) return false;
  if (typeof value.name !== "string") return false;
  if (typeof value.isFake !== "boolean") return false;

  const { types, sprite, moves } = value;
  if (!Array.isArray(types) || types.length < 1 || types.length > 2) return false;
  if (!types.every((t: unknown) => typeof t === "string")) return false;

  if (!optional(sprite, text)) return false;

  if (!Array.isArray(moves) || moves.length !== 4) return false;
  return moves.every(isValidMove)
    && optional(value.stats, (s) => isRecord(s) && ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"].every((k) => finite(s[k])))
    && optional(value.spriteTransform, (s) => isRecord(s) && ["x", "y", "zoom"].every((k) => finite(s[k])))
    && optional(value.abilities, texts)
    && optional(value.learnableMoves, texts)
    && optional(value.hiddenAbility, text)
    && optional(value.manualRoleEn, text)
    && optional(value.learnMethods, (methods) => isRecord(methods) && Object.values(methods).every((m) =>
      isRecord(m) && ["level", "mt", "tutor", "egg"].includes(String(m.type)) && (m.level === undefined || finite(m.level))));
};

/** Frontera común de importación y persistencia. No muta equipos históricos. */
export function normalizarEquipo(value: unknown): Slot[] | null {
  if (!Array.isArray(value) || value.length !== TEAM_SIZE || !value.every(isValidSlot)) return null;
  return value.map((slot) => ({
    ...slot,
    types: [slot.types[0], slot.types[1] ?? ""],
    sprite: slot.sprite ? normalizeSpriteUrl(slot.sprite) : null,
    moves: slot.moves.map((move) => ({ ...move, type: move.type ?? null })),
  }));
}

export function normalizarPlantillas(value: unknown): SavedTeam[] | null {
  if (!Array.isArray(value)) return null;
  const result: SavedTeam[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !finite(entry.id) || !text(entry.name) || !text(entry.savedAt)) return null;
    const team = normalizarEquipo(entry.team);
    if (!team) return null;
    result.push({ id: entry.id as number, name: entry.name as string, savedAt: entry.savedAt as string, team });
  }
  return result;
}
