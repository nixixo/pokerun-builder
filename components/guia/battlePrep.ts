// components/guia/battlePrep.ts
//
// Lógica pura (sin JSX) para la sección "preparación de batalla" del
// banner de próxima batalla importante:
//   1. Encontrar el jefe anterior más cercano (para acotar el tramo).
//   2. Calcular debilidades compartidas + stat más floja del equipo rival.
//   3. Puntuar qué Pokémon salvajes del tramo conviene usar contra él.
//
// Todo funciona con "cobertura parcial": si una especie no matchea en
// pokemon_z_completo.json, se excluye del cálculo en silencio a nivel
// de cada función, pero se cuenta y se expone en el resultado para que
// la UI pueda avisar "cobertura parcial: faltan datos de X, Y".

import { computeTeamDefenseProfile } from "../team-builder/utils/defensiveCalculations";
import type { Zone } from "./types";
import type { PokeType } from "./typeChart";
import { ALL_TYPES, getEffectiveness } from "./typeChart";
import { reglasDeCombate } from "./reglasCombate";
import { TYPE_RELATIONS } from "./typeRelations";
import type { PasoEvolucion } from "./useEvolutions";
import type { SpeciesInfo } from "./useSpeciesData";
import type { Starter } from "./useStarterChoice";
import { equipoSegunInicial } from "./useStarterChoice";

// Tipo indexado en vez de importar un named export "Trainer" que no
// confirmé que exista en types.ts — así siempre queda sincronizado con
// la forma real de zone.entrenadores[i].
type Trainer = Zone["entrenadores"][number];

export const STAT_KEYS = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABEL_ES: Record<StatKey, string> = {
  HP: "PS",
  ATK: "Ataque",
  DEF: "Defensa",
  "SP.ATK": "At. Especial",
  "SP.DEF": "Def. Especial",
  SPE: "Velocidad",
};

/**
 * Habilidades que cambian de hecho una stat defensiva, con el factor que se
 * aplica a la stat base antes de compararlas entre sí.
 *
 * Solo entran las que multiplican de forma incondicional: Intimidación baja el
 * ataque del RIVAL (no sube su defensa) y Multiescamas o Fortaleza dependen de
 * los PS o del estado, así que promediarlas engañaría igual que no hacer nada.
 */
const HABILIDAD_MULTIPLICA: Record<string, Partial<Record<StatKey, number>>> = {
  "pelaje recio": { DEF: 2 }, // parte a la mitad el daño físico
  "coraza guardia": { DEF: 2 }, // idem, en el romhack aparece como "Contra-Guardia"
  "contra-guardia": { DEF: 2 },
};

function multiplicadorPorHabilidad(habilidad: string | undefined, key: StatKey): number {
  if (!habilidad) return 1;
  const clave = habilidad.trim().toLowerCase();
  return HABILIDAD_MULTIPLICA[clave]?.[key] ?? 1;
}

/** Jefe anterior más cercano hacia atrás desde activeIndex (o null si no hay). */
export function findPreviousImportantBattle(zones: Zone[], activeIndex: number) {
  for (let i = activeIndex - 1; i >= 0; i--) {
    const trainer = zones[i].entrenadores.find((t) => t.tipo === "importante");
    if (trainer) return { zoneIndex: i, zone: zones[i], trainer };
  }
  return null;
}

export type RivalAnalysis = {
  sharedWeaknesses: { type: PokeType; count: number }[];
  weakestStats: { key: StatKey; label: string; avg: number }[]; // las 2 más flojas, ascendente
  ace: { name: string; level: number; types: PokeType[] } | null;
  aceWeaknesses: PokeType[];
  // Con qué pega el rival: sus tipos, con cuántos miembros los llevan. Es lo
  // que decide si un candidato, por potente que sea, va a durar dos turnos.
  attackTypes: { type: PokeType; count: number }[];
  /** Suma de stats media del equipo rival. 0 si no hay stats de nadie. */
  bstMedio: number;
  /**
   * Este combate se juega con la tabla de tipos invertida. Sale de las notas
   * del propio entrenador (ver reglasCombate.ts) y se expone aquí para que
   * quien consuma el análisis calcule con la misma regla — si no, el banner
   * diría una cosa y las recomendaciones la contraria.
   */
  inverso: boolean;
  matchedCount: number;
  unmatchedNames: string[];
};

