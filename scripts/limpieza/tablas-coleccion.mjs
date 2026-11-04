// scripts/limpieza/tablas-coleccion.mjs
//
// Correcciones a mano sobre lo COLECCIONABLE de cada zona: MTs, páginas de
// alquimia y habitantes de Pueblo Acrílico. Son las tres cosas que la guía
// lista dos veces — dentro del texto de la zona y en un apéndice al final —
// y donde la extracción del .docx se dejó cosas por el camino.
//
// Cada entrada lleva encima de dónde sale. Ese es el motivo de que esto sea un
// .mjs y no un .json: la corrección sin su prueba no se puede revisar.

/**
 * Los 18 habitantes reclutables de Pueblo Acrílico, tomados del "Listado de
 * Habitantes de Acrílico" de la guía (una sección propia al final, que la
 * extracción del .docx no llegó a usar).
 *
 * De ahí salen tres arreglos: los dos que faltaban por completo (Madame
 * Caléndula y Cerúleo), los cinco que estaban como "Sin nombre confirmado"
 * porque el texto de su ruta no los nombra, y uno mal atribuido — el de la
 * Ruta 16 figuraba como "Azoth", que es el equipo al que pertenecía, no su
 * nombre. La `funcion` es el servicio que presta una vez mudado, que el
 * listado detalla y en el JSON no estaba.
 *
 * Son 17 entradas pero 18 habitantes: Mariano y Luciano se reclutan juntos.
 */
export const HABITANTES_ACRILICO = [
  { zona: "Ruta 3", nombre: "Nácar", funcion: "Tienda Pokémon" },
  { zona: "SANTUARIO DE LOS REYES", nombre: "Azahara", funcion: "Recordadora de movimientos" },
  { zona: "Ruta 6", nombre: "Margarito", funcion: "Rancho Pokémon (PC)" },
  { zona: "Regresar a la Ruta 8 a entregar el Pañuelo (Opcional)", nombre: "Isidora", funcion: "Guardería Pokémon" },
  { zona: "Estación de servicio (opcional)", nombre: "Dendro", funcion: "Cambiador de habilidades" },
  { zona: "Ruta 11", nombre: "Espino", funcion: "Vende bayas que reducen EVs" },
  { zona: "VIEJO VÁNITAS", nombre: "Jara", funcion: "Vende hierbas medicinales" },
  { zona: "CRIPTAS DE LUMINALIA (Opcional)", nombre: "Plumanegra", funcion: "Vende objetos que potencian EVs" },
  { zona: "TORRE OSCURA (7º MEDALLA)", nombre: "Pistia", funcion: "Vende objetos que potencian EVs" },
  { zona: "FÁBRICA DE POKÉBALL (INTERIOR)", nombre: "Mariano y Luciano", funcion: "Entrenamiento de EVs", cantidad: 2 },
  { zona: "PRISIÓN DEL OLVIDO (ISLA)", nombre: "Dandelio", funcion: "Intercambio prodigioso" },
  { zona: "Ruta 16 Sur (Opcional)", nombre: "Andrea", funcion: "Juego de minería" },
  { zona: "Cueva Desenlace (Opcional)", nombre: "Ginia", funcion: "Cambiadora de formas" },
  { zona: "Obtener a Rotom Guillotina (Opcional)", nombre: "Briof", funcion: "Vende objetos competitivos" },
  { zona: "PUEBLO SANGUINO:", nombre: "Mimi", funcion: "Abre huevos, cambia género y sube la felicidad a 255" },
  // Los dos que no estaban en el JSON.
  {
    zona: "EXPANSIONES DE LUMINALIA-ESTE",
    nombre: "Madame Caléndula",
    funcion: "Vendedora de mentas",
    detalle:
      "En la Estación de Luminalia. Para que se mude hay que encontrar su anillo en el Lugar Misterioso bajo la estación; la llave de esa puerta está en una roca en la orilla del río.",
  },
  {
    zona: "Ruta 23",
    nombre: "Cerúleo",
    funcion: "Vende objetos para craftear",
    detalle:
      "En un barco varado, rodeando el barranco por la derecha justo antes de pasar sobre el faro. Pide un libro escondido en la biblioteca: hay que examinarla con la Lente de la Verdad para hallar una sala secreta y acertar quién dice la verdad.",
  },
];

/**
 * MTs que están en el "LISTADO DE MTS Y UBICACIÓN" del PDF (págs. 443-448, las
 * 108 completas) pero que la extracción del .docx no recogió en su zona.
 *
 * Falta una tercera, la MT107 (Espacio Raro): su ubicación es "Columna Lanza",
 * una zona de postgame a la que se llega por un portal tras reunir las 18
 * tablas elementales, y que no existe entre las 201 zonas del JSON. Sin zona
 * donde colgarla, se deja fuera en vez de inventarle una.
 */
export const MTS_FALTANTES = [
  {
    zona: "BASTIÓN FRACTAL (10º MEDALLA)",
    numero: "MT1",
    movimiento: "Ventisca",
    contexto: "Recompensa de Cendera (10ª Medalla).",
  },
  {
    zona: "Ruta 6",
    numero: "MT62",
    movimiento: "Acróbata",
    contexto: "Ruta 6, viniendo desde Ciudad Óleo.",
  },
];

