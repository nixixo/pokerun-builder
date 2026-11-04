// Helpers para detectar tipos especiales de Pokémon

import { LEGENDARY_IDS, LEGENDARY_SLUG_PREFIXES, POKEMON_Z_ORIGINALS, Z_FAKEMON_NEW_NAMES } from './pokemonDefinitions';
import type { AvailablePokemon } from '../types';

/**
 * Detecta si un Pokémon es legendario basándose en su ID nacional
 * (primera capa: verificación por ID exacto).
 */
export const isLegendaryByID = (id: number | undefined): boolean => {
  if (!id) return false;
  return LEGENDARY_IDS.has(id);
};

/**
 * Detecta si un Pokémon es legendario basándose en su slug (segunda capa,
 * cubre formas alternativas y futuros añadidos).
 */
export const isLegendaryBySlug = (slug: string): boolean => {
  const lowerSlug = slug.toLowerCase();
  return Array.from(LEGENDARY_SLUG_PREFIXES).some(prefix =>
    lowerSlug.startsWith(prefix) || lowerSlug.includes(`-${prefix}`) || lowerSlug === prefix
  );
};

/**
 * Detecta si es legendario (combina ambas capas de seguridad).
 */
export const isLegendary = (pokemon: AvailablePokemon): boolean => {
  return isLegendaryByID(pokemon.id) || isLegendaryBySlug(pokemon.slug);
};

/**
 * Detecta si es un Pokémon original de Pokémon Z (con forma Z alterada).
 */
export const isZOriginal = (name: string): boolean => {
  return POKEMON_Z_ORIGINALS.has(name);
};

/**
 * Detecta si es un fakemon nuevo exclusivo de Pokémon Z.
 */
export const isZFakemon = (name: string): boolean => {
  return Z_FAKEMON_NEW_NAMES.has(name);
};

/**
 * Detecta si es una última evolución (no tiene pre-evoluciones posteriores).
 * Usa el campo `isFinalEvo` que viene del servidor.
 */
export const isFinalEvolution = (pokemon: AvailablePokemon): boolean => {
  return pokemon.isFinalEvo ?? false;
};