/** Debilidades compartidas + 2 stats promedio más flojas + análisis del "as" (mayor nivel) de un entrenador. */
export function analyzeRivalTeam(
  trainer: Trainer,
  getSpeciesInfo: (name: string, hints?: { tipos?: string[]; spriteBase?: string }) => SpeciesInfo | null,
  inicial: Starter | null = null
): RivalAnalysis {
  // Lo primero: con qué reglas se pelea esto. Todo lo de abajo depende.
  const { inverso } = reglasDeCombate(trainer);

  const matched: SpeciesInfo[] = [];
  const unmatchedNames: string[] = [];

  // Los miembros con `condicion` son variantes de una misma ranura (el rival
  // lleva un inicial que depende del tuyo, así que hay tres versiones y solo se
  // enfrenta una). Contarlas todas triplicaría esa ranura en las debilidades
  // compartidas y en el promedio de stats, sesgando el análisis hacia los tipos
  // de los iniciales.
  //
  // Con `inicial` elegido ya se sabe cuál de las tres es, así que entra en el
  // análisis como un miembro más — que es justo el punto de preguntarlo.
  const equipoFijo = inicial
    ? equipoSegunInicial(trainer.equipo, inicial)
    : trainer.equipo.filter((m) => !m.condicion);

  // Se guarda el par info+mon y no solo la info: el promedio de stats necesita
  // saber qué habilidad lleva CADA miembro (ver `multiplicadorPorHabilidad`).
  const matchedConMon: { info: SpeciesInfo; mon: Trainer["equipo"][number] }[] = [];
  for (const m of equipoFijo) {
    const info = getSpeciesInfo(m.especie, { spriteBase: m.spriteBase });
    if (info) {
      matched.push(info);
      matchedConMon.push({ info, mon: m });
    } else unmatchedNames.push(m.especie);
  }

  // Debilidades compartidas: tipos atacantes donde 2+ miembros reciben >= 2x.
  const weaknessCounts: Partial<Record<PokeType, number>> = {};
  for (const atk of ALL_TYPES) {
    let count = 0;
    for (const info of matched) {
      if (getEffectiveness(atk, info.types, inverso) >= 2) count++;
    }
    if (count >= 2) weaknessCounts[atk] = count;
  }
  const sharedWeaknesses = Object.entries(weaknessCounts)
    .map(([type, count]) => ({ type: type as PokeType, count: count as number }))
    .sort((a, b) => b.count - a.count);

  // Las 2 stats promedio más flojas (solo entre los que tienen stats cargados).
  //
  // Con la stat BASE a secas el consejo puede salir al revés: el Furfrou Boss
  // lleva Pelaje Recio, que parte a la mitad el daño físico — su defensa real
  // es el doble de la que dice la Pokédex, y sin corregirlo la guía recomienda
  // justo pegarle por donde más aguanta.
  const withStats = matchedConMon.filter((p) => p.info.stats !== null);
  let weakestStats: RivalAnalysis["weakestStats"] = [];
  if (withStats.length > 0) {
    const averages = STAT_KEYS.map((key) => ({
      key,
      label: STAT_LABEL_ES[key],
      avg: Math.round(
        withStats.reduce((sum, p) => sum + (p.info.stats![key] ?? 0) * multiplicadorPorHabilidad(p.mon.habilidad, key), 0) /
          withStats.length
      ),
    }));
    weakestStats = averages.sort((a, b) => a.avg - b.avg).slice(0, 2);
  }

  // El "as" del equipo: el de MAYOR NIVEL. Esto no depende de que matchee
  // en pokemon_z_completo.json (m.nivel siempre viene del JSON de zonas),
  // así que casi siempre hay un as identificado aunque falten datos de
  // especie — en ese caso simplemente no se pueden calcular sus debilidades.
  // `nivel` viene del JSON como string: hay que pasarlo a número ANTES de
  // comparar, o la comparación es lexicográfica y "9" > "10" — con lo que el
  // "as" del equipo salía mal en cualquier rival con niveles de 2 cifras.
  const aceMember = equipoFijo.reduce<{ member: (typeof trainer.equipo)[number]; level: number } | null>(
    (best, m) => {
      const level = Number.parseInt(m.nivel, 10);
      if (!Number.isFinite(level)) return best;
      return best === null || level > best.level ? { member: m, level } : best;
    },
    null
  );
  const aceInfo = aceMember ? getSpeciesInfo(aceMember.member.especie) : null;
  const ace = aceMember && aceInfo ? { name: aceMember.member.especie, level: aceMember.level, types: aceInfo.types } : null;
  const aceWeaknesses = ace ? ALL_TYPES.filter((atk) => getEffectiveness(atk, ace.types, inverso) >= 2) : [];

  // Con qué ataca el rival. Se toman sus TIPOS y no sus movimientos a
  // propósito: los movimientos de cobertura son medio equipo y darían por
  // amenazado casi cualquier candidato, mientras que el STAB es lo que de
  // verdad pega fuerte y lo que uno mira al elegir con quién plantarse.
  const attackCounts: Partial<Record<PokeType, number>> = {};
  for (const info of matched) {
    for (const t of info.types) attackCounts[t] = (attackCounts[t] ?? 0) + 1;
  }
  const attackTypes = Object.entries(attackCounts)
    .map(([type, count]) => ({ type: type as PokeType, count: count as number }))
    .sort((a, b) => b.count - a.count);

  // Con cuánta stat viene el rival. Es la vara para decidir si un candidato es
  // "potente" DE VERDAD aquí: 500 puntos son mucho contra un jefe de tramo 1 y
  // poco contra un Alto Mando, así que un umbral fijo se equivoca en los dos
  // extremos.
  const conBst = matched.filter((info) => info.stats !== null);
  const bstMedio =
    conBst.length === 0
      ? 0
      : Math.round(
          conBst.reduce((s, info) => s + STAT_KEYS.reduce((t, k) => t + (info.stats![k] ?? 0), 0), 0) / conBst.length
        );

  return {
    sharedWeaknesses,
    weakestStats,
    ace,
    aceWeaknesses,
    attackTypes,
    bstMedio,
    inverso,
    matchedCount: matched.length,
    unmatchedNames,
  };
}

