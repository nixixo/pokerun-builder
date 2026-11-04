// scripts/limpieza/tablas-zonas.mjs
//
// Correcciones a mano sobre la LISTA DE ZONAS: las que hay que crear porque la
// guía las describe sin darles sección propia, las conexiones que no cuadran, y
// lo que está archivado en el sitio equivocado.
//
// Van en un módulo .mjs y no en un JSON a propósito: cada entrada lleva encima
// la razón por la que existe — qué dice el PDF, qué se comprobó — y eso es lo
// que hace revisable la corrección. Un JSON no guarda comentarios, y varias de
// estas tablas usan además expresiones regulares.

/** Zona de postgame que la extracción del .docx nunca creó. Se añade al final. */
export const ZONA_COLUMNA_LANZA = {
  zona: "COLUMNA LANZA (Opcional)",
  conexiones: ["PUEBLO COLLAGE"],
  pokemon_salvajes: [],
  objetos: [],
  mts: [
    { numero: "MT107", movimiento: "Espacio Raro", contexto: "En la Columna Lanza." },
  ],
  entrenadores: [],
  intercambios: [],
  notas_generales: [
    "Se llega reuniendo las 18 tablas elementales de los nidos Alfa y volviendo a la ubicación donde conocemos a Crisanto: allí aparece un portal que lleva a la Columna Lanza.",
    "Dentro nos enfrentamos al Entrenador Volus, con un equipo de 6 Pokémon entre Nv.98 y Nv.100. Al vencerle se accede a Arceus.",
  ],
  conexiones_fuente: "pdf_guia_oficial",
};

/**
 * Sitios que otras zonas listan como conexión pero que la guía describe dentro
 * del texto de la zona madre, sin darles sección propia. Sin entrada aquí el
 * botón de la conexión sale deshabilitado (ver resolverConexiones).
 *
 * Queda fuera "Ruinas Fractales", que Ruta 21 declara como conexión: no aparece
 * ni una sola vez en el PDF, así que no hay con qué construirla.
 */
export const ZONAS_SUBSECCION = [
  {
    zona: "Madriguera Profunda",
    conexiones: ["PANTANO PROFANO"],
    pokemon_salvajes: [],
    objetos: [],
    mts: [],
    entrenadores: [
      {
        nombre: "Reclutas Azoth Amicia y Hugo",
        notas: "Combate doble. Son los reclutas a los que perseguimos desde Pueblo Profano.",
        equipo: [
          {
            especie: "Venomoth",
            nivel: "27",
            objeto: "",
            habilidad: "",
            naturaleza: null,
            movimientos: ["Cargatóxica", "Viento Plata", "Luz Decadente", "Gigadrenado"],
            nota: "Luz Decadente es de tipo Hada en el romhack.",
          },
          {
            especie: "Mr. Mime",
            nivel: "27",
            objeto: "",
            habilidad: "",
            naturaleza: null,
            movimientos: ["Psicorrayo", "Beso Drenaje", "Luz Decadente", "Reflejo"],
            nota: "Luz Decadente es de tipo Hada en el romhack.",
          },
        ],
      },
    ],
    intercambios: [],
    notas_generales: [
      "Está en la tercera parte del Pantano Profano. Se llega yendo al norte tras el combate contra la ladrona.",
      "Al derrotar a los reclutas aparecen Melia y Crisanto junto a un Clodsire. Melia lo hace enfadar y el Clodsire llena la madriguera de toxinas, obligando a todos a salir. Después hay que volver a Pueblo Profano a informar.",
      "Pecharunt se obtiene aquí, en el punto donde el Clodsire nos envenena.",
      "El Nido Alfa Veneno no está dentro: queda en la parte inferior izquierda del pantano, tomando la entrada de la madriguera como referencia.",
    ],
    conexiones_fuente: "pdf_guia_oficial",
  },
  {
    zona: "Faro Abandonado",
    conexiones: ["Ruta 23"],
    pokemon_salvajes: [],
    objetos: [],
    mts: [],
    entrenadores: [],
    intercambios: [],
    notas_generales: [
      "Está en la Ruta 23. Es una de las entradas a las Catacumbas Occidentales: para abrirla hay que pasar por encima de la rejilla llevando de primero un Pokémon que pese 200 kg o más.",
      "Rayquaza está en la cima.",
      "Detrás del faro hay un barco encallado donde vive Cerúleo, el habitante que se muda a Pueblo Acrílico como Vendedor de Objetos para Crear. Sus objetos siguen listados en la Ruta 23.",
    ],
    conexiones_fuente: "pdf_guia_oficial",
  },
];

/**
 * Entrenadores que quedaron archivados bajo un título de ARCO.
 *
 * Los arcos son separadores de capítulo, no ubicaciones, y la interfaz los pinta
 * como tales: no se pueden clicar. Un combate ahí dentro solo se alcanza con las
 * flechas de anterior/siguiente o si el banner lo pesca — invisible en la lista.
 *
 * De momento hay uno solo. La nota del propio entrenador dice dónde se pelea de
 * verdad ("Combate en la Estación de Servicio... necesario para poder entrar a
 * la ruta"), así que va al principio de esa ruta: es la puerta que abre. La nota
 * viaja con él, así que la ubicación exacta no se pierde.
 *
 * Las notas del arco NO se mueven: describen el arranque del capítulo ("ir a la
 * Estación de Servicio", "hablar con Melia"), que es justo lo que un separador
 * tiene que contar.
 */
