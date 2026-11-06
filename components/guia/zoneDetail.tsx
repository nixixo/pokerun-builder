// components/guia/ZoneDetail.tsx
//
// Panel de detalle completo. Rediseño visual (sin cambios de datos ni
// de estructura) alineado al lenguaje del Builder: chips con
// border+bg tintado por color, iconos protagonistas en tarjetas de
// objeto, método de encuentro como chip separado del nombre, y
// pequeños detalles tipo HUD (separadores con gradiente, marcas de
// esquina en el bloque de entrenadores).
//
// Zoom de sprites: los sprites se agrandaron levemente (contenedor +
// tamaño de imagen) y se les fuerza `image-rendering: pixelated` vía
// clase arbitraria de Tailwind (`[image-rendering:pixelated]`), para
// que al escalar el pixel art el navegador no interpole/difumine los
// bordes — se ve "grande y nítido" en vez de agrandado y borroso.

import { useMemo } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Swords,
  Disc,
  Repeat,
  StickyNote,
  Link2,
  Check,
  Sparkles,
  ArrowUpNarrowWide,
  CornerRightDown,
  History,
} from "lucide-react";
import type { Requisito, Zone, ZoneTrainer } from "./types";
import type { Origen, ZonaFusionada } from "./lugares";
import { esFusionada, resolverLugares } from "./lugares";
import { ZoneSpriteImg } from "./zoneSpriteImage";
import { typeEsChipStyle } from "./typeColors";
import { useSpeciesData } from "./useSpeciesData";
import { useEvolutions } from "./useEvolutions";
import { lineaPorNivel } from "./battlePrep";
import { etiquetaMax, textoMax, tramoDeZona } from "./levelCaps";
import { findNextImportantBattle } from "./nextImportantBattle";
import { nombreZona, sinSufijoOpcional } from "./formato";
import { construirDisponibilidad, requisitosPendientes } from "./requisitos";
import { StarterPicker } from "./starterPicker";
import { MonCard } from "./monCard";
import { equipoSegunInicial, STARTER_TIPO, tieneRanuraCondicional, useStarterChoice } from "./useStarterChoice";
import {
  ACCENT_CHIP_CLASS,
  DEFAULT_CHIP_CLASS,
  EncounterAccent,
  encounterAccentKind,
  encounterIcon,
} from "./zona/encuentroAcento";
import { CollectCheck, EmptyHint, RequisitoChips, SectionHead, VisitaChip } from "./zona/piezas";
import type { ProgresoColeccion } from "./zona/piezas";
import { BotonPendiente } from "./listaPendientes";
import { crearPendiente, type AccionesPendientes } from "./usePendientes";
import { SeccionObjetos } from "./zona/seccionObjetos";
import { BadgesColeccionables } from "./zona/badgesColeccionables";
import { BloqueCapturas, ChipOpcional } from "./zona/opcional";

/** Un destino de la navegación anterior/siguiente, ya resuelto por quien llama. */
export type PasoNav = { nombre: string; ir: () => void };

/**
 * Anterior / siguiente en el orden de la lista, que es el orden de juego. Va
 * arriba y abajo del detalle: abajo porque es donde acabas después de leer la
 * zona entera, y volver a subir para pasar a la siguiente es un incordio.
 *
 * Los destinos llegan hechos y no se calculan aquí: en la vista de Lugares el
 * paso no es a la entrada de al lado sino al siguiente sitio, que puede estar
 * veinte entradas más allá.
 */
