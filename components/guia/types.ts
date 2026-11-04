// components/guia/types.ts
//
// Tipos calcados 1:1 de la estructura real de public/pokemon_z_guia.json
// (201 zonas). Separados del types.ts del team-builder porque son datos
// de guion/walkthrough, no de equipos — evita mezclar dominios.

// Los cuatro campos opcionales salieron de dentro de `nombre`: la extracción
// del .docx dejaba "Zigzagoon de Galar, nivel 8." o "Luvdisc 70% (Dropea
// Escama Corazón)." en una sola cadena, lo que rompía el match contra la
// Pokédex Z y por lo tanto el sprite. scripts/clean-guia-names.mjs los separa.
export type WildPokemon = {
  porcentaje: string; // ej. "20%"
  nombre: string;
  drop: string;
  metodo: string; // ej. "hierba alta", "pesca", "surf"
  nivel?: string;
  tipos?: string[]; // solo variantes del romhack que cambian de tipo
  nota?: string; // movimientos, sexo, restos de otra celda de la tabla
  spriteBase?: string; // especie de la que tomar el sprite (ver más abajo)
  requisitos?: Requisito[];
};

// Qué hace falta para llegar hasta algo. El romhack no usa MOs: la travesía va
// con MONTURAS (Gogoat para trepar paredes, Surf) y con objetos CRAFTEADOS
// (Hacha Endeble para cortar, Polvo Explosivo para volar rocas). Lo deduce
// scripts/clean-guia-names.mjs del propio texto de la guía; ver REQUISITOS allí.
export type Requisito =
  | "surf"
  | "gogoat"
  | "corte"
  | "polvo_explosivo"
  | "golpe_roca"
  | "fuerza"
  | "lente"
  | "buceo";

export type ZoneItem = {
  nombre: string;
  detalle: string;
  requisitos?: Requisito[];
};

export type ZoneMT = {
  id: string;
  numero: string; // ej. "MT83"
  movimiento: string;
  contexto: string;
  requisitos?: Requisito[];
};

export type TrainerMon = {
  especie: string;
  nivel: string;
  objeto: string;
  habilidad: string;
  naturaleza: string | null;
  movimientos: string[];
  nota?: string;
  // Cómo plantarle cara a ESTE Pokémon: sale del bloque "Consejos de batalla"
  // que la guía pone tras cada combate importante. Venía dentro de `objetos`,
  // listado como si fuera algo que se recoge del suelo.
  consejo?: string;
  // Aviso nuestro cuando el consejo de la guía contradice la tabla del propio
  // combate (Landorus y Poder Arena en el Alto Mando Tornasola). El consejo se
  // deja tal cual — es lo que dice la guía — pero avisado.
  consejoAviso?: string;
  // Solo lo traen las variantes del romhack cuyo tipo difiere del de su especie
  // base ("Solosis Z" es Psíquico/Veneno). Para el resto los tipos salen de la
  // Pokédex Z.
  tipos?: string[];
  // Miembros que solo aparecen según una elección del jugador — hoy, el inicial
  // que elegiste: los rivales llevan el que es fuerte contra el tuyo, así que
  // esa ranura tiene tres variantes y solo se enfrenta una. Se excluyen del
  // análisis de debilidades por eso mismo (ver battlePrep.ts).
  condicion?: string;
  // Variantes del romhack ("Solosis Z", "Raichu Regional", "Zigzagoon Galar")
  // que no tienen entrada propia en pokemon_z_completo.json: sin esto no hay
  // sprite posible, porque el nombre no existe en la Pokédex.
  spriteBase?: string;
};

export type ZoneTrainer = {
  tipo?: "importante" | string;
  nombre: string;
  equipo: TrainerMon[];
  notas?: string;
  equipo_fuente?: string;
  // Cómo se obtuvo o verificó este equipo (especies confirmadas a mano, erratas
  // de la guía, datos que siguen sin confirmar). NO se renderiza: es
  // trazabilidad para quien mantiene los datos, no información de juego —
  // vivía dentro de `notas` y se mostraba al jugador como un consejo más.
  procedencia?: string;
  // Combates encadenados que se pelean seguidos, sin poder curar entre medio:
  // los dos Alto Mando del juego ("Alto Mando I" en Cámaras de Reflexión,
  // "Alto Mando II" en El Arma Definitiva). `ordenSecuencia` empieza en 1.
  secuencia?: string;
  ordenSecuencia?: number;
  // El combate no es contra un entrenador sino contra UN Pokémon suelto
  // (Furfrou Boss, Blastoise Gigamax, Auretosk, el Artificio del molino).
  // Cambia cómo se presenta: no hay entrenador al que enseñarle la cara ni
  // "as del equipo" que destacar, porque el equipo es un único bicho.
  esBoss?: boolean;
};

