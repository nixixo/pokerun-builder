// components/guia/equipoVsRival.ts
//
// Tu equipo del Builder contra el próximo combate importante: cuál de los seis
// sirve, cuál se muere, y qué le falta al conjunto.
//
// Es la otra mitad de battlePrep.ts. Allí la pregunta es "qué conviene atrapar
// en este tramo"; aquí es "con lo que ya tengo, a quién saco". Comparten la
// tabla de tipos y el RivalAnalysis para no decir dos cosas distintas sobre el
// mismo rival.
//
// Qué NO es: un calculador de daño. El Slot del Builder no guarda nivel, así
// que aquí no hay forma de saber si sobrevives a un golpe. Todo lo que sale de
// aquí es ventaja de tipo, movimientos y stats base — suficiente para decidir a
// quién sacas primero, no para prometer que ganas.
//
// El análisis defensivo del conjunto NO se reimplementa: se llama al del
// Builder (computeTeamDefenseProfile) a través del adaptador de typeRelations.

import { computeTeamDefenseProfile } from "../team-builder/utils/defensiveCalculations";
import type { BaseStats } from "../team-builder/types";
import { STAT_KEYS, STAT_LABEL_ES } from "./battlePrep";
import type { StatKey } from "./battlePrep";
import type { PokeType } from "./typeChart";
import { getEffectiveness } from "./typeChart";
import { relacionesSegunReglas } from "./typeRelations";
import type { MiembroEquipo } from "./useEquipoBuilder";

/** Un miembro del equipo rival, ya resuelto contra la Pokédex Z. */
export type RivalMiembro = {
  nombre: string;
  tipos: PokeType[];
  stats: BaseStats | null;
  nivel: number;
};

export type Veredicto = "clave" | "sirve" | "banquillo" | "peligro";

export const VEREDICTO_LABEL: Record<Veredicto, string> = {
  clave: "Clave",
  sirve: "Sirve",
  banquillo: "Banquillo",
  peligro: "Peligro",
};

export type MiembroContraRival = {
  miembro: MiembroEquipo;
  veredicto: Veredicto;
  puntos: number;
  /** A cuántos del equipo rival les pega x2 o más. */
  golpeaA: number;
  /** El movimiento que castiga a más rivales, para poder decir "con Terremoto". */
  conQue: { nombre: string; tipo: PokeType } | null;
  /** No tiene movimientos cargados en el Builder: se le juzga por sus tipos. */
  soloPorTipo: boolean;
  golpeaAs: boolean;
  /** Tipos del rival (sus STAB) que le pegan x2 o más. */
  enRiesgo: PokeType[];
  /** De esos, los que le entran x4. */
  x4: PokeType[];
  /** null si falta la velocidad de alguno de los dos. */
  masRapidoQueAs: boolean | null;
  /** Sus movimientos de daño van por su stat de ataque más floja. */
  ladoFlojo: "fisico" | "especial" | null;
  /** Ataca por el lado en que el rival aguanta ("muro") o por el que sufre ("bueno"). */
  ladoRival: "bueno" | "muro" | null;
};

export type ResumenEquipo = {
  /** Tipos a los que 2+ miembros son débiles. `loTieneElRival` = además puede explotarlo. */
  debilidades: { tipo: PokeType; cuantos: number; loTieneElRival: boolean }[];
  /** Tipos con los que ataca el rival y que NADIE del equipo resiste ni es inmune. */
  sinRespuesta: PokeType[];
  /** Las 2 medias de stat base más bajas del equipo. */
  statsFlojas: { key: StatKey; label: string; avg: number }[];
  masLentosQueAs: number;
  conStats: number;
};

export type EquipoContraRival = {
  orden: MiembroContraRival[];
  resumen: ResumenEquipo;
};

/** Descuento máximo por ser débil al rival: un x4 no debe borrar a nadie del todo. */
const RIESGO_MAXIMO = 30;
/** Diferencia mínima entre dos stats para considerar que una es "el lado flojo". */
const MARGEN_LADO = 15;

function sumaStats(stats: BaseStats | null): number {
  if (!stats) return 0;
  return STAT_KEYS.reduce((s, k) => s + (stats[k] ?? 0), 0);
}

/**
 * Con qué tipos ataca de verdad un miembro. Manda su set de movimientos: es lo
 * que lo diferencia del recomendador de capturas, que solo puede mirar tipos.
 * Si el Builder no tiene movimientos cargados en esa ranura se cae a sus dos
 * tipos — es una suposición (el STAB que seguro que aprende), y por eso se
 * marca con `soloPorTipo` para poder avisarlo en la interfaz.
 */
