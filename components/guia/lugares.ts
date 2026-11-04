// components/guia/lugares.ts
//
// La guía está escrita en orden de partida, así que un mismo sitio aparece
// varias veces: "Ruta 8", "Ruta 8 Parte 2", "Ruta 8 Parte 3" y "Regresar a la
// Ruta 8 a entregar el Pañuelo" son cuatro entradas del mismo lugar, con sus
// cosas repartidas entre ellas. Para jugar siguiendo la guía eso está bien; para
// preguntarse "qué hay en la Ruta 8" es un incordio.
//
// Aquí se agrupan las 204 entradas en LUGARES (177), y se fusiona el contenido
// de cada grupo en una sola Zone. Es una vista DERIVADA: no se toca el JSON ni
// se copia nada a otro archivo, y cada cosa fusionada sigue sabiendo de qué
// entrada salió (ver `Fusion`). Eso último no es un lujo: el progreso de MTs y
// páginas de alquimia se guarda como (índice de zona, índice dentro de la
// lista), así que sin el origen marcar una MT en la vista de Lugares marcaría
// otra distinta en la de Historia.

import type {
  AlquimiaInfo,
  HabitanteAcrilicoInfo,
  InicialRival,
  NidoAlfaInfo,
  RegaloPokemonInfo,
  WildPokemon,
  Zone,
  ZoneConversion,
  ZoneItem,
  ZoneMT,
  ZoneTrade,
  ZoneTrainer,
} from "./types";
import { nombreZona } from "./formato";

/** De qué entrada de la historia salió una cosa, y en qué posición estaba allí. */
export type Origen = { zona: number; i: number };

export type Lugar = {
  /** Nombre normalizado con el que se agrupó. */
  clave: string;
  /** Nombre para mostrar, ya sin "Parte 2" ni "(2º visita)". */
  nombre: string;
  /** Índices de las entradas de historia que lo componen, en orden de partida. */
  entradas: number[];
  /** La primera visita. Es la identidad del lugar de cara al resto de la app. */
  principal: number;
};

/**
 * Origen de cada elemento de una zona fusionada, en arrays paralelos a los de
 * la propia zona (mismo índice = mismo elemento). `nido` y `habitante` son de
 * zona entera, así que van como índice suelto.
 */
export type Fusion = {
  entradas: number[];
  salvajes: Origen[];
  objetos: Origen[];
  mts: Origen[];
  entrenadores: Origen[];
  paginas: Origen[];
  nido: number | null;
  habitante: number | null;
};

export type ZonaFusionada = Zone & { fusion: Fusion };

export function esFusionada(zone: Zone | ZonaFusionada): zone is ZonaFusionada {
  return (zone as ZonaFusionada).fusion !== undefined;
}

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * "Ruta 8 Parte 2" -> "Ruta 8", "PRISIÓN DEL OLVIDO (CELDAS)" -> "PRISIÓN DEL
 * OLVIDO". Los paréntesis se van enteros porque en este JSON siempre marcan una
 * variante de la misma visita: "(2º VISITA)", "(INTERIOR)", "(Opcional)",
 * "(CELDAS)". El único efecto colateral es que también se llevan "(4º MEDALLA)",
 * y por eso el nombre recortado solo se usa cuando el lugar tiene MÁS DE UNA
 * entrada: los sitios de una sola visita conservan su título tal cual.
 */
function sinMarcasDeVisita(nombre: string): string {
  return nombre
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bparte\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[:.,\s]+$/, "")
    .trim();
}

function claveBase(nombre: string): string {
  const limpio = sinMarcasDeVisita(nombre);
  return normalizar(limpio || nombre);
}

type Ajuste = {
  /** Meter esta entrada en el lugar de otra clave. */
  clave?: string;
  /** Nombre para mostrar, cuando el de la guía es una instrucción y no un sitio. */
  nombre?: string;
};

/**
 * Lo que el nombre no resuelve solo. Son entradas escritas como una tarea
 * ("Regresar a la Ruta 8 a entregar el Pañuelo") en vez de como un lugar: por
 * nombre no se agrupan con nada, pero su contenido pertenece a un sitio que ya
 * existe — o al menos merece un título que se pueda leer en una lista.
 *
 * Va por nombre normalizado y no por índice: el índice se mueve en cuanto se
 * añade o se parte una zona.
 */