export type ZoneTrade = {
  detalle: string;
};

export type AlquimiaInfo = {
  progressIds?: Record<string, string>;
  presente: boolean;
  descripcion?: string;
  // Ubicaciones de páginas ADICIONALES en la misma zona: hay cuatro zonas con
  // dos páginas (Taller Quemado, Ciudad Luminalia Norte, Ruta 15 y Ruta 23).
  // Cada una se marca por separado en el progreso, así que van aparte de
  // `descripcion` en vez de concatenadas en un solo texto.
  adicionales?: string[];
  requisitos?: Requisito[];
};

export type RegaloPokemonInfo = {
  presente: boolean;
  detalle?: string;
};

// Nido Alfa: hay exactamente 18 en el juego, uno por cada tipo de
// Pokémon. Campo opcional — solo lo tienen las zonas donde el nido
// está físicamente ubicado (no las que solo lo mencionan de paso).
export type NidoAlfaInfo = {
  id: string;
  tipo: string; // ej. "Fuego", "Dragón"
  detalle?: string;
};

// Habitante reclutable para Pueblo Acrílico. Campo opcional — solo lo
// tienen las zonas donde se recluta o se completa la mudanza del
// personaje. "nombre" puede ser genérico ("Sin nombre confirmado")
// cuando la guía no da un nombre propio.
export type HabitanteAcrilicoInfo = {
  id: string;
  nombre: string;
  detalle?: string;
  // Servicio que presta una vez mudado a Pueblo Acrílico ("Guardería Pokémon",
  // "Recordadora de movimientos"...). Sale del "Listado de Habitantes de
  // Acrílico" de la guía; ver HABITANTES_ACRILICO en clean-guia-names.mjs.
  funcion?: string;
  /** Personas que se reclutan juntas en una sola entrada de la guía. */
  cantidad?: number;
};

// Conversión de especie que ofrece un NPC (la tabla del conversor de Pueblo
// Petroglifo). Venía dentro de `objetos` como texto suelto: "Raticate a
// Raticate Alola." — ver scripts/clean-guia-names.mjs.
export type ZoneConversion = {
  de: string;
  a: string;
  nota?: string;
};

// Inicial que le toca al rival según el que elijas. También venía dentro de
// `objetos`, como "Si tu inicial es TIPO PLANTA" con el detalle aparte.
export type InicialRival = {
  siTuInicial: string; // "PLANTA", "FUEGO", "AGUA"
  detalle: string; // "Froakie, al nivel 5."
};

export type Zone = {
  id: string;
  zona: string;
  // No es un lugar: es el título de un ARCO de la historia. La guía divide el
  // tramo final en tres arcos con el nombre de un legendario ("Xerneas",
  // "Yveltal", "Zygarde") y la extracción del .docx los convirtió en zonas.
  // Su contenido es la instrucción de a dónde ir a continuación. El combate
  // contra cada legendario ocurre en su sitio real (Manantial Profundo,
  // Pesadilla de Circo, Torre Prisma), no aquí.
  arco?: boolean;
  // Título del arco al que pertenece esta zona. Va desde la cabecera del arco
  // hasta la zona donde se pelea su legendario, ambas incluidas.
  arcoDe?: string;
  // Tampoco es un lugar: parte la historia en tres actos. Entrada vacía del
  // todo (ni notas), solo sirve de marca de capítulo. Un acto abarca medio
  // juego; un arco es un capítulo del tramo final — por eso van separados.
  separador?: "acto";
  // La guía lo marca "(Opcional)" en el título: 59 de las 204 entradas. Saltarse
  // una no deja la historia atascada, y por eso conviene que se note antes de
  // abrirla. Lo pone scripts/clean-guia-names.mjs a partir del propio título.
  opcional?: boolean;
  // La entrada no es un lugar sino un objetivo: "Atrapar a Raikou", "Atrapar a
  // los Tapus", "Obtener a Rotom Guillotina". Aquí van las especies que se
  // consiguen, que en el JSON crudo solo existían dentro del título — sin esto
  // no hay forma de buscarlas, listarlas ni sacarles el sprite.
  // Ver CAPTURAS_POR_ZONA en scripts/limpieza/tablas-zonas.mjs.
  capturas?: string[];
  conexiones: string[];
  pokemon_salvajes: WildPokemon[];
  objetos: ZoneItem[];
  conversiones?: ZoneConversion[];
  inicial_rival?: InicialRival[];
  mts: ZoneMT[];
  entrenadores: ZoneTrainer[];
  pagina_alquimia?: AlquimiaInfo;
  regalo_pokemon?: RegaloPokemonInfo;
  nido_alfa?: NidoAlfaInfo;
  habitante_acrilico?: HabitanteAcrilicoInfo;
  intercambios: ZoneTrade[];
  notas_generales: string[];
  conexiones_fuente?: string;
};
