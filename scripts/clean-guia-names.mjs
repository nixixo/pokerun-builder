// scripts/clean-guia-names.mjs
//
// Normaliza los nombres de especie de data-src/pokemon_z_guia.json.
//
// El JSON viene de una extracción del .docx de la guía y arrastra el defecto
// de la tabla original: nivel, porcentaje de aparición, drop, tipos y hasta
// movimientos quedaron pegados dentro del campo `nombre`. Ejemplos reales:
//
//   "Zigzagoon de Galar, nivel 8."
//   "Luvdisc 70% (Dropea Escama Corazón)."
//   "14% Mime Jr. (Dropea Baya Zanama)."
//   "Solosis Z (Psíquico Veneno), nivel 25. Bomba Ácida, Luz Decadente (Hada)"
//
// Eso rompe dos cosas: el nombre se muestra crudo en la tarjeta de zona, y
// usePokemonZSprites no encuentra la especie en la Pokédex Z, así que no hay
// sprite (sin request de red, por eso tampoco hay 404 que seguir).
//
// Este script parte cada nombre en sus campos propios y, para las variantes
// del romhack que no tienen entrada en la Pokédex Z ("Solosis Z",
// "Raichu Regional", "Zigzagoon Galar"...), anota `spriteBase` con la especie
// base de la que se toma prestado el sprite.
//
// Entrada y salida:
//   data-src/pokemon_z_guia.raw.json   ← el volcado del .docx, NUNCA se toca
//   data-src/pokemon_z_guia.json       ← lo que consume la app, se regenera
//
// Uso:
//   node scripts/clean-guia-names.mjs           — dry-run, solo reporta
//   node scripts/clean-guia-names.mjs --apply   — regenera el JSON limpio

import { preserveGuideIds } from "./guia-identities.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ENTRENADORES_HUERFANOS } from "./entrenadores-huerfanos.mjs";
import { informe } from "./limpieza/informe.mjs";
import {
  CAPTURAS_POR_ZONA,
  CONEXIONES_ALIAS,
  CONEXIONES_ESPURIAS,
  ENTRENADORES_FUERA_DE_ARCO,
  MUDANZA_FARO,
  ZONAS_SUBSECCION,
  ZONA_COLUMNA_LANZA,
} from "./limpieza/tablas-zonas.mjs";
import {
  ALQUIMIAS_ADICIONALES,
  ALQUIMIAS_ESPURIAS,
  ALQUIMIAS_FALTANTES,
  HABITANTES_ACRILICO,
  MTS_ESPURIAS,
  MTS_FALTANTES,
  MTS_MOVIMIENTO_CORREGIDO,
  REQUISITOS_ALQUIMIA_MANUALES,
} from "./limpieza/tablas-coleccion.mjs";
import {
  CONSEJOS_ACLARADOS,
  CONSEJOS_INTERCAMBIADOS,
  CONSEJOS_PARTIDOS,
  ESPECIE_RECUPERADA,
  NOTAS_ENTRENADOR_ESPURIAS,
  NOTAS_PARTIDAS,
  RECLASIFICAR_MENOR,
  RIVALES,
  SALVAJE_RECUPERADO,
  SECUENCIAS,
} from "./limpieza/tablas-entrenadores.mjs";

// ENTRADA y SALIDA son archivos distintos a propósito. Antes este script leía
// y reescribía el mismo pokemon_z_guia.json, así que cada --apply se comía su
// propia fuente: una tabla de correcciones mal puesta destruía el dato original
// y no quedaba con qué compararlo.
//
// Ahora el crudo (.raw.json) no se toca nunca y el limpio se regenera entero.
// El diff sale gratis y volver atrás es borrar la salida y repetir.
const GUIA_RAW = join(process.cwd(), "data-src", "pokemon_z_guia.raw.json");
const GUIA = join(process.cwd(), "data-src", "pokemon_z_guia.json");
const DEX = join(process.cwd(), "data-src", "pokemon_z_completo.json");
const ITEMS = join(process.cwd(), "data-src", "items_pokemon_z.json");
const ENTRENADORES_PDF = join(process.cwd(), "data-src", "entrenadores-pdf.json");
const SALVAJES_CUEVA_PDF = join(process.cwd(), "data-src", "salvajes-cueva-pdf.json");
const MOVES_Z = join(process.cwd(), "data-src", "moves_z_completo.json");

const APPLY = process.argv.includes("--apply");

/**
 * El crudo. Si no está, se avisa en vez de caer con un ENOENT pelado: es el
 * error que va a ver quien clone el repo y no tenga el archivo.
 */
async function leerCrudo() {
  try {
    return await readFile(GUIA_RAW, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    throw new Error(
      `no existe data-src/pokemon_z_guia.raw.json.\n\n` +
        `    Es la ENTRADA de este script: el volcado del .docx sin tocar.\n` +
        `    pokemon_z_guia.json (la salida) se regenera a partir de él, así\n` +
        `    que no sirve como sustituto — sería limpiar lo ya limpio.`
    );
  }
}

// --- índice de la Pokédex Z -------------------------------------------------

/** Misma normalización que components/guia/usePokemonZSprites.ts. */
function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[.'’]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- correcciones que no se deducen del texto -------------------------------

/**
 * Nombres que hay que reemplazar enteros: erratas de tipeo de la guía y
 * variantes escritas distinto a como las nombra la Pokédex Z.
 */
const ALIAS = {
  // erratas
  Duckett: "Ducklett",
  Excavalier: "Escavalier",
  Spiranak: "Spinarak", // letras cambiadas de sitio, en Catacumbas Meridionales
  // Nidoran: la Pokédex Z llama "Nidoran" a ambos sexos y los distingue por
  // internalName (NIDORANfE / NIDORANmA), así que el sexo va como nota.
  "Nidoran-F": "Nidoran",
  "Nidoran-M": "Nidoran",
  "Nidoran Hembra": "Nidoran",
  "Nidoran Macho": "Nidoran",
  // las megas del romhack llevan sufijo " Z" en la Pokédex
  "Mega Grimmsnarl": "Mega Grimmsnarl Z",
  "Mega Florges": "Mega Florges Z",
  "Mega Entei": "Mega Entei Z",
  // "de Alola" -> "Alola" (esta sí existe en la Pokédex)
  "Muk de Alola": "Muk Alola",
};

/** Nota que se conserva al aplicar el alias, cuando el alias pierde info. */
const ALIAS_NOTE = {
  "Nidoran-F": "hembra",
  "Nidoran-M": "macho",
  "Nidoran Hembra": "hembra",
  "Nidoran Macho": "macho",
};

/**
 * Variantes cuya especie base no se deduce quitando el sufijo. Cada una está
 * verificada contra pokemon_z_completo.json (y, donde hacía falta, contra el
 * servidor de sprites).
 */
const SPRITE_BASE_OVERRIDE = {
  // "Regional" acá es el formLabel de la Pokédex: la forma de Alola, no el
  // Raichu común. Sprite 026_1.png, tipos Eléctrico/Psíquico.
  "Raichu Regional": "Raichu Alola",
  // Sin esto colisiona con "Porygon-Z": ambos normalizan a "porygon z", así
  // que el Porygon base del Regente F3 salía con el sprite de Porygon-Z.
  // La " Z" del final es la marca de versión Z, no parte del nombre.
  "Porygon Z": "Porygon",
};

/**
 * Nombres distintos que son el mismo Pokémon. El equipo del Regente F3 es la
 * línea Porygon completa (Porygon / Porygon2 / Porygon-Z, los tres en versión
 * Z), pero el último aparece escrito de dos formas según la zona.
 */
const NOMBRE_UNIFICADO = {
  "PorygonZ Z": "Porygon-Z Z",
};

/** Reubica a su sitio real los combates archivados bajo un título de ARCO. */
function sacarEntrenadoresDeArcos(zonas) {
  const movidos = [];
  for (const { nombre, desde, hasta } of ENTRENADORES_FUERA_DE_ARCO) {
    const origen = zonas.find((z) => z.zona === desde);
    const destino = zonas.find((z) => z.zona === hasta);
    if (!origen || !destino) continue;

    const i = (origen.entrenadores || []).findIndex((t) => t.nombre === nombre);
    if (i < 0) continue; // ya se movió en una pasada anterior

    // Al principio: es el combate que da acceso a la zona, así que va antes que
    // los entrenadores que ya viven dentro.
    destino.entrenadores.unshift(origen.entrenadores.splice(i, 1)[0]);
    movidos.push({ nombre, desde, hasta });
  }
  return movidos;
}

// --- normalización de texto ------------------------------------------------
//
// Las tablas de entrenadores del PDF vienen ENTERAS EN MAYÚSCULAS y con las
// palabras partidas por el salto de línea de la celda ("RECUPE-RACIÓN",
// "MAQUINA-CIÓN"). Eso no son guiones: ningún movimiento del juego lleva uno.

/** Palabras que en un título van en minúscula salvo que abran la frase. */
const MINUSCULAS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "o", "u", "e",
  "en", "con", "a", "al", "por", "para", "un", "una", "sin", "tras",
]);

/**
 * Título al estilo de los nombres del juego: "TOQUE TÓXICO" -> "Toque Tóxico".
 * Respeta lo que ya venía bien escrito (si trae minúsculas, no se toca), para
 * no estropear nombres propios ni cosas como "MT54" o "Nº 3".
 */
function tituloEs(texto) {
  const s = String(texto).replace(/\s+/g, " ").trim();
  if (!s || s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => {
      if (i > 0 && MINUSCULAS.has(palabra)) return palabra;
      // La primera LETRA, no el primer carácter: hay entradas que empiezan por
      // guion ("-planta baja-") o por comilla, y ahí no se puede anclar en ^.
      return palabra.replace(/[a-záéíóúñü]/, (c) => c.toUpperCase());
    })
    .join(" ");
}

/**
 * Nombres propios que hay que devolver a mayúscula al pasar una frase a
 * minúsculas. Se completa en tiempo de ejecución con las especies de la
 * Pokédex (ver `cargarPropios`), que son la mayoría de los casos.
 */
const PROPIOS = new Set([
  "pokémon", "pokemon", "melia", "crisanto", "alca", "malvo", "olivier",
  "lysson", "azoth", "kalos", "mt", "ps", "acrílico",
]);

function cargarPropios(dex) {
  for (const e of dex) {
    for (const n of [e.name, e.internalName]) {
      if (!n) continue;
      for (const palabra of String(n).split(/[\s-]+/)) {
        if (palabra.length > 2) PROPIOS.add(palabra.toLowerCase());
      }
    }
  }
}

/**
 * Frase suelta o nota: primera en mayúscula y punto final.
 *
 * Las que vienen ENTERAS EN MAYÚSCULAS no se pasan por `tituloEs` si son
 * largas: "Y DE ÚLTIMO POKÉMON EL INICIAL DÉBIL..." es una oración, no un
 * título, y capitalizar cada palabra queda peor que dejarlo como estaba. Se
 * bajan a minúscula y solo se levantan los nombres propios conocidos.
 */
function fraseEs(texto) {
  let s = String(texto).replace(/\s+/g, " ").trim();
  if (!s) return s;
  if (s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(s)) {
    const palabras = s.split(" ");
    s =
      palabras.length <= 4
        ? tituloEs(s)
        : palabras
            .map((p) => {
              const limpio = p.toLowerCase();
              const solo = limpio.replace(/[^a-záéíóúñü]/g, "");
              if (PROPIOS.has(solo)) return limpio.replace(solo, solo.replace(/^./, (c) => c.toUpperCase()));
              return limpio;
            })
            .join(" ");
  }
  s = s.replace(/^([a-záéíóúñü])/, (c) => c.toUpperCase());
  if (!/[.!?:)]$/.test(s)) s += ".";
  return s;
}

/** Junta las palabras que el PDF partió al final de la línea de una celda. */
function unirPartidas(texto) {
  return String(texto).replace(/([A-Za-zÁÉÍÓÚÑáéíóúñ])-([A-Za-zÁÉÍÓÚÑáéíóúñ])/g, "$1$2");
}

/**
 * Movimientos partidos que al juntarlos no dan el nombre real. Solo hay uno:
 * el corte de línea dejó una "a" de más ("CARGA-AGRESIÓN" -> "Cargagresión").
 */
const MOVIMIENTOS_PARTIDOS = {
  "carga-agresión": "Cargagresión",
};

/**
 * Habilidades que la guía escribe con su efecto entre paréntesis: "Pelaje
 * Recio (reduce a la mitad el daño físico)". El nombre limpio va a `habilidad`
 * — que es lo que se cruza con abilities_descriptions.json para el tooltip — y
 * el paréntesis se conserva como nota del Pokémon, para no perder el matiz.
 */
function partirHabilidad(valor) {
  const s = String(valor ?? "").trim();
  const m = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return { habilidad: tituloEs(unirPartidas(s)), aclaracion: null };
  return { habilidad: tituloEs(unirPartidas(m[1])), aclaracion: fraseEs(m[2]) };
}