/**
 * Entradas que TIENEN cosas de sitio pero no son un sitio: eventos, misiones y
 * secciones de guion. "Atrapar a Rotom" trae un combate, "Misión del Campanero"
 * trece, y "Cuarto Acertijo" un objeto — contenido de sobra para colarse en la
 * lista de lugares, pero ninguno es un lugar al que se pueda ir.
 *
 * Solo desaparecen de la vista de Zonas. En Historia siguen donde estaban, que
 * es su sitio: son cosas que se hacen en un momento concreto de la partida.
 */
const NO_SON_LUGARES = new Set([
  "regresar a hacer cosas con el poder de surf (opcional)",
  "atrapar a rotom (opcional)",
  "obtener a rotom guillotina (opcional)",
  "cuarto acertijo:",
  "mision del campanero (opcional)",
  "postgame",
]);

const AJUSTES: Record<string, Ajuste> = {
  "regresar a la ruta 8 a entregar el panuelo (opcional)": { clave: "ruta 8" },
  "regresar a bajar el nivel del agua de la ruta 9 (opcional)": { clave: "ruta 9" },
  "regresar a pueblo profano (opcional)": { clave: "pueblo profano" },
  "conocer a la brujita maldita de pueblo profano (opcional)": { clave: "pueblo profano" },
  "regresar a prision del olvido (isla) (opcional)": { clave: "prision del olvido" },
  "tomar teleferico para llegar a la estacion de servicio (opcional)": { clave: "estacion de servicio" },
  "acceder a las catacumbas septentrionales (opcional)": { nombre: "Catacumbas Septentrionales" },
  // Sitios de verdad con el nombre destrozado por la extracción del .docx: se
  // les arregla el rótulo, pero NO el dato — el nombre crudo del bastión de
  // Zafra es la clave con la que levelCaps.ts ancla la 4ª medalla.
  // El "º" no lo toca `normalizar` (no es una tilde: NFD no lo descompone),
  // así que la clave lo lleva tal cual.
  "2º subtrama de pueblo bodegon bastion de la regente zafra (4º medalla)": {
    nombre: "Bastión de la Regente Zafra (4º Medalla)",
  },
  "ayudar a zafra en el restaurante le chonk (opcional)": { nombre: "Restaurante Le Chonk" },
  // Las dos mitades del mismo bosque, escritas una como "Zona 1" y otra como
  // "Parte 2", que es lo único que impedía que se juntaran solas.
  "bosque ladera zona 1": { clave: "bosque ladera", nombre: "Bosque Ladera" },
  "regresar a la granja gogoat para la montura (opcional)": { nombre: "Granja Gogoat" },
  "regresar a hacer cosas con el poder de surf (opcional)": { nombre: "Vuelta con el poder de Surf" },
  "visitar la isla montesanto (opcional)": { nombre: "Isla Montesanto" },
  "completar la isla certijo (opcional)": { nombre: "Isla Certijo" },
  "ir al balneario (opcional)": { nombre: "Balneario" },
};

/**
 * Si la entrada tiene algo que se pueda encontrar EN un sitio. Las que solo
 * traen `notas_generales` son pasos de guion ("Atrapar a Registeel", "Primer
 * Acertijo:", "COMIENZO DEL SEGUNDO ACTO") y se quedan únicamente en la vista
 * de Historia, que es donde tienen sentido.
 */
function tieneContenidoDeSitio(z: Zone): boolean {
  return (
    z.pokemon_salvajes.length > 0 ||
    z.objetos.length > 0 ||
    z.mts.length > 0 ||
    z.entrenadores.length > 0 ||
    z.intercambios.length > 0 ||
    (z.conversiones?.length ?? 0) > 0 ||
    (z.inicial_rival?.length ?? 0) > 0 ||
    !!z.pagina_alquimia?.presente ||
    !!z.nido_alfa ||
    !!z.habitante_acrilico ||
    !!z.regalo_pokemon?.presente
  );
}

const cacheLugares = new WeakMap<Zone[], Lugar[]>();

/**
 * Los lugares en ORDEN DE HISTORIA — el de su primera visita. Es el mismo eje
 * que la lista de siempre; lo único que cambia es que cada sitio sale una vez.
 */
