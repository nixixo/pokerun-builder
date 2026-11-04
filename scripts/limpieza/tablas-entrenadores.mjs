// scripts/limpieza/tablas-entrenadores.mjs
//
// Correcciones a mano sobre los ENTRENADORES y sus equipos: especies que la
// extracción perdió, combates mal clasificados, el orden de las secuencias tipo
// Alto Mando y el reparto de notas entre lo que se enseña y lo que solo es
// trazabilidad.
//
// Módulo .mjs y no JSON porque cada entrada lleva encima la prueba de por qué
// existe — qué dice el PDF, con qué se contrastó — y porque varias usan
// expresiones regulares. Ver también tablas-zonas.mjs y tablas-coleccion.mjs.

import { EQUIPOS_MELIA } from "../equipos-melia.mjs";
import { EQUIPOS_CRISANTO } from "../equipos-crisanto.mjs";

/** Rivales cuyos equipos se reescriben enteros desde la guía en PDF. */
export const RIVALES = [
  { patron: /^Rival Melia/i, equipos: EQUIPOS_MELIA },
  { patron: /^Rival Crisanto/i, equipos: EQUIPOS_CRISANTO },
];

/**
 * Especies que la extracción del .docx perdió: la celda de `especie` se llenó
 * con texto de otra columna (un movimiento, una habilidad, o una palabra del
 * párrafo de consejos), pero el resto de la fila — nivel, objeto, habilidad y
 * los 4 movimientos — quedó intacto y correcto.
 *
 * Cada recuperación está confirmada por dos vías independientes: la habilidad,
 * que en estos casos apunta a una sola especie posible, y el nombre citado en
 * las notas del propio entrenador. La `especie` esperada evita reescribir una
 * fila distinta si el JSON cambia.
 */
export const ESPECIE_RECUPERADA = [
  // Bastión de la Regente Canola. "Sorpresa" es el primer movimiento de
  // Croagunk y "Toque" viene de su habilidad TOQUE TÓXICO: la tabla corrió una
  // columna. Las notas de la Regente nombran a Meditite y a Kricketune.
  // ENERGÍA PURA solo existe en Meditite/Medicham (a Nv.14 es Meditite, que
  // evoluciona a 37); CONTRA-GUARDIA existe en una única especie.
  { zona: /^BASTIÓN DE LA REGENTE CANOLA/, alias: "Sorpresa", nivel: "14", especie: "Meditite" },
  { zona: /^BASTIÓN DE LA REGENTE CANOLA/, alias: "Toque", nivel: "15", especie: "Kricketune" },

  // Rival Melia. El alias sale de sus propias notas: "bloqueamos ambos stabs
  // con un pokémon defensivo Veneno o de Acero". La línea Munna evoluciona
  // entre combates, así que la especie depende de la zona.
  { zona: "SANTUARIO DE LOS REYES", alias: "Veneno", nivel: "21", especie: "Munna" },
  { zona: "Ruta 9 Parte 2", alias: "Veneno", nivel: "21", especie: "Musharna" },
  { zona: "CIUDAD LUMINALIA NORTE", alias: "Veneno", nivel: "21", especie: "Musharna" },
  { zona: "Ruta 18 Parte 2", alias: "Veneno", nivel: "21", especie: "Musharna" },
  // El combate de Postgame queda sin tocar a propósito: es el único sin notas
  // que nombren la especie, así que no hay con qué confirmarlo.
];

/**
 * Igual que arriba pero para Pokémon salvajes. En Isla Montesanto el nombre
 * quedó en "Alola" — el mismo corte que dejó los drops de la zona terminando
 * en ") (Izquierda" se comió el resto. De las nueve formas de Alola de la
 * Pokédex, Exeggutor es la única de tipo Planta, que es lo coherente con su
 * drop (Piedra Hoja); el resto de la zona es fauna de séptima generación.
 */
export const SALVAJE_RECUPERADO = [
  { zona: "Visitar la Isla Montesanto (Opcional)", nombre: "Alola", especie: "Exeggutor Alola" },
];

/**
 * `tipo: "importante"` venía puesto en 96 de los 105 entrenadores, o sea en
 * casi todos. No es solo cosmético: battlePrep y nextImportantBattle eligen el
 * PRIMER entrenador importante de cada zona para el panel "próxima batalla",
 * así que en el Bastión de la Regente Canola el panel preparaba para
 * "Mosquetera del centro" en vez de para la Regente.
 *
 * Importante queda reservado a jefes, Regentes, rivales y combates de trama.
 * Lo de acá abajo se degrada a "menor".
 */
