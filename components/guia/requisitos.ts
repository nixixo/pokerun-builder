// components/guia/requisitos.ts
//
// Cuándo puedes recoger algo que pide Surf, Corte, la Montura Gogoat, etc.
//
// El orden de las zonas del JSON es el orden de juego, así que basta con saber
// EN QUÉ ZONA se consigue cada habilidad para poder avisar: si un objeto de la
// Ruta 8 pide Surf y Surf se obtiene diez zonas más adelante, la tarjeta lo
// marca como "vuelve más tarde" en vez de dejarte dar vueltas buscándolo.

import type { Requisito, Zone } from "./types";

export const REQUISITO_LABEL: Record<Requisito, string> = {
  surf: "Surf",
  gogoat: "Montura Gogoat",
  corte: "Hacha Endeble",
  polvo_explosivo: "Polvo Explosivo",
  golpe_roca: "Romper rocas",
  fuerza: "Fuerza",
  lente: "Lente de la Verdad",
  buceo: "Buceo",
};

/** Frase corta para el aviso, ya conjugada. */
export const REQUISITO_COMO: Record<Requisito, string> = {
  surf: "Melia te la entrega en el Barco del Capitán Loto",
  gogoat: "se cambia por la Llave Mercúrica en la Granja de la Ruta 2",
  corte: "es un crafteo, necesita 8 páginas de alquimia",
  polvo_explosivo: "es un crafteo, necesita 1 página de alquimia",
  golpe_roca: "es la MT94, la da la Regente Canola con la 1ª medalla",
  fuerza: "es la MT108, la da la Profesora Olivier en Chateau Lanto",
  lente: "aparece durante la historia en Chateau Rosillon",
  buceo: "se aprende al llegar a Ciudad Fluxus",
};

// Zona donde se obtiene cada habilidad, por nombre exacto. Los crafteos no van
// aquí: su disponibilidad depende de cuántas páginas de alquimia llevas, que se
// calcula recorriendo las zonas (ver `construirDisponibilidad`).
//
// Buceo no es una MT: la guía dice literalmente "justo en este punto hemos
// aprendido la capacidad de bucear" al llegar a Ciudad Fluxus.
const ZONA_DE_OBTENCION: Partial<Record<Requisito, string>> = {
  golpe_roca: "BASTIÓN DE LA REGENTE CANOLA (1º MEDALLA)",
  lente: "CHATEAU ROSILLON",
  fuerza: "CHATEAU LANTO",
  surf: "BARCO DEL CAPITÁN LOTO (5º MEDALLA )",
  buceo: "CIUDAD FLUXUS",
  gogoat: "Regresar a la Granja Gogoat para la Montura (Opcional)",
};

// Páginas de alquimia necesarias para desbloquear cada crafteo, tal cual las
// lista el apéndice de la guía ("Polvo Explosivo (1 Recetas)", "Hacha Endeble
// (8 Recetas)").
const RECETAS_NECESARIAS: Partial<Record<Requisito, number>> = {
  polvo_explosivo: 1,
  corte: 8,
};

export type Disponibilidad = Partial<Record<Requisito, number>>;

/**
 * Índice de zona a partir del cual tienes cada habilidad. Las que no aparecen
 * es que la guía no dice dónde se consiguen: esas se muestran como requisito
 * pero nunca generan aviso, porque no habría con qué respaldarlo.
 */
export function construirDisponibilidad(zones: Zone[]): Disponibilidad {
  const out: Disponibilidad = {};

  for (const [clave, nombre] of Object.entries(ZONA_DE_OBTENCION)) {
    const i = zones.findIndex((z) => z.zona === nombre);
    if (i >= 0) out[clave as Requisito] = i;
  }

  let paginas = 0;
  for (let i = 0; i < zones.length; i++) {
    const a = zones[i].pagina_alquimia;
    if (a?.presente) paginas += 1 + (a.adicionales?.length ?? 0);
    for (const [clave, hacenFalta] of Object.entries(RECETAS_NECESARIAS)) {
      const k = clave as Requisito;
      if (out[k] === undefined && paginas >= hacenFalta) out[k] = i;
    }
  }

  return out;
}

/**
 * De los requisitos de algo, los que TODAVÍA no tienes estando en esa zona.
 * Vacío significa que puedes ir a por ello ya.
 */
export function requisitosPendientes(
  requisitos: Requisito[] | undefined,
  zoneIndex: number,
  disponibilidad: Disponibilidad
): Requisito[] {
  if (!requisitos?.length) return [];
  return requisitos.filter((r) => {
    const desde = disponibilidad[r];
    return desde !== undefined && zoneIndex < desde;
  });
}