export function resolverLugares(zones: Zone[]): Lugar[] {
  const previo = cacheLugares.get(zones);
  if (previo) return previo;

  const grupos = new Map<string, { clave: string; nombre?: string; entradas: number[] }>();
  const soloNotas: { i: number; clave: string }[] = [];

  zones.forEach((z, i) => {
    // Arcos y actos son títulos de capítulo, no sitios. (Los actos ya caerían
    // solos por no tener contenido, pero conviene decirlo y no depender de eso.)
    if (z.arco || z.separador) return;
    if (NO_SON_LUGARES.has(normalizar(z.zona))) return;
    const ajuste = AJUSTES[normalizar(z.zona)];
    const clave = ajuste?.clave ?? claveBase(z.zona);

    if (!tieneContenidoDeSitio(z)) {
      soloNotas.push({ i, clave });
      return;
    }

    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.entradas.push(i);
      if (!grupo.nombre && ajuste?.nombre) grupo.nombre = ajuste.nombre;
    } else {
      grupos.set(clave, { clave, nombre: ajuste?.nombre, entradas: [i] });
    }
  });

  // Las entradas de solo notas se pegan al sitio del que hablan si ese sitio ya
  // existe — "CIUDAD GRISALLA (2º VISITA)" es media línea sobre Ciudad Grisalla
  // y ahí es donde se quiere leer. Las que no encajan en ninguno se quedan solo
  // en Historia: son pasos de guion, no lugares.
  for (const { i, clave } of soloNotas) {
    grupos.get(clave)?.entradas.push(i);
  }

  const lugares = Array.from(grupos.values())
    .map(({ clave, nombre, entradas: crudas }) => {
      const entradas = [...crudas].sort((a, b) => a - b);
      // La primera visita CON contenido manda: una entrada de solo notas puede
      // colarse delante, y de ella no sale ni un nombre decente ni un tramo.
      const principal = entradas.find((i) => tieneContenidoDeSitio(zones[i])) ?? entradas[0];
      const crudo = zones[principal].zona;
      return {
        clave,
        entradas,
        principal,
        nombre:
          nombre ??
          (entradas.length > 1 ? nombreZona(sinMarcasDeVisita(crudo) || crudo) : nombreZona(crudo)),
      };
    })
    .sort((a, b) => a.principal - b.principal);

  cacheLugares.set(zones, lugares);
  return lugares;
}

/** El lugar que contiene esa entrada, o null si es un arco o un paso de guion. */
export function lugarQueContiene(zones: Zone[], zoneIndex: number): Lugar | null {
  return resolverLugares(zones).find((l) => l.entradas.includes(zoneIndex)) ?? null;
}

/**
 * Como `lugarQueContiene`, pero sin devolver null: para las entradas que no son
 * un sitio cae en el último lugar visto antes de ellas, que es donde estabas
 * cuando la historia te mandó a hacer eso.
 */
export function lugarDeZona(zones: Zone[], zoneIndex: number): Lugar | null {
  const lugares = resolverLugares(zones);
  const exacto = lugares.find((l) => l.entradas.includes(zoneIndex));
  if (exacto) return exacto;

  let previo: Lugar | null = null;
  for (const l of lugares) {
    if (l.principal > zoneIndex) break;
    previo = l;
  }
  return previo ?? lugares[0] ?? null;
}

const cacheFusion = new WeakMap<Zone[], Map<string, ZonaFusionada>>();

/**
 * Todo lo del lugar en una sola Zone.
 *
 * Los salvajes se DEDUPLICAN (mismo nombre, método, nivel y porcentaje): las
 * partes de una ruta repiten casi entera la tabla de encuentros, y sin esto la
 * Ruta 8 pasaría de 17 líneas útiles a 29 con repetidos. Objetos, MTs y
 * entrenadores no se tocan: dos Hiperpociones en dos tramos son dos objetos.
 */