/** Forma a la que llega un candidato dentro del tope de nivel del tramo. */
export type FormaAlcanzable = {
  /** Especie final ("Garchomp"). Igual al nombre capturado si no evoluciona a tiempo. */
  nombre: string;
  /** Los pasos que hay que dar desde lo que capturas hasta esa forma. */
  pasos: PasoEvolucion[];
  /** Nivel al que queda completa la cadena, o null si ningún paso depende del nivel. */
  nivel: number | null;
  /** Algún paso pide objeto, intercambio o condición rara — no basta con subir de nivel. */
  necesitaAlgoMas: boolean;
};

/** Suma de stats por debajo de la cual un Pokémon no suma nada por potencia. */
const PODER_BASE = 400;
/** Tope del descuento por ser débil al rival, para que un x4 no borre a nadie del todo. */
const RIESGO_MAXIMO = 30;
/**
 * Cuánto puede mover el ranking el hecho de que un candidato tape un agujero de
 * TU equipo. Topado a propósito y por debajo del peso de la ventaja de tipo
 * contra el rival: la pregunta de esta lista sigue siendo "qué me sirve para
 * este combate", y lo del equipo es un criterio de desempate con sentido, no el
 * criterio principal.
 */
const ENCAJE_MAXIMO = 18;
const ENCAJE_MINIMO = -12;
/** A partir de aquí se considera que el Pokémon vale por sus stats, no por su tipo. */
export const BST_POTENTE = 500;