/** "Atq. Esp.", "Vel."… a partir de como lo escriba la guía, que varía mucho. */
function nombreDeStat(crudo) {
  const k = String(crudo)
    .replace(/\./g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // Las variantes "esp" van ANTES que las simples: si no, "atq esp" cazaría
  // como "atq" y el matiz se perdería, que es justo el fallo que había.
  if (/^(atq|atk|ataque)\s+(esp|especial)$/.test(k)) return "Atq. Esp.";
  if (/^(def|defensa)\s+(esp|especial)$/.test(k)) return "Def. Esp.";
  if (/^(atq|atk|ataque)$/.test(k)) return "Atq.";
  if (/^(def|defensa)$/.test(k)) return "Def.";
  if (/^(vel|spe|velocidad)$/.test(k)) return "Vel.";
  if (/^(ps|hp)$/.test(k)) return "PS";
  return null;
}

/**
 * Naturaleza: las celdas del PDF traen los dos modificadores en dos líneas
 * ("-ATK\n+DEF") y con puntuación irregular. Queda "+Def. / -Atq.", siempre la
 * que sube primero, que es como se lee de un vistazo.
 *
 * Se parte SOLO por "/" y no también por espacios. Partir por espacios rompía
 * "Atq. Esp." en dos trozos y tiraba el "Esp." al filtrar por el signo, así que
 * "+Atq. / -Atq. Esp." (Firme) y "+Atq. Esp. / -Atq." (Modesta) —naturalezas
 * OPUESTAS— acababan las dos convertidas en "+atq / -atq".
 *
 * Y si sube y baja la MISMA stat es una naturaleza neutra (Fuerte, Dócil,
 * Seria, Tímida, Rara): se dice "Neutra", como ya hace la guía en el resto de
 * los casos, en vez de soltar un "+Atq. / -Atq." que no significa nada.
 *
 * Lo que no se sepa leer se deja tal cual: antes se devolvía a medio formatear,
 * que es peor que no tocarlo — se pierde el original y encima queda mal.
 */
function normalizarNaturaleza(valor) {
  if (!valor) return valor;
  const s = String(valor).replace(/\s+/g, " ").trim();
  if (/^neutra$/i.test(s)) return "Neutra";

  const leidas = s
    .split("/")
    .map((p) => p.trim())
    .filter((p) => /^[+-]/.test(p))
    .map((p) => ({ signo: p[0], stat: nombreDeStat(p.slice(1)) }));

  if (leidas.length !== 2 || leidas.some((x) => !x.stat)) return s;

  const sube = leidas.filter((x) => x.signo === "+");
  const baja = leidas.filter((x) => x.signo === "-");
  if (sube.length !== 1 || baja.length !== 1) return s;
  if (sube[0].stat === baja[0].stat) return "Neutra";

  return `+${sube[0].stat} / -${baja[0].stat}`;
}

/**
 * Qué hace falta para alcanzar un objeto / MT / página / encuentro. El romhack
 * no usa MOs: la travesía va con MONTURAS (Gogoat para trepar paredes, Surf) y
 * con objetos CRAFTEADOS (Hacha Endeble para cortar, Polvo Explosivo para
 * volar rocas), más la Lente de la Verdad, que es de historia.
 *
 * Los negativos son tan importantes como los positivos: "Granja Gogoat" es un
 * sitio y no pide montura, y "Chapa Fuerte", "Fuerza Lunar" o "Fuerza Bruta"
 * son objetos y movimientos, no la habilidad.
 */
const REQUISITOS = [
  {
    clave: "surf",
    re: /\bsurf(?:ea|ear|eando|eamos)?\b|montura surf|capacidad de surfear|hacer surf/i,
  },
  {
    clave: "gogoat",
    re: /montura gog[oa]at/i,
  },
  {
    clave: "corte",
    re: /hach(?:a|uela) endeble|cortar(?:emos|é)?\s+(?:un|unos|el|los|3|tres)?\s*(?:árbol|arbust)/i,
  },
  {
    clave: "polvo_explosivo",
    re: /polvos? explosivos?/i,
  },
  {
    // Sin "golpe roca" como alternativa: en la guía eso es el NOMBRE DE LA MT
    // que dan por derrotar a una regente, no un requisito. Y se descarta cuando
    // ya se nombra el Polvo Explosivo, que es lo que rompe esas rocas.
    clave: "golpe_roca",
    re: /romper(?:emos)? (?:unas?|las?|los?)? ?rocas?/i,
    salvoSi: /polvos? explosivos?/i,
  },
  {
    clave: "fuerza",
    re: /requiere fuerza|usar fuerza|usando fuerza/i,
  },
  {
    clave: "lente",
    re: /lente de la verdad/i,
  },
  {
    clave: "buceo",
    re: /\bbuceo\b|bucear/i,
  },
];

/**
 * Pasa por el normalizador todo lo que viene de las tablas del PDF.
 *
 * `movimientosValidos` es el índice de moves_z_completo.json: sirve para
 * comprobar que al juntar una palabra partida ("RECUPE-RACIÓN") sale un
 * movimiento que existe de verdad. Si no existe se deja el guion y se reporta,
 * en vez de inventar un nombre.
 */
function normalizarTextos(zonas, movimientosValidos) {
  const stats = { movimientos: 0, habilidades: 0, objetos: 0, naturalezas: 0, notas: 0, aclaraciones: 0 };
  const movsDudosos = new Map();

  const claveMov = (s) =>
    String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  for (const zona of zonas) {
    for (const t of zona.entrenadores || []) {
      const nombreNuevo = tituloEs(t.nombre);
      if (nombreNuevo !== t.nombre) t.nombre = nombreNuevo;

      for (const mon of t.equipo || []) {
        if (Array.isArray(mon.movimientos)) {
          mon.movimientos = mon.movimientos.map((mv) => {
            if (typeof mv !== "string" || mv.trim() === "-") return mv;
            let usar = mv;
            if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]-[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(mv)) {
              // Hay movimientos con guion DE VERDAD ("Psico-corte"), así que no
              // vale quitarlo a ciegas: solo se junta si el resultado existe en
              // moves_z_completo.json, o si está en la lista de erratas.
              const alias = MOVIMIENTOS_PARTIDOS[mv.toLowerCase()];
              const unido = unirPartidas(mv);
              if (alias) usar = alias;
              else if (movimientosValidos.has(claveMov(unido))) usar = unido;
              else movsDudosos.set(mv, (movsDudosos.get(mv) ?? 0) + 1);
            }
            const final = tituloEs(usar);
            if (final !== mv) stats.movimientos++;
            return final;
          });
        }

        if (mon.habilidad) {
          const { habilidad, aclaracion } = partirHabilidad(mon.habilidad);
          if (habilidad !== mon.habilidad) stats.habilidades++;
          mon.habilidad = habilidad;
          if (aclaracion) {
            stats.aclaraciones++;
            const previa = mon.nota ? `${mon.nota} ` : "";
            if (!String(mon.nota ?? "").includes(aclaracion)) mon.nota = `${previa}${aclaracion}`.trim();
          }
        }

        if (mon.objeto) {
          const nuevo = tituloEs(unirPartidas(mon.objeto));
          if (nuevo !== mon.objeto) stats.objetos++;
          mon.objeto = nuevo;
        }

        if (mon.naturaleza) {
          const nuevo = normalizarNaturaleza(mon.naturaleza);
          if (nuevo !== mon.naturaleza) stats.naturalezas++;
          mon.naturaleza = nuevo;
        }
      }
    }

    for (const o of zona.objetos || []) {
      const nombre = tituloEs(unirPartidas(o.nombre));
      if (nombre !== o.nombre) stats.objetos++;
      o.nombre = nombre;
      if (o.detalle) o.detalle = fraseEs(o.detalle);
    }

    if (Array.isArray(zona.notas_generales)) {
      zona.notas_generales = zona.notas_generales.map((n) => {
        const nuevo = fraseEs(n);
        if (nuevo !== n) stats.notas++;
        return nuevo;
      });
    }
  }

  return { stats, movsDudosos };
}

/**
 * Combates contra UN Pokémon suelto, sin entrenador detrás. Se marcan con
 * `esBoss` para que la ficha no invente un entrenador ni hable de "as del
 * equipo": el equipo es un solo bicho.
 *
 * Se detectan por dos vías, y las dos dan exactamente estos cuatro: los que ya
 * venían con `tipo: "boss_narrativo"`, y los de un solo miembro cuyo nombre de
 * entrenador contiene el de su propia especie ("Furfrou Boss" -> Furfrou).
 */
function marcarBosses(zonas, dexIndex) {
  const marcados = [];
  for (const zona of zonas) {
    for (const t of zona.entrenadores || []) {
      const unico = (t.equipo || []).length === 1 ? t.equipo[0] : null;
      const nombreEsEspecie =
        unico && normalize(t.nombre).includes(normalize(unico.especie)) && dexIndex.has(normalize(unico.especie));
      const esBoss = t.tipo === "boss_narrativo" || Boolean(nombreEsEspecie);
      if (esBoss && !t.esBoss) {
        t.esBoss = true;
        marcados.push({ zona: zona.zona, nombre: t.nombre });
      } else if (!esBoss && t.esBoss) {
        delete t.esBoss;
      }
    }
  }
  return marcados;
}

/**
 * Zonas que no son lugares sino títulos de ARCO de la historia. La guía divide
 * el tramo final en tres arcos con el nombre de un legendario y la extracción
 * del .docx los tomó por ubicaciones; el propio JSON ya lo decía en una nota
 * suelta ("el título de la zona es el nombre del arco narrativo, no una
 * ubicación en sí").
 *
 * No se borran de la lista aunque no sean zonas: el progreso de coleccionables
 * está guardado en localStorage con el ÍNDICE de zona, así que quitar tres de
 * en medio le correría el marcador a todo lo que va detrás. Se marcan y la
 * interfaz las pinta como lo que son.
 */
/**
 * Cada arco abarca desde su título hasta la zona donde se pelea su legendario,
 * inclusive. Se delimita por NOMBRE de zona final y no por número de zonas,
 * para que añadir una zona en medio no descuadre el reparto.
 */
const ZONAS_ARCO = [
  { titulo: "Xerneas", hasta: "Guarida Team Flare" },
  { titulo: "Yveltal", hasta: "PESADILLA DE CIRCO" },
  { titulo: "Zygarde", hasta: "TORRE PRISMA" },
];

/**
 * Los ACTOS: la guía parte la historia en tres, y la extracción del .docx dejó
 * "COMIENZO DEL SEGUNDO ACTO" y "COMIENZO DEL TERCER ACTO" como zonas vacías
 * del todo — sin salvajes, sin objetos y sin una sola nota.
 *
 * No son ubicaciones, igual que los arcos, pero tampoco son lo mismo: un acto
 * abarca medio juego y un arco es un capítulo del tramo final. Se marcan aparte
 * (`separador`) para que la interfaz pueda pintarlos con más peso, y para no
 * ensuciar `arcoDe`, que sirve para sangrar las zonas de dentro de un arco.
 *
 * Igual que con los arcos: se marcan, no se borran. Quitarlas de en medio
 * correría el índice de zona, que es la clave del progreso en localStorage.
 */
const ES_ACTO = /^\s*comienzo del .*\bacto\b/i;

function marcarSeparadores(zonas) {
  const marcados = [];
  for (const zona of zonas) {
    if (!ES_ACTO.test(zona.zona)) {
      if (zona.separador) delete zona.separador;
      continue;
    }
    zona.separador = "acto";
    marcados.push(zona.zona);
  }
  return marcados;
}

/**
 * Lo que la guía marca como "(Opcional)" en el título, y lo que además es un
 * OBJETIVO de captura en vez de un sitio.
 *
 * Son 65 entradas de 204, un tercio de la guía, y hoy no se distinguen en nada
 * de las obligatorias: cuentan igual para el porcentaje de exploración, ocupan
 * el mismo hueco en la lista y se abren igual. Marcarlas deja que la interfaz
 * diga cuáles se pueden saltar sin perderse nada de la historia.
 *
 * Se marcan, no se tocan de sitio: el índice de zona es la clave del progreso
 * en localStorage (mismo motivo que en arcos y actos).
 *
 * El sufijo lo escribió el .docx a su aire — "(Opcional)", "(opcional)",
 * "(OPCIONAL)" pegado sin espacio, y un "Pirineos (Frontera con Paldea)
 * Opcional" sin paréntesis siquiera —, así que se busca al final del título y
 * con los paréntesis sueltos.
 */
const ES_OPCIONAL = /\s*\(?\s*opcional\s*\)?\s*$/i;

/** "Atrapar a X", "Obtener a X": el título es la tarea, no el lugar. */
const ES_CAPTURA = /^\s*(?:atrapar|obtener|conseguir|capturar)\s+a\b/i;

function marcarOpcionales(zonas) {
  const opcionales = [];
  const capturas = [];
  const sinTabla = [];

  for (const zona of zonas) {
    if (ES_OPCIONAL.test(zona.zona)) {
      zona.opcional = true;
      opcionales.push(zona.zona);
    } else if (zona.opcional) {
      delete zona.opcional;
    }

    const especies = CAPTURAS_POR_ZONA[zona.zona];
    if (especies) {
      zona.capturas = [...especies];
      capturas.push({ zona: zona.zona, especies });
    } else {
      if (zona.capturas) delete zona.capturas;
      // Si la guía gana un "Atrapar a ..." nuevo, que se vea en el informe en
      // vez de quedarse sin marcar en silencio.
      if (ES_CAPTURA.test(zona.zona)) sinTabla.push(zona.zona);
    }
  }

  return { opcionales, capturas, sinTabla };
}

function marcarArcos(zonas) {
  const marcados = [];
  let actual = null;

  for (const zona of zonas) {
    const cabecera = ZONAS_ARCO.find((a) => a.titulo === zona.zona);

    if (cabecera) {
      zona.arco = true;
      delete zona.arcoDe;
      actual = cabecera;
      marcados.push(zona.zona);
      continue;
    }

    if (zona.arco) delete zona.arco;

    if (actual) {
      zona.arcoDe = actual.titulo;
      // El cierre va DESPUÉS de asignar: la zona del combate es la última del
      // arco, no la primera de fuera.
      if (zona.zona === actual.hasta) actual = null;
    } else if (zona.arcoDe) {
      delete zona.arcoDe;
    }
  }

  return marcados;
}

