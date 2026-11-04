import { useEffect, useState } from "react";
import { pokemonZResources, type AbilityDescriptions } from "../data/pokemonZData";
import type { MoveZ, PokemonZEntry } from "../types/pokemonZ";

type State = {
  pokemon: PokemonZEntry[]; moves: MoveZ[]; abilities: AbilityDescriptions;
  error: string | null; attempt: number;
};

export function usePokemonZData(active: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ pokemon: [], moves: [], abilities: {}, error: null, attempt: -1 });
  useEffect(() => {
    if (!active) return;
    let live = true;
    Promise.allSettled([pokemonZResources.pokemon(), pokemonZResources.moves(), pokemonZResources.abilities()])
      .then(([pokemon, moves, abilities]) => {
        if (!live) return;
        const failures = [pokemon, moves, abilities].filter((r) => r.status === "rejected");
        setState((previous) => ({
          pokemon: pokemon.status === "fulfilled" ? pokemon.value : previous.pokemon,
          moves: moves.status === "fulfilled" ? moves.value : previous.moves,
          abilities: abilities.status === "fulfilled" ? abilities.value : previous.abilities,
          error: failures.length ? "No se pudieron cargar todos los datos de Pokémon Z." : null,
          attempt,
        }));
      });
    return () => { live = false; };
  }, [active, attempt]);
  return { ...state, loading: active && state.attempt !== attempt, retry: () => setAttempt((n) => n + 1) };
}