export type LineaPorNivel = {
  /** Formas a las que llegas subiendo de nivel sin pasarte del tope (las de más adelante en la línea). */
  alcanzables: { nombre: string; nivel: number }[];
  /** El primer salto que el tope deja fuera, si lo hay. Es el dato que dice "esta vez no llegas". */
  bloqueada: { nombre: string; nivel: number } | null;
  /** Evoluciona, pero por objeto/intercambio/felicidad — el tope no pinta nada ahí. */
  porOtraVia: PasoEvolucion[];
};

/**
 * La línea evolutiva de una especie leída SOLO por nivel, que es lo único que
 * el tope del tramo puede frenar. Pensada para la ficha de un salvaje: dice a
 * qué llegas antes del próximo jefe y, si te quedas corto, a qué no.
 *
 * Las evoluciones por piedra o intercambio salen aparte en `porOtraVia`: se
 * pueden hacer al nivel que sea, así que ni entran ni se bloquean por el tope.
 */
export function lineaPorNivel(
  especie: string,
  cap: number,
  pasosDesde: (nombre: string) => PasoEvolucion[]
): LineaPorNivel {
  const alcanzadas = new Map<string, number>(); // nombre -> nivel al que llega
  const vistas = new Set([especie.toLowerCase()]);
  let bloqueada: { nombre: string; nivel: number } | null = null;
  const porOtraVia: PasoEvolucion[] = [];
  let frontera = [especie];

  for (let profundidad = 0; profundidad < 3 && frontera.length > 0; profundidad++) {
    const siguiente: string[] = [];
    for (const nombre of frontera) {
      for (const paso of pasosDesde(nombre)) {
        if (paso.nivel === null) {
          if (profundidad === 0) porOtraVia.push(paso);
          continue;
        }
        if (paso.nivel > cap) {
          if (!bloqueada || paso.nivel < bloqueada.nivel) bloqueada = { nombre: paso.a, nivel: paso.nivel };
          continue;
        }
        if (vistas.has(paso.a.toLowerCase())) continue;
        vistas.add(paso.a.toLowerCase());
        alcanzadas.set(paso.a, paso.nivel);
        siguiente.push(paso.a);
      }
    }
    frontera = siguiente;
  }

  // Solo interesan las puntas de la línea: si llegas a Garchomp, decir también
  // "y a Gabite" sobra. Punta = ninguna evolución suya entra dentro del tope.
  const alcanzables = [...alcanzadas.entries()]
    .filter(([nombre]) => !pasosDesde(nombre).some((p) => p.nivel !== null && p.nivel <= cap))
    .map(([nombre, nivel]) => ({ nombre, nivel }))
    .sort((a, b) => a.nivel - b.nivel);

  return { alcanzables, bloqueada, porOtraVia };
}

export type CaptureCandidate = {
  name: string;
  // Se arrastra desde el JSON de la zona porque la tarjeta del candidato
  // también necesita resolver el sprite, y las variantes del romhack
  // ("Solosis Z") no existen en la Pokédex Z con ese nombre.
  spriteBase?: string;
  // Tipos de la forma que se puntúa (`evolucion?.nombre ?? name`), no siempre
  // los de lo que capturas: un Magikarp puntúa como Gyarados si el tope del
  // tramo llega al 20, porque es con Gyarados con quien vas a pelear.
  types: PokeType[];
  zoneNames: string[]; // en qué zona(s) del tramo aparece
  offensiveHits: PokeType[]; // debilidades COMPARTIDAS del rival a las que este candidato pega x2
  hitsAce: boolean; // además, ¿le pega x2 específicamente al as (mayor nivel)?
  score: number;
  /** Solo si de verdad evoluciona antes del combate; si no, se omite. */
  evolucion?: FormaAlcanzable;
  /** Suma de stats base de la forma puntuada. 0 si no hay stats cargadas. */
  bst: number;
  /** A cuántos miembros del equipo rival les pega x2 con sus tipos. */
  golpeaA: number;
  /** Tipos del rival que le pegan x2 o más. Vacío si aguanta bien a todo el equipo. */
  enRiesgo: PokeType[];
  /** Está recomendado por sus stats y no por ventaja de tipo. */
  porPoder: boolean;
  /** Tipos a los que TU equipo es débil y este candidato resiste (o es inmune). */
  tapaHuecos: PokeType[];
  /** Debilidades de tu equipo que este candidato agravaría. */
  empeora: PokeType[];
};