/** ¿Esta entrada de `objetos` es en realidad un Pokémon de un equipo? */
const PARECE_MON = /,\s*(?:al\s+)?nivel\s*\d+|,\s*al\s*\d+/i;

/**
 * Devuelve a `entrenadores` los equipos que quedaron sueltos en `objetos`, y
 * limpia esas entradas.
 *
 * Se borra TODO lo que tenga forma de Pokémon, no solo lo que se reasigna:
 * hay 47 entradas que ya estaban duplicadas en un equipo de la misma zona
 * (la fusión con el PDF las había reconstruido sin borrar la copia), y las 31
 * restantes son justamente las que trae ENTRENADORES_HUERFANOS.
 */
function rescatarEntrenadoresDeObjetos(zonas) {
  const creados = [];
  const rellenados = [];
  let borrados = 0;
  const sinDestino = [];

  for (const zona of zonas) {
    for (const def of ENTRENADORES_HUERFANOS.filter((h) => h.zona === zona.zona)) {
      zona.entrenadores = zona.entrenadores || [];
      const existente = zona.entrenadores.find((t) => t.nombre === def.nombre);
      if (existente) {
        // Ya estaba declarado pero sin equipo (Mosquetero/a Spartoi). Los
        // jefes narrativos no traen equipo, así que no hay nada que rellenar y
        // se saltan — si no, se reportarían como "rellenados" en cada pasada.
        if ((existente.equipo || []).length || !def.equipo.length) continue;
        existente.equipo = structuredClone(def.equipo);
        if (def.notas && !existente.notas) existente.notas = def.notas;
        if (def.procedencia) existente.procedencia = def.procedencia;
        existente.equipo_fuente = "pdf_guia_oficial";
        rellenados.push({ zona: zona.zona, nombre: def.nombre, n: def.equipo.length });
        continue;
      }
      const nuevo = {
        ...(def.tipo ? { tipo: def.tipo } : {}),
        nombre: def.nombre,
        equipo: structuredClone(def.equipo),
        ...(def.notas ? { notas: def.notas } : {}),
        ...(def.procedencia ? { procedencia: def.procedencia } : {}),
        equipo_fuente: "pdf_guia_oficial",
      };
      // El orden de `entrenadores` es el orden en que se pelean, y el banner de
      // próxima batalla se guía por él. Los que se añaden tarde (los dos
      // combates contra Mirra, delante de Zygarde) tienen que colarse en su
      // sitio en vez de ir al final.
      const antesDe = def.antesDe
        ? zona.entrenadores.findIndex((t) => t.nombre === def.antesDe)
        : -1;
      if (antesDe >= 0) zona.entrenadores.splice(antesDe, 0, nuevo);
      else zona.entrenadores.push(nuevo);
      creados.push({ zona: zona.zona, nombre: def.nombre, n: def.equipo.length });
    }

    // Rótulos que quedaron sueltos en `notas_generales` porque la tabla que
    // encabezaban se perdió: ahora que el equipo existe como entrenador, la
    // nota es ruido duplicado. Se compara sin punto final ni mayúsculas para
    // que la normalización de textos no la vuelva a dejar pasar.
    const aQuitar = ENTRENADORES_HUERFANOS.filter(
      (h) => h.zona === zona.zona && h.quitarNotas
    ).flatMap((h) => h.quitarNotas.map((n) => n.toLowerCase().replace(/\.$/, "")));
    if (aQuitar.length && Array.isArray(zona.notas_generales)) {
      zona.notas_generales = zona.notas_generales.filter(
        (n) => !aQuitar.includes(String(n).trim().toLowerCase().replace(/\.$/, ""))
      );
    }

    const antes = (zona.objetos || []).length;
    zona.objetos = (zona.objetos || []).filter((o) => !PARECE_MON.test(String(o.nombre)));
    const quitados = antes - zona.objetos.length;
    if (quitados) {
      borrados += quitados;
      // Aviso si se borra algo en una zona para la que no hay equipo definido:
      // querría decir que se está perdiendo información.
      const cubierta =
        ENTRENADORES_HUERFANOS.some((h) => h.zona === zona.zona) ||
        (zona.entrenadores || []).some((t) => (t.equipo || []).length);
      if (!cubierta) sinDestino.push({ zona: zona.zona, n: quitados });
    }
  }

  return { creados, rellenados, borrados, sinDestino };
}

/**
 * Los "Consejos de batalla" no siempre acabaron en `objetos`: en la mayoría de
 * los combates cayeron en `notas_generales`, como líneas sueltas del tipo
 * "Torkoal: Poniendo la lluvia lo deberíamos anular por completo." Leídas ahí
 * no se sabe ni de qué combate son — la zona puede tener trece.
 *
 * Esta pasada las devuelve a su sitio:
 *   - "<Especie>: <consejo>"  ->  al miembro del equipo que nombra.
 *   - "Nota: …" que menciona una habilidad, un movimiento o al propio
 *     entrenador  ->  a las notas de ese combate.
 *   - cabeceras huérfanas ("Consejos de batalla:", "Objetos:") y notas que
 *     repiten algo que el entrenador ya dice  ->  fuera.
 *
 * Todo lo demás se queda: las notas de zona de verdad (cómo llegar, qué pasa
 * después) no son de ningún combate.
 */
function repartirNotasDeCombate(zonas) {
  const consejos = [];
  const notas = [];
  const quitadas = [];
  const ambiguas = [];

  const nzEspecie = (s) => normalize(String(s)).replace(/[^a-z0-9]/g, "");
  const nzTexto = (s) => normalize(String(s)).replace(/\s+/g, " ").trim().replace(/[.:]$/, "");
  const CABECERA = /^\s*(consejos? de (batalla|combate)|gu[ií]a de combate|entrenadores\b.*|objetos)\s*:?\s*$/i;
  const CURACION =
    /\btiene\b[^.]*\b(?:\d+|un|una|dos|tres)\b[^.]*(poci[oó]n|pociones|restaurar|full\s*restore|revivir)/i;

  for (const zona of zonas) {
    if (!Array.isArray(zona.notas_generales)) continue;
    const importantes = (zona.entrenadores || []).filter((t) => t.tipo === "importante");
    if (!importantes.length) continue;

    const mons = importantes.flatMap((t) => (t.equipo || []).map((m) => ({ t, m })));
    // Términos que identifican a UN combate: habilidades y movimientos de su
    // equipo, y el propio nombre del entrenador. Las especies quedan fuera a
    // propósito: se nombran en notas que no son del combate ("Lunatone abre un
    // atajo con un Solrock de Ciudad Fluxus").
    const señas = importantes.map((t) => ({
      t,
      terminos: new Set(
        [
          t.nombre.replace(/^(Regente|Rival|Alquimista Azoth|Alto Mando|Entrenadora?|Clérigo|Capitán)\s+/i, ""),
          ...(t.equipo || []).flatMap((m) => [m.habilidad, ...(m.movimientos || [])]),
        ]
          .map((x) => nzTexto(x ?? ""))
          .filter((x) => x.length > 3 && x !== "no especificada")
      ),
    }));

    const notasTrainer = importantes.map((t) => nzTexto(t.notas ?? "")).filter(Boolean);
    const vistas = new Set();
    const restantes = [];

    for (const nOriginal of zona.notas_generales) {
      // Rótulo pegado al final de una frase de verdad: "La enredadera que está
      // al lado de la continuación del Arma Definitiva: Entrenadores:".
      const texto = String(nOriginal).trim().replace(/\s+(Entrenadores|Objetos|Consejos? de batalla)\s*:\s*$/i, "");
      const n = texto === String(nOriginal).trim() ? nOriginal : texto;
      const clave = nzTexto(texto);

      if (CABECERA.test(texto) || vistas.has(clave)) {
        quitadas.push({ zona: zona.zona, nota: texto });
        continue;
      }
      vistas.add(clave);

      // Ya lo dice el propio entrenador en su ficha.
      if (clave.length > 20 && notasTrainer.some((t) => t.includes(clave))) {
        quitadas.push({ zona: zona.zona, nota: texto });
        continue;
      }

      // "<Especie>: <consejo>", con o sin el "Consejos de batalla:" delante.
      const m = texto.match(/^\s*(?:consejos? de batalla:\s*)?([^:]{3,28}):\s*(.{25,})$/i);
      if (m) {
        const c = nzEspecie(m[1]);
        const hits = mons.filter(({ m: mon }) => {
          const e = nzEspecie(mon.especie);
          return e === c || e.startsWith(c) || c.startsWith(e) || e === c.replace(/^mega/, "");
        });
        if (hits.length === 1 && !hits[0].m.consejo) {
          hits[0].m.consejo = m[2].trim();
          consejos.push({ zona: zona.zona, trainer: hits[0].t.nombre, especie: hits[0].m.especie });
          continue;
        }
        if (hits.length > 1) ambiguas.push({ zona: zona.zona, nombre: m[1].trim() });
      }

      // "Nota: …" sobre un combate concreto.
      if (/^nota\s*:/i.test(texto)) {
        const hits = señas.filter(({ terminos }) => [...terminos].some((x) => clave.includes(x)));
        if (hits.length === 1) {
          const t = hits[0].t;
          t.notas = [t.notas, texto].filter(Boolean).join(" ");
          notas.push({ zona: zona.zona, trainer: t.nombre, nota: texto });
          continue;
        }
      }

      // Qué curación lleva el rival ("Tiene disponible dos Hiperpociones como
      // objetos curativos.", "Arrayan tiene dos Full Restore."). Es un dato del
      // combate y en la lista de notas de zona no se sabe de quién es.
      if (CURACION.test(texto) && texto.length < 140) {
        const porNombre = señas.filter(({ terminos }) => [...terminos].some((x) => clave.includes(x)));
        // Si nadie sale nombrado pero la zona tiene un solo combate importante,
        // no hay ambigüedad posible.
        const destino = porNombre.length === 1 ? porNombre[0].t : importantes.length === 1 ? importantes[0] : null;
        if (destino) {
          if (!nzTexto(destino.notas ?? "").includes(clave)) {
            destino.notas = [destino.notas, texto].filter(Boolean).join(" ");
            notas.push({ zona: zona.zona, trainer: destino.nombre, nota: texto });
          } else {
            quitadas.push({ zona: zona.zona, nota: texto });
          }
          continue;
        }
      }

      restantes.push(n);
    }

    zona.notas_generales = restantes;
  }

  return { consejos, notas, quitadas, ambiguas };
}

function unirConsejosPartidos(zonas) {
  const unidos = [];
  for (const zona of zonas) {
    for (const c of CONSEJOS_PARTIDOS.filter((x) => x.zona === zona.zona)) {
      const t = (zona.entrenadores || []).find((x) => x.nombre === c.entrenador);
      const mon = (t?.equipo || []).find((m) => m.especie === c.especie);
      const i = (zona.notas_generales || []).findIndex((n) => String(n).trim() === c.cola);
      if (!mon?.consejo || i < 0) continue;
      mon.consejo = c.unir(mon.consejo, c.cola);
      zona.notas_generales.splice(i, 1);
      unidos.push({ zona: zona.zona, especie: c.especie });
    }
  }
  return unidos;
}

function intercambiarConsejos(zonas) {
  const hechos = [];
  for (const zona of zonas) {
    for (const c of CONSEJOS_INTERCAMBIADOS.filter((x) => x.zona === zona.zona)) {
      const t = (zona.entrenadores || []).find((x) => x.nombre === c.entrenador);
      const ma = (t?.equipo || []).find((m) => m.especie === c.a.especie);
      const mb = (t?.equipo || []).find((m) => m.especie === c.b.especie);
      if (!ma?.consejo || !mb?.consejo) continue;
      if (!ma.consejo.startsWith(c.a.empiezaPor) || !mb.consejo.startsWith(c.b.empiezaPor)) continue;
      [ma.consejo, mb.consejo] = [mb.consejo, ma.consejo];
      hechos.push({ zona: zona.zona, a: c.a.especie, b: c.b.especie });
    }
  }
  return hechos;
}

function aclararConsejos(zonas) {
  const puestos = [];
  // Se reescribe entero en cada pasada: quitar una entrada de la lista tiene
  // que borrar su aviso del JSON, no dejarlo ahí para siempre.
  for (const zona of zonas) {
    for (const t of zona.entrenadores || []) {
      for (const m of t.equipo || []) {
        const esperado = CONSEJOS_ACLARADOS.find(
          (c) => c.zona === zona.zona && c.entrenador === t.nombre && c.especie === m.especie
        );
        if (m.consejoAviso && !esperado) delete m.consejoAviso;
      }
    }
  }

  for (const zona of zonas) {
    for (const c of CONSEJOS_ACLARADOS.filter((x) => x.zona === zona.zona)) {
      const t = (zona.entrenadores || []).find((x) => x.nombre === c.entrenador);
      const mon = (t?.equipo || []).find((m) => m.especie === c.especie);
      if (!mon?.consejo || mon.consejoAviso === c.aviso) continue;
      mon.consejoAviso = c.aviso;
      puestos.push({ zona: zona.zona, especie: c.especie });
    }
  }
  return puestos;
}

/**
 * Aviso de mantenimiento: un consejo que nombra la habilidad de OTRO miembro
 * del equipo suele ser un despiste de la guía (el caso de Landorus y Poder
 * Arena). No se toca nada, solo se reporta para revisarlo a mano.
 *
 * Se ignora "con <habilidad>": ahí el consejo está recomendando llevar un
 * Pokémon con esa habilidad, no diciendo que el rival la tenga.
 */
