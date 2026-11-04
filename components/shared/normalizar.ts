// components/shared/normalizar.ts
//
// Normalización de texto para comparar nombres.
//
// Estaba reescrita a mano en doce sitios y NO todas las copias hacían lo mismo:
// unas hacían trim y otras no, unas colapsaban espacios y otras no. Como se usan
// para cruzar nombres entre JSON distintos, esa clase de diferencia no da un
// error — da un Pokémon sin sprite y nadie sabe por qué.
//
// Aquí están las cuatro variantes que de verdad hacen falta, con nombre. Si
// necesitas otra, añádela aquí antes que en tu archivo.

const DIACRITICOS = /[\u0300-\u036f]/g;

/** Quita tildes y diéresis, sin tocar mayúsculas ni espacios. */
export function sinTildes(s: string): string {
  return String(s).normalize("NFD").replace(DIACRITICOS, "");
}

/**
 * La de andar por casa: minúsculas, sin tildes, sin espacios sobrantes en los
 * extremos. Es la que quieren casi todas las búsquedas por nombre.
 */
export function clave(s: string): string {
  return sinTildes(String(s).trim().toLowerCase());
}

/**
 * Como `clave` pero además colapsa los espacios interiores. Para nombres
 * sacados de un .docx, donde "Torre  Oscura" y "Torre Oscura" son lo mismo.
 */
export function claveEspacios(s: string): string {
  return clave(s).replace(/\s+/g, " ");
}

/**
 * Para nombres de especie, que llegan de fuentes que los escriben de maneras
 * incompatibles entre sí:
 *
 *   "Nidoran♀"      -> "nidoranf"
 *   "Mr. Mime"      -> "mr mime"
 *   "Raichu-Alola"  -> "raichu alola"
 *   "Raichu (Alola)"-> "raichu alola"
 */
export function claveEspecie(s: string): string {
  return clave(s)
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[.'’]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