export type CandidatePoolResult = {
  candidates: CaptureCandidate[];
  unmatchedNames: string[];
};

/**
 * Todas las formas a las que llega `especie` sin pasarse del tope del tramo,
 * ella misma incluida. Los pasos que no dependen del nivel (piedras,
 * intercambios) NO los bloquea el tope: se pueden hacer al nivel que sea, así
 * que entran y se marcan aparte con `necesitaAlgoMas` para poder avisar.
 *
 * Anchura antes que profundidad y `vistas` compartido: las cadenas ramifican
 * (Eevee tiene ocho salidas) y hay pares que se repiten por método, así que sin
 * el corte se recorrería lo mismo muchas veces.
 */
function formasAlcanzables(
  especie: string,
  cap: number,
  pasosDesde: (nombre: string) => PasoEvolucion[]
): FormaAlcanzable[] {
  const salida: FormaAlcanzable[] = [{ nombre: especie, pasos: [], nivel: null, necesitaAlgoMas: false }];
  const vistas = new Set([especie.toLowerCase()]);
  let frontera = salida.slice();

  // Tres saltos es el máximo real de una línea evolutiva; el límite además
  // corta en seco cualquier ciclo que se cuele en los datos.
  for (let profundidad = 0; profundidad < 3 && frontera.length > 0; profundidad++) {
    const siguiente: FormaAlcanzable[] = [];
    for (const forma of frontera) {
      for (const paso of pasosDesde(forma.nombre)) {
        if (paso.nivel !== null && paso.nivel > cap) continue;
        if (vistas.has(paso.a.toLowerCase())) continue;
        vistas.add(paso.a.toLowerCase());
        siguiente.push({
          nombre: paso.a,
          pasos: [...forma.pasos, paso],
          nivel: paso.nivel !== null ? Math.max(paso.nivel, forma.nivel ?? 0) : forma.nivel,
          necesitaAlgoMas: forma.necesitaAlgoMas || paso.nivel === null,
        });
      }
    }
    salida.push(...siguiente);
    frontera = siguiente;
  }

  return salida;
}

/**
 * Junta los Pokémon salvajes de todas las zonas entre (excl.) el jefe
 * anterior y (excl.) la zona del próximo jefe, deduplica por especie, y
 * puntúa cada uno según:
 *   - cuántas debilidades COMPARTIDAS del rival puede explotar (STAB),
 *     ponderado por severidad (a cuántos miembros afecta cada una).
 *   - un bonus fijo si además le pega x2 específicamente al AS del
 *     equipo (el de mayor nivel) — importa aunque esa debilidad no sea
 *     "compartida" por el resto, porque el as suele ser el que más
 *     cuesta abajo en la práctica.
 */
