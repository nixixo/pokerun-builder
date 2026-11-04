// scripts/entrenadores-huerfanos.mjs
//
// Equipos que la extracción del .docx dejó dentro de `objetos` como texto
// suelto ("Ralts, nivel 11.", "Gyarados, nivel 76. Restos. Acua Cola, ...").
// Perdieron la línea de cabecera con el nombre del entrenador, así que no había
// forma de saber de quién eran sin volver al PDF.
//
// De las 78 entradas de ese tipo, 47 ya estaban duplicadas en un equipo de la
// misma zona (la fusión con el PDF las había reconstruido, pero nadie borró la
// copia). Las 31 restantes son las que se rehacen aquí.
//
// Los "aliados" (Melia, Crisanto, Olivier) NO son rivales: pelean de tu lado en
// combates dobles de historia. Se guardan igual porque saber qué lleva tu
// aliado importa tanto como saber qué lleva el enemigo.

/**
 * El inicial que lleva el rival depende del tuyo, y la guía nunca lo nombra:
 * dice "el inicial de Kalos fuerte contra el nuestro". Melia lleva el FUERTE
 * contra el tuyo y Crisanto el DÉBIL — la misma regla que ya siguen sus equipos
 * reconstruidos desde las tablas del PDF, así que las especies se derivan del
 * triángulo de tipos. La derivación queda anotada en `procedencia`.
 */
const MELIA_FUERTE = { Chespin: "Fennekin", Fennekin: "Froakie", Froakie: "Chespin" };
const MELIA_FUERTE_FINAL = { Chespin: "Delphox", Fennekin: "Greninja", Froakie: "Chesnaught" };
const CRISANTO_DEBIL_MEDIO = { Chespin: "Frogadier", Fennekin: "Quilladin", Froakie: "Braixen" };

const mon = (especie, nivel, extra = {}) => ({
  especie,
  nivel: String(nivel),
  objeto: "",
  habilidad: "",
  naturaleza: null,
  movimientos: [],
  ...extra,
});

/** Las tres variantes de la ranura del inicial, a partir de un mapa. */
const ranuraInicial = (mapa, nivel, movimientos = []) =>
  Object.entries(mapa).map(([tuyo, suyo]) =>
    mon(suyo, nivel, { condicion: `Si elegiste ${tuyo}`, movimientos })
  );

