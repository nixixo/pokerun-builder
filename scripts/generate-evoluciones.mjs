// scripts/generate-evoluciones.mjs
//
// Congela en data-src/evoluciones.json quién evoluciona en quién, a qué nivel y
// por qué método, para poder decir "si atrapas un Gible, con el cap de nivel de
// este tramo te llega a Garchomp" en las recomendaciones de la guía.
//
// De dónde salen los datos y por qué:
//   La Pokédex Z (data-src/pokemon_z_completo.json) NO trae evoluciones: la
//   extracción se quedó con tipos, stats y learnsets. Tampoco las trae la guía
//   en PDF, que solo las menciona de pasada en acertijos. Así que la cadena
//   evolutiva se toma de los CSV oficiales de PokéAPI — los mismos que alimenta
//   la API REST, pero servidos como archivo plano, sin rate limit ni GraphQL.
//
// LA ADVERTENCIA IMPORTANTE: estos son los niveles del juego OFICIAL. Pokémon Z
// es un romhack y puede haber cambiado alguno. Si aparece una discrepancia, se
// corrige a mano en ANULACIONES (abajo) y se vuelve a correr el script — no se
// edita el JSON generado, que se sobrescribe.
//
// Solo se emiten pares donde AMBAS especies existen en la Pokédex Z: lo que no
// está en el juego no se puede recomendar. Las megaevoluciones quedan fuera a
// propósito (no son una evolución: piden Megapiedra y solo duran el combate).
//
// Uso:  node scripts/generate-evoluciones.mjs
// Volver a correrlo solo si cambia la Pokédex Z o se descubre una errata.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const POKEDEX_Z = join(process.cwd(), "data-src", "pokemon_z_completo.json");
const MOVIMIENTOS_Z = join(process.cwd(), "data-src", "moves_z_completo.json");
const SALIDA = join(process.cwd(), "data-src", "evoluciones.json");

/**
 * Correcciones sobre el dato oficial, para cuando el romhack cambia una
 * evolución. Clave "De>A" (nombres tal cual la Pokédex Z).
 * Poner `null` como valor descarta el par entero.
 */
const ANULACIONES = {
  // "Gible>Gabite": { nivel: 20, metodo: "nivel" },
};

/**
 * Especies de la Pokédex Z cuyo nombre no coincide con el slug de PokéAPI ni
 * normalizando. Clave: slug de PokéAPI. Valor: nombre en la Pokédex Z.
 *
 * Los dos Nidoran NO hacen falta aquí: la Pokédex Z llama "Nidoran" a los dos
 * (solo se distinguen por internalName), y la guía también. Al normalizar, los
 * slugs nidoran-f y nidoran-m caen igualmente en "nidoran", así que el par
 * queda como "Nidoran → Nidorina" y "Nidoran → Nidorino" — que es lo correcto
 * mientras el nombre siga siendo ambiguo aguas arriba.
 */
const ALIAS = {
  "type-null": "Código Cero",
};

/** Disparadores que no son ni nivel, ni objeto, ni intercambio. */
const TRIGGERS_ES = {
  "three-defeated-bisharp": "tras derrotar a 3 Bisharp que lleven Insignia Jefe",
  "gimmighoul-coins": "con 999 Monedas Gimmighoul",
  "use-move": "usando un movimiento concreto",
  "three-critical-hits": "tras 3 golpes críticos en un combate",
  "take-damage": "tras recibir 49 PS de daño y pasar por un sitio concreto",
  "agile-style-move": "usando su movimiento en estilo ágil",
  "strong-style-move": "usando su movimiento en estilo fuerte",
  "recoil-damage": "acumulando daño de retroceso",
  "tower-of-darkness": "en la Torre Tinieblas",
  "tower-of-waters": "en la Torre Aguas",
  spin: "girando con el traje puesto",
  other: "método especial",
};

const DIACRITICOS = /[\u0300-\u036f]/g;
const NO_ALFANUM = /[^a-z0-9]/g;

const nz = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(DIACRITICOS, "").replace(NO_ALFANUM, "");

// ── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Parser mínimo pero con comillas: los nombres de objeto en PokéAPI llevan
 * comas ("Poké Ball, Great") y partir por "," a secas corre las columnas.
 */
function parseCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') entreComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }

  const cabecera = filas.shift();
  return filas
    .filter((f) => f.length === cabecera.length)
    .map((f) => Object.fromEntries(cabecera.map((k, i) => [k, f[i]])));
}

async function bajarCsv(nombre) {
  const res = await fetch(CSV_BASE + nombre);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${nombre}`);
  return parseCsv(await res.text());
}

const num = (v) => (v === "" || v === undefined ? null : Number(v));

// ── Método legible ───────────────────────────────────────────────────────────

/** Nombre presentable de un identifier de PokéAPI: "water-stone" -> "Water Stone". */
const bonito = (slug) =>
  String(slug)
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

/**
 * Traducción de los objetos evolutivos, que son los únicos que hace falta
 * nombrar en la interfaz. Lo que no esté aquí sale en inglés, capitalizado.
 */
const OBJETOS_ES = {
  "fire-stone": "Piedra Fuego",
  "water-stone": "Piedra Agua",
  "thunder-stone": "Piedra Trueno",
  "leaf-stone": "Piedra Hoja",
  "moon-stone": "Piedra Lunar",
  "sun-stone": "Piedra Solar",
  "shiny-stone": "Piedra Día",
  "dusk-stone": "Piedra Noche",
  "dawn-stone": "Piedra Alba",
  "ice-stone": "Piedra Hielo",
  "oval-stone": "Piedra Oval",
  "kings-rock": "Roca del Rey",
  "metal-coat": "Revestimiento Metálico",
  "dragon-scale": "Escama Dragón",
  "up-grade": "Mejora",
  "dubious-disc": "Disco Extraño",
  "protector": "Protector",
  "electirizer": "Electrizador",
  "magmarizer": "Magmarizador",
  "reaper-cloth": "Tela Terrible",
  "prism-scale": "Escama Bella",
  "sachet": "Saquito Fragante",
  "whipped-dream": "Dulce de Nata",
  "razor-claw": "Garra Afilada",
  "razor-fang": "Colmillo Agudo",
  "deep-sea-tooth": "Diente Marino",
  "deep-sea-scale": "Escama Marina",
  "black-augurite": "Mineral Negro",
  "peat-block": "Bloque de Turba",
  "linking-cord": "Cordón Unión",
  "auspicious-armor": "Armadura Auspiciosa",
  "malicious-armor": "Armadura Maldita",
  "syrupy-apple": "Manzana Melosa",
  "tart-apple": "Manzana Ácida",
  "sweet-apple": "Manzana Dulce",
  "cracked-pot": "Tetera Agrietada",
  "chipped-pot": "Tetera Rajada",
  "galarica-cuff": "Brazal Galanuez",
  "galarica-wreath": "Corona Galanuez",
  "strawberry-sweet": "Confite Fresa",
  "berry-sweets": "Confite Baya",
  "metal-alloy": "Aleación Metálica",
  "leaders-crest": "Insignia Jefe",
  "scroll-of-darkness": "Pergamino Tinieblas",
  "scroll-of-waters": "Pergamino Aguas",
  "sun-shard": "Fragmento Solar",
  "moon-shard": "Fragmento Lunar",
};

const objetoEs = (slug) => OBJETOS_ES[slug] ?? bonito(slug);

/**
 * Devuelve { nivel, metodo, objeto }. `nivel` solo se rellena cuando la
 * evolución está de verdad cerrada por nivel — es lo único que el cap del tramo
 * puede bloquear. Todo lo demás (piedras, intercambios, felicidad) se puede
 * hacer al nivel que sea, así que va con nivel null y el requisito en `metodo`.
 *
 * `objeto` sale aparte del texto de `metodo` a propósito: la guía usa esa lista
 * para marcar en cada zona los objetos que sirven para evolucionar algo, y
 * sacar el nombre a base de parsear "intercambio con Roca del Rey" sería
 * quedarse a merced de cómo esté redactada la frase.
 */
function describir(fila, trigger, itemPorId, movPorId) {
  const nivel = num(fila.minimum_level);
  const objetoUso = itemPorId.get(num(fila.trigger_item_id));
  const objetoLlevado = itemPorId.get(num(fila.held_item_id));

  switch (trigger) {
    case "use-item":
      return {
        nivel: null,
        metodo: objetoUso ? objetoEs(objetoUso) : "objeto",
        objeto: objetoUso ? objetoEs(objetoUso) : null,
      };

    case "trade":
      return {
        nivel: null,
        metodo: objetoLlevado ? `intercambio con ${objetoEs(objetoLlevado)}` : "intercambio",
        objeto: objetoLlevado ? objetoEs(objetoLlevado) : null,
      };

    case "shed":
      return { nivel, metodo: "hueco en el equipo y una Poké Ball", objeto: null };

    case "level-up": {
      const extras = [];
      if (num(fila.minimum_happiness) !== null) extras.push("felicidad alta");
      if (num(fila.minimum_beauty) !== null) extras.push("belleza alta");
      if (num(fila.minimum_affection) !== null) extras.push("afecto alto");
      if (fila.time_of_day) extras.push(fila.time_of_day === "night" ? "de noche" : "de día");
      if (objetoLlevado) extras.push(`llevando ${objetoEs(objetoLlevado)}`);
      if (num(fila.known_move_id) !== null) {
        const mov = movPorId.get(num(fila.known_move_id));
        extras.push(mov ? `sabiendo ${mov}` : "sabiendo un movimiento concreto");
      }
      // El sitio NO se nombra a propósito: PokéAPI lista una fila por cada mapa
      // de cada juego donde vale (Glaceon tiene seis), y ninguno de esos mapas
      // es el de este romhack. Nombrarlos daría seis entradas que además
      // mandarían al jugador a un sitio que no existe aquí.
      if (num(fila.location_id) !== null) extras.push("en el sitio especial del mapa");
      if (fila.needs_overworld_rain === "1") extras.push("bajo lluvia");
      if (fila.turn_upside_down === "1") extras.push("con la consola del revés");
      if (fila.relative_physical_stats !== "") extras.push("según Ataque y Defensa");
      if (num(fila.gender_id) !== null) extras.push(num(fila.gender_id) === 1 ? "hembra" : "macho");
      if (num(fila.minimum_move_count) !== null) extras.push("con el movimiento usado varias veces");

      // El objeto que se LLEVA también cuenta como objeto evolutivo: sin la
      // Garra Afilada no hay Weavile, aunque además haga falta subir de nivel.
      const objeto = objetoLlevado ? objetoEs(objetoLlevado) : null;
      if (nivel !== null && extras.length === 0) return { nivel, metodo: "nivel", objeto };
      if (nivel !== null) return { nivel, metodo: `nivel, ${extras.join(" y ")}`, objeto };
      return {
        nivel: null,
        metodo: extras.length ? `subir de nivel ${extras.join(" y ")}` : "subir de nivel",
        objeto,
      };
    }

    default:
      return { nivel, metodo: TRIGGERS_ES[trigger] ?? bonito(trigger), objeto: null };
  }
}

// ── Principal ────────────────────────────────────────────────────────────────

async function main() {
  console.log("Descargando los CSV de PokéAPI...");
  const [especies, evoluciones, triggers, objetos, movimientos] = await Promise.all([
    bajarCsv("pokemon_species.csv"),
    bajarCsv("pokemon_evolution.csv"),
    bajarCsv("evolution_triggers.csv"),
    bajarCsv("items.csv"),
    bajarCsv("moves.csv"),
  ]);

  const triggerPorId = new Map(triggers.map((t) => [num(t.id), t.identifier]));
  const itemPorId = new Map(objetos.map((o) => [num(o.id), o.identifier]));
  // Los movimientos van con el nombre que usa el juego, no el slug en inglés:
  // "sabiendo Poder Pasado" y no "sabiendo Ancient Power". El internalName de la
  // lista del romhack es el slug de PokéAPI en mayúsculas y sin guiones.
  const movimientosZ = JSON.parse(readFileSync(MOVIMIENTOS_Z, "utf8"));
  const zMovPorInternal = new Map(movimientosZ.map((m) => [nz(m.internalName), m.name]));
  const movPorId = new Map(
    movimientos.map((m) => [num(m.id), zMovPorInternal.get(nz(m.identifier)) ?? bonito(m.identifier)])
  );
  const especiePorId = new Map(especies.map((e) => [num(e.id), e.identifier]));

  // Índice de la Pokédex Z: solo formas base (las megas y las variantes Z no
  // son destino ni origen de una evolución normal).
  const pokedex = JSON.parse(readFileSync(POKEDEX_Z, "utf8"));
  const zPorNombre = new Map();
  for (const p of pokedex) {
    if (p.formKind === "mega-rb-script" || p.formKind === "primal-rb-script") continue;
    if (!zPorNombre.has(nz(p.name))) zPorNombre.set(nz(p.name), p.name);
  }

  /** Slug de PokéAPI -> nombre exacto en la Pokédex Z, o null si no está. */
  const enZ = (slug) => {
    const alias = ALIAS[slug];
    if (alias) return zPorNombre.get(nz(alias)) ?? null;
    return zPorNombre.get(nz(slug)) ?? null;
  };

  // La CSV trae una fila por cada forma en que se puede obtener una especie.
  // Los duplicados por version_group son reales (Ursaring cambió en Legends),
  // así que se conservan todos y luego se deduplica por (de, a, metodo).
  const pares = new Map();
  const sinZ = new Set();

  for (const fila of evoluciones) {
    const idHijo = num(fila.evolved_species_id);
    const slugHijo = especiePorId.get(idHijo);
    if (!slugHijo) continue;

    const filaEspecie = especies.find((e) => num(e.id) === idHijo);
    const idPadre = num(filaEspecie?.evolves_from_species_id);
    const slugPadre = idPadre === null ? null : especiePorId.get(idPadre);
    if (!slugPadre) continue;

    const de = enZ(slugPadre);
    const a = enZ(slugHijo);
    if (!de || !a) {
      if (!de) sinZ.add(slugPadre);
      if (!a) sinZ.add(slugHijo);
      continue;
    }

    const trigger = triggerPorId.get(num(fila.evolution_trigger_id)) ?? "other";
    const { nivel, metodo, objeto } = describir(fila, trigger, itemPorId, movPorId);

    const clave = `${de}>${a}>${metodo}`;
    const previo = pares.get(clave);
    // Con varias entradas para el mismo método (una por generación) se queda la
    // de nivel más BAJO: es la que antes deja de estar bloqueada por el cap.
    if (previo && (previo.nivel ?? 999) <= (nivel ?? 999)) continue;
    pares.set(clave, objeto ? { de, a, nivel, metodo, objeto } : { de, a, nivel, metodo });
  }

  let anulados = 0;
  const salida = [];
  for (const par of pares.values()) {
    const anulacion = ANULACIONES[`${par.de}>${par.a}`];
    if (anulacion === null) {
      anulados++;
      continue;
    }
    salida.push(anulacion ? { ...par, ...anulacion } : par);
    if (anulacion) anulados++;
  }
  salida.sort((x, y) => x.de.localeCompare(y.de) || x.a.localeCompare(y.a));

  const conNivel = salida.filter((p) => p.nivel !== null).length;
  console.log(`\nPares emitidos:          ${salida.length}`);
  console.log(`  cerrados por nivel:    ${conNivel}`);
  console.log(`  por objeto/otra cosa:  ${salida.length - conNivel}`);
  console.log(`Anulaciones aplicadas:   ${anulados}`);
  console.log(`Especies fuera de la Pokédex Z: ${sinZ.size}  ${[...sinZ].join(", ")}`);

  writeFileSync(
    SALIDA,
    JSON.stringify(
      {
        fuente: "PokéAPI — data/v2/csv (pokemon_evolution.csv)",
        advertencia:
          "Niveles del juego oficial. Pokémon Z es un romhack: si alguno no coincide, corregirlo en ANULACIONES de scripts/generate-evoluciones.mjs y regenerar.",
        evoluciones: salida,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`\n✓ Escrito ${SALIDA}`);
}

main().catch((err) => {
  console.error("\n✗ Falló la generación de evoluciones:", err.message);
  process.exit(1);
});