function revisarConsejosVsEquipo(zonas) {
  const sospechas = [];
  const nz = (s) => normalize(String(s)).replace(/\s+/g, " ").trim();

  for (const zona of zonas) {
    for (const t of zona.entrenadores || []) {
      if (t.tipo !== "importante") continue;
      const habilidades = (t.equipo || []).map((m) => ({ especie: m.especie, h: nz(m.habilidad ?? "") }));
      for (const mon of t.equipo || []) {
        if (!mon.consejo) continue;
        const texto = nz(mon.consejo);
        const propia = nz(mon.habilidad ?? "");
        for (const { especie, h } of habilidades) {
          if (!h || h === "no especificada" || h.length < 5 || h === propia) continue;
          const i = texto.indexOf(h);
          if (i < 0 || /\bcon\s$/.test(texto.slice(Math.max(0, i - 4), i))) continue;
          sospechas.push({ zona: zona.zona, trainer: t.nombre, especie: mon.especie, habilidad: h, de: especie });
        }
      }
    }
  }
  return sospechas;
}

function limpiarNotasEspuriasDeEntrenador(zonas) {
  const quitadas = [];
  for (const zona of zonas) {
    for (const e of NOTAS_ENTRENADOR_ESPURIAS.filter((x) => x.zona === zona.zona)) {
      const t = (zona.entrenadores || []).find((x) => x.nombre === e.nombre);
      if (!t?.notas || !String(t.notas).startsWith(e.empiezaPor)) continue;
      delete t.notas;
      quitadas.push({ zona: zona.zona, nombre: e.nombre });
    }
  }
  return quitadas;
}

/**
 * De los bloques "Entrenadores <zona>:" el .docx solo salvó texto suelto en
 * `notas_generales`: la cabecera de la sección, el nombre de cada entrenador y
 * sus Pokémon línea a línea. Ahora que esos entrenadores existen de verdad (los
 * trae el PDF), esas notas son la misma información dos veces y encima
 * indescifrable — "Lapras, al 85 Carabinero Narumi (P3):" es una nota de zona.
 *
 * Se quita una nota solo si su contenido ya está cubierto por un entrenador de
 * la zona: o es su nombre, o es un Pokémon de su equipo. Lo que no encaje se
 * queda, que es mejor que perder texto de la guía.
 */
function limpiarNotasDeEntrenadores(zonas) {
  const quitadas = [];
  const nzNota = (s) => normalize(String(s)).replace(/[^a-z0-9]/g, "");

  for (const zona of zonas) {
    if (!Array.isArray(zona.notas_generales)) continue;
    const entrenadores = zona.entrenadores || [];
    if (!entrenadores.length) continue;

    const nombres = new Set(entrenadores.map((t) => nzNota(String(t.nombre).replace(/[:.]\s*$/, ""))));
    const mons = new Set();
    for (const t of entrenadores) {
      for (const m of t.equipo || []) mons.add(nzNota(m.especie) + "|" + String(m.nivel ?? "").trim());
    }

    const cubierto = (trozo) => {
      // "ALCA EL ARMA DEFINITIVA:(Combate Doble)" es el rótulo de "Alca: El Arma
      // Definitiva" con una coletilla entre paréntesis.
      const limpio = trozo.trim().replace(/\s*[:.]?\s*\([^)]*\)\s*$/, "").replace(/[:.]\s*$/, "");
      if (!limpio) return false;
      if (nombres.has(nzNota(limpio))) return true;
      const mon = limpio.match(/^(.+?),\s*(?:al\s+|nivel\s+|al\s+nivel\s+)(\d+)\.?$/i);
      return Boolean(mon && mons.has(nzNota(mon[1]) + "|" + mon[2]));
    };

    zona.notas_generales = zona.notas_generales.filter((n) => {
      const texto = String(n).trim();
      if (/^Entrenadores\b.*:$/i.test(texto)) {
        quitadas.push({ zona: zona.zona, nota: texto });
        return false;
      }
      // "Lapras, al 85 Carabinero Narumi (P3):" — dos cosas pegadas en una
      // línea. Solo se tira si las dos mitades están cubiertas.
      const pegado = texto.match(/^(.+?,\s*(?:al\s+|nivel\s+)\d+\.?)\s+(.+)$/i);
      const ok = pegado ? cubierto(pegado[1]) && cubierto(pegado[2]) : cubierto(texto);
      if (ok) quitadas.push({ zona: zona.zona, nota: texto });
      return !ok;
    });
  }

  return quitadas;
}

/**
 * Los bloques de "Consejos de batalla" de la guía son una línea por Pokémon del
 * rival ("Landorus: importante cambiar el clima…"). La extracción del .docx los
 * metió en `objetos`, así que salían como si fueran objetos que se recogen del
 * suelo, y encima con nombre de Pokémon.
 *
 * Van a parar al miembro del equipo al que se refieren, que es donde sirven:
 * al lado de sus movimientos y su objeto. Solo se miran los combates
 * IMPORTANTES — son los únicos que la guía comenta.
 */
function moverConsejosDeBatalla(zonas) {
  const movidos = [];
  const sinDestino = [];

  // Sin espacios ni signos: la guía escribe "MegaSceptile" en los consejos y
  // "Mega Sceptile" en la tabla del equipo.
  const nzEspecie = (s) => normalize(String(s)).replace(/[^a-z0-9]/g, "");

  // Erratas de la guía: el consejo nombra a un Pokémon que no está en el
  // equipo. Ver la `procedencia` de Alto Mando Tornasola — el cuarto lleva
  // Garchompita, así que es Mega Garchomp y no Mega Excadrill.
  const ERRATAS = { megaexcadrill: "megagarchomp" };

  for (const zona of zonas) {
    const mons = (zona.entrenadores || [])
      .filter((t) => t.tipo === "importante")
      .flatMap((t) => (t.equipo || []).map((m) => ({ trainer: t.nombre, mon: m })));
    if (!mons.length) continue;

    const restantes = [];
    for (const o of zona.objetos || []) {
      const detalle = String(o.detalle ?? "").trim();
      // Sin texto no hay consejo, y con ubicación ("En el primer piso…") es un
      // objeto de verdad que por casualidad se llama como un Pokémon.
      if (!detalle) {
        restantes.push(o);
        continue;
      }
      const bruto = nzEspecie(String(o.nombre).replace(/\.$/, ""));
      const clave = ERRATAS[bruto] ?? bruto;
      // "Mega Darkrai" en los consejos frente a "Darkrai" con Darkrainita en la
      // tabla: es el mismo bicho, la guía lo nombra ya megaevolucionado.
      const sinMega = clave.replace(/^mega/, "");
      const hits = mons.filter(({ mon }) => {
        const e = nzEspecie(mon.especie);
        return e === clave || e.startsWith(clave) || clave.startsWith(e) || e === sinMega || e.startsWith(sinMega);
      });
      if (hits.length !== 1) {
        if (hits.length > 1) sinDestino.push({ zona: zona.zona, nombre: o.nombre, motivo: "ambiguo" });
        restantes.push(o);
        continue;
      }
      hits[0].mon.consejo = detalle;
      movidos.push({ zona: zona.zona, trainer: hits[0].trainer, especie: hits[0].mon.especie });
    }
    zona.objetos = restantes;
  }

  return { movidos, sinDestino };
}

function detectarRequisitos(texto) {
  if (!texto) return [];
  const t = String(texto);
  const out = [];
  for (const r of REQUISITOS) {
    if (!r.re.test(t)) continue;
    if (r.salvoSi && r.salvoSi.test(t)) continue;
    out.push(r.clave);
  }
  return out;
}

/**
 * Anota `requisitos` en todo lo que se puede recoger de una zona. Se reescribe
 * entero en cada pasada (no se acumula) para que corregir un patrón arriba se
 * refleje sin arrastrar lo detectado antes.
 */
function anotarRequisitos(zonas) {
  const cuenta = {};
  let conRequisito = 0;

  const anotar = (obj, ...textos) => {
    const reqs = [...new Set(textos.flatMap((t) => detectarRequisitos(t)))];
    if (reqs.length) {
      obj.requisitos = reqs;
      conRequisito++;
      for (const r of reqs) cuenta[r] = (cuenta[r] || 0) + 1;
    } else if (obj.requisitos) {
      delete obj.requisitos;
    }
  };

  for (const zona of zonas) {
    // Solo el detalle, nunca el nombre: la "Buceo Ball" se consigue hablando
    // con un señor, y la "Roca Lluvia" no pide nada — los nombres de objeto
    // arrastran palabras que parecen requisitos y no lo son.
    for (const o of zona.objetos || []) anotar(o, o.detalle);
    for (const m of zona.mts || []) anotar(m, m.contexto);
    for (const p of zona.pokemon_salvajes || []) anotar(p, p.nota, p.metodo);
    const a = zona.pagina_alquimia;
    if (a?.presente) {
      anotar(a, a.descripcion, ...(a.adicionales || []));
      const manual = REQUISITOS_ALQUIMIA_MANUALES[zona.zona];
      if (manual) {
        const antes = a.requisitos?.length ?? 0;
        a.requisitos = [...new Set([...(a.requisitos || []), ...manual])];
        if (!antes) conRequisito++;
        for (const r of manual) cuenta[r] = (cuenta[r] || 0) + 1;
      }
    }
  }

  return { conRequisito, cuenta };
}

/**
 * Vuelca las listas de "nubes de polvo" extraídas del PDF
 * (data-src/salvajes-cueva-pdf.json) a `pokemon_salvajes`.
 *
 * En las cuevas no hay hierba alta: los encuentros salen de las nubes de polvo,
 * un método que la extracción original del .docx no reconoció. El resultado era
 * que una cueva solo mostraba lo que se pesca, o nada.
 *
 * Hay nombres de zona repetidos en el JSON (dos "Catacumbas Orientales
 * (Opcional)", dos "Acceder a las Catacumbas Septentrionales (Opcional)"), y el
 * PDF trae también dos listas para cada uno. Se reparten por posición: la
 * primera lista a la primera zona con ese nombre, y así.
 */
function volcarSalvajesDeCueva(zonas, listas) {
  const porNombre = new Map();
  for (const z of zonas) {
    if (!porNombre.has(z.zona)) porNombre.set(z.zona, []);
    porNombre.get(z.zona).push(z);
  }

  const usadas = new Map();
  const volcadas = [];
  const sinZona = [];

  for (const lista of listas) {
    const candidatas = porNombre.get(lista.zona) ?? [];
    const n = usadas.get(lista.zona) ?? 0;
    const zona = candidatas[n] ?? candidatas[candidatas.length - 1];
    usadas.set(lista.zona, n + 1);
    if (!zona) {
      sinZona.push(lista.zona);
      continue;
    }

    zona.pokemon_salvajes = zona.pokemon_salvajes || [];
    // Idempotente: si ya hay nubes de polvo de una pasada anterior, se
    // reemplazan en bloque en vez de acumularse.
    const otros = zona.pokemon_salvajes.filter((p) => !String(p.metodo || "").startsWith("nubes de polvo"));
    const nuevos = lista.pokemon.map((p) => ({ ...p }));
    const cambia =
      otros.length !== zona.pokemon_salvajes.length - nuevos.length ||
      JSON.stringify(zona.pokemon_salvajes.filter((p) => String(p.metodo || "").startsWith("nubes de polvo"))) !==
        JSON.stringify(nuevos);
    zona.pokemon_salvajes = [...nuevos, ...otros];
    if (cambia) volcadas.push({ zona: zona.zona, n: nuevos.length });
  }

  return { volcadas, sinZona };
}

// --- tablas de encuentros atrapadas en notas_generales ----------------------

/** "● 25% Rattata (Dropea Pelaje Fino)." — el porcentaje siempre va delante. */
const LINEA_ENCUENTRO = /^\s*●?\s*(\d{1,3})\s*%\s*(.+)$/;

/**
 * Encabezados que anuncian una tabla. Los dos primeros la nombran; los otros
 * son etiquetas de subzona que la guía mete ENTRE bloques de la misma tabla
 * ("Planta Baja:", "Sótano 1."). Estas últimas solo se borran si el bloque que
 * encabezan desaparece entero — sueltas podrían ser una nota cualquiera.
 */
const CABECERA_TABLA = /^(?:l?ista de\s+pok.mon|pok.mon\s+(?:salvajes|en\b))/i;
const SUBZONA_TABLA = /^(?:planta baja|s[oó]tano\s*\d*|zona\s*\d+|alcantarillas)\s*[:.]?\s*$/i;

/** Método de encuentro según lo que diga el encabezado. */
const METODO_POR_CABECERA = [
  [/ca[nñ]a de pescar|pescando/i, "caña de pescar"],
  [/nubes de polvo/i, "nubes de polvo"],
  [/surf|surfeando/i, "surf"],
  [/hierba alta/i, "hierba alta"],
];