function tiposOfensivos(miembro: MiembroEquipo): { tipos: PokeType[]; porMovimiento: Map<PokeType, string>; soloPorTipo: boolean } {
  const porMovimiento = new Map<PokeType, string>();
  for (const m of miembro.movimientos) {
    if (m.categoria === "Status" || !m.tipo) continue;
    if (!porMovimiento.has(m.tipo)) porMovimiento.set(m.tipo, m.nombre);
  }
  if (porMovimiento.size > 0) {
    return { tipos: [...porMovimiento.keys()], porMovimiento, soloPorTipo: false };
  }
  return { tipos: miembro.tipos, porMovimiento, soloPorTipo: true };
}

/** Media de una stat entre los que la tengan cargada. 0 si no la tiene nadie. */
function media(lista: (BaseStats | null)[], key: StatKey): number {
  const conDato = lista.filter((s): s is BaseStats => s !== null);
  if (conDato.length === 0) return 0;
  return Math.round(conDato.reduce((s, st) => s + (st[key] ?? 0), 0) / conDato.length);
}

export function analizarEquipoContraRival(
  miembros: MiembroEquipo[],
  rivales: RivalMiembro[],
  rivalAttackTypes: { type: PokeType; count: number }[],
  as: { nombre: string; tipos: PokeType[]; stats: BaseStats | null } | null,
  // El combate va con la tabla de tipos invertida (Regente Hibis y su revancha).
  // Afecta a todo lo de tipos: a quién golpea cada miembro y qué le entra a él.
  // Lo que NO cambia es la velocidad ni el lado físico/especial.
  inverso = false
): EquipoContraRival {
  // Por dónde conviene pegarle al rival: si su Defensa media es más baja que su
  // Def. Especial, los físicos entran mejor. Con menos de 10 de diferencia no se
  // dice nada — no es una ventaja, es ruido.
  const defMedia = media(rivales.map((r) => r.stats), "DEF");
  const defEspMedia = media(rivales.map((r) => r.stats), "SP.DEF");
  const ladoBlando: "fisico" | "especial" | null =
    defMedia === 0 || defEspMedia === 0 || Math.abs(defMedia - defEspMedia) < 10
      ? null
      : defMedia < defEspMedia
        ? "fisico"
        : "especial";

  const orden: MiembroContraRival[] = miembros.map((miembro) => {
    const { tipos, porMovimiento, soloPorTipo } = tiposOfensivos(miembro);

    // A cuántos rivales castiga cada tipo ofensivo, para quedarse con el que
    // más cubre y poder nombrarlo.
    let golpeaA = 0;
    let mejorTipo: PokeType | null = null;
    for (const t of tipos) {
      const cuantos = rivales.filter((r) => getEffectiveness(t, r.tipos, inverso) >= 2).length;
      if (cuantos > golpeaA) {
        golpeaA = cuantos;
        mejorTipo = t;
      }
    }
    const conQue =
      mejorTipo && porMovimiento.has(mejorTipo)
        ? { nombre: porMovimiento.get(mejorTipo)!, tipo: mejorTipo }
        : null;

    const golpeaAs = as ? tipos.some((t) => getEffectiveness(t, as.tipos, inverso) >= 2) : false;

    const enRiesgo: PokeType[] = [];
    const x4: PokeType[] = [];
    let riesgo = 0;
    for (const { type, count } of rivalAttackTypes) {
      const eff = getEffectiveness(type, miembro.tipos, inverso);
      if (eff >= 4) {
        x4.push(type);
        enRiesgo.push(type);
        riesgo += count * 7;
      } else if (eff >= 2) {
        enRiesgo.push(type);
        riesgo += count * 4;
      }
    }
    riesgo = Math.min(RIESGO_MAXIMO, riesgo);

    const masRapidoQueAs =
      miembro.stats && as?.stats ? miembro.stats.SPE > as.stats.SPE : null;

    // El fallo que nadie avisa: un Pokémon con Ataque alto llevando solo
    // movimientos especiales (o al revés). No es opinión, es su propia hoja de
    // stats contra su propio set.
    let ladoFlojo: "fisico" | "especial" | null = null;
    if (miembro.stats && !soloPorTipo) {
      const fisicos = miembro.movimientos.filter((m) => m.categoria === "Physical" && m.tipo).length;
      const especiales = miembro.movimientos.filter((m) => m.categoria === "Special" && m.tipo).length;
      const atk = miembro.stats.ATK ?? 0;
      const atkEsp = miembro.stats["SP.ATK"] ?? 0;
      if (fisicos > 0 && especiales === 0 && atkEsp - atk >= MARGEN_LADO) ladoFlojo = "fisico";
      else if (especiales > 0 && fisicos === 0 && atk - atkEsp >= MARGEN_LADO) ladoFlojo = "especial";
    }

    // Por qué lado pega este miembro, para cruzarlo con el lado blando del
    // rival. Sin movimientos cargados no se puede saber, y no se inventa.
    let ladoRival: "bueno" | "muro" | null = null;
    if (ladoBlando && !soloPorTipo) {
      const fisicos = miembro.movimientos.filter((m) => m.categoria === "Physical" && m.tipo).length;
      const especiales = miembro.movimientos.filter((m) => m.categoria === "Special" && m.tipo).length;
      if (fisicos > 0 || especiales > 0) {
        const suLado = fisicos >= especiales ? "fisico" : "especial";
        ladoRival = suLado === ladoBlando ? "bueno" : "muro";
      }
    }

    const puntos =
      golpeaA * 12 +
      (golpeaAs ? 20 : 0) +
      (masRapidoQueAs ? 6 : 0) +
      (ladoRival === "bueno" ? 8 : ladoRival === "muro" ? -6 : 0) +
      (ladoFlojo ? -6 : 0) +
      // Un desempate suave por potencia bruta, no un criterio: entre dos que
      // aportan lo mismo, sale antes el que pega más fuerte.
      Math.round(sumaStats(miembro.stats) / 100) -
      riesgo;

    // El orden de los casos importa: lo primero es avisar de quien se muere sin
    // dar nada a cambio, aunque en la cuenta salga con puntos.
    const veredicto: Veredicto =
      x4.length > 0 && golpeaA === 0 && !golpeaAs
        ? "peligro"
        : golpeaA >= 2 || (golpeaAs && enRiesgo.length === 0)
          ? "clave"
          : golpeaA >= 1 || golpeaAs
            ? "sirve"
            : "banquillo";

    return {
      miembro,
      veredicto,
      puntos,
      golpeaA,
      conQue,
      soloPorTipo,
      golpeaAs,
      enRiesgo,
      x4,
      masRapidoQueAs,
      ladoFlojo,
      ladoRival,
    };
  });

  orden.sort((a, b) => b.puntos - a.puntos);

  // ── El conjunto ────────────────────────────────────────────────────────────
  // Aquí se reusa el motor del Builder tal cual, con la tabla estática.
  // Con la tabla que toque: este bloque habla de ESTE combate ("nadie resiste
  // lo que lleva"), así que en el inverso tiene que ir invertido igual que el
  // resto, o diría lo contrario que las tarjetas de arriba.
  const perfil = computeTeamDefenseProfile(
    miembros.map((m) => m.tipos as string[]),
    relacionesSegunReglas(inverso)
  );

  const tiposDelRival = new Set(rivalAttackTypes.map((a) => a.type));

  const debilidades = Object.entries(perfil)
    .filter(([, p]) => p.weak >= 2)
    .map(([tipo, p]) => ({
      tipo: tipo as PokeType,
      cuantos: p.weak,
      loTieneElRival: tiposDelRival.has(tipo as PokeType),
    }))
    // Primero lo que este rival puede explotar hoy; después lo que es un
    // problema del equipo pero no de este combate.
    .sort((a, b) => Number(b.loTieneElRival) - Number(a.loTieneElRival) || b.cuantos - a.cuantos);

  const sinRespuesta = rivalAttackTypes
    .filter(({ type }) => {
      const p = perfil[type];
      return p && p.resist === 0 && p.immune === 0;
    })
    .map(({ type }) => type);

  const stats = miembros.map((m) => m.stats);
  const conStats = stats.filter(Boolean).length;
  const statsFlojas =
    conStats === 0
      ? []
      : STAT_KEYS.map((key) => ({ key, label: STAT_LABEL_ES[key], avg: media(stats, key) }))
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 2);

  const masLentosQueAs =
    as?.stats == null ? 0 : miembros.filter((m) => m.stats && m.stats.SPE < as.stats!.SPE).length;

  return {
    orden,
    resumen: { debilidades, sinRespuesta, statsFlojas, masLentosQueAs, conStats },
  };
}