export const RECLASIFICAR_MENOR = {
  // "Mosquetero/a" es la clase de relleno: los entrenadores comunes de los
  // Bastiones (gimnasios) y los sueltos de ruta o cueva.
  patrones: [/^Mosqueter[oa]/i],
  // Secundarios con nombre propio, pero combates normales al fin y al cabo.
  nombres: [
    "Carabineros Edmond y Mercedes",
    "Actor Sombrío Malvo",
    "Monsieur Bastian",
    "Crítico de cocina Eneldo",
    "Espadachín Espino",
    "Obreros Mariano y Luciano",
    "Veterano Urano",
  ],
};

/**
 * Las dos secuencias tipo Alto Mando del juego, una por mitad. Se marcan con
 * `secuencia` y `ordenSecuencia` en vez de tocar `tipo`, para que sigan siendo
 * "importante" y no se caigan del panel de próxima batalla ni del badge.
 *
 * El orden es el del JSON, que ya coincide con el de la guía (verificado para
 * El Arma Definitiva contra el PDF). Se listan por nombre para no marcar de
 * más: en Cámaras de Reflexión hay además un "Rey Áster Zephir" a Nv.50-51,
 * siete niveles por debajo de los Altos, que es un combate de trama previo y
 * no parte de la secuencia.
 */
export const SECUENCIAS = [
  {
    nombre: "Alto Mando I",
    zona: "CÁMARAS DE REFLEXIÓN (INTERIOR)",
    orden: [
      "Alto Caballero Tileo",
      "Alta Dama Malva",
      "Alta Dama Drácena",
      "Alto Caballero Narciso",
      "Reyes Áster y Angeline",
    ],
  },
  {
    nombre: "Alto Mando II",
    zona: "El Arma Definitiva",
    orden: [
      "Alto Mando Tornasola",
      "Alto Mando Aure",
      "Alto Mando Prímula",
      "Alto Mando Malvo",
      "Malvo del linaje Rojo",
      "Entrenadora Alca",
      "Alca: El Arma Definitiva",
    ],
  },
];

/**
 * Notas de trazabilidad que quedaron mezcladas con las de juego. El campo
 * `notas` se pinta debajo de la tarjeta del entrenador, así que el registro de
 * "esta especie se confirmó a mano mirando la guía" acababa mostrándose al
 * jugador como si fuera un consejo de batalla. Se parte cada una: lo que sirve
 * en pantalla se queda en `notas`, y el resto pasa a `procedencia`, que no se
 * renderiza.
 *
 * El corte va escrito a mano porque no es mecánico: en unas la nota entera es
 * trazabilidad y en otras arranca con información útil.
 */
export const NOTAS_PARTIDAS = [
  {
    // Hay otro Alquimista Azoth Núbila en Chateau Lanto con su propia nota:
    // sin anclar la zona, esta trazabilidad le pisaba la suya.
    entrenador: "Alquimista Azoth Núbila",
    zona: "BOSQUE LADERA PARTE 2",
    notas: "",
    procedencia:
      "La tabla de nivel 19 (Baya Aranja / Alquimia Vil / Arrumaco, Bomba Ácida, Luz Decadente, Armadura Ácida) corresponde a Duosion (Regional), no a Stunky — confirmado con captura de la guía. Stunky sí participa en el combate (aparece en 'Consejos de batalla' con la habilidad Globo Helio), pero la guía no le da tabla propia: su nivel, objeto y movimientos siguen sin confirmar.",
  },
  {
    entrenador: "Actor Sombrío Malvo",
    notas: "",
    procedencia: "Especie del 2º Pokémon confirmada a mano como Fraxure.",
  },
  {
    entrenador: "Rival Crisanto",
    zona: "FÁBRICA DE POKÉBALL (INTERIOR)",
    notas: "Combate final de la fábrica, 7 Pokémon.",
    // La nota original decía que Crisanto usa el inicial FUERTE contra el
    // nuestro. Es al revés: el PDF (pág. 254) dice "EL INICIAL DÉBIL FRENTE A
    // NUESTRO TIPO ELEGIDO" — el fuerte lo lleva Melia. Además ya está cubierto
    // por el campo `condicion` de cada variante, así que la frase se retira.
    procedencia:
      "Equipo tomado de la guía en PDF, pág. 254. Los tres últimos dependen del inicial del jugador: Crisanto lleva el DÉBIL frente al nuestro (Melia lleva el fuerte).",
  },
  {
    entrenador: "Regente Loto (Revancha)",
    notas: "REVANCHA P1. Comparte casi todo el roster con Regente Zafra salvo el 6º Pokémon, que es la variante fakemon Wailord Z en vez de un Wailord normal.",
    procedencia: "Equipo confirmado a mano: Politoed, Mega Gyarados, Honchkrow, Whiscash, Clawitzer, Wailord Z.",
  },
  {
    entrenador: "Regente Cendera (Revancha)",
    notas: "REVANCHA P2.",
    procedencia:
      "Especies confirmadas a mano: Aurorus, Empoleon, Weavile, Mega Baxcalibur, Glastrier y Freyjynx. Es el único Regente sin bloque de 'Consejos de batalla' en la guía, así que en su momento se infirieron por objeto, habilidad y movimientos.",
  },
  {
    entrenador: "Alto Mando Tornasola",
    notas: "Primer Alto Mando de El Arma Definitiva. Tiene dos Restaurar Todo.",
    procedencia:
      "El 4º Pokémon es Mega Garchomp: el texto de consejos de la guía lo llama 'Mega Excadrill' por error, pero lleva Garchompita.",
  },
];