function normalizarTexto(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * El drop, en el mismo formato que el resto del JSON ("Dropea X y raramente Y").
 * Pueblo Lienzo es la única zona que lo escribe como "Puede dropear “X”, y, más
 * raramente, “Y”." — y es justo la que no importó nadie.
 */
function normalizarDrop(texto) {
  let t = String(texto ?? "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;\s]+$/, "")
    .trim();
  if (!t) return "";
  if (/^no tiene drop$/i.test(t)) return "";
  t = t.replace(/^puede\s+dropear/i, "Dropea");
  t = t.replace(/,\s*y\s*,\s*m[aá]s raramente\s*,\s*/i, " y raramente ");
  t = t.replace(/\s*,\s*y\s+m[aá]s raramente\s+/i, " y raramente ");
  return t.replace(/[.,;\s]+$/, "").trim();
}

/** Parte "25% Rattata (Dropea X)." en sus tres campos. null si no es una línea de tabla. */
function partirLineaEncuentro(texto) {
  const m = String(texto).trim().match(LINEA_ENCUENTRO);
  if (!m) return null;

  const resto = m[2].trim();
  let nombre = resto;
  let drop = "";

  const conParentesis = resto.match(/^([^(]+)\(([^)]*)\)/);
  if (conParentesis) {
    nombre = conParentesis[1];
    drop = conParentesis[2];
  } else {
    // "Krabby. Puede dropear “Agua Vital”." — el punto separa nombre de drop.
    const conPunto = resto.match(/^([^.]+)\.\s*(.+)$/);
    if (conPunto) {
      nombre = conPunto[1];
      drop = conPunto[2];
    }
  }

  return {
    porcentaje: `${m[1]}%`,
    nombre: nombre.replace(/[.,;\s]+$/, "").trim(),
    drop: normalizarDrop(drop),
  };
}

/**
 * Saca de `notas_generales` las tablas de encuentros que no pintan nada ahí.
 *
 * Son 154 líneas repartidas por 21 zonas, y casi todas (152) son un RESTO: el
 * dato ya vive en `pokemon_salvajes` desde que volcarSalvajesDeCueva importó
 * las listas del PDF, pero las líneas originales del .docx nunca se borraron,
 * así que cada cueva enseña su tabla dos veces — una como tarjetas y otra como
 * párrafos sueltos al final.
 *
 * Las 2 que faltan son de Pueblo Lienzo, y esas sí son el único sitio donde
 * está el dato: su tabla de caña se escribió como "Puede dropear “X”" en vez de
 * "(Dropea X)", que es lo que la extracción original buscaba. Esas se suben a
 * `pokemon_salvajes` en vez de borrarse.
 *
 * Una línea se da por absorbida si hay un salvaje con el MISMO porcentaje y, o
 * bien el mismo nombre, o bien el mismo drop. Lo segundo cubre los nombres que
 * la guía escribe mal y este script ya corrigió al importar: "Spiranak" es
 * Spinarak, y por nombre no casaría nunca.
 */
function limpiarTablasDeNotas(zonas) {
  const borradas = [];
  const movidas = [];

  for (const zona of zonas) {
    const notas = zona.notas_generales || [];
    if (notas.length === 0) continue;

    const salvajes = zona.pokemon_salvajes || [];
    const fuera = new Set();
    const nuevos = [];

    let i = 0;
    while (i < notas.length) {
      const entrada = partirLineaEncuentro(notas[i]);
      if (!entrada) {
        i++;
        continue;
      }

      // Todo el bloque de líneas seguidas: se decide en conjunto, porque el
      // método sale del encabezado que tienen encima y es común a todas.
      const inicio = i;
      const bloque = [];
      while (i < notas.length) {
        const e = partirLineaEncuentro(notas[i]);
        if (!e) break;
        bloque.push({ indice: i, entrada: e });
        i++;
      }

      const cabecera = inicio > 0 ? String(notas[inicio - 1]).trim() : "";
      const esCabecera = CABECERA_TABLA.test(cabecera) || SUBZONA_TABLA.test(cabecera);
      const metodo = esCabecera
        ? (METODO_POR_CABECERA.find(([patron]) => patron.test(cabecera)) ?? [])[1] ?? null
        : null;

      let bloqueEntero = true;
      for (const { indice, entrada: e } of bloque) {
        const absorbida = salvajes.some(
          (p) =>
            String(p.porcentaje) === e.porcentaje &&
            (normalizarTexto(p.nombre) === normalizarTexto(e.nombre) ||
              (e.drop !== "" && normalizarTexto(p.drop) === normalizarTexto(e.drop)))
        );
        if (absorbida) {
          fuera.add(indice);
          borradas.push({ zona: zona.zona, texto: notas[indice] });
        } else if (metodo) {
          fuera.add(indice);
          nuevos.push({ ...e, metodo });
          movidas.push({ zona: zona.zona, texto: notas[indice], metodo });
        } else {
          // Ni está en la lista ni se sabe con qué método se encuentra: se deja
          // como estaba. Perder el dato sería peor que enseñarlo mal colocado.
          bloqueEntero = false;
        }
      }

      // La cabecera solo sobra si ya no queda nada debajo de ella.
      if (bloqueEntero && esCabecera) {
        fuera.add(inicio - 1);
        borradas.push({ zona: zona.zona, texto: notas[inicio - 1] });
      }
    }

    if (fuera.size === 0) continue;
    zona.notas_generales = notas.filter((_, j) => !fuera.has(j));
    if (nuevos.length > 0) zona.pokemon_salvajes = [...salvajes, ...nuevos];
  }

  return { borradas, movidas };
}

// --- drops de los Pokémon salvajes ------------------------------------------

/**
 * Nombres de objeto que la guía escribe de una forma que `nzItem` no alcanza a
 * casar (no es cuestión de tildes ni de espacios, son palabras distintas).
 * Clave ya normalizada con nzItem.
 */
/**
 * Marcas internas para partir un drop en sus objetos. Son caracteres de
 * control porque no pueden aparecer nunca en el texto de la guía; el separador
 * real ("y raramente", ", más raramente", ". Muy raro") se escribe de tantas
 * formas que es más limpio unificarlo antes de partir que intentar partir por
 * todas ellas a la vez.
 */
const MUY = "\u0001";
const RARO = "\u0002";
const MAS = "\u0003";
const SEPARADORES = new RegExp(`([${MUY}${RARO}${MAS}])`);

const ALIAS_DROP = {
  revestimientometalico: "Revestim. Metálico",
  revestmetalico: "Revestim. Metálico",
  revmetalico: "Revestim. Metálico",
  trozodeestrella: "Trozo Estrella",
  muscoaromatico: "Musgo Aromático",
  toxistrella: "Toxiestrella",
  escamadural: "Escama Dura",
};

/**
 * Deja los drops en una sola forma: "Dropea X y raramente Y." — que es la que
 * ya usan 7 de cada 10, con el nombre de objeto tal y como lo escribe el juego
 * y cerrando con punto.
 *
 * Lo que arregla, además del formato:
 *   - "Dropa" por "Dropea" y "No tien drop" por "No tiene drop".
 *   - 38 nombres mal escritos: "Poketoxina" (26 veces), "Brasa candente",
 *     "PIedraeterna", "Musco Aromático"... Se cotejan contra
 *     items_pokemon_z.json, así que el que no exista se deja como está en vez
 *     de inventarlo.
 *   - Los separadores sueltos: "X, raramente Y", "X y, más raramente Y",
 *     "X. Muy raro Y" — todos acaban en la misma frase.
 *   - Cuatro entradas de Isla Montesanto con un "(Izquierda"/"(Derecha" pegado
 *     al final: el paréntesis marcaba la mitad de la isla y la extracción lo
 *     dejó dentro del drop. Pasa al método, que es donde este JSON ya guarda
 *     las subzonas ("hierba alta - Zona del Puerto").
 *   - Un drop de 1835 caracteres en el Bastión de Belladona con la tabla del
 *     combate entera dentro. La tabla ya está parseada como entrenador, así
 *     que se descarta; los "Consejos de batalla" NO, que no están en ningún
 *     otro sitio: se pasan a las notas del entrenador.
 */
function normalizarDrops(zonas, items) {
  const lista = Array.isArray(items) ? items : Object.values(items);
  const canon = new Map();
  for (const it of lista) {
    if (it.name && !canon.has(nzItem(it.name))) canon.set(nzItem(it.name), it.name);
  }

  const cambios = [];
  const rescatados = [];

  /** El nombre tal y como lo escribe el juego, o el original si no existe. */
  const nombreObjeto = (crudo) => {
    const limpio = crudo.replace(/^[\s.,;)]+|[\s.,;)]+$/g, "");
    if (!limpio) return "";
    const clave = nzItem(limpio);
    return ALIAS_DROP[clave] ?? canon.get(clave) ?? limpio;
  };

  for (const zona of zonas) {
    for (const p of zona.pokemon_salvajes || []) {
      const original = typeof p.drop === "string" ? p.drop : "";
      if (!original.trim()) continue;

      let texto = original.replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();

      // El lado de la isla, antes de tocar nada más: viene pegado al final como
      // "... Semilla Milagro) (Derecha".
      const lado = texto.match(/\)\s*\.?\s*\((Izquierda|Derecha)\s*\)?\s*$/i);
      if (lado) {
        texto = texto.slice(0, lado.index);
        const sufijo = lado[1][0].toUpperCase() + lado[1].slice(1).toLowerCase();
        if (!String(p.metodo || "").includes(sufijo)) p.metodo = `${p.metodo} - ${sufijo}`;
      }

      // "No tiene drop" y todo lo que venga detrás: en una zona ese "detrás"
      // son 1800 caracteres de la ficha del combate.
      // `drop\w*` y no `drop\b`: la guía también escribe "No tiene dropeo".
      const sinDrop = texto.match(/^no\s+tien\w*\s+drop\w*\b(.*)$/i);
      if (sinDrop) {
        const sobrante = sinDrop[1].trim();
        const consejos = sobrante.match(/Consejos de batalla:.*$/is);
        if (consejos) {
          const entrenador = (zona.entrenadores || [])[0];
          if (entrenador && !String(entrenador.notas || "").includes("Consejos de batalla")) {
            entrenador.notas = [entrenador.notas, consejos[0].trim()].filter(Boolean).join(" ");
            rescatados.push({ zona: zona.zona, entrenador: entrenador.nombre, largo: consejos[0].length });
          }
        }
        if (p.drop !== "No tiene drop.") {
          cambios.push({ zona: zona.zona, antes: original, despues: "No tiene drop." });
          p.drop = "No tiene drop.";
        }
        continue;
      }

      // El verbo, en la única forma que usa el resto del JSON.
      texto = texto.replace(/^(?:puede\s+)?drop\w*\s*/i, "");

      // Todos los separadores a tres centinelas, para poder partir sin
      // arrastrar las quince formas en que la guía escribe "y raramente".
      // El orden importa: "muy raramente" tiene que casar antes que "raramente".
      texto = texto
        .replace(/\s*[,.;]?\s*(?:y\s*[,.]?\s*)?muy\s+rar\w*\s+/gi, MUY)
        .replace(/\s*[,.;]?\s*(?:y\s*[,.]?\s*)?(?:m[aá]s\s+)?rar\w*\s+/gi, RARO)
        .replace(/\s*,\s*y\s+/gi, MAS)
        .replace(/\s+y\s+/gi, MAS)
        .replace(/\s*,\s*/g, MAS);

      const normales = [];
      const raros = [];
      const muyRaros = [];
      let cubo = normales;
      for (const trozo of texto.split(SEPARADORES)) {
        if (trozo === MUY) cubo = muyRaros;
        else if (trozo === RARO) cubo = raros;
        else if (trozo === MAS) {
          // Una conjunción no cambia de rareza: "Perla y Perla Grande" son las
          // dos igual de comunes.
        } else {
          const nombre = nombreObjeto(trozo);
          if (nombre) cubo.push(nombre);
        }
      }
      if (normales.length === 0 && raros.length === 0 && muyRaros.length === 0) continue;

      const colas = [];
      if (raros.length > 0) colas.push(`raramente ${raros.join(" y ")}`);
      if (muyRaros.length > 0) colas.push(`muy raramente ${muyRaros.join(" y ")}`);

      let frase = normales.length > 0 ? `Dropea ${normales.join(" y ")}` : "Dropea";
      // Con una sola cola va con "y"; con dos, coma y "y" al final — que es
      // como está escrita la mayoría. Sin objeto común no hay nada que enlazar:
      // "Dropea raramente Garra Rápida", no "Dropea y raramente...".
      if (colas.length === 1) frase += normales.length > 0 ? ` y ${colas[0]}` : ` ${colas[0]}`;
      else if (colas.length > 1) frase += `, ${colas.slice(0, -1).join(", ")} y ${colas[colas.length - 1]}`;
      frase = `${frase.replace(/\s+/g, " ").trim()}.`;

      if (frase !== original) {
        cambios.push({ zona: zona.zona, antes: original, despues: frase });
        p.drop = frase;
      }
    }
  }

  return { cambios, rescatados };
}

