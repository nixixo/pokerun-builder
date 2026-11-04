/** Dominio público actual de los recursos de Fakedex. */
export const FAKEDEX_SPRITES_BASE = "https://assets.fakedex.es/fakedex/z/sprites";
const LEGACY_BASE = "https://minio-p0ogk8cks8sc0k0coksoccco.195.200.15.5.sslip.io/fakedex/z/sprites/";

/** Compatibilidad con URLs que ya quedaron guardadas en equipos y plantillas. */
export function normalizeSpriteUrl(url: string): string {
  return url.startsWith(LEGACY_BASE) ? `${FAKEDEX_SPRITES_BASE}/${url.slice(LEGACY_BASE.length)}` : url;
}
