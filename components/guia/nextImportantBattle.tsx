// components/guia/NextImportantBattle.tsx
//
// Banner fijo arriba del detalle de zona: busca, a partir de la zona
// ACTIVA hacia adelante (por índice, sin dar la vuelta), la primera
// zona que tenga un entrenador con tipo === "importante", y muestra
// ese entrenador con su equipo completo. Es puramente informativo — no
// depende de progreso de visitadas, solo de dónde estás parado en la
// lista/mapa ahora mismo.
//
// Si no hay ninguna batalla importante más adelante (por ejemplo,
// estás en las últimas zonas), no se renderiza nada.

import { useMemo, useState } from "react";
import { Swords, ChevronRight, ChevronLeft, CornerDownRight, MapPin, UserRound, Skull, ChevronDown, ChevronUp, ShieldAlert, TrendingDown, Sparkles, Info as InfoIcon, Crown, ArrowUpNarrowWide, CornerRightDown, TrendingUp, Repeat } from "lucide-react";
import type { Zone } from "./types";
import { ZoneSpriteImg } from "./zoneSpriteImage";
import { useSpeciesData } from "./useSpeciesData";
import { useEvolutions } from "./useEvolutions";
import { tramoDeZona, etiquetaMax } from "./levelCaps";
import { TYPE_COLORS } from "./typeColors";
import { findPreviousImportantBattle, analyzeRivalTeam, buildCaptureCandidates, BST_POTENTE } from "./battlePrep";
import type { FormaAlcanzable } from "./battlePrep";
import { useEquipoBuilder } from "./useEquipoBuilder";
import { analizarEquipoContraRival, VEREDICTO_LABEL } from "./equipoVsRival";
import { codecBooleano, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";
import { AVISO_INVERSO, DETALLE_INVERSO } from "./reglasCombate";
import type { MiembroContraRival, RivalMiembro, Veredicto } from "./equipoVsRival";
import { StarterPicker } from "./starterPicker";
import { MonCard } from "./monCard";
import { equipoSegunInicial, tieneRanuraCondicional, useStarterChoice } from "./useStarterChoice";
import { nombreZona } from "./formato";
import { getTrainerSpriteUrl } from "./trainerSprites";
import type { PokeType } from "./typeChart";

// Nombres en español para los badges de tipo de esta sección — no hay
// un helper de i18n de tipos disponible en la Guía (a diferencia del
// Builder), así que se resuelve acá con un mapa chico.
const LS_KEY_COLAPSO = "guia:batallaColapsada";

const TYPE_LABEL_ES: Record<PokeType, string> = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico",
  grass: "Planta", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
  ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
  rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
  steel: "Acero", fairy: "Hada",
};

/**
 * `destacado` marca los tipos con los que este candidato explota una debilidad
 * compartida del rival. La tarjeta muestra TODOS sus tipos, así que sin esta
 * distinción se perdería el motivo por el que está recomendado.
 */
function TypeBadge({ type, destacado = false }: { type: PokeType; destacado?: boolean }) {
  const color = TYPE_COLORS[type];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: destacado ? `${color}40` : `${color}18`,
        color,
        border: `1px solid ${color}${destacado ? "cc" : "40"}`,
        opacity: destacado ? 1 : 0.75,
      }}
    >
      {TYPE_LABEL_ES[type]}
    </span>
  );
}

// Un color por veredicto, el mismo en el chip y en el borde de la tarjeta, para
// poder barrer los seis sin leer: verde el que gana el combate, rosa el que se
// muere, gris el que no aporta.
const VEREDICTO_TARJETA: Record<Veredicto, string> = {
  clave: "border-emerald-500/40 bg-emerald-500/5",
  sirve: "border-sky-500/30 bg-slate-900/70",
  banquillo: "border-slate-700/50 bg-slate-900/70",
  peligro: "border-rose-500/40 bg-rose-500/5",
};

const VEREDICTO_CHIP: Record<Veredicto, string> = {
  clave: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
  sirve: "border-sky-400/40 bg-sky-400/15 text-sky-300",
  banquillo: "border-slate-600/50 bg-slate-800/50 text-slate-400",
  peligro: "border-rose-400/40 bg-rose-400/15 text-rose-300",
};

const VEREDICTO_MOTIVO: Record<Veredicto, string> = {
  clave: "Le pega a varios del equipo rival, o al as sin arriesgar nada.",
  sirve: "Tiene algo que aportar, pero no decide el combate por sí solo.",
  banquillo: "Ni ventaja de tipo ni riesgo: aquí no cambia nada.",
  peligro: "El rival le pega x4 y él no devuelve nada. Sacarlo es regalar un turno.",
};

/**
 * El as del rival, nombrado y destacado. Antes ponía "el as" en gris, igual que
 * el resto de la frase: el Pokémon que decide el combate quedaba escondido en
 * medio de una línea de diez palabras.
 *
 * Con corona y no con estrella a propósito: la corona ya es el símbolo del as en
 * este banner (la línea "As del equipo" y el distintivo de las tarjetas de
 * captura la usan), y meter un segundo icono para lo mismo se lee como si fueran
 * dos cosas distintas.
 */