/** Nombre de zona sin tildes, sin puntuación y en mayúsculas, para comparar. */
function normalizarZona(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Reescribe `conexiones` al nombre EXACTO de la zona destino.
 *
 * El render las pinta como botones y hace `zones.find(z => z.zona === c)`: si no
 * coincide carácter por carácter el botón sale deshabilitado. El .docx original
 * escribía los destinos en Título Sin Tildes ("Pueblo Bodegon") mientras que los
 * títulos de zona van en mayúsculas y acentuados ("PUEBLO BODEGÓN"), así que 138
 * de 330 conexiones no se podían clicar.
 *
 * Tres pasadas, de más a menos estricta:
 *   1. coincidencia exacta — ya estaba bien, no se toca.
 *   2. normalizada — resuelve tildes, mayúsculas y basurilla ("PUEBLO SANGUINO:").
 *   3. prefijo por palabra completa — "Torre Oscura" -> "TORRE OSCURA (7º MEDALLA)".
 *      El límite de palabra es lo que impide que "Ruta 22" caiga en "Ruta 2".
 *      Si hay varias candidatas gana la primera del JSON, que es la primera a la
 *      que llegas jugando ("Bosque Ladera" -> "BOSQUE LADERA ZONA 1").
 */
function resolverConexiones(zonas) {
  const exactos = new Set(zonas.map((z) => z.zona));
  const porNorm = new Map();
  for (const z of zonas) {
    const k = normalizarZona(z.zona);
    if (!porNorm.has(k)) porNorm.set(k, z.zona);
  }
  const cambiadas = [];
  const irresolubles = [];
  const retiradas = [];

  for (const zona of zonas) {
    if (!Array.isArray(zona.conexiones)) continue;
    zona.conexiones = zona.conexiones.filter((c) => {
      const fuera = CONEXIONES_ESPURIAS.some((e) => e.zona === zona.zona && e.destino === c);
      if (fuera) retiradas.push({ de: zona.zona, destino: c });
      return !fuera;
    });
    zona.conexiones = zona.conexiones.map((c) => {
      if (typeof c !== "string" || exactos.has(c)) return c;
      const k = CONEXIONES_ALIAS[normalizarZona(c)] ?? normalizarZona(c);
      const directo = porNorm.get(normalizarZona(k));
      if (directo) {
        cambiadas.push({ de: zona.zona, antes: c, ahora: directo });
        return directo;
      }
      const prefijo = normalizarZona(k) + " ";
      const candidata = zonas.find((z) => normalizarZona(z.zona).startsWith(prefijo));
      if (candidata) {
        cambiadas.push({ de: zona.zona, antes: c, ahora: candidata.zona });
        return candidata.zona;
      }
      irresolubles.push({ de: zona.zona, destino: c });
      return c;
    });
  }
  return { cambiadas, irresolubles, retiradas };
}

/** Sufijos de variante regional del romhack, para derivar la especie base. */
const VARIANT_SUFFIXES = [
  / Z$/,
  / Regional$/,
  / (?:de )?Galar$/,
  / (?:de )?Alola$/,
  / (?:de )?Hisui$/,
  / (?:de )?Paldea$/,
  /^Mega /,
];

// --- parser -----------------------------------------------------------------

/**
 * Parte un nombre sucio en sus campos. Devuelve siempre `nombre`; el resto de
 * las claves solo aparecen si el texto las traía.
 */
export function parseNombre(raw) {
  let s = String(raw).trim();
  const out = {};

  // Basura de OCR antes del porcentaje: "cc10% Chansey".
  s = s.replace(/^[a-z]{1,3}(?=\d)/, "");

  // Drop: "(Dropea X y raramente Y)" / "(No tiene drop)".
  const drop = s.match(/\((Dropea[^)]*|No tiene drop)\)\s*\.?/i);
  if (drop) {
    out.drop = drop[1].trim();
    s = s.replace(drop[0], " ");
  }

  // Porcentaje. Puede venir al inicio ("14% Mime Jr.") o después del nombre
  // ("Luvdisc 70%"), y puede ser una lista por dificultad ("18-14-10-5%").
  const pct = s.match(/(?:^|\s)(\d{1,3}(?:-\d{1,3})*)\s*%/);
  if (pct) {
    out.porcentaje = `${pct[1]}%`;
    s = s.replace(pct[0], " ");
  }

  // Nivel relativo en vez de numérico: "Excadrill, a un nivel menos que la
  // media de nivel de tu equipo". No hay número que extraer, va entero a nota.
  const relativo = s.match(/,\s*(a un nivel\b[^.]*)\.?\s*$/i);
  if (relativo) {
    out.nota = [relativo[1].trim(), out.nota].filter(Boolean).join(" · ");
    s = s.slice(0, relativo.index);
  }

  // Nivel. En el tramo final de la guía se escribe sin la palabra ("Starmie,
  // al 95."), así que la coma vale como ancla igual que "nivel". Todo lo que
  // venga después son movimientos o restos de otra fila de la tabla: se guarda
  // como nota en vez de descartarlo o clasificarlo mal.
  const nivel = s.match(/[,\s]*nivel\s*(\d+)\s*\.?\s*/i) ?? s.match(/,\s*al\s*(\d+)\s*\.?\s*/i);
  if (nivel) {
    out.nivel = nivel[1];
    const resto = s.slice(nivel.index + nivel[0].length).trim();
    if (resto) out.nota = resto.replace(/^[.,\s]+/, "").trim();
    s = s.slice(0, nivel.index);
  }

  // Tipos entre paréntesis pegados al nombre: "(Psíquico Veneno)",
  // "(Normal/Fantasma)". Solo cuentan si están al final de lo que queda,
  // para no confundirlos con el "(Hada)" de un movimiento.
  const tipos = s.match(/\s*\(([^)]+)\)\s*$/);
  if (tipos) {
    const partes = tipos[1].split(/[\/\s]+/).filter(Boolean);
    const esTipos = partes.length <= 2 && partes.every((p) => /^[A-ZÁÉÍÓÚ][a-záéíóúñ]+$/.test(p));
    if (esTipos) {
      out.tipos = partes;
      s = s.slice(0, tipos.index);
    } else {
      // "(fakemon)", "(disfrazado de Gengar)", "(fakemon, insignia)"...
      out.nota = [tipos[1].trim(), out.nota].filter(Boolean).join(" · ");
      s = s.slice(0, tipos.index);
    }
  }

  // Puntuación sobrante. El punto final se respeta en "Mime Jr.".
  s = s.replace(/[\s:,]+$/, "").trim();
  if (!/\b(?:Jr|Sr)\.$/.test(s)) s = s.replace(/\.$/, "").trim();
  s = s.replace(/\s+/g, " ");

  // La Pokédex Z escribe las formas regionales sin preposición ("Muk Alola",
  // "Voltorb Hisui"), pero la guía alterna "Zigzagoon Galar" y "Zigzagoon de
  // Galar" para la misma especie. Se unifica al estilo de la Pokédex.
  s = s.replace(/\sde\s(Galar|Alola|Hisui|Paldea)$/i, " $1");

  if (ALIAS[s]) {
    const nota = ALIAS_NOTE[s];
    if (nota) out.nota = [nota, out.nota].filter(Boolean).join(" · ");
    s = ALIAS[s];
  }

  if (NOMBRE_UNIFICADO[s]) s = NOMBRE_UNIFICADO[s];

  out.nombre = s;
  return out;
}

/**
 * Especie base de la que tomar el sprite, para variantes del romhack que no
 * tienen entrada propia en la Pokédex Z. Devuelve null si el nombre ya
 * resuelve o si no hay base conocida.
 */
export function findSpriteBase(nombre, dexIndex) {
  // Va antes del match por nombre a propósito: algunos casos resuelven contra
  // la Pokédex pero contra la entrada equivocada (ver "Porygon Z" arriba).
  if (SPRITE_BASE_OVERRIDE[nombre]) return SPRITE_BASE_OVERRIDE[nombre];
  if (dexIndex.has(normalize(nombre))) return null;

  const candidatos = [];
  for (const suffix of VARIANT_SUFFIXES) {
    if (suffix.test(nombre)) candidatos.push(nombre.replace(suffix, "").trim());
  }
  // "Zigzagoon de Galar" -> "Zigzagoon Galar": la Pokédex escribe la forma sin
  // preposición, y si tampoco existe se cae a la especie base por el bucle.
  const sinDe = nombre.replace(/\sde\s(Galar|Alola|Hisui|Paldea)$/, " $1");
  if (sinDe !== nombre) candidatos.unshift(sinDe);

  for (const c of candidatos) {
    if (c && dexIndex.has(normalize(c))) return c;
    // dos niveles: "Solosis Z (ya sin tipos)" -> "Solosis"; "Raichu Regional" -> "Raichu"
    for (const suffix of VARIANT_SUFFIXES) {
      const cc = c.replace(suffix, "").trim();
      if (cc && cc !== c && dexIndex.has(normalize(cc))) return cc;
    }
  }
  return null;
}

// --- objetos ----------------------------------------------------------------
//
// El array `objetos` de cada zona es un cajón de sastre: además de objetos trae
// notas narrativas, la tabla de conversiones de Pueblo Petroglifo, el inicial
// que le toca al rival, y equipos de entrenador sueltos. Acá se reparte cada
// cosa a su sitio y se arreglan los nombres que traen dos objetos pegados o la
// descripción del objeto metida dentro del nombre.

/** Objetos del juego, para distinguir un nombre real de una frase suelta. */
function indexarItems(items) {
  const lista = Array.isArray(items) ? items : Object.values(items);
  const set = new Set();
  for (const i of lista) {
    if (i.name) set.add(nzItem(i.name));
    if (i.namePlural) set.add(nzItem(i.namePlural));
  }
  return set;
}

/** Normalización agresiva: la guía escribe "Superball" donde el juego pone "Super Ball". */
const nzItem = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** La guía escribe entero algún nombre que el juego abrevia. */
const ALIAS_ITEM = {
  florrepelentepequena: "florreppequena",
  florrepelentegrande: "florrepgrande",
  florrepelentemaxima: "florrepmaxima",
};

const sinCantidad = (n) =>
  n.replace(/\s*[([]?\s*[xX]\s*\d+\s*[)\]]?\s*$/, "").replace(/\s*\(\s*\d+\s*\)\s*$/, "").trim();

function esItem(n, itemIndex) {
  const base = nzItem(sinCantidad(String(n)));
  return Boolean(base) && (itemIndex.has(base) || itemIndex.has(ALIAS_ITEM[base] ?? ""));
}

/**
 * Reparte los `objetos` de una zona. Devuelve las listas nuevas y un recuento
 * de qué se movió, sin descartar nada: todo termina en algún campo.
 */