export const ENTRENADORES_FUERA_DE_ARCO = [
  {
    nombre: "Payaso Mecánico Anticuado",
    desde: "Yveltal",
    hasta: "Ruta 22 Parte 1:",
  },
];

/**
 * Objetos y MTs que el PDF sitúa en el Faro Abandonado pero que el JSON tenía
 * en la Ruta 23, la zona que lo contiene.
 */
export const MUDANZA_FARO = {
  destino: "Faro Abandonado",
  origen: "Ruta 23",
  objetos: ["Ectoplasma"],
  mts: ["MT76"],
};

/**
 * Conexiones cuyo destino no se deduce normalizando el nombre. La clave va
 * normalizada (ver normalizarZona).
 */
export const CONEXIONES_ALIAS = {
  "SANTUARIO DE REYES": "SANTUARIO DE LOS REYES",
  "COLINA TORMENTA": "COLINA DE TORMENTA",
  // La zona no lleva el nombre del sitio sino la acción, así que no hay prefijo
  // que valga.
  "CATACUMBAS SEPTENTRIONALES": "Acceder a las Catacumbas Septentrionales (Opcional)",
};

/**
 * Conexiones a sitios que no existen. Venían con `conexiones_fuente:
 * "confirmada_por_mapa"`, y ese mapa (public/mapa.png) es el del juego: nodos y
 * líneas sin una sola etiqueta, así que los nombres se pusieron a mano. El PDF
 * no menciona "Ruinas Fractales" ni una vez en sus 17.000 líneas.
 */
export const CONEXIONES_ESPURIAS = [{ zona: "Ruta 21 (Opcional)", destino: "Ruinas Fractales" }];

/**
 * Entradas que no son un LUGAR sino un objetivo: "conseguir a X". La guía las
 * titula "Atrapar a Raikou (Opcional)" y la extracción del .docx las convirtió
 * en zonas, así que hoy se recorren como si fueran una ruta más.
 *
 * Qué especie es solo lo dice el título, y no siempre de una forma que se pueda
 * partir sola: "los Tapus" son cuatro, "los Espadachines Místicos" también, y
 * "Manaphy y tener a Phione" es una cadena de dos pasos. De ahí la tabla a mano
 * en vez de una regex sobre el nombre — el resto sale de las propias notas de
 * cada entrada, que enumeran uno por uno dónde aparece cada bicho.
 *
 * Los nombres van tal cual los conoce la Pokédex Z: son la clave con la que se
 * resuelve el sprite. Están comprobados los 27 contra data-src.
 *
 * Ojo con lo que NO está aquí: los legendarios que se pelean dentro de un sitio
 * de verdad (Xerneas, Yveltal, Zygarde, Rayquaza en el Faro, Arceus en la
 * Columna Lanza, Pecharunt en la Madriguera). Esos ya tienen su zona y no hay
 * nada que desambiguar.
 */
export const CAPTURAS_POR_ZONA = {
  "Atrapar a Raikou (Opcional)": ["Raikou"],
  "Atrapar a Entei (Opcional)": ["Entei"],
  "Atrapar a Suicune (Opcional)": ["Suicune"],
  "Atrapar a Cresselia (Opcional)": ["Cresselia"],
  "Atrapar a Darkrai (Opcional)": ["Darkrai"],
  "Atrapar a Registeel (Opcional)": ["Registeel"],
  "Atrapar a Rotom (Opcional)": ["Rotom"],
  "Atrapar a los Tapus (Opcional)": ["Tapu Koko", "Tapu Lele", "Tapu Bulu", "Tapu Fini"],
  "Atrapar a Regice (Opcional)": ["Regice"],
  // Phione no se atrapa: sale de criar a Manaphy con Ditto. Van juntos porque
  // la guía los cuenta como un solo objetivo, y el segundo depende del primero.
  "Atrapar a Manaphy y tener a Phione (Opcional)": ["Manaphy", "Phione"],
  "Atrapar a Magearna (Opcional)": ["Magearna"],
  "Atrapar a Regirock (Opcional)": ["Regirock"],
  // No es una captura sino un cambio de forma: hay que llevar el Rotom que ya
  // tienes a la guillotina de Ciudad Grisalla.
  "Obtener a Rotom Guillotina (Opcional)": ["Rotom Guillotina"],
  "Atrapar a Uxie, Mesprit y Azelf (Opcional)": ["Uxie", "Mesprit", "Azelf"],
  // Cuatro, no tres: Keldeo aparece con los otros al colocar la Espada en el
  // altar del Santuario de los Reyes, aunque el nombre del grupo diga otra cosa.
  "Atrapar a los Espadachines Místicos (Opcional)": ["Cobalion", "Terrakion", "Virizion", "Keldeo"],
  "Atrapar a Regigigas (Opcional)": ["Regigigas"],
  "Atrapar a Shaymin(Opcional)": ["Shaymin"],
  "Atrapar a Eternatus (Opcional)": ["Eternatus"],
};