/**
 * Filas de MT que no son tales: la extracción tomó por ubicación un párrafo de
 * prosa donde la MT se menciona de pasada ("es recomendable haber obtenido la
 * MT78 Terratemblor ya que es un...") o directamente el texto de consejos de
 * batalla del Regente. El listado del PDF confirma que la MT está en otra zona.
 */
export const MTS_ESPURIAS = [
  { zona: "BASTIÓN DEL REGENTE F3 (3º MEDALLA)", numero: "MT31" }, // real: Colina de Tormenta
  { zona: "BASTIÓN DEL REGENTE HISOPO (2º MEDALLA)", numero: "MT46" }, // real: Ciudad Óleo
  { zona: "BASTIÓN DEL REGENTE F3 (3º MEDALLA)", numero: "MT78" }, // real: Ciudad Novarte
];

/** Nombres de movimiento que quedaron cortados al extraer la tabla de MTs. */
export const MTS_MOVIMIENTO_CORREGIDO = {
  MT34: "Joya de Luz",
  MT60: "Ala de Acero",
  MT89: "Ida y Vuelta",
};

/**
 * Zonas con DOS páginas de alquimia. La guía las lista como ubicaciones
 * separadas ("Burned Workshop (Basement)" y "Burned Workshop (F3 Room)"), pero
 * el JSON solo guardaba una por zona, así que la segunda se perdía.
 *
 * `principal` reescribe la descripción de la PRIMERA página cuando la que
 * traía el JSON era en realidad la de la segunda (Ruta 15) o venía cortada a
 * medias por la extracción del .docx (Taller Quemado). Sin eso las dos
 * entradas describían el mismo sitio con otras palabras.
 */
export const ALQUIMIAS_ADICIONALES = [
  {
    zona: "TALLER QUEMADO",
    principal: "Página de Alquimia Pokémon: en el sótano, en la esquina superior izquierda.",
    descripcion: "Segunda página: en el lado izquierdo de la sala donde conoces a F3.",
  },
  {
    zona: "CIUDAD LUMINALIA NORTE",
    descripcion: "Segunda página: surfeando entre los setos de la zona central.",
  },
  {
    zona: "Ruta 15",
    principal: "Página de Alquimia Pokémon: nada más entrar en la ruta, abajo a la izquierda.",
    descripcion: "Segunda página: surfeando por debajo del puente y luego a la izquierda, en una zona apartada.",
  },
  {
    zona: "Ruta 23",
    descripcion: "Segunda página: tras rodear el acantilado por la derecha y descender.",
  },
];

/**
 * Páginas de alquimia que el PDF lista como obtenibles en la zona pero que el
 * JSON tenía sin marcar.
 *
 * Vacío a propósito: el recuento contra el texto del PDF (49 menciones de
 * "Página de Alquimia", 46 páginas reales) no dejó ninguna zona sin marcar.
 * La entrada que hubo aquí — CAMPAMENTO DE CRISANTO — era en realidad el texto
 * de CHATEAU LANTO ("en la dimensión alterna, en el dormitorio"), que el PDF
 * asigna a esa otra zona; se retira en ALQUIMIAS_ESPURIAS.
 */
export const ALQUIMIAS_FALTANTES = [];

/**
 * Zonas marcadas con página de alquimia que en realidad NO tienen ninguna.
 * Salieron de cruzar zona por zona el texto del PDF: son de tres clases.
 *
 *  - recapitulaciones: las secciones "Regresar a…" repiten páginas que ya
 *    están contadas en su zona original (Ruta 5, Ruta 8 Parte 3, Ruta 11).
 *  - otra cosa que se llama parecido: el POTE de alquimia de la Prisión del
 *    Olvido y el requisito de "42 Páginas" de la Orfebrería de Rúpico.
 *  - texto copiado de otra zona: ver ALQUIMIAS_FALTANTES.
 *
 * `mover` conserva el texto como nota general en vez de tirarlo, porque en las
 * recapitulaciones sigue siendo útil como checklist de backtracking.
 */
export const ALQUIMIAS_ESPURIAS = [
  { zona: "Regresar a la Granja Gogoat para la Montura (Opcional)", mover: true },
  { zona: "Regresar a hacer cosas con el poder de Surf (Opcional)", mover: true },
  { zona: "PRISIÓN DEL OLVIDO (MATERIALES)", mover: true },
  { zona: "CIUDAD FLUXUS", mover: true },
  { zona: "CAMPAMENTO DE CRISANTO", mover: false },
];

/**
 * Requisitos que el texto de la zona no menciona pero el apéndice "LISTADO DE
 * UBICACIÓN DE RECETAS" sí. Es el único caso: de los cuatro "(Requiere X)" del
 * apéndice, los otros tres ya se detectan solos de la prosa de la zona.
 */
export const REQUISITOS_ALQUIMIA_MANUALES = {
  "Acceder a las Catacumbas Septentrionales (Opcional)": ["fuerza"],
};
