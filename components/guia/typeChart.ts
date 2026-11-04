// components/guia/typeChart.ts
//
// Tabla estática de multiplicadores de daño tipo-contra-tipo (18x18),
// generación estándar (sin Acero resistiendo Siniestro/Fantasma de
// antes de Gen VI, ya que Pokémon Z es un hackrom moderno). Se usa
// para calcular debilidades de equipos rivales y puntuar candidatos
// de captura, SIN depender de fetches en vivo a PokéAPI — el Builder
// sí hace eso (18 fetches por tipo), pero acá conviene que sea
// instantáneo y offline-friendly ya que se recalcula cada vez que se
// abre una zona.
//
// CHART[atacante][defensor] = multiplicador (0, 0.5, 1, o 2).
// Cualquier combinación no listada explícitamente es 1 (neutral).

export type PokeType =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice" | "fighting"
  | "poison" | "ground" | "flying" | "psychic" | "bug" | "rock" | "ghost"
  | "dragon" | "dark" | "steel" | "fairy";

export const ALL_TYPES: PokeType[] = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting",
  "poison", "ground", "flying", "psychic", "bug", "rock", "ghost",
  "dragon", "dark", "steel", "fairy",
];

// Por cada tipo atacante: a qué tipos les pega x2, y a cuáles x0.5 o x0.
// El resto queda implícito en 1 (neutral).
const SUPER_EFFECTIVE: Record<PokeType, PokeType[]> = {
  normal: [],
  fire: ["grass", "ice", "bug", "steel"],
  water: ["fire", "ground", "rock"],
  electric: ["water", "flying"],
  grass: ["water", "ground", "rock"],
  ice: ["grass", "ground", "flying", "dragon"],
  fighting: ["normal", "ice", "rock", "dark", "steel"],
  poison: ["grass", "fairy"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  flying: ["grass", "fighting", "bug"],
  psychic: ["fighting", "poison"],
  bug: ["grass", "psychic", "dark"],
  rock: ["fire", "ice", "flying", "bug"],
  ghost: ["psychic", "ghost"],
  dragon: ["dragon"],
  dark: ["psychic", "ghost"],
  steel: ["ice", "rock", "fairy"],
  fairy: ["fighting", "dragon", "dark"],
};

const NOT_VERY_EFFECTIVE: Record<PokeType, PokeType[]> = {
  normal: ["rock", "steel"],
  fire: ["fire", "water", "rock", "dragon"],
  water: ["water", "grass", "dragon"],
  electric: ["electric", "grass", "dragon"],
  grass: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],
  ice: ["fire", "water", "ice", "steel"],
  fighting: ["poison", "flying", "psychic", "bug", "fairy"],
  poison: ["poison", "ground", "rock", "ghost"],
  ground: ["grass", "bug"],
  flying: ["electric", "rock", "steel"],
  psychic: ["psychic", "steel"],
  bug: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"],
  rock: ["fighting", "ground", "steel"],
  ghost: ["dark"],
  dragon: ["steel"],
  dark: ["fighting", "dark", "fairy"],
  steel: ["fire", "water", "electric", "steel"],
  fairy: ["fire", "poison", "steel"],
};

const NO_EFFECT: Record<PokeType, PokeType[]> = {
  normal: ["ghost"],
  fire: [],
  water: [],
  electric: ["ground"],
  grass: [],
  ice: [],
  fighting: ["ghost"],
  poison: ["steel"],
  ground: ["flying"],
  flying: [],
  psychic: ["dark"],
  bug: [],
  rock: [],
  ghost: ["normal"],
  dragon: ["fairy"],
  dark: [],
  steel: [],
  fairy: [],
};

/**
 * Multiplicador de daño de `atkType` contra un Pokémon con `defTypes` (1 o 2
 * tipos).
 *
 * En modo INVERSO la tabla se da la vuelta, que es lo que hace el combate del
 * Regente Hibis (7ª medalla) y su revancha: lo que era supereficaz pasa a
 * resistido, lo resistido a supereficaz, y las inmunidades pasan a supereficaz.
 * El neutro se queda igual.
 *
 * La vuelta se da tipo a tipo ANTES de multiplicar, no al resultado final: es
 * la tabla la que está invertida, no el daño. Por eso un Sigilyph
 * (Psíquico/Volador) pasa de resistir Lucha a 0.25x a comerla a x4 — dos
 * resistencias de 0.5 que se convierten en dos 2. La propia guía lo dice con
 * esas palabras ("Sigilyph es débil x4 a Lucha"), así que sirve de comprobación.
 */
export function getEffectiveness(atkType: PokeType, defTypes: PokeType[], inverso = false): number {
  let mult = 1;
  for (const def of defTypes) {
    let paso = 1;
    if (NO_EFFECT[atkType]?.includes(def)) paso = 0;
    else if (SUPER_EFFECTIVE[atkType]?.includes(def)) paso = 2;
    else if (NOT_VERY_EFFECTIVE[atkType]?.includes(def)) paso = 0.5;
    mult *= inverso ? invertirPaso(paso) : paso;
  }
  return mult;
}

/** 2x y 0.5x se intercambian; la inmunidad pasa a 2x; el neutro no se toca. */
function invertirPaso(paso: number): number {
  if (paso === 2) return 0.5;
  if (paso === 0.5 || paso === 0) return 2;
  return 1;
}