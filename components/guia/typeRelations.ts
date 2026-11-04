// components/guia/typeRelations.ts
//
// El Builder ya tiene resuelto el análisis defensivo de un equipo
// (utils/defensiveCalculations.ts: computeTeamDefenseProfile,
// getCandidateWeaknesses, scorePokemonCandidate), pero pide la tabla de tipos
// en el formato de PokéAPI, que allá se consigue con 18 fetches en vivo.
//
// Esto arma esa misma tabla desde el typeChart estático de la Guía. Resultado:
// las funciones del Builder corren tal cual, offline y al instante, sin
// duplicar aquí una segunda versión de la misma lógica — que es como acaban
// desincronizándose dos análisis que deberían decir lo mismo.
//
// Se construye una vez al cargar el módulo: 18x18 llamadas a getEffectiveness,
// que es una consulta a dos Sets. Ni se nota.

import type { PokeType } from "./typeChart";
import { ALL_TYPES, getEffectiveness } from "./typeChart";

/** Misma forma que espera defensiveCalculations.ts (la de PokéAPI). */
export type TypeRelation = {
  double_damage_to: { name: string }[];
  half_damage_to: { name: string }[];
  no_damage_to: { name: string }[];
};

function construir(inverso: boolean): Record<string, TypeRelation> {
  const salida: Record<string, TypeRelation> = {};
  for (const atacante of ALL_TYPES) {
    const dobles: { name: string }[] = [];
    const mitades: { name: string }[] = [];
    const nulos: { name: string }[] = [];
    for (const defensor of ALL_TYPES) {
      // Contra UN solo tipo defensor: es así como lo lee el Builder, que luego
      // multiplica los dos tipos del Pokémon por su cuenta.
      const mult = getEffectiveness(atacante, [defensor], inverso);
      if (mult === 0) nulos.push({ name: defensor });
      else if (mult > 1) dobles.push({ name: defensor });
      else if (mult < 1) mitades.push({ name: defensor });
    }
    salida[atacante] = { double_damage_to: dobles, half_damage_to: mitades, no_damage_to: nulos };
  }
  return salida;
}

export const TYPE_RELATIONS: Record<string, TypeRelation> = construir(false);

/**
 * La misma tabla dada la vuelta, para el combate inverso del Regente Hibis.
 * En esta no hay inmunidades: lo que no recibía daño pasa a recibir el doble.
 */
export const TYPE_RELATIONS_INVERSAS: Record<string, TypeRelation> = construir(true);

/** La tabla que toque según las reglas del combate. */
export function relacionesSegunReglas(inverso: boolean): Record<string, TypeRelation> {
  return inverso ? TYPE_RELATIONS_INVERSAS : TYPE_RELATIONS;
}

/** Los tipos, en el orden canónico, para recorrer el perfil sin repetir el array. */
export const TIPOS: PokeType[] = ALL_TYPES;
