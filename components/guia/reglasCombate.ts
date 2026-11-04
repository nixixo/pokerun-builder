// components/guia/reglasCombate.ts
//
// Combates que no se juegan con las reglas normales.
//
// De momento solo hay una regla especial en todo el juego: el COMBATE INVERSO
// del Regente Hibis (7ª medalla, Torre Oscura) y su revancha en la Misión del
// Campanero. Ahí la tabla de tipos está del revés, así que todo lo que calcula
// battlePrep.ts y equipoVsRival.ts diría exactamente lo contrario de la verdad
// si no se tuviera en cuenta: la guía marcaría a Sigilyph como resistente a
// Lucha cuando es justo por donde más daño recibe.
//
// Se detecta LEYENDO EL DATO y no con una lista de nombres a mano: la propia
// guía escribe "Combate inverso" en las notas de los dos entrenadores. Si el
// romhack añade otro en una actualización, entra solo con solo que la guía lo
// diga igual.

import type { Zone } from "./types";

type Trainer = Zone["entrenadores"][number];

/** Cómo se juega este combate. */
export type ReglasCombate = {
  /** La tabla de tipos está invertida (2x <-> 0.5x, y las inmunidades a 2x). */
  inverso: boolean;
};

export const REGLAS_NORMALES: ReglasCombate = { inverso: false };

/**
 * "Combate inverso" en las notas del entrenador. Se mira también en las notas y
 * consejos de cada Pokémon porque el volcado del .docx no siempre deja el texto
 * en el mismo campo, y perderse esto es peor que comprobarlo de más.
 */
const INVERSO = /combate\s+inverso/i;

export function reglasDeCombate(trainer: Trainer | null | undefined): ReglasCombate {
  if (!trainer) return REGLAS_NORMALES;

  const textos: (string | undefined)[] = [trainer.notas, trainer.procedencia];
  for (const m of trainer.equipo ?? []) {
    textos.push(m.nota, m.consejo, m.consejoAviso);
  }

  return { inverso: textos.some((t) => t != null && INVERSO.test(t)) };
}

/** Rótulo corto para avisar en la interfaz. */
export const AVISO_INVERSO = "Combate inverso: la tabla de tipos está del revés";

/**
 * El detalle, para el tooltip. Lo de las inmunidades es lo que más sorprende:
 * un Fantasma deja de ser inmune a Normal y pasa a comerlo a doble.
 */
export const DETALLE_INVERSO =
  "Lo supereficaz pasa a resistido, lo resistido a supereficaz, y lo que era inmune recibe daño doble. " +
  "Todo lo que hay debajo (debilidades, recomendaciones y veredictos) ya está calculado con la tabla invertida.";
