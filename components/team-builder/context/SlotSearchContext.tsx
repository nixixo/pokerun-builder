"use client";

// components/team-builder/context/SlotSearchContext.tsx
//
// Estado de los buscadores del equipo: el autocompletado de Pokémon de cada
// uno de los 6 slots y el de movimientos de cada uno de sus 4 ataques.
//
// Por qué existe: eran 21 props que TeamBuilder pasaba a TeamGrid (drafts,
// resultados, índice seleccionado, abierto/cerrado y los setters de cada uno,
// por Pokémon y por movimiento). TeamGrid es el ÚNICO consumidor —
// atravesaban el árbol solo para llegar ahí.
//
// Este estado se actualiza en cada tecla, así que se mantiene deliberadamente
// separado de BuilderChromeContext: los paneles que no tienen buscadores
// (recomendaciones, análisis, dashboard) no se suscriben acá y por lo tanto
// no re-renderizan mientras el usuario escribe.

import { createContext, use } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Move } from "../types";

export type SlotSearch = {
  // ── Buscador de Pokémon, por slot ──────────────────────────────────────
  /** Texto que el usuario está tipeando; null = mostrar el valor del slot. */
  pokemonInputDraft: (string | null)[];
  setPokemonInputDraft: Dispatch<SetStateAction<(string | null)[]>>;
  pokemonSearch: string[];
  setPokemonSearch: Dispatch<SetStateAction<string[]>>;
  pokemonResults: string[][];
  pokemonOpen: boolean[];
  setPokemonOpen: Dispatch<SetStateAction<boolean[]>>;
  pokemonSelectedIdx: number[];
  setPokemonSelectedIdx: Dispatch<SetStateAction<number[]>>;
  fetchPokemon: (query: string, idx: number) => void;
  selectPokemonSuggestion: (idx: number, name: string) => void;

  // ── Buscador de movimientos, por slot y ataque ─────────────────────────
  moveInputDraft: (string | null)[][];
  setMoveInputDraft: Dispatch<SetStateAction<(string | null)[][]>>;
  moveResults: string[][][];
  moveOpen: boolean[][];
  setMoveOpen: Dispatch<SetStateAction<boolean[][]>>;
  moveSelectedIdx: number[][];
  setMoveSelectedIdx: Dispatch<SetStateAction<number[][]>>;
  updateMove: (slotIdx: number, moveIdx: number, patch: Partial<Move>) => void;
  fetchMove: (moveName: string, slotIdx: number, moveIdx: number) => void;
  selectMoveSuggestion: (slotIdx: number, moveIdx: number, name: string) => void;
};

const SlotSearchContext = createContext<SlotSearch | null>(null);

export function SlotSearchProvider({
  value,
  children,
}: {
  value: SlotSearch;
  children: ReactNode;
}) {
  return <SlotSearchContext value={value}>{children}</SlotSearchContext>;
}

export function useSlotSearch(): SlotSearch {
  const ctx = use(SlotSearchContext);
  if (ctx === null) {
    throw new Error("useSlotSearch debe usarse dentro de <SlotSearchProvider>");
  }
  return ctx;
}