function NombreAs({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-baseline font-extrabold uppercase tracking-wide text-amber-300">
      <Crown className="h-2.5 w-2.5 shrink-0" />
      {nombre}
    </span>
  );
}

/**
 * Ficha de un miembro de TU equipo contra este rival. Misma retícula que las
 * tarjetas de captura, para que las dos pestañas se lean igual.
 */
function TarjetaMiembro({
  analisis,
  nombreAs,
  esBoss,
}: {
  analisis: MiembroContraRival;
  nombreAs: string | null;
  esBoss: boolean;
}) {
  const { miembro, veredicto } = analisis;
  // En un combate contra un Pokémon suelto, el "as" ES el rival entero: decir
  // "pega x2 a 1, incluido el as" es dar dos veces el mismo dato.
  const as = nombreAs ? <NombreAs nombre={nombreAs} /> : <span className="font-bold text-amber-300">el as</span>;
  return (
    <div className={`flex h-full flex-col gap-2 rounded-lg border p-2.5 ${VEREDICTO_TARJETA[veredicto]}`}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-950/60 ring-1 ring-slate-700/40">
          {miembro.sprite ? (
            // El sprite del Builder ya viene recortado al primer frame y
            // guardado en el propio Slot, así que aquí no hay nada que procesar.
            <img
              src={miembro.sprite}
              alt={miembro.nombre}
              className="h-12 w-12 object-contain [image-rendering:pixelated]"
            />
          ) : (
            <span className="text-[11px] text-slate-600">?</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="truncate text-[13px] font-bold text-slate-100">{miembro.nombre}</span>
            <span
              title={VEREDICTO_MOTIVO[veredicto]}
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${VEREDICTO_CHIP[veredicto]}`}
            >
              {VEREDICTO_LABEL[veredicto]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {miembro.tipos.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-slate-800/70 pt-1.5 text-xs leading-snug">
        {analisis.golpeaA > 0 && (
          <div className="flex items-center gap-1 font-semibold text-emerald-300/90">
            <Swords className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {esBoss ? <>le pega x2 a {as}</> : (
                <>
                  pega x2 a {analisis.golpeaA}
                  {analisis.golpeaAs ? <>, incluido {as}</> : null}
                </>
              )}
              {analisis.conQue ? ` · ${analisis.conQue.nombre}` : ""}
            </span>
          </div>
        )}
        {analisis.golpeaA === 0 && analisis.golpeaAs && (
          <div className="flex items-center gap-1 font-semibold text-emerald-300/90">
            <Swords className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">le pega x2 a {as}</span>
          </div>
        )}
        {analisis.x4.length > 0 ? (
          <div className="flex items-center gap-1 font-semibold text-rose-300/90">
            <Skull className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">le entra x4: {analisis.x4.map((t) => TYPE_LABEL_ES[t]).join(", ")}</span>
          </div>
        ) : (
          analisis.enRiesgo.length > 0 && (
            <div className="flex items-center gap-1 text-rose-300/80">
              <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">le pegan x2: {analisis.enRiesgo.map((t) => TYPE_LABEL_ES[t]).join(", ")}</span>
            </div>
          )
        )}
        {analisis.masRapidoQueAs === false && (
          <div className="flex items-center gap-1 text-amber-300/80">
            <TrendingDown className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">más lento que {as}</span>
          </div>
        )}
        {/* Los dos avisos de "por dónde pegas". El primero es un fallo del set
            que se arregla en el Builder; el segundo es de este combate. */}
        {analisis.ladoFlojo && (
          <div className="flex items-center gap-1 text-amber-300/80">
            <InfoIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              ataca {analisis.ladoFlojo === "fisico" ? "en físico" : "en especial"} con la stat más floja
            </span>
          </div>
        )}
        {analisis.ladoRival === "muro" && (
          <div className="flex items-center gap-1 text-amber-300/80">
            <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">pega por donde el rival aguanta</span>
          </div>
        )}
        {analisis.ladoRival === "bueno" && (
          <div className="flex items-center gap-1 text-sky-300/90">
            <TrendingUp className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">pega por donde el rival es blando</span>
          </div>
        )}
        {analisis.soloPorTipo && (
          <div className="flex items-center gap-1 text-slate-500">
            <InfoIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">sin movimientos puestos: juzgado por sus tipos</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * La cadena entera, escrita, para el tooltip: "Gible → Gabite (nivel 24) →
 * Garchomp (nivel 48)". En la tarjeta solo cabe la forma final y su nivel, y sin
 * esto no habría forma de ver qué hace falta en los pasos intermedios — que es
 * justo lo que importa cuando alguno pide una piedra o un intercambio.
 */
function cadenaEvolutiva(capturado: string, forma: FormaAlcanzable): string {
  const tramos = forma.pasos.map((p) => `${p.a} (${p.nivel !== null ? `nivel ${p.nivel}` : p.metodo})`);
  return `${capturado} → ${tramos.join(" → ")}`;
}

/**
 * Lo que va junto al nombre de la evolución en la tarjeta. Con el nivel basta
 * cuando la cadena se cierra subiendo de nivel; si no depende del nivel, lo
 * útil es el requisito (la piedra, el intercambio), no un "Nv." que no existe.
 */
function detalleEvolucion(forma: FormaAlcanzable): string {
  if (forma.nivel !== null) return `Nv. ${forma.nivel}`;
  return forma.pasos[forma.pasos.length - 1]?.metodo ?? "";
}

/**
 * Empieza a buscar en la zona ACTIVA, no en la siguiente: si estás parado en un
 * bastión, la batalla que tienes por delante es la del líder que hay ahí mismo,
 * no la de la zona de después. Solo cuando la zona actual no tiene ninguna se
 * mira hacia adelante.
 */
export function findNextImportantBattle(zones: Zone[], activeIndex: number) {
  for (let i = Math.max(activeIndex, 0); i < zones.length; i++) {
    // Una zona puede tener varias: los seis del Alto Mando I, los siete de El
    // Arma Definitiva, los dos combates seguidos contra Mirra, los trece de la
    // Misión del Campanero. Se devuelven todos para poder ir pasando de uno a
    // otro; `trainer` es el primero, que es el que se pelea antes.
    const importantes = zones[i].entrenadores.filter((t) => t.tipo === "importante");
    if (importantes.length) {
      return { zoneIndex: i, zone: zones[i], trainer: importantes[0], importantes };
    }
  }
  return null;
}

export function NextImportantBattle({
  zones,
  activeIndex,
  getSpriteUrl,
  onNavigate,
}: {
  zones: Zone[];
  activeIndex: number;
  getSpriteUrl?: (speciesName: string, spriteBase?: string) => string | null;
  onNavigate: (zoneIndex: number) => void;
}) {
  const encontrado = findNextImportantBattle(zones, activeIndex);
  const [colapsado, setColapsado] = usePreferenciaLocal(LS_KEY_COLAPSO, false, codecBooleano);
  const { inicial } = useStarterChoice();

  // Cuál de las batallas importantes de la zona se está mostrando. Vuelve a la
  // primera en cuanto cambia la zona de destino: si no, al pasar de una zona
  // con siete combates a una con dos quedaría apuntando a un índice que ya no
  // existe, y además lo natural es empezar por el primero que se pelea.
  //
  // La selección se guarda junto a la zona a la que pertenece, así el reinicio
  // sale de comparar en el render y no de un efecto que corrige después.
  const [seleccion, setSeleccion] = useState<{ zona: number | null; indice: number }>({
    zona: null,
    indice: 0,
  });
  const zonaDestino = encontrado?.zoneIndex ?? null;
  const elegido = seleccion.zona === zonaDestino ? seleccion.indice : 0;
  const elegir = (siguiente: (n: number) => number) =>
    setSeleccion({ zona: zonaDestino, indice: siguiente(elegido) });

  // Pestaña de preparación. `null` = todavía no la ha tocado nadie, así que
  // manda el valor por defecto: si hay equipo armado, lo primero que interesa
  // es qué hacer con él; si no lo hay, lo único que se puede ofrecer es qué
  // atrapar. Como se resuelve al vuelo, no hace falta un efecto que corrija la
  // pestaña cuando el equipo termina de cargar.
  const [pestana, setPestana] = useState<"atrapar" | "equipo" | null>(null);


  const importantes = encontrado?.importantes ?? [];
  const indiceActual = Math.min(elegido, Math.max(importantes.length - 1, 0));
  const next = encontrado ? { ...encontrado, trainer: importantes[indiceActual] } : null;

  const alternarColapso = () => setColapsado((previo) => !previo);
  // Los getters de movimiento/habilidad/objeto los pide ahora MonCard por su
  // cuenta; aquí solo queda lo que usa el resto del panel.
  const { getSpeciesInfo } = useSpeciesData();
  const { pasosDesde } = useEvolutions();

  // El máximo manda sobre la zona DEL COMBATE, no sobre la que estás mirando: es
  // el tramo que hay que superar, y es el que decide a qué evoluciones llegas
  // antes de pelear.
  const tramo = useMemo(
    () => (encontrado ? tramoDeZona(zones, encontrado.zoneIndex) : null),
    [zones, encontrado]
  );

  // Estos hooks van ANTES del `if (!next) return null` a propósito —
  // las reglas de hooks exigen que se llamen siempre en el mismo
  // orden, sin importar si termina habiendo batalla o no.
  const rivalAnalysis = useMemo(() => {
    if (!next) return null;
    return analyzeRivalTeam(next.trainer, getSpeciesInfo, inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.trainer, getSpeciesInfo, inicial]);

  // El equipo que tengas armado en el Builder. Vale para las dos cosas: juzgar
  // a los seis contra este rival, y saber qué le falta al conjunto.
  const equipo = useEquipoBuilder();

  const equipoAnalisis = useMemo(() => {
    if (!next || !rivalAnalysis || equipo.miembros.length === 0) return null;
    // El rival, miembro a miembro: `analyzeRivalTeam` devuelve agregados, pero
    // para decir "le pega x2 a tres de los seis" hacen falta los individuales.
    const rivales: RivalMiembro[] = equipoSegunInicial(next.trainer.equipo, inicial)
      .map((m) => {
        const info = getSpeciesInfo(m.especie, { spriteBase: m.spriteBase });
        if (!info) return null;
        return {
          nombre: m.especie,
          tipos: info.types,
          stats: info.stats,
          nivel: Number.parseInt(m.nivel, 10) || 0,
        };
      })
      .filter((r): r is RivalMiembro => r !== null);
    if (rivales.length === 0) return null;

    const as = rivalAnalysis.ace
      ? {
          nombre: rivalAnalysis.ace.name,
          tipos: rivalAnalysis.ace.types,
          stats: getSpeciesInfo(rivalAnalysis.ace.name)?.stats ?? null,
        }
      : null;

    return analizarEquipoContraRival(
      equipo.miembros,
      rivales,
      rivalAnalysis.attackTypes,
      as,
      rivalAnalysis.inverso
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.trainer, rivalAnalysis, equipo.miembros, inicial, getSpeciesInfo]);

  const candidatePool = useMemo(() => {
    if (!next || !rivalAnalysis) return null;
    const prev = findPreviousImportantBattle(zones, activeIndex);
    const fromIndexExclusive = prev ? prev.zoneIndex : -1;
    return buildCaptureCandidates(
      zones,
      fromIndexExclusive,
      next.zoneIndex,
      rivalAnalysis.sharedWeaknesses,
      rivalAnalysis.aceWeaknesses,
      getSpeciesInfo,
      tramo?.capEfectivo ?? 0,
      pasosDesde,
      rivalAnalysis.attackTypes,
      equipo.miembros.map((m) => m.tipos),
      rivalAnalysis.bstMedio,
      rivalAnalysis.inverso
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.zoneIndex, activeIndex, zones, rivalAnalysis, getSpeciesInfo, tramo, pasosDesde, equipo.miembros]);

  if (!next) return null;

  const { zoneIndex, zone, trainer } = next;
  const enEstaZona = zoneIndex === activeIndex;
  const esBoss = Boolean(trainer.esBoss);
  const spriteEntrenador = getTrainerSpriteUrl(trainer.nombre, zone.zona);
  const faltanZonas = zoneIndex - activeIndex;
  const hayVarias = importantes.length > 1;
  const siguienteBatalla = importantes[indiceActual + 1];

  // Plegado: la ficha entera ocupa media pantalla y estorba cuando solo quieres
  // leer la zona. Se puede plegar y la preferencia se recuerda, PERO cuando el
  // combate es de la zona que estás mirando se despliega igual: es justo el
  // momento en que hace falta.
  const plegado = colapsado && !enEstaZona;

  const hayCandidatos = Boolean(candidatePool && candidatePool.candidates.length > 0);
  const hayEquipo = Boolean(equipoAnalisis && equipoAnalisis.orden.length > 0);
  // Sin elección explícita manda lo que haya: con equipo armado, lo primero que
  // se quiere ver es qué hacer con él.
  const pestanaActiva = pestana ?? (hayEquipo ? "equipo" : "atrapar");

  return (
    <div
      className={`relative mb-5 overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-slate-950/60 to-slate-950/60 transition-[padding] duration-200 ease-out motion-reduce:transition-none ${
        plegado ? "px-4 py-2.5" : "p-4"
      }`}
    >
      <span className="pointer-events-none absolute left-2.5 top-2.5 h-2.5 w-2.5 border-l border-t border-red-500/40" />
      <span className="pointer-events-none absolute right-2.5 top-2.5 h-2.5 w-2.5 border-r border-t border-red-500/40" />

      <div
        className={`flex flex-wrap items-center justify-between gap-2 transition-[margin] duration-200 ease-out motion-reduce:transition-none ${
          plegado ? "" : "mb-3"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/30">
            <Swords className="h-3.5 w-3.5 text-red-400" />
          </span>
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.15em] text-red-400/80">
              {enEstaZona ? "Batalla importante de esta zona" : "Próxima batalla importante"}
              {/* El "1 de 2" ya no va aquí: vive entre las flechas, que es
                  donde se mira cuando se está cambiando de combate. */}
            </div>
            <div className="text-[15px] font-extrabold text-slate-100">{trainer.nombre}</div>
          </div>

          {/* Con varias batallas en la misma zona el banner enseñaba solo la
              primera y las demás quedaban fuera de la preparación (el análisis
              de debilidades, los candidatos a capturar). Las flechas van por la
              lista en orden de combate.
              Van como un paginador entero — flecha, posición, flecha — y no
              como dos botones sueltos: antes el "1 de 2" estaba en el texto de
              arriba, lejos, y las flechas no se leían como un control. */}
          {hayVarias && (
            <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full border border-red-400/30 bg-red-400/10 p-0.5">
              <button
                type="button"
                onClick={() => elegir((n) => Math.max(n - 1, 0))}
                disabled={indiceActual === 0}
                title="Batalla anterior de esta zona"
                aria-label="Batalla anterior de esta zona"
                className="flex h-8 w-8 items-center justify-center rounded-full text-red-300 transition hover:bg-red-400/25 hover:text-red-100 disabled:cursor-not-allowed disabled:text-slate-700 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="select-none px-0.5 text-[12px] font-bold tabular-nums text-red-200/90">
                {indiceActual + 1}/{importantes.length}
              </span>
              <button
                type="button"
                onClick={() => elegir((n) => Math.min(n + 1, importantes.length - 1))}
                disabled={indiceActual === importantes.length - 1}
                title={siguienteBatalla ? `Siguiente: ${siguienteBatalla.nombre}` : "Siguiente batalla de esta zona"}
                aria-label="Siguiente batalla de esta zona"
                className="flex h-8 w-8 items-center justify-center rounded-full text-red-300 transition hover:bg-red-400/25 hover:text-red-100 disabled:cursor-not-allowed disabled:text-slate-700 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
        {/* El nivel máximo del tramo. Va en la cabecera y no dentro de la
            ficha porque sigue a la vista con el banner plegado: es el dato que
            decide con qué te presentas al combate. */}
        {tramo && (
          <span
            title={
              tramo.hito
                ? `Tramo ${tramo.numero} de ${tramo.total} — hasta ${tramo.hito.etiqueta} (${tramo.hito.entrenador}).` +
                  (tramo.cap === null
                    ? " Aquí el máximo ya no es fijo: los rivales escalan con la media de nivel de tu equipo."
                    : ` Tu equipo no pasa del nivel ${tramo.cap} hasta ganar ese combate.`)
                : "Postgame: ya no queda nada que superar, el máximo es el nivel 100."
            }
            className="flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1.5 text-[12px] font-semibold text-sky-300"
          >
            <ArrowUpNarrowWide className="h-3 w-3 shrink-0" />
            {etiquetaMax(tramo)}
          </span>
        )}

        {/* Dos situaciones distintas y conviene distinguirlas de un vistazo: o
            el combate es de la zona que estás mirando (te toca ya), o está más
            adelante y el botón sirve para ir. */}
        <button
          type="button"
          onClick={() => onNavigate(zoneIndex)}
          title={enEstaZona ? "El combate es en esta misma zona" : `Ir a ${nombreZona(zone.zona)}`}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition ${
            enEstaZona
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
              : "border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20"
          }`}
        >
          <span
            className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              enEstaZona ? "bg-emerald-400/20 text-emerald-200" : "bg-red-400/20 text-red-200"
            }`}
          >
            {enEstaZona ? (
              <>
                <MapPin className="h-2.5 w-2.5" /> Aquí
              </>
            ) : (
              <>
                <CornerDownRight className="h-2.5 w-2.5" />
                {faltanZonas === 1 ? "Siguiente" : `En ${faltanZonas} zonas`}
              </>
            )}
          </span>
          {nombreZona(zone.zona)}
          {!enEstaZona && <ChevronRight className="h-3 w-3" />}
        </button>

          {/* En la zona del combate no se ofrece plegar: es cuando hace falta
              tenerlo delante, y ocultarlo sería justo lo contrario. */}
          {!enEstaZona && (
            <button
              type="button"
              onClick={alternarColapso}
              title={plegado ? "Mostrar la ficha completa" : "Plegar la ficha"}
              aria-expanded={!plegado}
              className="flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-1.5 text-[13px] font-semibold text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            >
              {plegado ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              {plegado ? "Ver" : "Plegar"}
            </button>
          )}
        </div>
      </div>

      {/* Plegado sin animación: se monta o no se monta. Hubo una versión
          animada con motion (altura de 0 a "auto") y se quitó a propósito.
          Si se quiere recuperar, el problema a resolver es que `height: auto`
          no se puede interpolar en CSS, y que `grid-template-rows` de 0fr a
          1fr se queda clavado en 0 con la transición activa. */}
      {!plegado && (
        <div>

      {/* Solo en combates de rival: el resto de entrenadores no tienen la
          ranura que depende del inicial. */}
      {tieneRanuraCondicional(trainer.equipo) && <StarterPicker getSpriteUrl={getSpriteUrl} />}

      <div className="flex items-stretch gap-3">
        {/* Sprite del entrenador — placeholder de prueba (mismo para
            todos) hasta tener una fuente real de sprites de
            entrenadores. Se estira (items-stretch del padre) para
            ocupar el mismo alto que la grilla de Pokémon, sin importar
            cuántas filas tenga.

            En los combates contra un Pokémon suelto no hay entrenador al que
            enseñarle la cara: se pone una calavera y la etiqueta "Jefe". */}
        <div
          className={`flex w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border bg-slate-950/60 ${
            esBoss ? "border-amber-500/25" : "border-red-500/20"
          }`}
        >
          {/* Los sprites de entrenador son retratos verticales (102x154), así
              que van a lo alto y sin recorte circular: metidos en un círculo de
              64 px no se distingue quién es. */}
          {spriteEntrenador ? (
            <img
              src={spriteEntrenador}
              alt={trainer.nombre}
              className="h-24 w-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full ring-1 ${
                esBoss ? "bg-amber-500/10 ring-amber-500/25" : "bg-red-500/10 ring-red-500/25"
              }`}
            >
              {esBoss ? (
                <Skull className="h-9 w-9 text-amber-300/80" />
              ) : (
                <UserRound className="h-9 w-9 text-red-300/80" />
              )}
            </span>
          )}
          <span className="px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {esBoss ? "Jefe" : "Entrenador"}
          </span>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {equipoSegunInicial(trainer.equipo, inicial).map((m, j) => (
          <MonCard key={`${m.especie}-${j}`} mon={m} getSpriteUrl={getSpriteUrl} variante="banner" />
        ))}
        </div>
      </div>

      {/* Un combate con la tabla del revés cambia TODO lo que hay debajo, así
          que va antes y en su propio bloque: si esto se lee después de las
          debilidades, ya has entendido el combate al revés. */}
      {rivalAnalysis?.inverso && (
        <div
          title={DETALLE_INVERSO}
          className="mt-3 flex items-start gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2.5 text-xs leading-snug text-fuchsia-200"
        >
          <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
          <span>
            <span className="font-bold uppercase tracking-wide">{AVISO_INVERSO}.</span>{" "}
            <span className="text-fuchsia-200/80">{DETALLE_INVERSO}</span>
          </span>
        </div>
      )}

      {/* ── Análisis del rival: debilidades compartidas + as + stats flojas ── */}
      {rivalAnalysis && (rivalAnalysis.sharedWeaknesses.length > 0 || rivalAnalysis.weakestStats.length > 0 || rivalAnalysis.ace) && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-red-300/90">
            <ShieldAlert className="h-3.5 w-3.5" />
            {esBoss ? "Puntos débiles" : "Puntos débiles del equipo rival"}
          </div>

          {rivalAnalysis.sharedWeaknesses.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {rivalAnalysis.sharedWeaknesses.map(({ type, count }) => (
                <span key={type} className="flex items-center gap-1">
                  <TypeBadge type={type} />
                  <span className="text-[12px] text-slate-500">×{count}</span>
                </span>
              ))}
            </div>
          )}

          {rivalAnalysis.weakestStats.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {rivalAnalysis.weakestStats.map((s) => (
                <span
                  key={s.key}
                  className="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[13px] font-semibold text-orange-300"
                >
                  <TrendingDown className="h-3 w-3 shrink-0" />
                  {s.label} floja (~{s.avg})
                </span>
              ))}
            </div>
          )}

          {/* "As del equipo" solo tiene sentido si hay equipo: en un combate
              contra un Pokémon suelto, el as sería él mismo y ya está arriba.
              Sus debilidades sí se muestran, pero sin la corona ni el rótulo. */}
          {rivalAnalysis.ace && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              {!esBoss && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
              {!esBoss && (
                <span>
                  As del equipo: <span className="font-bold text-slate-200">{rivalAnalysis.ace.name}</span> (Nv. {rivalAnalysis.ace.level})
                </span>
              )}
              {rivalAnalysis.aceWeaknesses.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  {esBoss ? "Débil a" : "— débil a"}
                  {rivalAnalysis.aceWeaknesses.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
              )}
            </div>
          )}

          {rivalAnalysis.unmatchedNames.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
              <InfoIcon className="h-2.5 w-2.5 shrink-0" />
              Cobertura parcial: sin datos de {rivalAnalysis.unmatchedNames.join(", ")}.
            </p>
          )}
        </div>
      )}

      {/* ── Preparación: con qué cuentas (tu equipo) y qué podrías conseguir ── */}
      {(hayCandidatos || hayEquipo || equipo.vacio) && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {/* Dos respuestas a la misma pregunta — con qué me presento a este
                combate — así que van como pestañas y no como dos bloques
                apilados: nunca hacen falta las dos a la vez. */}
            <button
              type="button"
              onClick={() => setPestana("equipo")}
              disabled={!hayEquipo}
              title={
                hayEquipo
                  ? "Cuál de los tuyos sirve contra este rival"
                  : "Arma un equipo en el Builder para ver esto"
              }
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.1em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                pestanaActiva === "equipo"
                  ? "border-sky-400/50 bg-sky-400/15 text-sky-300"
                  : "border-slate-700/60 text-slate-500 hover:text-slate-300"
              }`}
            >
              <UserRound className="h-3 w-3" />
              Tu equipo
              {hayEquipo && <span className="tabular-nums opacity-70">{equipo.miembros.length}</span>}
            </button>
            <button
              type="button"
              onClick={() => setPestana("atrapar")}
              disabled={!hayCandidatos}
              title="Qué se puede atrapar en este tramo y sirve contra este rival"
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.1em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                pestanaActiva === "atrapar"
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                  : "border-slate-700/60 text-slate-500 hover:text-slate-300"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              Qué atrapar
              {hayCandidatos && (
                <span className="tabular-nums opacity-70">{candidatePool!.candidates.length}</span>
              )}
            </button>
            {pestanaActiva === "atrapar" && tramo && tramo.cap !== null && (
              <span className="text-xs text-slate-400">
                · evoluciones que entran en el MAX (Nv. {tramo.cap})
              </span>
            )}
            {pestanaActiva === "equipo" && (
              <span className="text-xs text-slate-400">
                · leído del Builder · sin niveles, solo tipos y stats base
              </span>
            )}
          </div>

          {/* Sin equipo guardado no se puede analizar nada, pero decirlo es más
              útil que esconder la pestaña: el dato existe, solo hay que armarlo. */}
          {pestanaActiva === "equipo" && !hayEquipo && (
            <p className="flex items-center gap-1.5 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2.5 text-xs text-slate-400">
              <InfoIcon className="h-3 w-3 shrink-0" />
              No hay ningún equipo guardado en el Builder todavía.
            </p>
          )}

          {pestanaActiva === "equipo" && equipoAnalisis && (
            <>
              <div className="grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {equipoAnalisis.orden.map((a) => (
                  <TarjetaMiembro
                    key={a.miembro.indice}
                    analisis={a}
                    nombreAs={rivalAnalysis?.ace?.name ?? null}
                    esBoss={esBoss}
                  />
                ))}
              </div>

              {/* ── El conjunto: lo que no se ve mirando a los seis por separado ── */}
              <div className="mt-2.5 flex flex-col gap-1.5 border-t border-slate-800/70 pt-2.5 text-xs">
                {equipoAnalisis.resumen.debilidades.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 text-slate-500">
                      <ShieldAlert className="h-3 w-3 shrink-0" />
                      Debilidades del equipo:
                    </span>
                    {equipoAnalisis.resumen.debilidades.map(({ tipo, cuantos, loTieneElRival }) => (
                      <span
                        key={tipo}
                        title={
                          loTieneElRival
                            ? `${cuantos} de los tuyos reciben x2, y este rival ataca de ese tipo.`
                            : `${cuantos} de los tuyos reciben x2, pero este rival no ataca de ese tipo.`
                        }
                        className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-semibold ${
                          loTieneElRival
                            ? "border-rose-400/40 bg-rose-400/15 text-rose-300"
                            : "border-slate-700/60 bg-slate-800/40 text-slate-500"
                        }`}
                      >
                        {TYPE_LABEL_ES[tipo]} ×{cuantos}
                        {loTieneElRival && <Skull className="h-2.5 w-2.5" />}
                      </span>
                    ))}
                  </div>
                )}

                {equipoAnalisis.resumen.sinRespuesta.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 text-amber-300/80">
                    <TrendingDown className="h-3 w-3 shrink-0" />
                    <span>
                      Nadie resiste{" "}
                      {equipoAnalisis.resumen.sinRespuesta.map((t) => TYPE_LABEL_ES[t]).join(", ")} — y es
                      con lo que pega.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                  {equipoAnalisis.resumen.statsFlojas.length > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 shrink-0" />
                      Lo más flojo del equipo:{" "}
                      {equipoAnalisis.resumen.statsFlojas
                        .map((s) => `${s.label} (~${s.avg})`)
                        .join(" y ")}
                    </span>
                  )}
                  {rivalAnalysis?.ace && equipoAnalisis.resumen.masLentosQueAs > 0 && (
                    <span className="flex items-center gap-1">
                      {equipoAnalisis.resumen.masLentosQueAs} de los tuyos{" "}
                      {equipoAnalisis.resumen.masLentosQueAs === 1 ? "es más lento" : "son más lentos"} que{" "}
                      <NombreAs nombre={rivalAnalysis.ace.name} />
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {pestanaActiva === "atrapar" && candidatePool && (
            <>
          <div className="grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {candidatePool.candidates.map((c) => {
              // El protagonista de la tarjeta es la forma con la que vas a
              // pelear, no la que atrapas: los tipos y la puntuación ya son los
              // suyos, y enseñar el sprite del bebé al lado de los tipos de la
              // evolución era justo lo confuso. Lo que se captura pasa a la
              // línea de abajo, que es donde importa a la hora de ir a buscarlo.
              const nombreUsado = c.evolucion?.nombre ?? c.name;
              // `spriteBase` solo vale para lo capturado: las evoluciones salen
              // de la tabla con su nombre canónico y resuelven solas.
              const sprite = c.evolucion
                ? getSpriteUrl?.(c.evolucion.nombre) ?? null
                : getSpriteUrl?.(c.name, c.spriteBase) ?? null;
              return (
                // Tarjeta en columna y a toda la altura de su celda: los motivos
                // son de largo muy distinto (uno tiene tres líneas y otro
                // ninguna) y con la fila horizontal de antes cada sprite quedaba
                // a una altura, con la zona flotando donde le tocara. Así la
                // cabecera arranca siempre arriba y la zona se pega abajo con
                // `mt-auto`, y las cuatro tarjetas se leen en la misma retícula.
                <div
                  key={c.name}
                  className={`flex h-full flex-col gap-2 rounded-lg border p-2.5 ${
                    c.hitsAce ? "border-amber-500/40 bg-amber-500/5" : "border-slate-700/50 bg-slate-900/70"
                  }`}
                >
                  {/* `items-start` y no `items-center`: los tipos de un Pokémon
                      doble envuelven a dos líneas en columna estrecha, y
                      centrando la fila el sprite bajaba siete píxeles solo en
                      esas tarjetas — la fila de sprites quedaba en zigzag. */}
                  <div className="flex items-start gap-2.5">
                    {/* Mismo tamaño de sprite que las fichas de salvajes y de
                        entrenador: el Pokémon es el protagonista de la tarjeta
                        y con 36 px competía con el texto en vez de mandar. */}
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-950/60 ring-1 ring-slate-700/40">
                      {c.hitsAce && (
                        <Crown className="absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-400 drop-shadow" />
                      )}
                      {sprite ? (
                        <ZoneSpriteImg
                          rawUrl={sprite}
                          alt={nombreUsado}
                          className="h-12 w-12 object-contain [image-rendering:pixelated]"
                          placeholderClassName="h-6 w-6 opacity-40 animate-pulse"
                        />
                      ) : (
                        <span className="text-[11px] text-slate-600">?</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="truncate text-[13px] font-bold text-slate-100">{nombreUsado}</span>
                        {/* Las stats justifican por sí solas media lista, así que
                            el número va a la vista y no escondido en un hover. */}
                        {c.bst >= BST_POTENTE && (
                          <span
                            title={`${c.bst} de suma de stats base. Un Pokémon así aguanta y pega más que casi cualquier cosa que se atrape en el tramo, tenga o no ventaja de tipo.`}
                            className="flex shrink-0 items-center gap-0.5 rounded-md bg-violet-500/15 px-1 py-0.5 text-[11px] font-extrabold tabular-nums text-violet-300 ring-1 ring-violet-500/30"
                          >
                            <TrendingUp className="h-2.5 w-2.5" />
                            {c.bst}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.types.map((t) => (
                          <TypeBadge key={t} type={t} destacado={c.offensiveHits.includes(t)} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Los porqués, todos con icono del mismo tamaño para que
                      formen un raíl a la izquierda en vez de tres líneas sueltas.
                      Toda tarjeta tiene al menos uno — o pega bien, o es potente:
                      son las dos únicas razones por las que algo entra aquí. */}
                  <div className="flex flex-col gap-1 border-t border-slate-800/70 pt-1.5 text-xs leading-snug">
                      {/* La ventaja de tipo se decía solo encendiendo un poco el
                          badge del tipo, que no lo ve nadie. Dicho con números
                          es la información que justifica la recomendación. */}
                      {(c.golpeaA > 0 || c.hitsAce) && (
                        <div className="flex items-center gap-1 font-semibold text-emerald-300/90">
                          <Swords className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {/* En un combate contra un Pokémon suelto no hay
                                "as del equipo" que valga: el as es el jefe. */}
                            {c.golpeaA > 0
                              ? `pega x2 a ${c.golpeaA} del equipo${c.hitsAce ? ", incluido el as" : ""}`
                              : esBoss
                                ? `le pega x2 a ${rivalAnalysis?.ace?.name ?? trainer.nombre}`
                                : "pega x2 al as del equipo"}
                          </span>
                        </div>
                      )}
                      {c.porPoder && (
                        <div className="flex items-center gap-1 font-semibold text-violet-300/90">
                          <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">por stats, no por tipo</span>
                        </div>
                      )}
                      {/* Lo que aporta a TU equipo, no al combate: por qué este
                          está por delante de otro que puntúa igual contra el rival. */}
                      {c.tapaHuecos.length > 0 && (
                        <div
                          title={`Tu equipo recibe x2 de ${c.tapaHuecos
                            .map((t) => TYPE_LABEL_ES[t])
                            .join(", ")} y este los aguanta.`}
                          className="flex items-center gap-1 text-sky-300/90"
                        >
                          <UserRound className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            tapa {c.tapaHuecos.slice(0, 2).map((t) => TYPE_LABEL_ES[t]).join(", ")} de tu equipo
                          </span>
                        </div>
                      )}
                      {/* El reparo, si lo hay. El descuento del ranking ya lo
                          castiga; esto es para que no sorprenda en el combate. */}
                      {c.enRiesgo.length > 0 && (
                        <div className="flex items-center gap-1 text-rose-300/80">
                          <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            le pegan x2: {c.enRiesgo.map((t) => TYPE_LABEL_ES[t]).join(", ")}
                          </span>
                        </div>
                      )}
                      {c.evolucion && (
                        <div
                          title={cadenaEvolutiva(c.name, c.evolucion)}
                          className="flex items-center gap-1 text-sky-300/90"
                        >
                          <CornerRightDown className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            se atrapa como <span className="font-semibold">{c.name}</span> ·{" "}
                            {detalleEvolucion(c.evolucion)}
                          </span>
                          {/* El aviso solo cuando además del nivel hace falta otra
                              cosa: si el requisito ya está escrito ahí al lado, el
                              icono no añade nada. */}
                          {c.evolucion.necesitaAlgoMas && c.evolucion.nivel !== null && (
                            <InfoIcon className="h-2.5 w-2.5 shrink-0 text-slate-500" />
                          )}
                        </div>
                      )}
                  </div>

                  <div
                    title={c.zoneNames.map(nombreZona).join(", ")}
                    className="mt-auto flex items-center gap-1 truncate text-[12px] text-slate-500"
                  >
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{c.zoneNames.map(nombreZona).join(", ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {candidatePool.unmatchedNames.length > 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
              <InfoIcon className="h-2.5 w-2.5 shrink-0" />
              Cobertura parcial: sin datos de {candidatePool.unmatchedNames.join(", ")}.
            </p>
          )}
            </>
          )}
        </div>
      )}

      {trainer.notas && <p className="mt-2.5 text-xs leading-snug text-slate-400">{trainer.notas}</p>}
        </div>
      )}
    </div>
  );
}