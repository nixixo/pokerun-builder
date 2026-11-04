// components/guia/formato.ts
//
// Nombres de zona presentables.
//
// El JSON los guarda tal cual salieron del .docx, casi todos EN MAYÚSCULAS
// ("PUEBLO ACRÍLICO", "TORRE OSCURA (7º MEDALLA)"). Aquí se arreglan SOLO PARA
// MOSTRAR, sin tocar el dato: el nombre de zona es la clave con la que se
// guardan las zonas visitadas en localStorage, y es también la clave con la que
// se cruzan `conexiones`, entrenadores-pdf.json y media docena de tablas de
// scripts/clean-guia-names.mjs. Renombrarlas en origen borraría el progreso de
// quien ya lleva partida y obligaría a tocar todo eso a la vez.

const MINUSCULAS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "o", "u", "e",
  "en", "con", "a", "al", "por", "para", "un", "una", "sin", "tras",
]);

// Palabras que van enteras en mayúscula pase lo que pase.
const SIGLAS = new Set(["mt", "mo", "ps", "pp", "npc"]);

/**
 * Espaciado de los paréntesis, que el volcado del .docx dejó a su aire:
 *
 *   "COSTA SANGUINA(OPCIONAL)"              -> "COSTA SANGUINA (OPCIONAL)"
 *   "BARCO DEL CAPITÁN LOTO (5º MEDALLA )"  -> "BARCO DEL CAPITÁN LOTO (5º MEDALLA)"
 *
 * Va antes del corte por mayúsculas de abajo a propósito: "Atrapar a
 * Shaymin(Opcional)" no está en mayúsculas y saldría por la vía rápida sin
 * arreglar. Aquí no hay riesgo de tocar un nombre bueno — nadie escribe un
 * paréntesis pegado a la palabra ni un espacio antes de cerrarlo queriendo.
 */
function espaciarParentesis(s: string): string {
  return s
    .replace(/(\S)\(/g, "$1 (") // falta espacio antes de abrir
    .replace(/\s+\)/g, ")"); // sobra espacio antes de cerrar
}

/**
 * Quita el "(Opcional)" del final del título. Solo para donde se pinta al lado
 * la marca de opcional: repetirlo en el nombre Y en la marca es ruido, pero en
 * los sitios donde no hay marca (pills de conexiones, buscador, mapa) el nombre
 * tiene que seguir diciéndolo.
 *
 * El dato ya trae `opcional`, así que esto es solo cosmética; se recorta con la
 * misma tolerancia con la que se marcó (ver ES_OPCIONAL en clean-guia-names).
 */
export function sinSufijoOpcional(nombre: string): string {
  return nombre.replace(/\s*\(?\s*opcional\s*\)?\s*$/i, "").trim() || nombre;
}

/**
 * "PUEBLO ACRÍLICO" -> "Pueblo Acrílico"
 * "TORRE OSCURA (7º MEDALLA)" -> "Torre Oscura (7º Medalla)"
 * "Ruta 22 Parte 1:" -> "Ruta 22 Parte 1"   (los dos puntos sobran en un título)
 *
 * Lo que ya viene con minúsculas se respeta: son nombres que alguien escribió
 * a mano y suelen estar mejor que cualquier regla automática.
 */
export function nombreZona(zona: string): string {
  const limpio = espaciarParentesis(
    String(zona).replace(/\s+/g, " ").trim().replace(/:$/, "")
  );
  if (!limpio) return limpio;
  if (limpio !== limpio.toUpperCase()) return limpio;

  return limpio
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => {
      const solo = palabra.replace(/[^a-záéíóúñü]/g, "");
      if (SIGLAS.has(solo)) return palabra.toUpperCase();
      if (i > 0 && MINUSCULAS.has(palabra)) return palabra;
      // Primera LETRA, no primer carácter: hay títulos que abren con paréntesis
      // o con un ordinal ("(7º medalla)").
      return palabra.replace(/[a-záéíóúñü]/, (c) => c.toUpperCase());
    })
    .join(" ");
}
