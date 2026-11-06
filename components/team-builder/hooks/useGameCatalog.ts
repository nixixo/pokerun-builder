import { useEffect, useState } from "react";
import { type GameCatalog, type AbilityDescriptions } from "../data/gameCatalog";
import type { MoveZ, PokemonZEntry } from "../types/pokemonZ";

type State = {
  pokemon: PokemonZEntry[]; moves: MoveZ[]; abilities: AbilityDescriptions;
  failed: boolean; attempt: number; catalog?: GameCatalog;
};

const EMPTY_STATE: State = { pokemon: [], moves: [], abilities: {}, failed: false, attempt: -1 };

export function useGameCatalog(catalog: GameCatalog | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>(EMPTY_STATE);
  useEffect(() => {
    if (!catalog) return;
    let live = true;
    Promise.allSettled([catalog.pokemon(), catalog.moves(), catalog.abilities()])
      .then(([pokemon, moves, abilities]) => {
        if (!live) return;
        const failures = [pokemon, moves, abilities].filter((r) => r.status === "rejected");
        setState((previous) => ({
          pokemon: pokemon.status === "fulfilled" ? pokemon.value : previous.catalog === catalog ? previous.pokemon : EMPTY_STATE.pokemon,
          moves: moves.status === "fulfilled" ? moves.value : previous.catalog === catalog ? previous.moves : EMPTY_STATE.moves,
          abilities: abilities.status === "fulfilled" ? abilities.value : previous.catalog === catalog ? previous.abilities : EMPTY_STATE.abilities,
          catalog,
          failed: failures.length > 0,
          attempt,
        }));
      });
    return () => { live = false; };
  }, [catalog, attempt]);
  const current = state.catalog === catalog ? state : EMPTY_STATE;
  return { ...current, loading: Boolean(catalog) && current.attempt !== attempt, retry: () => setAttempt((n) => n + 1) };
}