export const ENTRENADORES_HUERFANOS = [
  // --- Los cuatro Malhechores -----------------------------------------------
  // El encargo se recoge en Ciudad Grisalla y por eso la guía los lista ahí,
  // pero cada uno se esconde en otra zona: va en `notas`.
  {
    zona: "CIUDAD GRISALLA",
    nombre: "Brujita Xenia",
    notas: "Primer Malhechor. Se esconde en el segundo piso de la Cueva Grisalla, en la parte inferior izquierda, saltando un montículo. Recompensa: Pepita x2.",
    equipo: [mon("Ralts", 11), mon("Impidimp", 12)],
  },
  {
    zona: "CIUDAD GRISALLA",
    nombre: "Cazador Wulfric",
    notas: "Segundo Malhechor. Se esconde en la zona superior izquierda de la Cueva Lóbrega, en la Ruta 6. Recompensa: Pepita y Roca del Rey.",
    equipo: [mon("Mightyena", 27)],
  },
  {
    zona: "CIUDAD GRISALLA",
    nombre: "Vampiro Azoth Edward",
    notas: "Tercer Malhechor. Se esconde en la planta baja de las Catacumbas Septentrionales, en mitad del largo pasillo. Hace falta poder romper rocas. Recompensa: Tyrogue (hay que llevar un hueco en el equipo).",
    equipo: [mon("Zweilous", 38), mon("Chandelure", 38)],
  },
  {
    zona: "CIUDAD GRISALLA",
    nombre: "Recluta Azoth Micolash",
    notas: "Cuarto y último Malhechor. Se esconde en las ruinas de Viejo Vánitas, al lado de unas tumbas.",
    equipo: [mon("Lokix", 48), mon("Beheeyem", 48), mon("Parasect Z", 48, { tipos: ["Bicho", "Veneno"] })],
  },

  // --- Combate doble de la Ruta 3 -------------------------------------------
  {
    zona: "Ruta 3",
    nombre: "Reclutas Azoth Curt y Debra",
    notas: "Combate doble en la segunda parte de la ruta, con Melia de aliada. Su equipo es el mismo en modo normal y en modo radical.",
    equipo: [
      mon("Grimer", 12, { movimientos: ["Gas Venenoso", "Bofetón Lodo", "Destructor"] }),
      mon("Gothorita", 12, { movimientos: ["Doble Bofetón", "Confusión", "Hipnosis"] }),
    ],
  },
  {
    zona: "Ruta 3",
    nombre: "Melia aliada",
    notas: "Pelea de tu lado en el combate doble contra los reclutas.",
    procedencia: "La guía no nombra su inicial (\"el inicial de Kalos fuerte contra el nuestro\"): la especie se deriva del triángulo de tipos, primera fase por el nivel.",
    equipo: [
      mon("Munna", 12, { movimientos: ["Poder Reserva", "Rizo Defensa", "Placaje"] }),
      ...ranuraInicial(MELIA_FUERTE, 13),
    ],
  },

  // --- Chateau Lanto: Crisanto pelea contigo contra Núbila -------------------
  {
    zona: "CHATEAU LANTO",
    nombre: "Crisanto aliado",
    notas: "Pelea de tu lado contra la Alquimista Azoth Núbila, tras verter el Vino Sombrío.",
    procedencia: "El tercer miembro es \"el inicial débil frente a nuestro tipo elegido\"; la especie se deriva del triángulo de tipos.",
    equipo: [
      mon("Wigglytuff", 35, { movimientos: ["Vozarrón", "Beso Drenaje", "Psicocarga", "Paz Mental"] }),
      mon("Sliggoo", 35, {
        movimientos: ["Dragoaliento", "Disparo Lodo", "Descanso"],
        nota: "Su cuarto movimiento depende de tu inicial: Tormenta Arena con Quilladin, Día Soleado con Braixen y Danza Lluvia con Frogadier.",
      }),
      ...ranuraInicial(CRISANTO_DEBIL_MEDIO, 36),
    ],
  },

  // --- Hospicio Caduco: revancha contra los mismos reclutas ------------------
  {
    zona: "HOSPICIO CADUCO",
    nombre: "Reclutas Azoth Curt y Debra (revancha)",
    notas: "Los mismos de la Ruta 3, con el mismo nombre y los mismos Pokémon evolucionados. Otra vez combate doble con Melia de aliada.",
    equipo: [
      mon("Muk", 50, { movimientos: ["Puya Nociva", "Puño Sombra", "Llamarada", "Armadura Ácida"] }),
      mon("Gothorita", 50, {
        objeto: "Mineral Evolutivo",
        movimientos: ["Psíquico", "Hipnosis", "Bola Sombra", "Hierba Lazo"],
      }),
    ],
  },
  {
    zona: "HOSPICIO CADUCO",
    nombre: "Melia aliada",
    notas: "Pelea de tu lado en la revancha contra los reclutas.",
    procedencia: "La guía no nombra su inicial: la especie se deriva del triángulo de tipos, fase final por el nivel.",
    equipo: [mon("Floette", 50), ...ranuraInicial(MELIA_FUERTE_FINAL, 51)],
  },

  // --- Los que ya existían pero sin equipo ----------------------------------
  {
    zona: "CIUDAD LUMINALIA NORTE",
    nombre: "Mosquetero/a Spartoi",
    notas: "Está en el Bulevar Oeste, sentado en un banco detrás de la galería de arte, con una estrellita brillante. Será chica si tu personaje es femenino.",
    equipo: [mon("Hariyama", 54), mon("Pangoro", 54)],
  },

  // --- Palacio Luminalia ----------------------------------------------------
  {
    zona: "PALACIO LUMINALIA (MAZMORRA FINAL PARTE 1)",
    nombre: "Revolucionarios Marcel y Marcela",
    notas: "Combate doble, justo después de regar la flor y obtener el Talismán de Malvo.",
    equipo: [mon("Zangoose", 55), mon("Gallade", 55), mon("Aggron", 55)],
  },

  // --- Los tres legendarios de Kalos ----------------------------------------
  //
  // No estaban en el JSON: la guía los cuenta en prosa, sin tabla de stats, así
  // que la extracción del .docx no tenía tabla que leer. Lo que sí da son los
  // BOOSTS de estadísticas y cuánto los reduce llevar la Efigie, que es
  // justamente lo que decide si el combate es duro o llevadero.
  //
  // Van como `boss_narrativo` y no como `importante` a propósito: sin equipo no
  // hay nada que enseñar en el banner de próxima batalla, solo un hueco.
  {
    zona: "MANANTIAL PROFUNDO",
    nombre: "Xerneas",
    tipo: "boss_narrativo",
    notas:
      "Se le enfrenta al volver aquí tras vencer a Lysson. Tiene las estadísticas bastante subidas, pero con la Efigie de Xerneas la subida es mucho menos notable y el combate se hace más fácil. La guía no da cifras ni tabla de stats. Tras derrotarlo hay ocasión de capturarlo, aunque la historia se lo lleva igualmente; se obtiene además una medalla y la Delphoxita Z.",
    equipo: [],
  },
  {
    zona: "PESADILLA DE CIRCO",
    nombre: "Yveltal",
    tipo: "boss_narrativo",
    notas:
      "Combate aéreo, después de vencer a la Regente Siempreviva. Sube +3 en Velocidad, +4 en ambas defensas y +1 en ambos ataques. Con la Efigie de Yveltal el único cambio pasa a ser +3 en ambas defensas. Sin tabla de stats en la guía.",
    equipo: [],
  },
  // --- Pesadilla de Circo: el Juicio de Yveltal -----------------------------
  //
  // Mismo caso que Mirra: en el JSON solo quedó el rótulo "Entrenadora
  // Angeline." suelto en las notas. El combate es después de Yveltal, en "Otro
  // Lugar", y la guía lo cuenta dentro de esta zona.
  {
    zona: "PESADILLA DE CIRCO",
    nombre: "Entrenadora Angeline",
    tipo: "importante",
    antesDe: "Payaso Mecánico Impío",
    quitarNotas: ["Entrenadora Angeline."],
    notas: "El Juicio de Yveltal. Tras vencer a Yveltal los esbirros de Alca nos noquean y aparecemos en \"Otro Lugar\", donde Angeline nos da una última oportunidad. Tiene dos Restaurar Todo.",
    procedencia: "Págs. 354-355 de la guía en PDF. Las especies son los sprites de cada tabla; los nombres se confirman con el bloque de \"Consejos de batalla\" que va justo debajo.",
    equipo: [
      mon("Ampharos", 88, {
        objeto: "Refleluz",
        habilidad: "Electricidad Estática",
        naturaleza: "+Atq. Esp. / -Atq.",
        movimientos: ["Rayo", "Joya de Luz", "Pulso Dragón", "Pantalla Luz"],
      }),
      mon("Milotic", 88, {
        objeto: "Restos",
        habilidad: "Competitivo",
        naturaleza: "+Atq. Esp. / -Atq.",
        movimientos: ["Hidrobomba", "Rayo Hielo", "Cola Dragón", "Recuperación"],
      }),
      mon("Gourgeist", 89, {
        objeto: "Vidasfera",
        habilidad: "Absorbe Fuego",
        naturaleza: "+Atq. Esp. / -Atq.",
        movimientos: ["Bola Sombra", "Llamarada", "Psíquico", "Gigadrenado"],
      }),
      mon("Bronzong", 89, {
        objeto: "Bola Férrea",
        habilidad: "Ignífugo",
        naturaleza: "+Atq. Esp. / -Atq.",
        movimientos: ["Giro Bola", "Cabezazo Zen", "Terremoto", "Espacio Raro"],
      }),
      mon("Mega Florges Z", 90, {
        objeto: "Florgesita",
        habilidad: "Voz Fluida",
        naturaleza: "+Atq. Esp. / -Atq.",
        movimientos: ["Vozarrón", "Fuerza Lunar", "Gigadrenado", "Psíquico"],
        tipos: ["Hada", "Agua"],
      }),
    ],
  },

  // --- Torre Prisma: los dos combates contra Mirra --------------------------
  //
  // Faltaban los dos. En el .docx las tablas de la cima quedaron sin cabecera y
  // solo sobrevivieron los rótulos sueltos ("Clérigo Mirra.", "Mirra Heraldo
  // del Oro.") dentro de notas_generales, sin un solo Pokémon.
  //
  // En el PDF (págs. 363-365) las especies tampoco son texto: son los sprites
  // de la primera columna de cada tabla. Se identificaron mirando las páginas
  // renderizadas y se contrastaron con la Pokédex Z — de ahí sale, por ejemplo,
  // que el primero del Heraldo es "Rotom Guillotina", la forma Eléctrico/
  // Siniestro del romhack, y no un Rotom cualquiera.
  {
    zona: "TORRE PRISMA",
    nombre: "Clérigo Mirra",
    tipo: "importante",
    antesDe: "Zygarde (1ª fase)",
    quitarNotas: ["Clérigo Mirra."],
    notas: "En la cima de la Torre Prisma, tras el dúo de Carabineros del séptimo piso. Es la primera mitad del combate: al derrotarla, Mirra le cede su cuerpo a Aure y los dos se funden en uno.",
    procedencia: "Págs. 363-365 de la guía en PDF. Las especies son sprites, no texto: identificadas a ojo sobre la página renderizada y confirmadas contra la Pokédex Z por habilidad, objeto y movimientos.",
    equipo: [
      mon("Salamence", 75, {
        objeto: "Baya Ziuela",
        habilidad: "Intimidación",
        naturaleza: "Neutra",
        movimientos: ["Enfado", "Lanzallamas", "Ala Bis", "Danza Dragón"],
      }),
      mon("Alakazam", 75, {
        objeto: "Cuchara Torcida",
        habilidad: "Muro Mágico",
        naturaleza: "Neutra",
        movimientos: ["Psíquico", "Bola Sombra", "Onda Certera", "Paz Mental"],
      }),
      mon("Absol", 76, {
        objeto: "Periscopio",
        habilidad: "Afortunado",
        naturaleza: "+Atq. / -Atq. Esp.",
        movimientos: ["Tajo Umbrío", "Carantoña", "Danza Espada", "Foco Energía"],
      }),
    ],
  },
  {
    zona: "TORRE PRISMA",
    nombre: "Mirra Heraldo del Oro",
    tipo: "importante",
    antesDe: "Zygarde (1ª fase)",
    quitarNotas: ["Mirra Heraldo del Oro.", "Tiene dos restaurar todo."],
    notas: "Segunda mitad del combate, seguida de la anterior: Mirra fusionada con Aure. Tiene dos Restaurar Todo. Al caer, Aure se manifiesta y huye, y queda pendiente Zygarde.",
    procedencia: "Págs. 364-365 de la guía en PDF. Especies identificadas sobre la página renderizada; el primero es Rotom Guillotina (Eléctrico/Siniestro) y el último Mega Absol Z (Siniestro/Fantasma), ambos exclusivos del romhack.",
    equipo: [
      mon("Rotom Guillotina", 88, {
        objeto: "Periscopio",
        habilidad: "Levitación",
        naturaleza: "Neutra",
        movimientos: ["Guillotina", "Triturar", "Voltio Cruel", "Onda Trueno"],
        tipos: ["Eléctrico", "Siniestro"],
        spriteBase: "Rotom",
      }),
      mon("Milotic", 88, {
        objeto: "Restos",
        habilidad: "Competitivo",
        naturaleza: "+Atq. Esp. / -Atq.",
        movimientos: ["Hidrobomba", "Pulso Dragón", "Viento Hielo", "Atracción"],
      }),
      mon("Raikou", 89, {
        objeto: "Chaleco Asalto",
        habilidad: "Presión",
        naturaleza: "Neutra",
        movimientos: ["Rayo", "Esfera Aural", "Bola Sombra", "Escaldar"],
      }),
      mon("Alakazam", 89, {
        objeto: "Vidasfera",
        habilidad: "Muro Mágico",
        naturaleza: "+Atq. Esp. / -Atq.",
        movimientos: ["Psíquico", "Bola Sombra", "Onda Certera", "Paz Mental"],
      }),
      mon("Salamence", 89, {
        objeto: "Baya Ziuela",
        habilidad: "Intimidación",
        naturaleza: "+Atq. / -Atq. Esp.",
        movimientos: ["Enfado", "Lanzallamas", "Ala Bis", "Danza Dragón"],
      }),
      mon("Mega Absol Z", 90, {
        objeto: "Absolita Z",
        habilidad: "Presión",
        naturaleza: "+Atq. / -Atq. Esp.",
        movimientos: ["Tajo Umbrío", "Carantoña", "Danza Espada", "Foco Energía"],
        tipos: ["Siniestro", "Fantasma"],
      }),
    ],
  },
  {
    zona: "TORRE PRISMA",
    nombre: "Zygarde (1ª fase)",
    tipo: "boss_narrativo",
    notas:
      "Tras caer Mirra. Sube +3 en ambas defensas, +2 en Velocidad y +1 en ambos ataques. OJO: en esta fase la Efigie NO se puede usar, así que no hay forma de rebajarlo. Sin tabla de stats en la guía.",
    equipo: [],
  },
  {
    zona: "TORRE PRISMA",
    nombre: "Zygarde (forma 100%)",
    tipo: "boss_narrativo",
    notas:
      "Regenera sus heridas y vuelve en forma 100%. Sube +4 en Velocidad, +5 en ambas defensas y +1 en ambos ataques. Aquí sí vale la Efigie de Zygarde, y con ella el único cambio pasa a ser +3 en ambas defensas. No se le puede abatir hasta que Crisanto le ataca; luego se captura y se obtiene la Chesnaughtita Z.",
    equipo: [],
  },

  // --- Antigua Forja Inundada: Olivier pelea contigo -------------------------
  {
    zona: "ANTIGUA FORJA INUNDADA",
    nombre: "Olivier aliada",
    notas: "Pelea de tu lado contra el Guardián de la Puerta para abriros paso.",
    equipo: [
      mon("Gyarados", 76, {
        objeto: "Restos",
        movimientos: ["Acua Cola", "Triturar", "Colmillo Hielo", "Danza Dragón"],
      }),
      mon("Noivern", 76, {
        objeto: "Gafas Especiales",
        movimientos: ["Pulso Dragón", "Tajo Aéreo", "Bola Sombra", "Protección"],
      }),
      mon("Gastrodon", 76, {
        movimientos: ["Salmuera", "Tierra Viva", "Recuperación", "Protección"],
      }),
      mon("Pyroar", 77, {
        objeto: "Pyroarita",
        movimientos: ["Lanzallamas", "Vozarrón", "Pulso Umbrío", "Protección"],
      }),
    ],
  },
];
