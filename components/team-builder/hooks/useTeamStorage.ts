import type { SavedTeam, Slot } from "../types";
import { EMPTY_MOVE } from "../utils/moveHelpers";
import { normalizarEquipo, normalizarPlantillas } from "../utils/validation";
import { STORAGE_KEY, SAVED_TEAMS_KEY, TEAM_SIZE } from "../utils/constants";
import { codecJson, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";

export const EMPTY_SLOT = (): Slot => ({
  name: "",
  isFake: false,
  types: ["", ""],
  sprite: null,
  moves: [EMPTY_MOVE(), EMPTY_MOVE(), EMPTY_MOVE(), EMPTY_MOVE()],
  stats: null,
  abilities: null,
  hiddenAbility: null,
  learnableMoves: null,
  learnMethods: null,
  manualRoleEn: null,
});

const EMPTY_TEAM = Array.from({ length: TEAM_SIZE }, EMPTY_SLOT);
const EMPTY_SAVED: SavedTeam[] = [];
const teamCodec = codecJson(normalizarEquipo);
const savedCodec = codecJson(normalizarPlantillas);
const fmtSavedAt = () => new Date().toLocaleString("es-CL");

/** Cada dex tiene su clave; las claves antiguas se leen sin sobrescribirlas al montar. */
export function useTeamStorage(activePokedex: string) {
  const [team, setTeam] = usePreferenciaLocal(
    `${STORAGE_KEY}-${activePokedex}`, EMPTY_TEAM, teamCodec,
    activePokedex === "standard" ? STORAGE_KEY : undefined
  );
  const [savedTeams, setSavedTeams] = usePreferenciaLocal(
    `${SAVED_TEAMS_KEY}-${activePokedex}`, EMPTY_SAVED, savedCodec,
    activePokedex === "standard" ? SAVED_TEAMS_KEY : undefined
  );

  const saveCurrentTeam = (name: string) => {
    const normalized = normalizarEquipo(team);
    if (!normalized) return;
    setSavedTeams((previous) => [...previous, {
      id: Math.max(Date.now(), ...previous.map((entry) => entry.id + 1)),
      name: name.trim() || `Plantilla ${previous.length + 1}`,
      team: normalized,
      savedAt: fmtSavedAt(),
    }]);
  };
  const loadSavedTeam = (saved: SavedTeam) => {
    const normalized = normalizarEquipo(saved.team);
    if (normalized) setTeam(normalized);
  };
  const deleteSavedTeam = (id: number) => setSavedTeams((previous) => previous.filter((t) => t.id !== id));
  const overwriteSavedTeam = (id: number) => {
    const normalized = normalizarEquipo(team);
    if (!normalized) return;
    setSavedTeams((previous) => previous.map((t) =>
      t.id === id ? { ...t, team: normalized, savedAt: fmtSavedAt() } : t
    ));
  };
  return { team, setTeam, savedTeams, saveCurrentTeam, loadSavedTeam, deleteSavedTeam, overwriteSavedTeam };
}