export function fusionarLugar(zones: Zone[], lugar: Lugar): ZonaFusionada {
  let porClave = cacheFusion.get(zones);
  if (!porClave) {
    porClave = new Map();
    cacheFusion.set(zones, porClave);
  }
  const previo = porClave.get(lugar.clave);
  if (previo) return previo;

  const principal = zones[lugar.principal];

  const salvajes: WildPokemon[] = [];
  const objetos: ZoneItem[] = [];
  const mts: ZoneMT[] = [];
  const entrenadores: ZoneTrainer[] = [];
  const intercambios: ZoneTrade[] = [];
  const conversiones: ZoneConversion[] = [];
  const inicialRival: InicialRival[] = [];
  const notas: string[] = [];
  const conexiones: string[] = [];
  const paginas: string[] = [];

  const fusion: Fusion = {
    entradas: lugar.entradas,
    salvajes: [],
    objetos: [],
    mts: [],
    entrenadores: [],
    paginas: [],
    nido: null,
    habitante: null,
  };

  let alquimia: AlquimiaInfo | undefined;
  let nido: NidoAlfaInfo | undefined;
  let habitante: HabitanteAcrilicoInfo | undefined;
  let regalo: RegaloPokemonInfo | undefined;

  const salvajesVistos = new Set<string>();
  const notasVistas = new Set<string>();
  const conexionesVistas = new Set<string>();
  // Las entradas del propio lugar no son "conexiones a otro sitio": la Ruta 8
  // no conecta consigo misma solo porque la guía la partiera en tres.
  const propias = new Set(lugar.entradas.map((i) => normalizar(zones[i].zona)));

  for (const iz of lugar.entradas) {
    const z = zones[iz];

    z.pokemon_salvajes.forEach((p, i) => {
      const clave = [p.nombre, p.metodo, p.nivel ?? "", p.porcentaje].map((v) => normalizar(String(v))).join("|");
      if (salvajesVistos.has(clave)) return;
      salvajesVistos.add(clave);
      salvajes.push(p);
      fusion.salvajes.push({ zona: iz, i });
    });

    z.objetos.forEach((o, i) => {
      objetos.push(o);
      fusion.objetos.push({ zona: iz, i });
    });

    z.mts.forEach((m, i) => {
      mts.push(m);
      fusion.mts.push({ zona: iz, i });
    });

    z.entrenadores.forEach((t, i) => {
      entrenadores.push(t);
      fusion.entrenadores.push({ zona: iz, i });
    });

    intercambios.push(...z.intercambios);
    conversiones.push(...(z.conversiones ?? []));
    inicialRival.push(...(z.inicial_rival ?? []));

    for (const n of z.notas_generales) {
      if (notasVistas.has(n)) continue;
      notasVistas.add(n);
      notas.push(n);
    }

    for (const c of z.conexiones) {
      const clave = normalizar(c);
      if (propias.has(clave) || conexionesVistas.has(clave)) continue;
      conexionesVistas.add(clave);
      conexiones.push(c);
    }

    const a = z.pagina_alquimia;
    if (a?.presente) {
      // Los requisitos se quedan con los del primer bloque presente: son de la
      // zona entera y no por página, así que no hay forma de repartirlos.
      if (!alquimia) alquimia = a;
      [a.descripcion ?? "", ...(a.adicionales ?? [])].forEach((texto, i) => {
        paginas.push(texto);
        fusion.paginas.push({ zona: iz, i });
      });
    }

    if (!nido && z.nido_alfa) {
      nido = z.nido_alfa;
      fusion.nido = iz;
    }
    if (!habitante && z.habitante_acrilico) {
      habitante = z.habitante_acrilico;
      fusion.habitante = iz;
    }
    if (!regalo && z.regalo_pokemon?.presente) regalo = z.regalo_pokemon;
  }

  const fusionada: ZonaFusionada = {
    ...principal,
    zona: lugar.nombre,
    arco: false,
    // El sitio es opcional solo si lo son TODAS sus visitas: al Pueblo Profano
    // se va por historia y luego se vuelve por gusto, y eso no lo hace opcional.
    opcional: lugar.entradas.every((i) => zones[i].opcional),
    conexiones,
    pokemon_salvajes: salvajes,
    objetos,
    mts,
    entrenadores,
    intercambios,
    conversiones: conversiones.length > 0 ? conversiones : undefined,
    inicial_rival: inicialRival.length > 0 ? inicialRival : undefined,
    notas_generales: notas,
    pagina_alquimia: alquimia
      ? { ...alquimia, descripcion: paginas[0] ?? "", adicionales: paginas.slice(1) }
      : principal.pagina_alquimia,
    nido_alfa: nido,
    habitante_acrilico: habitante,
    regalo_pokemon: regalo ?? principal.regalo_pokemon,
    fusion,
  };

  porClave.set(lugar.clave, fusionada);
  return fusionada;
}
