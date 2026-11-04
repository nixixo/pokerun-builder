// components/guia/useMoveTypes.ts
//
// Carga /moves_z_completo.json (public/) una sola vez y arma un mapa
// nombre en español -> typeApi, para poder pintar los chips de
// movimiento en la Guía según su tipo. La guía solo tiene el nombre
// del movimiento como string (ej. "Chispa"), así que el match es por
// nombre exacto en español, normalizado (minúsculas, sin tildes) para
// tolerar pequeñas diferencias de capitalización.

import { useMemo } from "react";
import { clave as normalize } from "@/components/shared/normalizar";
import { recursoJson } from "@/components/shared/recursoJson";

type MoveEntry = {
  internalName: string;
  name: string;
  type: string;
  typeApi: string;
  category: string;
  categoryEn: string;
  basePower: number;
  accuracy: number;
  pp: number;
  description: string;
};

/**
 * Variante tolerante, para los nombres que la gu\u00eda escribe con adornos: punto
 * final ("Pu\u00f1o Bala."), guion de corte de l\u00ednea ("Afila-Garras") o el tipo
 * entre par\u00e9ntesis ("Luz Decadente (Hada)"). Se usa solo si falla el match
 * exacto, para no arriesgar falsos positivos donde el nombre ya es correcto.
 */
function normalizeLoose(s: string): string {
  return normalize(s)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[.\-\u2013\u2014]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Físico" | "Especial" | "Estado", tal cual lo escribe moves_z_completo.json. */
export type MoveCategory = string;

// Compartido por el detalle de zona y el panel de próxima batalla, que lo usan
// a la vez: recursoJson se encarga de que se pida una sola vez.
const MovimientosZ = recursoJson<MoveEntry[]>("/generated/moves_z_completo.json", {
  etiqueta: "useMoveTypes",
});

export function useMoveTypes() {
  const { datos: moves } = MovimientosZ.useRecurso();

  const { byName, byLooseName } = useMemo(() => {
    const exact = new Map<string, MoveEntry>();
    const loose = new Map<string, MoveEntry>();
    for (const mv of moves ?? []) {
      exact.set(normalize(mv.name), mv);
      // Sin sobrescribir: ante dos movimientos que colapsen al mismo nombre
      // relajado, gana el primero en vez de quedarse con el último.
      const k = normalizeLoose(mv.name);
      if (!loose.has(k)) loose.set(k, mv);
    }
    return { byName: exact, byLooseName: loose };
  }, [moves]);

  function findMove(moveName: string): MoveEntry | null {
    return byName.get(normalize(moveName)) ?? byLooseName.get(normalizeLoose(moveName)) ?? null;
  }

  function getMoveTypeApi(moveName: string): string | null {
    return findMove(moveName)?.typeApi ?? null;
  }

  function getMoveCategory(moveName: string): MoveCategory | null {
    return findMove(moveName)?.category ?? null;
  }

  /**
   * Con qué lado ataca este Pokémon, mirando solo sus movimientos ofensivos —
   * los de Estado no cuentan porque no pegan por ninguno de los dos lados.
   * Devuelve null si no se reconoce ningún ataque (nombre que no matchea, o un
   * equipo que solo lleva movimientos de estado).
   */
  function getAttackProfile(movimientos: string[]): "Físico" | "Especial" | "Mixto" | null {
    let fisicos = 0;
    let especiales = 0;
    for (const mv of movimientos) {
      const cat = getMoveCategory(mv);
      if (cat === "Físico") fisicos++;
      else if (cat === "Especial") especiales++;
    }
    if (fisicos === 0 && especiales === 0) return null;
    if (fisicos === especiales) return "Mixto";
    return fisicos > especiales ? "Físico" : "Especial";
  }

  return { getMoveTypeApi, getMoveCategory, getAttackProfile, loaded: moves !== null };
}