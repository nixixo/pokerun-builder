/**
 * Utilidades para manejo de sprites de Pokémon Z
 */

import type React from "react";
import { FAKEDEX_SPRITES_BASE, normalizeSpriteUrl } from "@/components/shared/spriteUrls";
import type { SpriteTransform } from "../types";
export type { SpriteTransform };

export const DEFAULT_TRANSFORM: SpriteTransform = { x: 0, y: 0, zoom: 0 };

export type ZSlotSpriteOverride = { zoom?: number; x?: number; y?: number };

// Sufijos de sprite para formas especiales de Pokémon Z
const Z_MEGA_SPRITE_SUFFIX: Record<number, string> = {
  // Gigamax curados Z (90009–90025)
  90009: "_1", 90010: "_1", 90011: "_1", 90012: "_1", 90013: "_1",
  90014: "_1", 90015: "_1", 90016: "_1", 90017: "_1", 90018: "_1",
  90019: "_1", 90020: "_1", 90021: "_1", 90022: "_1", 90023: "_1",
  90024: "_1", 90025: "_1",
  // Formas regionales (90026–90058)
  90026: "_1", 90027: "_1", 90028: "_1", 90029: "_1", 90030: "_1",
  90031: "_1", 90032: "_1", 90033: "_1", 90034: "_1", 90035: "_1",
  90036: "_1", 90037: "_1", 90038: "_1", 90039: "_1", 90040: "_1",
  90041: "_1", 90042: "_1", 90043: "_1", 90044: "_1", 90045: "_1",
  90046: "_1", 90047: "_1", 90048: "_1", 90049: "_1", 90050: "_1",
  90051: "_1", 90052: "_1", 90053: "_1", 90054: "_1", 90055: "_1",
  90056: "_1", 90057: "_1", 90058: "_1",
  // Otras formas alternativas (90079+)
  90079: "_1", 90080: "_1", 90081: "_2", 90082: "_3", 90083: "_4",
  90084: "_5", 90085: "_1", 90086: "_2", 90087: "_2", 90088: "_1",
  90089: "_1", 90090: "_2", 90091: "_3", 90092: "_1", 90094: "_1",
  90095: "_2", 90096: "_3", 90097: "_4", 90098: "_5", 90099: "_6",
  90100: "_7", 90101: "_8", 90102: "_9", 90103: "_6", 90104: "_1",
  90105: "_2", 90106: "_3", 90107: "_1", 90109: "_1", 90113: "_1",
  90114: "_1", 90115: "_1", 90116: "_1", 90120: "_1", 90121: "_1",
  90122: "_1", 90123: "_2", 90124: "_1",
  // Formas nuevas (90160+)
  90160: "_1", 90161: "_2", 90162: "_3", 90163: "_4", 90164: "_1",
  90165: "_2", 90166: "_1", 90167: "_2", 90168: "_1", 90169: "_1",
  90170: "_1", 90171: "_1", 90172: "_1", 90173: "_1",
  // Formas tanda 3
  90174: "_3", 90175: "_5", 90176: "_1",
  // Formas sin dexId propio
  90177: "_1", 90178: "_1", 90179: "_1", 90180: "_1", 90181: "_1",
  90182: "_1", 90183: "_1", 92001: "_1",
  // Megas nuevas (91000+)
  91000: "_1", 91001: "_1", 91002: "_2", 91003: "_1", 91004: "_1",
  91005: "_1", 91006: "_1", 91007: "_1", 91008: "_1", 91009: "_1",
  91010: "_1", 91011: "_1", 91012: "_1", 91013: "_1", 91014: "_1",
  91015: "_1", 91016: "_1", 91017: "_1", 91018: "_1", 91019: "_1",
  91020: "_2", 91021: "_1", 91022: "_2", 91023: "_1", 91024: "_1",
  91025: "_1", 91026: "_1", 91027: "_1", 91028: "_1", 91029: "_1",
  91030: "_1", 91031: "_1", 91032: "_2", 91033: "_1", 91034: "_1",
  91035: "_1", 91036: "_1", 91037: "_1", 91038: "_1", 91039: "_1",
  91040: "_1", 91041: "_1", 91042: "_1", 91043: "_1", 91044: "_1",
  91045: "_1", 91046: "_1", 91047: "_1", 91048: "_1", 91049: "_1",
  91050: "_1", 91051: "_1", 91052: "_2", 91053: "_1", 91054: "_1",
  91055: "_1", 91056: "_1", 91057: "_1", 91058: "_2", 91059: "_3",
  91060: "_4", 91061: "_1", 91062: "_1", 91063: "_1", 91064: "_1",
  91065: "_1", 91066: "_1", 91067: "_1", 91068: "_1", 91069: "_1",
  91070: "_1", 91071: "_1", 91072: "_1", 91073: "_1", 91074: "_1",
  91075: "_1", 91076: "_1", 91077: "_2", 91078: "_1", 91079: "_1",
  91080: "_1", 91081: "_1", 91082: "_1", 91083: "_1", 91084: "_1",
  91085: "_1", 91086: "_1", 91087: "_1", 91088: "_1", 91089: "_1",
  91090: "_2", 91091: "_1", 91092: "_1", 91093: "_1", 91094: "_1",
  91095: "_1", 91096: "_1", 91097: "_1", 91098: "_1", 91099: "_1",
  91100: "_1", 91101: "_1", 91102: "_1", 91103: "_2", 91104: "_1",
  91105: "_1", 91106: "_1", 91107: "_1", 91108: "_1", 91109: "_1",
  91110: "_1", 91111: "_2", 91112: "_1", 91113: "_1", 91114: "_3",
  91115: "_1", 91116: "_1", 91117: "_1", 91118: "_2",
};