export function buildCaptureCandidates(
  zones: Zone[],
  fromIndexExclusive: number, // índice del jefe anterior, o -1 si no hay
  toIndexExclusive: number, // índice de la zona del próximo jefe
  rivalWeaknesses: { type: PokeType; count: number }[],
  aceWeaknesses: PokeType[],
  getSpeciesInfo: (name: string, hints?: { tipos?: string[]; spriteBase?: string }) => SpeciesInfo | null,
  // Tope de nivel del tramo y tabla de evoluciones. Sin ellos el cálculo sigue
  // funcionando exactamente como antes: cada salvaje se puntúa por lo que es al
  // capturarlo, sin mirar a qué evoluciona.
  cap: number = 0,
  pasosDesde: (nombre: string) => PasoEvolucion[] = () => [],
  // Tipos con los que pega el rival, para descontar a quien vaya a comerse un
  // x2. Sin esto solo se premia atacar bien, y se acaba recomendando algo que
  // cae de un golpe.
  rivalAttackTypes: { type: PokeType; count: number }[] = [],
  // Los tipos de TU equipo del Builder, si lo hay. Con ellos la lista deja de
  // recomendar en el vacío: entre dos candidatos igual de buenos contra el
  // rival, sube el que además tapa un agujero que hoy nadie cubre. Vacío =
  // exactamente el comportamiento de antes.
  equipoTipos: string[][] = [],
  // Suma de stats media del rival. Es la vara de "potente": ver `umbralPoder`.
  rivalBstMedio = 0,
  // El combate se pelea con la tabla de tipos invertida (Regente Hibis y su
  // revancha). Sin esto la lista recomendaría justo lo contrario de lo que
  // sirve. Sale de `analyzeRivalTeam`, que lo lee de las notas del entrenador.
  inverso = false
): CandidatePoolResult {
  const seen = new Map<string, CaptureCandidate>();
  const unmatched = new Set<string>();
  const weaknessTypes = new Set(rivalWeaknesses.map((w) => w.type));
  const aceWeaknessTypes = new Set(aceWeaknesses);
  // Bonus fijo por golpear al as — calibrado para que pese más que
  // cualquier debilidad compartida individual (que suma count*10, y
  // count rara vez pasa de ~4-5 en un equipo de 6), así el as siempre
  // empuja el ranking hacia arriba sin necesariamente dominarlo del todo.
  const ACE_HIT_BONUS = 25;

  // "Potente" no es un número fijo: 500 de stats es enorme contra el jefe del
  // primer tramo y del montón contra un Alto Mando. Se mide contra el propio
  // rival, y por eso un Steelix de 510 deja de colarse en una lista donde el
  // enemigo es un Furfrou de 472 — no lo supera en nada que se note.
  const umbralPoder = Math.max(BST_POTENTE, rivalBstMedio + 40);

  // Los agujeros REALES del equipo. Con el `reduces` de scorePokemonCandidate
  // bastaba con que un solo miembro fuera débil, y en un equipo de dos eso lo
  // cumple casi cualquier tipo: el bonus dejaba de distinguir nada. Un agujero
  // es que sufran dos, o que nadie tenga con qué responder.
  const perfilEquipo =
    equipoTipos.length > 0 ? computeTeamDefenseProfile(equipoTipos, TYPE_RELATIONS) : null;
  const huecosEquipo: PokeType[] = perfilEquipo
    ? ALL_TYPES.filter((t) => {
        const p = perfilEquipo[t];
        if (!p) return false;
        return p.weak >= 2 || (p.weak >= 1 && p.resist === 0 && p.immune === 0);
      })
    : [];

  const puntuar = (types: PokeType[], stats: SpeciesInfo["stats"]) => {
    const offensiveHits = types.filter((t) => weaknessTypes.has(t));
    const hitsAce = types.some((t) => aceWeaknessTypes.has(t));
    const sharedScore = offensiveHits.reduce((sum, t) => {
      const w = rivalWeaknesses.find((x) => x.type === t);
      return sum + (w?.count ?? 0) * 10;
    }, 0);

    // Un Garchomp, un Tyranitar o un Metagross valen aunque no tengan ventaja
    // de tipo: pegan más fuerte y aguantan más que cualquier cosa que se
    // atrape en la ruta. La escala arranca en 400 (por debajo no aporta nada)
    // y da 10 por cada 100 de más, así que un 600 vale 20 puntos — lo mismo
    // que explotar una debilidad que sufren dos miembros del equipo rival.
    const bst = stats ? STAT_KEYS.reduce((s, k) => s + (stats[k] ?? 0), 0) : 0;
    const poder = Math.max(0, Math.round((bst - PODER_BASE) / 10));

    // Y el descuento por lo contrario: de nada sirve pegar fuerte si el equipo
    // rival te pega x2 a ti. Topado, porque si no un doble x4 hunde a un
    // candidato que por lo demás es el mejor del tramo.
    const enRiesgo = rivalAttackTypes
      .filter(({ type }) => getEffectiveness(type, types, inverso) >= 2)
      .map(({ type }) => type);
    const riesgo = Math.min(
      RIESGO_MAXIMO,
      rivalAttackTypes.reduce((sum, { type, count }) => {
        const eff = getEffectiveness(type, types, inverso);
        return sum + (eff >= 4 ? count * 7 : eff >= 2 ? count * 4 : 0);
      }, 0)
    );

    // A cuántos del equipo rival les entra x2. Se toma el máximo y no la suma
    // porque los dos tipos del candidato pueden estar pegándole al MISMO
    // miembro, y sumarlos diría "pega a 6" en un equipo de tres.
    const golpeaA = offensiveHits.reduce(
      (max, t) => Math.max(max, rivalWeaknesses.find((x) => x.type === t)?.count ?? 0),
      0
    );

    // Qué le aporta a TU equipo: de los agujeros reales, cuáles aguanta este, y
    // a cuáles se suma como un débil más.
    //
    // Estas dos van SIN invertir a propósito, aunque el combate sea inverso: es
    // un criterio de equipo para toda la partida ("me falta quien aguante
    // Hielo"), no para este combate. La inversión solo vale dentro de la Torre
    // Oscura; el agujero sigue ahí cuando sales.
    const tapaHuecos = huecosEquipo.filter((t) => getEffectiveness(t, types) <= 0.5);
    const empeora = huecosEquipo.filter((t) => getEffectiveness(t, types) >= 2);
    const encaje = Math.max(
      ENCAJE_MINIMO,
      Math.min(ENCAJE_MAXIMO, tapaHuecos.length * 6 - empeora.length * 6)
    );

    return {
      offensiveHits,
      hitsAce,
      bst,
      golpeaA,
      enRiesgo,
      tapaHuecos,
      empeora,
      score: sharedScore + (hitsAce ? ACE_HIT_BONUS : 0) + poder - riesgo + encaje,
    };
  };

  for (let i = fromIndexExclusive + 1; i < toIndexExclusive; i++) {
    const zone = zones[i];
    if (!zone) continue;
    for (const p of zone.pokemon_salvajes) {
      const existing = seen.get(p.nombre);
      if (existing) {
        if (!existing.zoneNames.includes(zone.zona)) existing.zoneNames.push(zone.zona);
        continue;
      }
      const info = getSpeciesInfo(p.nombre, { tipos: p.tipos, spriteBase: p.spriteBase });
      if (!info) {
        unmatched.add(p.nombre);
        continue;
      }

      // Solo se sigue la cadena evolutiva de las especies que están en la
      // Pokédex Z con SU nombre. Las variantes del romhack se resuelven por
      // `spriteBase` o traen sus propios `tipos`, y su línea evolutiva no tiene
      // por qué ser la de la especie base: un Solosis Z no evoluciona en el
      // Duosion normal. Antes que inventarla, se deja sin evolución.
      const esVariante = Boolean(p.tipos?.length || p.spriteBase);
      const formas = esVariante
        ? [{ nombre: p.nombre, pasos: [], nivel: null, necesitaAlgoMas: false } as FormaAlcanzable]
        : formasAlcanzables(p.nombre, cap, pasosDesde);

      // Se queda la forma que mejor le venga al combate. A igualdad de puntos
      // gana la que menos pida (nada de mandar a por una piedra si el bicho de
      // base ya sirve igual) y, entre esas, la más evolucionada: si llegas de
      // todas formas, llegas con mejores stats.
      let mejor: { forma: FormaAlcanzable; info: SpeciesInfo; puntos: ReturnType<typeof puntuar> } | null = null;
      for (const forma of formas) {
        const formaInfo =
          forma.pasos.length === 0 ? info : getSpeciesInfo(forma.nombre);
        if (!formaInfo) continue;
        const puntos = puntuar(formaInfo.types, formaInfo.stats);
        const mejorEs =
          mejor === null ||
          puntos.score > mejor.puntos.score ||
          (puntos.score === mejor.puntos.score &&
            (Number(forma.necesitaAlgoMas) < Number(mejor.forma.necesitaAlgoMas) ||
              (forma.necesitaAlgoMas === mejor.forma.necesitaAlgoMas &&
                forma.pasos.length > mejor.forma.pasos.length)));
        if (mejorEs) mejor = { forma, info: formaInfo, puntos };
      }
      if (!mejor) continue;

      seen.set(p.nombre, {
        name: p.nombre,
        spriteBase: p.spriteBase,
        types: mejor.info.types,
        zoneNames: [zone.zona],
        offensiveHits: mejor.puntos.offensiveHits,
        hitsAce: mejor.puntos.hitsAce,
        score: mejor.puntos.score,
        evolucion: mejor.forma.pasos.length > 0 ? mejor.forma : undefined,
        bst: mejor.puntos.bst,
        golpeaA: mejor.puntos.golpeaA,
        enRiesgo: mejor.puntos.enRiesgo,
        tapaHuecos: mejor.puntos.tapaHuecos,
        empeora: mejor.puntos.empeora,
        // "Está aquí por sus stats" solo si no aporta ninguna ventaja de tipo:
        // si además explota una debilidad, el motivo que interesa es ese.
        porPoder:
          mejor.puntos.bst >= umbralPoder &&
          mejor.puntos.offensiveHits.length === 0 &&
          !mejor.puntos.hitsAce,
      });
    }
  }

  // Dos motivos válidos para salir en la lista: explotar una debilidad del
  // rival, o ser sencillamente bueno. Lo segundo pide un mínimo de stats —
  // sin él entraría cualquier cosa de 420 que no sea débil a nada, que no es
  // una recomendación, es relleno. El `score > 0` sigue mandando encima de
  // ambos: si el rival le pega x2, no se recomienda por potente que sea.
  const utiles = Array.from(seen.values()).filter(
    (c) => c.score > 0 && (c.offensiveHits.length > 0 || c.hitsAce || c.bst >= umbralPoder)
  );

  // Deduplicar por la forma FINAL y no por lo que se atrapa: en el mismo tramo
  // hay Larvitar y Pupitar, y los dos acaban en Tyranitar — la lista enseñaba
  // dos tarjetas idénticas. Gana la ruta más corta, que es la que de verdad
  // conviene: atrapar el Pupitar te ahorra veinte niveles.
  const porForma = new Map<string, CaptureCandidate>();
  for (const c of utiles) {
    const forma = (c.evolucion?.nombre ?? c.name).toLowerCase();
    const previo = porForma.get(forma);
    if (
      !previo ||
      c.score > previo.score ||
      (c.score === previo.score &&
        (c.evolucion?.pasos.length ?? 0) < (previo.evolucion?.pasos.length ?? 0))
    ) {
      porForma.set(forma, c);
    }
  }

  // En dos niveles, y no por puntuación a secas: quien tiene ventaja de tipo va
  // SIEMPRE antes que quien solo pega fuerte. Con una sola cuenta, un bicho de
  // 510 con dos bonus de encaje adelantaba al que le pega x2 al jefe, y esa
  // lista ya no responde a la pregunta que tiene encima ("con qué me presento a
  // este combate"). La puntuación sigue ordenando dentro de cada nivel.
  const conVentaja = (c: CaptureCandidate) => c.offensiveHits.length > 0 || c.hitsAce;
  const candidates = Array.from(porForma.values())
    .sort((a, b) => Number(conVentaja(b)) - Number(conVentaja(a)) || b.score - a.score)
    .slice(0, 4);

  return { candidates, unmatchedNames: Array.from(unmatched) };
}