function ZoneNav({ anterior, siguiente }: { anterior: PasoNav | null; siguiente: PasoNav | null }) {
  const boton = (destino: PasoNav | null, lado: "prev" | "next") => (
    <button
      type="button"
      disabled={!destino}
      onClick={() => destino?.ir()}
      title={destino?.nombre}
      // En gris se perdían contra el fondo del panel, y son el control que más
      // se usa: se recorre la guía saltando de zona en zona. En azul, que es el
      // color de "navegación" en el resto de la página (los pills de conexiones
      // usan el mismo), y con la flecha al mismo tono que el texto.
      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-sky-200 transition hover:border-sky-400/70 hover:bg-sky-500/20 hover:text-white disabled:cursor-default disabled:border-slate-700/50 disabled:bg-slate-950/40 disabled:font-normal disabled:text-slate-600 disabled:hover:border-slate-700/50 disabled:hover:bg-slate-950/40"
    >
      {lado === "prev" && <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
      <span className={`min-w-0 flex-1 truncate ${lado === "next" ? "text-right" : "text-left"}`}>
        {destino ? destino.nombre : "—"}
      </span>
      {lado === "next" && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      {boton(anterior, "prev")}
      {boton(siguiente, "next")}
    </div>
  );
}

export function ZoneDetail({
  zone,
  zones,
  zoneIndex,
  onNavigate,
  onNavigateIndex,
  navegacion,
  onVerEnHistoria,
  getSpriteUrl,
  isVisited,
  onToggleVisited,
  collection,
  pendientes,
}: {
  // Puede ser una entrada de la guía o un LUGAR entero ya fusionado. Lo segundo
  // trae `fusion`, que dice de qué entrada salió cada cosa.
  zone: Zone | ZonaFusionada;
  zones: Zone[];
  zoneIndex: number;
  onNavigate: (zoneId: string) => void;
  // Navegación por ÍNDICE para anterior/siguiente: el nombre no sirve porque
  // hay zonas con el mismo nombre repetido.
  onNavigateIndex?: (zoneIndex: number) => void;
  // Anterior/siguiente a medida. Sin esto se usa el orden de las entradas, que
  // es lo correcto en la vista de Historia.
  navegacion?: { anterior: PasoNav | null; siguiente: PasoNav | null };
  // Saltar a una entrada concreta desde la tira de visitas de un lugar.
  onVerEnHistoria?: (zoneIndex: number) => void;
  getSpriteUrl?: (speciesName: string, spriteBase?: string) => string | null;
  isVisited?: (zoneId: string) => boolean;
  onToggleVisited?: (zoneId: string) => void;
  // Progreso de colección (páginas de alquimia, MTs, nidos alfa, habitantes de
  // Pueblo Acrílico). Opcional para no romper usos previos del componente que
  // no lo pasen. El tipo vive en zona/piezas.tsx, que es de donde lo toman
  // también las secciones.
  collection?: ProgresoColeccion;
  pendientes?: AccionesPendientes;
}) {
  const activeIndex = zoneIndex;
  // Cuando la zona es un lugar fusionado, cada cosa arrastra la entrada de la
  // que salió; si no, todo viene de esta misma zona y en su posición original.
  const fusion = esFusionada(zone) ? zone.fusion : null;
  const origen = (lista: Origen[] | undefined, i: number): Origen => lista?.[i] ?? { zona: zoneIndex, i };
  /** En qué visita del lugar aparece algo (1 si no es un lugar fusionado). */
  const visitaDe = (o: Origen) => (fusion ? fusion.entradas.indexOf(o.zona) + 1 : 1);
  const alquimia = zone.pagina_alquimia;
  // Cuatro zonas tienen dos páginas de alquimia (ver AlquimiaInfo.adicionales).
  // Una entrada por página, cada una con su propio check: el índice dentro de
  // este array es el que se usa como sub-id del progreso, así que el orden
  // tiene que quedar estable (la principal siempre primero).
  const paginasAlquimia = alquimia?.presente
    ? [alquimia.descripcion ?? "", ...(alquimia.adicionales ?? [])]
    : [];
  const regalo = zone.regalo_pokemon;
  const visited = isVisited?.(zone.id) ?? false;
  const { inicial } = useStarterChoice();
  // Los getters de objetos los piden ahora SeccionObjetos y MonCard por su
  // cuenta; aquí solo queda lo que usa el resto del detalle de zona.
  const { getSpeciesInfo } = useSpeciesData();
  const { pasosDesde } = useEvolutions();

  // Nivel MÁXIMO del tramo en el que cae esta zona: es lo que decide hasta
  // dónde evoluciona lo que atrapes aquí antes del próximo jefe.
  const tramo = useMemo(() => tramoDeZona(zones, zoneIndex), [zones, zoneIndex]);

  // En un lugar fusionado cada cosa se mide con el tramo de SU visita: en la
  // Ruta 8 Parte 3 llevas veinte niveles más de tope que en la primera, y con
  // ellos evoluciona lo que antes no llegaba.
  const tramoDe = (zonaOrigen: number) => (zonaOrigen === zoneIndex ? tramo : tramoDeZona(zones, zonaOrigen));

  // Las variantes del romhack quedan fuera: se resuelven por `spriteBase` o
  // traen sus propios `tipos`, y su línea evolutiva no tiene por qué ser la de
  // la especie base (mismo criterio que en battlePrep — antes que inventarla,
  // no se dice nada).
  const evolucionDe = (nombre: string, cap: number, tipos?: string[], spriteBase?: string) =>
    tipos?.length || spriteBase ? null : lineaPorNivel(nombre, cap, pasosDesde);

  // Tipos a mostrar en la tarjeta de un Pokémon. Manda lo que traiga el JSON de
  // la guía (las variantes del romhack cambian de tipo respecto de su especie
  // base); si no, se toman de la Pokédex Z.
  const tiposDe = (nombre: string, tipos?: string[], spriteBase?: string): string[] => {
    if (tipos?.length) return tipos;
    return getSpeciesInfo(nombre, { spriteBase })?.typesEs ?? [];
  };

  // "Inicial del rival" va por TIPO ("Si tu inicial es PLANTA"), no por nombre,
  // así que hay que traducir la elección antes de filtrar.
  const sinTildes = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

  // El banner de arriba muestra la primera batalla importante desde esta zona
  // hacia adelante. Cuando esa batalla está en ESTA zona, repetirla abajo es
  // ruido: se lista dos veces el mismo equipo. Se llama a la misma función que
  // usa el banner en vez de reimplementar el criterio, que es como acaban
  // desincronizándose.
  // Son TODAS las de la zona, no solo la primera: el banner tiene flechas para
  // pasar de una a otra, así que ninguna se pierde por no listarla aquí.
  // En un lugar fusionado la batalla del banner puede venir de cualquiera de
  // sus visitas, no solo de la primera: se compara contra todas.
  const siguiente = findNextImportantBattle(zones, zoneIndex);
  const enBannerAqui =
    siguiente != null && (fusion ? fusion.entradas.includes(siguiente.zoneIndex) : siguiente.zoneIndex === zoneIndex);
  const enBanner = new Set(enBannerAqui ? siguiente!.importantes : []);
  const entrenadoresListados = zone.entrenadores.filter((t) => !enBanner.has(t));
  // Se busca por identidad y no por índice: la lista que se pinta ya viene
  // filtrada (fuera la batalla del banner), así que las posiciones no casan.
  const origenEntrenador = (t: ZoneTrainer): Origen => {
    const i = zone.entrenadores.indexOf(t);
    return origen(fusion?.entrenadores, i >= 0 ? i : 0);
  };

  // Qué habilidades tienes ya a la altura de ESTA zona. Se recalcula sobre la
  // lista entera de zonas porque depende del orden de juego, no de la zona.
  const disponibilidad = useMemo(() => construirDisponibilidad(zones), [zones]);
  const pendientesDe = (reqs?: Requisito[], zonaOrigen = zoneIndex) =>
    requisitosPendientes(reqs, zonaOrigen, disponibilidad);

  const inicialesRival = (zone.inicial_rival ?? []).filter(
    (i) => !inicial || sinTildes(i.siTuInicial) === sinTildes(STARTER_TIPO[inicial])
  );

  // Anterior/siguiente: manda lo que venga de fuera (en Lugares el salto no es
  // a la entrada de al lado); si no, la entrada contigua en el orden de la guía.
  const nav =
    navegacion ??
    (onNavigateIndex
      ? {
          anterior:
            zoneIndex > 0
              ? { nombre: nombreZona(zones[zoneIndex - 1].zona), ir: () => onNavigateIndex(zoneIndex - 1) }
              : null,
          siguiente:
            zoneIndex < zones.length - 1
              ? { nombre: nombreZona(zones[zoneIndex + 1].zona), ir: () => onNavigateIndex(zoneIndex + 1) }
              : null,
        }
      : null);

  const lugares = useMemo(() => resolverLugares(zones), [zones]);
  const posicionLugar = fusion ? lugares.findIndex((l) => l.principal === zoneIndex) + 1 : 0;
  // Un lugar puede abarcar varios tramos: la primera visita cae en uno y la
  // última en otro muy posterior. Se enseñan los dos extremos, porque el tope
  // con el que puedes plantarte aquí no es el mismo en cada vuelta.
  const tramoFinal = fusion ? tramoDe(fusion.entradas[fusion.entradas.length - 1]) : tramo;
  const maxCambia = tramoFinal.numero !== tramo.numero;

  return (
    <>
      {nav && (
        <div className="mb-3">
          <ZoneNav anterior={nav.anterior} siguiente={nav.siguiente} />
        </div>
      )}

      {zone.arco ? (
        <div className="mb-1 flex items-center gap-1.5 text-[13px] uppercase tracking-[0.15em] text-amber-400/80">
          <BookOpen className="h-3 w-3" />
          Arco de la historia · no es un lugar
        </div>
      ) : (
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[13px] uppercase tracking-[0.15em] text-slate-500">
          <span className="h-1 w-1 rounded-full bg-sky-400" />
          {fusion ? `Lugar ${posicionLugar} de ${lugares.length}` : `Zona ${activeIndex + 1} de ${zones.length}`}
          {zone.arcoDe && (
            <span className="flex items-center gap-1 text-amber-400/70">
              <BookOpen className="h-3 w-3" />
              Arco {zone.arcoDe}
            </span>
          )}
          <span
            className="flex items-center gap-1 text-sky-400/80"
            title={
              (tramo.hito
                ? `Tramo ${tramo.numero} de ${tramo.total} — hasta ${tramo.hito.etiqueta} (${tramo.hito.entrenador}).` +
                  (tramo.cap === null
                    ? " Aquí el máximo ya no es fijo: los rivales escalan con la media de nivel de tu equipo."
                    : ` Tu equipo no pasa del nivel ${tramo.cap} hasta ganar ese combate.`)
                : "Postgame: ya no queda nada que superar, el máximo es el nivel 100.") +
              (maxCambia
                ? ` En la última visita a este sitio el máximo ya es ${textoMax(tramoFinal)}.`
                : "")
            }
          >
            <ArrowUpNarrowWide className="h-3 w-3" />
            {etiquetaMax(tramo)}
            {maxCambia && ` → ${textoMax(tramoFinal)}`}
            {tramo.hito && ` · ${tramo.hito.etiqueta}`}
          </span>
        </div>
      )}
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">
          {/* El "(Opcional)" del título se cambia por la marca: decirlo dos
              veces en la misma línea no aporta nada. El nombre se formatea
              DESPUÉS de quitarlo — "PETROCUEVA (Opcional)" no contaba como
              mayúsculas por el paréntesis y se quedaba sin arreglar. */}
          {zone.opcional ? nombreZona(sinSufijoOpcional(zone.zona)) : nombreZona(zone.zona)}
          {zone.opcional && <ChipOpcional tamano="detalle" />}
        </h2>
        {onToggleVisited && (
          <button
            type="button"
            onClick={() => onToggleVisited(zone.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wide transition ${
              visited
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            {visited ? "Visitada" : "Marcar visitada"}
          </button>
        )}
      </div>

      {/* De qué entradas de la guía está hecho este lugar. Sirve para dos cosas:
          avisar de que aquí se vuelve más de una vez, y poder leer esa vuelta en
          su sitio del recorrido, que es donde dice qué te trae de nuevo. */}
      {fusion && fusion.entradas.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
          <History className="h-3 w-3" />
          {fusion.entradas.length} visitas:
          {fusion.entradas.map((i, n) => (
            <button
              key={i}
              type="button"
              disabled={!onVerEnHistoria}
              onClick={() => onVerEnHistoria?.(i)}
              title={onVerEnHistoria ? `Ver "${nombreZona(zones[i].zona)}" en la historia` : undefined}
              className="rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 font-medium text-slate-400 transition enabled:hover:border-sky-500/40 enabled:hover:text-sky-300 disabled:cursor-default"
            >
              {n + 1}. {nombreZona(zones[i].zona)}
            </button>
          ))}
        </div>
      )}

      {/* Lo que se consigue aquí, cuando la entrada es un objetivo y no un
          sitio ("Atrapar a los Tapus"). Va antes de las conexiones porque es
          de lo que trata la entrada entera. */}
      {zone.capturas && zone.capturas.length > 0 && (
        <BloqueCapturas especies={zone.capturas} getSpriteUrl={getSpriteUrl} />
      )}

      {/* Conexiones */}
      {zone.conexiones.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {zone.conexiones.map((c) => {
            const target = zones.find((z) => z.zona === c);
            return (
              <button
                key={c}
                type="button"
                disabled={!target}
                onClick={() => target && onNavigate(target.zona)}
                className="flex items-center gap-1 rounded-full border border-dashed border-sky-500/40 bg-sky-500/5 px-3 py-1 text-[12px] font-medium text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-default disabled:opacity-60"
              >
                <Link2 className="h-2.5 w-2.5" /> {nombreZona(c)}
              </button>
            );
          })}
        </div>
      )}

      <BadgesColeccionables
        alquimia={alquimia}
        paginasAlquimia={paginasAlquimia}
        regalo={regalo}
        nidoAlfa={zone.nido_alfa}
        habitante={zone.habitante_acrilico}
        collection={collection}
        origenPagina={(i) => origen(fusion?.paginas, i)}
        indiceNido={fusion?.nido ?? zoneIndex}
        indiceHabitante={fusion?.habitante ?? zoneIndex}
        pendientesDe={pendientesDe}
      />

      {/* Pokémon salvajes */}
      <div className="mb-6">
        <SectionHead icon={<Leaf className="h-3.5 w-3.5" />} color="text-emerald-400" title="Pokémon salvajes" count={zone.pokemon_salvajes.length} />
        {zone.pokemon_salvajes.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {zone.pokemon_salvajes.map((p, i) => {
              const sprite = getSpriteUrl?.(p.nombre, p.spriteBase) ?? null;
              const EncIcon = encounterIcon(p.metodo);
              const accentKind = encounterAccentKind(p.metodo);
              const o = origen(fusion?.salvajes, i);
              const tramoAqui = tramoDe(o.zona);
              const evo = evolucionDe(p.nombre, tramoAqui.capEfectivo, p.tipos, p.spriteBase);
              return (
                <div
                  key={`${p.nombre}-${i}`}
                  className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/45 p-3 transition hover:border-emerald-500/30 hover:bg-slate-950/60"
                >
                  {accentKind && <EncounterAccent kind={accentKind} />}
                  <div className="relative z-10 mb-2 flex items-center gap-2">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                      {sprite ? (
                        <ZoneSpriteImg
                          rawUrl={sprite}
                          alt={p.nombre}
                          className="h-9 w-9 object-contain [image-rendering:pixelated]"
                          placeholderClassName="h-5 w-5 opacity-40 animate-pulse"
                        />
                      ) : (
                        <Leaf className="h-4 w-4 text-emerald-400" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{p.nombre}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {p.nivel && (
                            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[13px] font-bold tabular-nums text-violet-300 ring-1 ring-violet-500/30">
                              Nv. {p.nivel}
                            </span>
                          )}
                          {p.porcentaje && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[13px] font-bold tabular-nums text-emerald-400 ring-1 ring-emerald-500/20">
                              {p.porcentaje}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide ${
                            accentKind ? ACCENT_CHIP_CLASS[accentKind] : DEFAULT_CHIP_CLASS
                          }`}
                        >
                          <EncIcon className="h-2.5 w-2.5" /> {p.metodo}
                        </span>
                        <VisitaChip n={visitaDe(o)} />
                        {tiposDe(p.nombre, p.tipos, p.spriteBase).map((tipo) => (
                          <span
                            key={tipo}
                            style={typeEsChipStyle(tipo)}
                            className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide"
                          >
                            {tipo}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Hasta dónde evoluciona con el máximo de este tramo. Es la
                      diferencia entre atrapar un Gible que llega a Garchomp
                      antes del jefe y uno que se queda en Gabite: sin esto hay
                      que saberse los niveles de memoria. */}
                  {evo && (evo.alcanzables.length > 0 || evo.bloqueada || evo.porOtraVia.length > 0) && (
                    <div className="relative z-10 mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-snug">
                      <CornerRightDown className="h-2.5 w-2.5 shrink-0 text-sky-400/70" />
                      {evo.alcanzables.length > 0 && (
                        <span className="font-semibold text-sky-300/90">
                          {evo.alcanzables.map((f) => `${f.nombre} (Nv. ${f.nivel})`).join(" / ")}
                        </span>
                      )}
                      {evo.bloqueada && (
                        <span className="text-slate-500" title={`El máximo de este tramo es ${textoMax(tramoAqui)}.`}>
                          {evo.alcanzables.length > 0 ? "· " : ""}
                          {evo.bloqueada.nombre} al {evo.bloqueada.nivel}, fuera del MAX
                        </span>
                      )}
                      {evo.alcanzables.length === 0 && !evo.bloqueada && evo.porOtraVia.length > 0 && (
                        <span
                          className="text-slate-500"
                          title={evo.porOtraVia.map((paso) => `${paso.a}: ${paso.metodo}`).join(" · ")}
                        >
                          evoluciona sin depender del nivel
                        </span>
                      )}
                    </div>
                  )}
                  {p.drop && <p className="relative z-10 text-xs leading-snug text-slate-400">{p.drop}</p>}
                  {p.nota && <p className="relative z-10 mt-1 text-[13px] leading-snug text-slate-500">{p.nota}</p>}
                  <div className="relative z-10">
                    <RequisitoChips requisitos={p.requisitos} pendientes={pendientesDe(p.requisitos, o.zona)} />
                    {pendientes && p.requisitos?.length ? (
                      <BotonPendiente actions={pendientes} entry={crearPendiente(zones[o.zona], "Encuentro", p.nombre, [p.metodo, p.nota].filter(Boolean).join(" · "), p.requisitos)} />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyHint>Sin Pokémon salvajes registrados en esta zona.</EmptyHint>
        )}
      </div>

      <SeccionObjetos
        objetos={zone.objetos}
        zonaDe={(index) => zones[index]}
        pendientes={pendientes}
        origenDe={(i) => origen(fusion?.objetos, i)}
        visitaDe={visitaDe}
        pendientesDe={pendientesDe}
      />

      {/* Inicial del rival — depende del que elijas tú */}
      {inicialesRival.length > 0 && (
        <div className="mb-6">
          <SectionHead icon={<Sparkles className="h-3.5 w-3.5" />} color="text-sky-300" title="Inicial del rival" count={inicialesRival.length} />
          <StarterPicker getSpriteUrl={getSpriteUrl} />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {inicialesRival.map((i) => (
              <div key={i.siTuInicial} className="rounded-xl border border-slate-700/50 bg-slate-950/45 p-3">
                <div className="text-[13px] font-semibold uppercase tracking-wide text-sky-300">
                  Si tu inicial es {i.siTuInicial}
                </div>
                <div className="mt-0.5 text-[13px] font-bold">{i.detalle}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversiones de especie que ofrece un NPC */}
      {zone.conversiones && zone.conversiones.length > 0 && (
        <div className="mb-6">
          <SectionHead icon={<Repeat className="h-3.5 w-3.5" />} color="text-violet-300" title="Conversiones" count={zone.conversiones.length} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {zone.conversiones.map((c, i) => (
              <div key={`${c.de}-${i}`} className="rounded-xl border border-slate-700/50 bg-slate-950/45 p-2.5">
                <div className="flex items-center gap-1.5 text-[13px] font-bold">
                  <span className="truncate">{c.de}</span>
                  <span className="shrink-0 text-violet-300">→</span>
                  <span className="truncate">{c.a}</span>
                </div>
                {c.nota && <div className="mt-0.5 text-[13px] leading-snug text-slate-500">{c.nota}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entrenadores — sin el que ya ocupa el banner de arriba */}
      {entrenadoresListados.length > 0 && (
        <div className="mb-6">
          <SectionHead icon={<Swords className="h-3.5 w-3.5" />} color="text-red-400" title="Entrenadores" count={entrenadoresListados.length} />
          {enBanner.size > 0 && (
            <p className="-mt-1 mb-2.5 text-[13px] text-slate-500">
              {enBanner.size === 1
                ? `${[...enBanner][0].nombre} no aparece aquí: es la batalla importante de la zona y ya está arriba.`
                : `Las ${enBanner.size} batallas importantes de la zona no aparecen aquí: están arriba, y se pasa de una a otra con las flechas.`}
            </p>
          )}
          <div className="space-y-3">
            {entrenadoresListados.map((t, i) => (
              <div
                key={`${t.nombre}-${i}`}
                className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/50 p-3.5"
              >
                <span className="pointer-events-none absolute left-2 top-2 h-2 w-2 border-l border-t border-red-500/30" />
                <span className="pointer-events-none absolute right-2 top-2 h-2 w-2 border-r border-t border-red-500/30" />
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                    <Swords className="h-3.5 w-3.5 text-red-400" />
                    {t.nombre}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <VisitaChip n={visitaDe(origenEntrenador(t))} />
                    {t.secuencia && (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-amber-300">
                        {t.secuencia}
                        {t.ordenSecuencia ? ` · ${t.ordenSecuencia}` : ""}
                      </span>
                    )}
                    {t.tipo === "importante" && (
                      <span className="rounded-full border border-red-400/30 bg-red-400/15 px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-red-400">
                        Importante
                      </span>
                    )}
                  </span>
                </div>
                {/* Solo en combates de rival: el resto de entrenadores no
                    tienen la ranura que depende del inicial. */}
                {tieneRanuraCondicional(t.equipo) && <StarterPicker getSpriteUrl={getSpriteUrl} />}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {equipoSegunInicial(t.equipo, inicial).map((m, j) => (
                    <MonCard key={`${m.especie}-${j}`} mon={m} getSpriteUrl={getSpriteUrl} variante="zona" />
                  ))}
                </div>
                {t.notas && <p className="mt-2.5 text-xs leading-snug text-slate-400">{t.notas}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MTs */}
      {zone.mts.length > 0 && (
        <div className="mb-6">
          <SectionHead icon={<Disc className="h-3.5 w-3.5" />} color="text-sky-300" title="MTs" count={zone.mts.length} />
          <div className="flex flex-col gap-1.5">
            {zone.mts.map((m, i) => {
              const o = origen(fusion?.mts, i);
              const mtChecked = collection?.isMtChecked(o.zona, o.i) ?? false;
              return (
                <div
                  key={`${m.numero}-${i}`}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition ${
                    mtChecked
                      ? "border-emerald-500/30 bg-emerald-500/5 text-slate-300"
                      : "border-slate-700/50 bg-slate-950/40 text-slate-300"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 ring-1 ring-sky-500/20">
                    <Disc className="h-4 w-4 text-sky-300" />
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-sky-300">
                        {/* `numero` ya viene como "MT59": anteponer "MT" a pelo
                            imprimía "MT MT59" en todas las zonas. */}
                        {/^MT/i.test(String(m.numero)) ? m.numero : `MT ${m.numero}`}
                      </span>
                      <span className="font-semibold">{m.movimiento}</span>
                    </div>
                    {m.contexto && <span className="mt-0.5 block text-xs text-slate-500">{m.contexto}</span>}
                    <RequisitoChips requisitos={m.requisitos} pendientes={pendientesDe(m.requisitos, o.zona)} />
                    {pendientes && m.requisitos?.length ? (
                      <BotonPendiente actions={pendientes} entry={crearPendiente(zones[o.zona], "MT", `${m.numero} · ${m.movimiento}`, m.contexto, m.requisitos)} />
                    ) : null}
                  </div>
                  {collection && (
                    <CollectCheck checked={mtChecked} onToggle={() => collection.toggleMt(o.zona, o.i)} label={m.numero} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Intercambios */}
      {zone.intercambios.length > 0 && (
        <div className="mb-6">
          <SectionHead icon={<Repeat className="h-3.5 w-3.5" />} color="text-slate-300" title="Intercambios" count={zone.intercambios.length} />
          <div className="flex flex-col gap-1.5">
            {zone.intercambios.map((tr, i) => (
              <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-[13px] text-slate-300">
                {tr.detalle}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notas generales */}
      {zone.notas_generales.length > 0 && (
        <div>
          <SectionHead icon={<StickyNote className="h-3.5 w-3.5" />} color="text-slate-300" title="Notas generales" />
          {/* El cuerpo de texto de la guía: párrafos enteros que se leen
              seguidos, no etiquetas. Va en text-sm (16px) y no en píxeles
              sueltos — es lo más largo que se lee en toda la página. */}
          <ul className="list-disc space-y-1.5 rounded-xl border border-slate-700/50 bg-slate-950/40 px-5 py-3 text-sm leading-relaxed text-slate-300">
            {zone.notas_generales.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {nav && (
        <div className="mt-6 border-t border-slate-800/70 pt-4">
          <ZoneNav anterior={nav.anterior} siguiente={nav.siguiente} />
        </div>
      )}
    </>
  );
}