// Mapeo de ids fake a dexIds reales para formas sin dexId propio
const Z_MISSING_DEXID: Record<number, number> = {
  90177: 586, // Sawsbuck
  90178: 586, // Sawsbuck
  90179: 586, // Sawsbuck
  90180: 249, // Lugia
  90181: 908, // Missingno
  90182: 908, // Missingno
  90183: 492, // Shaymin
  92001: 197, // Umbreon
};

// Nota: Z_SPRITE_ZOOM_OVERRIDES (para tarjetas de candidatos) vive en
// TeamBuilder.tsx, no acá — ver comentario en ese archivo.

// Overrides para slots del equipo
export const Z_SLOT_SPRITE_ZOOM_OVERRIDES: Record<string, ZSlotSpriteOverride> = {
  "Mega Delphox Z": { zoom: 1.6, x: -7, y: -20 },
  "Tornadus Tótem": { x: 20 },
};

// Conjuntos de nombres para detectar formas Z
const Z_FORM_SPECIES = new Set<string>([
  "raichu", "entei", "volcarona", "chesnaught", "delphox", "greninja", "florges", "grimmsnarl",
]);

const Z_MEGA_ONLY_SPECIES = new Set<string>([
  "gengar", "mawile", "banette", "audino", "zygarde",
]);

// Lo mínimo que estas dos funciones necesitan de un Pokémon Z. Se deja
// estructural (y no atado a PokemonZEntry o AvailablePokemon) porque se las
// llama con las dos formas.
//
// `sprite` admite null además de undefined: AvailablePokemon lo declara así, y
// el cuerpo ya se protege con `typeof p?.sprite === "string"`.
interface PokemonZ {
  name?: string;
  internalName?: string;
  id: number;
  dexId?: number;
  sprite?: string | null;
  formLabel?: string | null;
}

/**
 * Obtiene el nombre de display para un Pokémon Z
 */
export const getZDisplayName = (p: PokemonZ): string => {
  const baseName: string = p?.name ?? p?.internalName ?? "";
  const key = baseName.toLowerCase();
  const id: number = p?.id ?? 0;

  if (id >= 90009 && id <= 90025) return `Gigamax ${baseName}`;
  if (id >= 90026 && id <= 90058) return baseName;
  if (Z_MEGA_ONLY_SPECIES.has(key)) return baseName;
  if (Z_FORM_SPECIES.has(key)) return `${baseName} Z`;
  return baseName;
};

/**
 * Obtiene la URL del sprite para un Pokémon Z
 */
export const getZSpriteUrl = (p: PokemonZ): string => {
  const base = `${FAKEDEX_SPRITES_BASE}/Battlers`;
  const suffix = Z_MEGA_SPRITE_SUFFIX[p?.id];
  if (suffix) {
    const dexId = p.dexId ?? Z_MISSING_DEXID[p?.id] ?? p.id;
    return `${base}/${String(dexId).padStart(3, "0")}${suffix}.png`;
  }
  if (p?.dexId !== undefined && p?.dexId !== null) {
    return `${base}/${String(p.dexId).padStart(3, "0")}.png`;
  }
  if (typeof p?.sprite === "string" && p.sprite) {
    return normalizeSpriteUrl(p.sprite);
  }
  return `${base}/${String(p?.id ?? 0).padStart(3, "0")}.png`;
};

/**
 * Convierte un SpriteTransform a estilos CSS
 */
export function buildSpriteStyle(
  transform: SpriteTransform | null | undefined,
  override?: ZSlotSpriteOverride
): React.CSSProperties {
  const tx = transform ?? DEFAULT_TRANSFORM;
  const scale = (tx.zoom >= 0 ? 1 + tx.zoom / 100 : 1 + tx.zoom / 200) * (override?.zoom ?? 1);
  const posX = tx.x + (override?.x ?? 0);
  const posY = tx.y + (override?.y ?? 0);
  return {
    transform: `translate(${posX}%, ${posY}%) scale(${scale})`,
    transformOrigin: "center center",
  };
}