function repartirObjetos(zona, itemIndex) {
  const objetos = [];
  const notas = [];
  const conversiones = [];
  const inicialRival = [];
  const stats = { divididos: 0, separados: 0, notas: 0, conversiones: 0, inicial: 0, equipos: 0 };

  for (const o of zona.objetos || []) {
    const n = String(o.nombre ?? "").trim();
    if (!n) continue;

    // "Si tu inicial es TIPO PLANTA" -> detalle "Froakie, al nivel 5."
    const ini = n.match(/^Si tu inicial es\s+(?:TIPO\s+)?(.+?)\s*$/i);
    if (ini) {
      inicialRival.push({ siTuInicial: ini[1].trim(), detalle: String(o.detalle ?? "").trim() });
      stats.inicial++;
      continue;
    }

    // Tabla del conversor de Pueblo Petroglifo: "Raticate a Raticate Alola."
    const conv = n.match(/^([A-ZÁÉÍÓÚ][\wáéíóúñ'-]*(?:\s+[A-Z0-9][\wáéíóúñ'-]*)?)\s+a\s+([^.(]+?)\.?\s*(\(.*\))?\s*$/);
    if (conv && !esItem(n, itemIndex)) {
      conversiones.push({
        de: conv[1].trim(),
        a: conv[2].trim(),
        ...(conv[3] ? { nota: conv[3].replace(/^\(|\)$/g, "").trim() } : {}),
      });
      stats.conversiones++;
      continue;
    }

    // Equipos de entrenador sueltos ("Ralts, nivel 11."): se quedan donde están
    // a propósito — reconstruir a qué entrenador pertenecen exige el PDF.
    if (/,?\s*nivel\s*\d+|,\s*al\s*\d+/i.test(n) && !esItem(n, itemIndex)) {
      stats.equipos++;
      objetos.push(o);
      continue;
    }

    // Frases largas que describen la zona, no un objeto.
    if (!esItem(n, itemIndex) && n.length > 60 && !/^Arbustos?\s+de\s+[Bb]ayas/i.test(n)) {
      const nombreCorto = n.match(/^([^.""“”]{2,40})["""“”.]\s*(.+)$/);
      if (nombreCorto && esItem(nombreCorto[1], itemIndex)) {
        // "Pokévial. Nos sirve para..." -> el nombre estaba pegado a su descripción.
        objetos.push({
          nombre: nombreCorto[1].trim(),
          detalle: [nombreCorto[2].trim(), o.detalle].filter(Boolean).join(" ").trim(),
        });
        stats.separados++;
        continue;
      }
      notas.push([n, o.detalle].filter(Boolean).join(" ").trim());
      stats.notas++;
      continue;
    }

    // Nombre corto con la descripción pegada: 'Frasco Cristalino" En la papelera...'
    const pegado = n.match(/^([^.""“”]{2,40})["""“”.]\s*(.+)$/);
    if (pegado && esItem(pegado[1], itemIndex) && !esItem(n, itemIndex)) {
      objetos.push({
        nombre: pegado[1].trim(),
        detalle: [pegado[2].trim(), o.detalle].filter(Boolean).join(" ").trim(),
      });
      stats.separados++;
      continue;
    }

    // "Pelaje Fino y Madera" -> dos objetos que comparten ubicación.
    const partes = n.split(/\s+y\s+/i);
    if (partes.length === 2 && !esItem(n, itemIndex) && partes.every((p) => esItem(p, itemIndex))) {
      for (const p of partes) objetos.push({ ...o, nombre: p.trim() });
      stats.divididos++;
      continue;
    }

    objetos.push(o);
  }

  return { objetos, notas, conversiones, inicialRival, stats };
}

// --- entrenadores del PDF ---------------------------------------------------
//
// data-src/entrenadores-pdf.json trae las secciones "Entrenadores <zona>" que
// la extracción del .docx nunca reconoció (ver extraer-entrenadores-pdf.mjs).
// Acá se fusionan con lo que ya hay en la zona, y se retiran de
// `pokemon_salvajes` las entradas que en realidad eran de esos entrenadores.

/** Clave para comparar un Pokémon entre las dos fuentes: especie + nivel. */
const claveMon = (especie, nivel) => `${normalize(String(especie))}|${String(nivel ?? "").trim()}`;

/**
 * Convierte una línea del PDF ("Solosis Z (Psíquico Veneno), nivel 16.
 * Confusión, Luz Decadente (Hada)") en un TrainerMon, reutilizando el mismo
 * parser que limpia los nombres de salvajes.
 */
function monDesdeLineaPdf(linea, dexIndex) {
  const p = parseNombre(linea);
  const mon = {
    especie: p.nombre,
    nivel: p.nivel ?? "",
    objeto: "No especificado",
    habilidad: "No especificada",
    naturaleza: null,
    // Lo que sigue al nivel en la guía son los movimientos del Pokémon.
    movimientos: p.nota ? p.nota.split(/\s*,\s*/).filter(Boolean) : [],
  };
  // Salvo cuando el nivel es relativo ("a un nivel menos que la media de nivel
  // de tu equipo"): eso no es un movimiento, es lo único que se sabe del nivel.
  if (!p.nivel && /^a un nivel\b/i.test(p.nota ?? "")) {
    mon.movimientos = [];
    mon.nota = p.nota;
  }
  if (p.tipos) mon.tipos = p.tipos;
  const base = findSpriteBase(mon.especie, dexIndex);
  if (base) mon.spriteBase = base;
  return mon;
}

/**
 * Añade a la zona los entrenadores del PDF que no estén ya presentes, y quita
 * de `pokemon_salvajes` los Pokémon que les pertenecen.
 *
 * Un salvaje se considera "de entrenador" solo si cumple las dos condiciones:
 * no tiene porcentaje de aparición (los salvajes de verdad siempre lo traen) y
 * coincide en especie + nivel con algún miembro de los equipos de la zona. Así
 * no se toca ningún encuentro legítimo que además indique nivel.
 */

/**
 * Un equipo "de lista": el .docx solo dejó especie y nivel, sin objeto,
 * habilidad ni movimientos. Es la firma de los entrenadores menores que se
 * extrajeron de una lista con bullets, y donde el PDF es mejor fuente porque sí
 * conserva a qué entrenador pertenece cada línea — en Torre Prisma el .docx le
 * había colgado a "Mosquetero Antonio" los Pokémon de otros dos entrenadores.
 */
function esEquipoDeLista(t) {
  if (t.equipo_fuente) return false;
  return (t.equipo || []).every(
    (m) =>
      (!m.objeto || m.objeto === "No especificado") &&
      (!m.habilidad || m.habilidad === "No especificada") &&
      !m.naturaleza
  );
}

function fusionarEntrenadoresPdf(zona, seccion, dexIndex) {
  const porNombre = new Map(
    (zona.entrenadores || []).map((t) => [normalize(String(t.nombre ?? "").replace(/[:.]\s*$/, "")), t])
  );
  const yaEstan = new Set(porNombre.keys());
  const nuevos = [];
  const reasignados = [];

  for (const e of seccion.entrenadores) {
    const nombre = e.nombre.replace(/[:.]\s*$/, "").trim();
    const existente = porNombre.get(normalize(nombre));
    if (existente) {
      // Solo se pisa el equipo si es una lista pelada Y el PDF discrepa: así no
      // se toca ningún equipo con tabla propia ni se reescribe en cada pasada.
      const delPdf = e.equipo.map((l) => monDesdeLineaPdf(l, dexIndex));
      const iguales =
        (existente.equipo || []).length === delPdf.length &&
        delPdf.every((m, i) => claveMon(m.especie, m.nivel) === claveMon(existente.equipo[i]?.especie, existente.equipo[i]?.nivel));
      if (esEquipoDeLista(existente) && !iguales) {
        reasignados.push({ nombre, antes: (existente.equipo || []).length, ahora: delPdf.length });
        existente.equipo = delPdf;
        existente.equipo_fuente = "pdf_guia_oficial";
      }
      continue;
    }
    // También contra los ya añadidos en esta misma pasada: una zona con varios
    // bloques en el PDF puede repetir un entrenador entre ellos.
    yaEstan.add(normalize(nombre));
    nuevos.push({
      tipo: "menor",
      nombre,
      equipo: e.equipo.map((l) => monDesdeLineaPdf(l, dexIndex)),
      equipo_fuente: "pdf_guia_oficial",
    });
  }

  // Índice de todo lo que pelean los entrenadores de la zona, nuevos y viejos.
  const deEntrenador = new Set();
  for (const t of [...(zona.entrenadores || []), ...nuevos]) {
    for (const m of t.equipo || []) deEntrenador.add(claveMon(m.especie, m.nivel));
  }

  const salvajes = [];
  const retirados = [];
  for (const p of zona.pokemon_salvajes || []) {
    const esFalso = !p.porcentaje && p.nivel && deEntrenador.has(claveMon(p.nombre, p.nivel));
    if (esFalso) retirados.push(p.nombre);
    else salvajes.push(p);
  }

  return { nuevos, salvajes, retirados, reasignados };
}

// --- entrenadores -----------------------------------------------------------

/**
 * Algunos equipos traen miembros como string suelto ("Butterfree, nivel 37.")
 * en vez del objeto TrainerMon. Hoy esos se renderizan vacíos, porque la
 * tarjeta lee `m.especie` y `m.nivel`. Se convierten al objeto con los mismos
 * marcadores de "sin dato" que ya usa el resto del archivo.
 */
function toTrainerMon(value) {
  if (typeof value !== "string") return value;
  const parsed = parseNombre(value);
  return {
    especie: parsed.nombre,
    nivel: parsed.nivel ?? "",
    objeto: "No especificado",
    habilidad: "No especificada",
    naturaleza: null,
    movimientos: parsed.nota ? [parsed.nota] : [],
  };
}

function fixTrainerTeam(equipo) {
  return equipo.map(toTrainerMon);
}

const zonaCoincide = (patron, zona) =>
  patron instanceof RegExp ? patron.test(zona) : patron === zona;

/** ¿Este entrenador está marcado importante sin serlo? */
function debeSerMenor(nombre) {
  if (typeof nombre !== "string") return false;
  const limpio = nombre.replace(/[:.]\s*$/, "").trim();
  if (RECLASIFICAR_MENOR.nombres.includes(limpio)) return true;
  return RECLASIFICAR_MENOR.patrones.some((p) => p.test(limpio));
}

/** Devuelve la especie recuperada para este miembro de equipo, o null. */
function especieRecuperada(mon, zona) {
  const regla = ESPECIE_RECUPERADA.find(
    (r) => r.alias === mon.especie && r.nivel === mon.nivel && zonaCoincide(r.zona, zona)
  );
  return regla ? regla.especie : null;
}

// --- main -------------------------------------------------------------------

async function main() {
  let zonaNueva = null;
  const zonas = JSON.parse(await leerCrudo());

  // Se añade al final por ser contenido de postgame.
  if (!zonas.some((z) => z.zona === ZONA_COLUMNA_LANZA.zona)) {
    zonas.push(structuredClone(ZONA_COLUMNA_LANZA));
    zonaNueva = ZONA_COLUMNA_LANZA.zona;
  }

  // Subsecciones: van justo detrás de su zona madre para no romper el orden de
  // juego, del que dependen el recuento de páginas y el panel de próxima
  // batalla.
  const subsecciones = [];
  for (const sub of ZONAS_SUBSECCION) {
    if (zonas.some((z) => z.zona === sub.zona)) continue;
    const madre = sub.conexiones[0];
    const at = zonas.findIndex((z) => z.zona === madre);
    zonas.splice(at < 0 ? zonas.length : at + 1, 0, structuredClone(sub));
    subsecciones.push(sub.zona);
  }

  const faro = zonas.find((z) => z.zona === MUDANZA_FARO.destino);
  const ruta23 = zonas.find((z) => z.zona === MUDANZA_FARO.origen);
  const mudados = [];
  if (faro && ruta23) {
    for (const nombre of MUDANZA_FARO.objetos) {
      const i = (ruta23.objetos || []).findIndex((o) => o.nombre === nombre);
      if (i < 0) continue;
      faro.objetos.push(ruta23.objetos.splice(i, 1)[0]);
      mudados.push(nombre);
    }
    for (const numero of MUDANZA_FARO.mts) {
      const i = (ruta23.mts || []).findIndex((m) => String(m.numero).trim() === numero);
      if (i < 0) continue;
      faro.mts.push(ruta23.mts.splice(i, 1)[0]);
      mudados.push(numero);
    }
  }
  const dex = JSON.parse(await readFile(DEX, "utf8"));

  const dexIndex = new Set();
  for (const e of dex) {
    if (e.name) dexIndex.add(normalize(e.name));
    if (e.internalName) dexIndex.add(normalize(e.internalName));
  }

  const cambios = [];
  const sinResolver = [];
  const conBase = new Map();
  // Miembros de equipo cuya `especie` no es un Pokémon pero que sí traen
  // nivel/objeto/habilidad/movimientos completos: la extracción del .docx
  // corrió una columna y la especie real se perdió. No se tocan — recuperarla
  // exige la guía original, y borrarlos perdería un Pokémon entero del equipo.
  const especieCorrida = [];
  const recuperadas = [];
  const rivales = [];
  const degradados = [];
  const marcadosSecuencia = [];
  const equiposEnObjetos = [];
  const objetosStats = {};
  const fusionPdf = [];
  const notasPartidas = [];
  const habitantes = { creados: [], renombrados: [] };
  const coleccion = { mts: [], movimientos: [], alquimias: [], espurias: [], adicionales: [], principales: [], espuriasAlquimia: [] };
  const itemIndex = indexarItems(JSON.parse(await readFile(ITEMS, "utf8")));
  // Una zona puede abrir varios bloques de "Entrenadores:" en el PDF (El Arma
  // Definitiva tiene tres, uno por mazmorra). Con un Map plano solo sobrevivía
  // el último y los demás se perdían en silencio: se concatenan.
  const entrenadoresPdf = new Map();
  for (const s of JSON.parse(await readFile(ENTRENADORES_PDF, "utf8"))) {
    const previo = entrenadoresPdf.get(s.zona);
    if (previo) previo.entrenadores.push(...s.entrenadores);
    else entrenadoresPdf.set(s.zona, { ...s, entrenadores: [...s.entrenadores] });
  }
  let salvajes = 0;

  // Antes del bucle a propósito: los salvajes de cueva tienen que pasar por la
  // misma normalización de nombres y asignación de spriteBase que el resto
  // ("Marowak Z", "Parasect Z" no existen en la Pokédex por su nombre).
  const cuevas = volcarSalvajesDeCueva(
    zonas,
    JSON.parse(await readFile(SALVAJES_CUEVA_PDF, "utf8")).listas
  );

  // Justo después del volcado: lo que decide si una línea de nota sobra es que
  // el mismo encuentro ya esté en `pokemon_salvajes`, así que la lista tiene
  // que estar completa antes de mirar. Y antes del bucle, porque lo que sube
  // desde las notas necesita pasar por la normalización de nombres como todo
  // lo demás.
  const tablas = limpiarTablasDeNotas(zonas);

  // Después de las tablas: los salvajes que suben desde las notas traen su drop
  // en el formato viejo ("Puede dropear “X”") y tienen que pasar por aquí.
  //
  // El recuento no baja a cero al repetir la pasada, y es correcto: los ~130
  // salvajes de cueva se reimportan crudos desde salvajes-cueva-pdf.json en
  // cada ejecución (ver volcarSalvajesDeCueva, justo arriba), así que hay que
  // volver a normalizarlos siempre. El archivo resultante sí sale idéntico.
  const drops = normalizarDrops(zonas, JSON.parse(await readFile(ITEMS, "utf8")));

  // También antes del bucle: los equipos rescatados necesitan pasar por la
  // asignación de spriteBase igual que el resto ("Parasect Z" no existe en la
  // Pokédex por su nombre).
  const rescate = rescatarEntrenadoresDeObjetos(zonas);

  for (const zona of zonas) {
    for (const p of zona.pokemon_salvajes || []) {
      salvajes++;
      const antes = p.nombre;
      if (typeof antes !== "string") continue;

      const rescate = SALVAJE_RECUPERADO.find(
        (r) => r.nombre === antes && zonaCoincide(r.zona, zona.zona)
      );
      if (rescate) {
        p.nombre = rescate.especie;
        recuperadas.push({ zona: zona.zona, antes, especie: rescate.especie, tipo: "salvaje" });
        continue;
      }

      const parsed = parseNombre(antes);

      // Los campos extraídos solo se escriben si el original estaba vacío: la
      // columna propia de la tabla manda sobre lo que venía dentro del nombre.
      if (parsed.nombre !== antes) cambios.push({ zona: zona.zona, antes, despues: parsed });
      p.nombre = parsed.nombre;
      if (parsed.nivel) p.nivel = parsed.nivel;
      if (parsed.tipos) p.tipos = parsed.tipos;
      if (parsed.nota) p.nota = parsed.nota;
      if (parsed.porcentaje && !p.porcentaje) p.porcentaje = parsed.porcentaje;
      if (parsed.drop && !p.drop) p.drop = parsed.drop;

      const base = findSpriteBase(p.nombre, dexIndex);
      if (base) {
        p.spriteBase = base;
        conBase.set(p.nombre, base);
      } else if (!dexIndex.has(normalize(p.nombre))) {
        sinResolver.push({ zona: zona.zona, nombre: p.nombre, antes });
      }
    }

    // MTs: quitar las filas espurias, añadir las que faltaban y completar los
    // nombres de movimiento cortados.
    for (const esp of MTS_ESPURIAS.filter((e) => e.zona === zona.zona)) {
      const antes = (zona.mts || []).length;
      zona.mts = (zona.mts || []).filter((m) => normalize(String(m.numero)) !== normalize(esp.numero));
      const quitadas = antes - zona.mts.length;
      if (quitadas) coleccion.espurias.push({ zona: zona.zona, numero: esp.numero, n: quitadas });
    }

    for (const mt of MTS_FALTANTES.filter((m) => m.zona === zona.zona)) {
      zona.mts = zona.mts || [];
      const yaEsta = zona.mts.some((x) => normalize(String(x.numero)) === normalize(mt.numero));
      if (!yaEsta) {
        zona.mts.push({ numero: mt.numero, movimiento: mt.movimiento, contexto: mt.contexto });
        coleccion.mts.push({ zona: zona.zona, numero: mt.numero, movimiento: mt.movimiento });
      }
    }
    for (const mt of zona.mts || []) {
      const completo = MTS_MOVIMIENTO_CORREGIDO[String(mt.numero).trim()];
      if (completo && mt.movimiento !== completo) {
        coleccion.movimientos.push({ numero: mt.numero, de: mt.movimiento, a: completo });
        mt.movimiento = completo;
      }
    }

    const alquimia = ALQUIMIAS_FALTANTES.find((a) => a.zona === zona.zona);
    if (alquimia && !zona.pagina_alquimia?.presente) {
      zona.pagina_alquimia = { presente: true, descripcion: alquimia.descripcion };
      coleccion.alquimias.push({ zona: zona.zona });
    }

    const espuria = ALQUIMIAS_ESPURIAS.find((a) => a.zona === zona.zona);
    if (espuria && zona.pagina_alquimia) {
      const texto = zona.pagina_alquimia.descripcion;
      delete zona.pagina_alquimia;
      if (espuria.mover && texto && !(zona.notas_generales || []).includes(texto)) {
        zona.notas_generales = [...(zona.notas_generales || []), texto];
      }
      coleccion.espuriasAlquimia.push({ zona: zona.zona });
    }

    const extra = ALQUIMIAS_ADICIONALES.find((a) => a.zona === zona.zona);
    if (extra && zona.pagina_alquimia?.presente) {
      // Asignación, no append: cada zona tiene exactamente una adicional, y así
      // corregir el texto aquí reemplaza el de una pasada anterior en vez de
      // acumular una tercera página fantasma.
      const previas = zona.pagina_alquimia.adicionales ?? [];
      if (previas.length !== 1 || previas[0] !== extra.descripcion) {
        zona.pagina_alquimia.adicionales = [extra.descripcion];
        coleccion.adicionales.push({ zona: zona.zona });
      }
      if (extra.principal && zona.pagina_alquimia.descripcion !== extra.principal) {
        zona.pagina_alquimia.descripcion = extra.principal;
        coleccion.principales.push({ zona: zona.zona });
      }
    }

    // Habitantes de Pueblo Acrílico: completar nombre y función desde el
    // listado oficial de la guía, y crear los que faltaban.
    const habitante = HABITANTES_ACRILICO.find((h) => h.zona === zona.zona);
    if (habitante) {
      const previo = zona.habitante_acrilico;
      const nombreViejo = previo?.nombre;
      zona.habitante_acrilico = {
        nombre: habitante.nombre,
        funcion: habitante.funcion,
        ...(habitante.cantidad ? { cantidad: habitante.cantidad } : {}),
        // El detalle que ya tuviera la zona describe cómo reclutarlo y suele
        // ser más específico que el del listado: solo se usa el del listado
        // cuando no había nada.
        ...(previo?.detalle || habitante.detalle
          ? { detalle: previo?.detalle ?? habitante.detalle }
          : {}),
      };
      if (!previo) habitantes.creados.push({ zona: zona.zona, nombre: habitante.nombre });
      else if (nombreViejo !== habitante.nombre) {
        habitantes.renombrados.push({ zona: zona.zona, de: nombreViejo, a: habitante.nombre });
      }
    }

    // Objetos: repartir a su campo propio lo que no es un objeto.
    if (Array.isArray(zona.objetos)) {
      const r = repartirObjetos(zona, itemIndex);
      zona.objetos = r.objetos;
      if (r.notas.length) zona.notas_generales = [...(zona.notas_generales || []), ...r.notas];
      if (r.conversiones.length) zona.conversiones = r.conversiones;
      if (r.inicialRival.length) zona.inicial_rival = r.inicialRival;
      for (const [k, v] of Object.entries(r.stats)) objetosStats[k] = (objetosStats[k] || 0) + v;
      if (r.stats.equipos) equiposEnObjetos.push({ zona: zona.zona, n: r.stats.equipos });
    }

    // Entrenadores que la extracción del .docx nunca creó, y los Pokémon suyos
    // que habían acabado en la lista de salvajes.
    const seccionPdf = entrenadoresPdf.get(zona.zona);
    if (seccionPdf) {
      const f = fusionarEntrenadoresPdf(zona, seccionPdf, dexIndex);
      if (f.nuevos.length) zona.entrenadores = [...(zona.entrenadores || []), ...f.nuevos];
      if (f.retirados.length) zona.pokemon_salvajes = f.salvajes;
      if (f.nuevos.length || f.retirados.length || f.reasignados.length) {
        fusionPdf.push({
          zona: zona.zona,
          nuevos: f.nuevos.length,
          retirados: f.retirados.length,
          reasignados: f.reasignados,
        });
      }
    }

    const secuencia = SECUENCIAS.find((s) => s.zona === zona.zona);

    for (const t of zona.entrenadores || []) {
      if (!Array.isArray(t.equipo)) continue;

      if (secuencia) {
        const limpio = (t.nombre || "").replace(/[:.]\s*$/, "").trim();
        const idx = secuencia.orden.indexOf(limpio);
        if (idx >= 0) {
          t.secuencia = secuencia.nombre;
          t.ordenSecuencia = idx + 1;
          marcadosSecuencia.push({ secuencia: secuencia.nombre, orden: idx + 1, nombre: limpio });
        }
      }

      // Los equipos de los rivales se reescriben enteros desde el PDF: lo que
      // había era el equipo del primer combate duplicado en todas sus
      // apariciones (ver equipos-melia.mjs y equipos-crisanto.mjs).
      const partida = NOTAS_PARTIDAS.find(
        (p) =>
          normalize(p.entrenador) === normalize(String(t.nombre ?? "").replace(/[:.]\s*$/, "")) &&
          (!p.zona || p.zona === zona.zona)
      );
      if (partida) {
        // Se conserva el prefijo de curativos, que lo pone la fusión de rivales.
        const curativos = String(t.notas ?? "").match(/^Tiene disponible[^.]*\./);
        t.notas = [curativos?.[0], partida.notas].filter(Boolean).join(" ").trim();
        if (!t.notas) delete t.notas;
        t.procedencia = partida.procedencia;
        notasPartidas.push({ zona: zona.zona, nombre: t.nombre });
      }

      if (t.tipo === "importante" && debeSerMenor(t.nombre)) {
        degradados.push({ zona: zona.zona, nombre: t.nombre });
        t.tipo = "menor";
      }

      const rival = RIVALES.find((r) => r.patron.test(t.nombre || ""));
      if (rival) {
        const real = rival.equipos.find((e) => e.zona === zona.zona);
        if (real) {
          rivales.push({
            rival: t.nombre.replace(/[:.]\s*$/, ""),
            zona: zona.zona,
            antes: t.equipo.length,
            despues: real.equipo.length,
            pagina: real.pagina,
          });
          t.equipo = real.equipo.map((m) => ({ ...m, movimientos: [...m.movimientos] }));
          t.equipo_fuente = `pdf_guia_oficial_p${real.pagina}`;
          if (real.curativos) {
            // Se quitan las copias previas antes de anteponerla: si no, cada
            // pasada de --apply acumulaba otra línea de curativos.
            const resto = String(t.notas ?? "").split(real.curativos).join(" ").replace(/\s+/g, " ").trim();
            t.notas = [real.curativos, resto].filter(Boolean).join(" ");
          }
        }
      }

      t.equipo = fixTrainerTeam(t.equipo);
      for (const mon of t.equipo) {
        if (typeof mon.especie !== "string") continue;

        const rescate = especieRecuperada(mon, zona.zona);
        if (rescate) {
          recuperadas.push({ zona: zona.zona, entrenador: t.nombre, antes: mon.especie, especie: rescate, tipo: "entrenador" });
          mon.especie = rescate;
        }

        const parsed = parseNombre(mon.especie);
        if (parsed.nombre !== mon.especie) {
          cambios.push({ zona: zona.zona, antes: mon.especie, despues: parsed, tipo: "entrenador" });
          mon.especie = parsed.nombre;
          if (parsed.nota) mon.nota = [mon.nota, parsed.nota].filter(Boolean).join(" · ");
        }
        const base = findSpriteBase(mon.especie, dexIndex);
        if (base) {
          mon.spriteBase = base;
          conBase.set(mon.especie, base);
        } else if (!dexIndex.has(normalize(mon.especie))) {
          const completo = mon.nivel && (mon.movimientos || []).length > 0;
          if (completo) especieCorrida.push({ zona: zona.zona, entrenador: t.nombre, mon });
          else sinResolver.push({ zona: zona.zona, nombre: mon.especie, antes: mon.especie, tipo: "entrenador" });
        }
      }
    }
  }

  // Al final: necesita la lista de zonas ya completa (ZONA_COLUMNA_LANZA se
  // añade al principio de esta función, pero podría añadirse alguna más).
  const conexiones = resolverConexiones(zonas);

  // Antes de anotar requisitos: el detector lee los textos ya normalizados.
  const movsZ = JSON.parse(await readFile(MOVES_Z, "utf8"));
  const movimientosValidos = new Set(
    (Array.isArray(movsZ) ? movsZ : Object.values(movsZ)).flatMap((m) =>
      [m.name, m.internalName].filter(Boolean).map((n) =>
        String(n).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
      )
    )
  );
  cargarPropios(dex);
  const normalizado = normalizarTextos(zonas, movimientosValidos);
  // Erratas tipográficas en campos estructurados de especie. Se corrigen en
  // la pasada reproducible para que `build-data` no las vuelva a introducir.
  const nombresEspecieCorregidos = new Map([
    ["Breeloom", "Breloom"],
    ["Vespiqueen", "Vespiquen"],
    ["Froatzel", "Floatzel"],
    ["Honchcrow", "Honchkrow"],
    ["Mabostiff", "Mabosstiff"],
    ["Golisopodt", "Golisopod"],
    ["Overqwill", "Overqwil"],
  ]);
  let especiesCorregidas = 0;
  for (const zona of zonas) {
    for (const pokemon of zona.pokemon_salvajes) {
      const corregido = nombresEspecieCorregidos.get(pokemon.nombre);
      if (corregido) { pokemon.nombre = corregido; especiesCorregidas += 1; }
    }
    for (const entrenador of zona.entrenadores) for (const pokemon of entrenador.equipo) {
      const corregido = nombresEspecieCorregidos.get(pokemon.especie);
      if (corregido) { pokemon.especie = corregido; especiesCorregidas += 1; }
    }
    zona.capturas = zona.capturas?.map((nombre) => {
      const corregido = nombresEspecieCorregidos.get(nombre);
      if (corregido) especiesCorregidas += 1;
      return corregido ?? nombre;
    });
  }
  const bosses = marcarBosses(zonas, dexIndex);
  const arcos = marcarArcos(zonas);
  const separadores = marcarSeparadores(zonas);
  const opcionales = marcarOpcionales(zonas);
  // Después de marcarArcos: hasta aquí no se sabe qué zonas son arcos.
  const sacadosDeArco = sacarEntrenadoresDeArcos(zonas);
  // Después de fusionar el PDF y de rescatar los equipos huérfanos: hasta aquí
  // no está completa la lista de entrenadores a la que enganchar los consejos.
  const consejos = moverConsejosDeBatalla(zonas);
  // Después de moverConsejosDeBatalla: así los consejos que venían de `objetos`
  // ya están puestos y estos no los pisan.
  const reparto = repartirNotasDeCombate(zonas);
  const partidos = unirConsejosPartidos(zonas);
  const intercambiados = intercambiarConsejos(zonas);
  const aclarados = aclararConsejos(zonas);
  const sospechas = revisarConsejosVsEquipo(zonas);
  const notasEntrenador = limpiarNotasDeEntrenadores(zonas);
  const notasEspurias = limpiarNotasEspuriasDeEntrenador(zonas);

  const requisitos = anotarRequisitos(zonas);

  informe({
    APPLY,
    aclarados,
    arcos,
    bosses,
    cambios,
    coleccion,
    conBase,
    conexiones,
    consejos,
    cuevas,
    degradados,
    drops,
    equiposEnObjetos,
    especieCorrida,
    especiesCorregidas,
    fusionPdf,
    habitantes,
    intercambiados,
    marcadosSecuencia,
    mudados,
    normalizado,
    notasEntrenador,
    notasEspurias,
    notasPartidas,
    objetosStats,
    opcionales,
    partidos,
    reparto,
    requisitos,
    rescate,
    recuperadas,
    rivales,
    sacadosDeArco,
    salvajes,
    separadores,
    sinResolver,
    sospechas,
    subsecciones,
    tablas,
    zonaNueva,
  });
  preserveGuideIds(zonas, JSON.parse(await readFile(GUIA, "utf8")));
  if (!APPLY) {
    console.log("\nDry-run. Nada escrito. Usa --apply para guardar.");
    return;
  }

  await writeFile(GUIA, JSON.stringify(zonas, null, 2) + "\n", "utf8");
  console.log(`\n✓ Escrito ${GUIA}`);
}

main().catch((err) => {
  console.error("\n✗ Falló la limpieza:", err);
  process.exit(1);
});
