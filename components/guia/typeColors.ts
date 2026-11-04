// components/guia/typeColors.ts
//
// Solo el estilo del chip. Los mapas de tipos y los colores viven en
// @/components/shared/tipos, compartidos con el Builder: antes eran una copia
// literal, justificada en un comentario que decía que no había ruta de import
// entre las dos features. Sí la había (`@/*`, en tsconfig.json).

import { TYPE_COLORS, TYPE_ES_TO_API, tipoEsAApi } from "@/components/shared/tipos";

export { TYPE_COLORS, TYPE_ES_TO_API };

/**
 * Igual que moveTypeChipStyle, pero para un tipo escrito en español.
 * Pasa por tipoEsAApi, así que ahora tolera tildes y espacios sobrantes — antes
 * era una búsqueda exacta y "eléctrico" en minúsculas se quedaba sin color.
 */
export function typeEsChipStyle(typeEs: string): React.CSSProperties | undefined {
  return moveTypeChipStyle(tipoEsAApi(typeEs));
}

// Estilo inline para un chip de movimiento, tintado según el color del
// tipo (fondo tenue + texto + borde en el mismo color). Se usa style
// en vez de clases Tailwind porque el color es dinámico (viene del
// JSON de movimientos), no hay forma de generarlo como clase estática.
export function moveTypeChipStyle(typeApi: string | null): React.CSSProperties | undefined {
  const color = typeApi ? TYPE_COLORS[typeApi] : undefined;
  if (!color) return undefined;
  return {
    backgroundColor: `${color}26`, // ~15% opacidad
    color,
    borderColor: `${color}55`,
  };
}