/**
 * Consejos que el .docx partió en dos: el párrafo se cortó a mitad de frase y
 * la cola quedó como una nota de zona suelta. No hay forma de detectarlo solo
 * con el texto — la guía llega a poner un punto en mitad de la frase ("…ya que
 * no cuenta con el.") — así que van uno a uno, con la nota que hay que pegar.
 */
export const CONSEJOS_PARTIDOS = [
  {
    zona: "El Arma Definitiva",
    entrenador: "Alto Mando Prímula",
    especie: "Royaleon",
    cola: "Ataque Onda Certera, e incluso cualquier tipo acero también es sumamente útil.",
    // Pág. 14586 del volcado del PDF: "…ya que no cuenta con el ataque Onda
    // Certera, e incluso cualquier tipo acero también es sumamente útil."
    unir: (consejo, cola) => `${consejo.replace(/\.$/, "")} ${cola[0].toLowerCase()}${cola.slice(1)}`,
  },
];

/**
 * Consejos cuyo texto contradice la tabla del propio combate. No se reescribe
 * el consejo — es lo que dice la guía — sino que se le cuelga un aviso, para
 * que quien lo lea no prepare el combate contra una habilidad que el rival no
 * tiene. Los detecta `revisarConsejosVsEquipo`.
 */
export const CONSEJOS_ACLARADOS = [];

/**
 * Consejos que la guía puso en el Pokémon equivocado y que aquí se cambian de
 * sitio. La condición `empiezaPor` es lo que hace la pasada idempotente: una
 * vez intercambiados ya no se cumple, así que volver a correr el script no los
 * devuelve a su sitio.
 */
export const CONSEJOS_INTERCAMBIADOS = [
  {
    zona: "El Arma Definitiva",
    entrenador: "Alto Mando Tornasola",
    // El consejo titulado "Landorus" es el que habla de Poder Arena, y Poder
    // Arena la lleva el Mega Garchomp de este equipo (Landorus va con
    // Intimidación). El otro consejo va titulado "Mega Excadrill" en la guía,
    // que es el nombre equivocado del propio Mega Garchomp.
    a: { especie: "Landorus", empiezaPor: "Importante cambiar el clima" },
    b: { especie: "Mega Garchomp", empiezaPor: "Muy ofensivo" },
  },
];

/**
 * Notas que el .docx le colgó al entrenador equivocado. Al perderse la cabecera
 * de la tabla, el párrafo que iba DESPUÉS de un combate se pegó al último
 * entrenador que sí tenía nombre, aunque fuera de otra parte de la zona.
 */
export const NOTAS_ENTRENADOR_ESPURIAS = [
  {
    zona: "TORRE PRISMA",
    nombre: "Mosquetero Antonio (P1):",
    // Es el texto de transición entre los dos combates contra Mirra, en la cima
    // de la torre. El mosquetero está en el primer piso.
    empiezaPor: "Tras derrotarle, nos toparemos con una ingrata sorpresa",
  },
];
