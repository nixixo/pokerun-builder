"use client";

// Los índices sirven para navegar; la persistencia usa IDs estables y migración v1 → v2.

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Search, Loader2, Check, FlaskConical, Disc, Sparkles, UserPlus, BookOpen, MapPin, History } from "lucide-react";
import { useZonesData } from "@/components/guia/useZonesData";
import { useGlobalSearchIndex } from "@/components/guia/useGlobalSearchIndex";
import { usePokemonZSprites } from "@/components/guia/usePokemonZSprites";
import { useZoneProgress } from "@/components/guia/useZoneProgress";
import { GlobalSearch } from "@/components/guia/globalSearch";
import { ZoneDetail } from "@/components/guia/zoneDetail";
// La vista de mapa arrastra la librería `motion` (~45 KB) y solo se muestra
// cuando el usuario cambia a view === "mapa", así que se carga bajo demanda.
const ZoneMapImageView = dynamic(
  () => import("@/components/guia/zoneMapImageView").then((m) => m.ZoneMapImageView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    ),
  }
);
import { GuiaHeader } from "@/components/guia/guiaHeader";
import { NextImportantBattle } from "@/components/guia/nextImportantBattle";
import type { Zone } from "@/components/guia/types";
import { COLLECTION_TOTALS } from "@/components/guia/collectionTotals";
import { nombreZona, sinSufijoOpcional } from "@/components/guia/formato";
import { ChipOpcional } from "@/components/guia/zona/opcional";
import { ZoneSpriteImg } from "@/components/guia/zoneSpriteImage";
import { fusionarLugar, lugarDeZona, lugarQueContiene, resolverLugares } from "@/components/guia/lugares";
import { activeZoneCodec } from "./progressIdentity";
import { ListaPendientes } from "./listaPendientes";
import { usePendientes } from "./usePendientes";
import { useGuideCollections } from "./useGuideCollections";
import { codecTexto, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";

const LS_KEY_ZONE = "guia:lastZoneIndex";
const LS_KEY_VIEW = "guia:lastView";
const LS_KEY_MODO = "guia:lastModo";

// Dos formas de recorrer los mismos datos. "historia" es el orden de la guía,
// con sus vueltas y sus segundas visitas; "zonas" enseña cada sitio una sola
// vez, con todo lo suyo junto. Ver components/guia/lugares.ts.
type Modo = "historia" | "zonas";

const codecVista = codecTexto(["lista", "mapa"] as const);
const codecModo = codecTexto(["historia", "zonas"] as const);

const MODOS: { key: Modo; label: string; icon: React.ComponentType<{ className?: string }>; title: string }[] = [
  {
    key: "historia",
    label: "Historia",
    icon: History,
    title: "El orden de la guía: cada visita a un sitio es su propia entrada.",
  },
  {
    key: "zonas",
    label: "Zonas",
    icon: MapPin,
    title: "Cada sitio una sola vez, con todo lo de sus visitas junto en una pantalla.",
  },
];

type CollectionFilterKey = "paginas" | "mts" | "nidos" | "habitantes";

const COLLECTION_FILTERS: {
  key: CollectionFilterKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
  hoverClass: string;
}[] = [
  {
    key: "paginas",
    label: "Páginas",
    icon: FlaskConical,
    activeClass: "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-300",
    hoverClass: "hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10 hover:text-fuchsia-300",
  },
  {
    key: "mts",
    label: "MTs",
    icon: Disc,
    activeClass: "border-sky-400/60 bg-sky-500/15 text-sky-300",
    hoverClass: "hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300",
  },
  {
    key: "nidos",
    label: "Nidos",
    icon: Sparkles,
    activeClass: "border-orange-400/60 bg-orange-500/15 text-orange-300",
    hoverClass: "hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-300",
  },
  {
    key: "habitantes",
    label: "Habitantes",
    icon: UserPlus,
    activeClass: "border-indigo-400/60 bg-indigo-500/15 text-indigo-300",
    hoverClass: "hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-300",
  },
];

/**
 * Entradas que no tienen NADA que enseñar: abrirlas deja el panel en blanco con
 * el nombre y poco más. Son tres — "Listado de Habitantes de Acrílico", que es
 * un apéndice cuyo contenido ya está repartido en el campo `habitante_acrilico`
 * de cada zona, y los dos "COMIENZO DEL ... ACTO", que la extracción del .docx
 * dejó como ubicaciones vacías.
 *
 * Se ocultan de la lista para conservar la secuencia editorial de la guía.
 * El progreso usa IDs estables, independientes de esa secuencia.
 *
 * Ojo, no es lo mismo que `tieneContenidoDeSitio` de lugares.ts: allí las notas
 * NO cuentan (una entrada de solo notas es un paso de guion, y en Historia sí
 * pinta algo), aquí sí.
 */
function sinNadaQueMostrar(z: Zone): boolean {
  // Arcos y actos se quedan: están vacíos a propósito, marcan capítulo.
  if (z.arco || z.separador) return false;
  return (
    z.pokemon_salvajes.length === 0 &&
    z.objetos.length === 0 &&
    z.mts.length === 0 &&
    z.entrenadores.length === 0 &&
    z.intercambios.length === 0 &&
    (z.conversiones?.length ?? 0) === 0 &&
    (z.inicial_rival?.length ?? 0) === 0 &&
    z.notas_generales.length === 0 &&
    !z.pagina_alquimia?.presente &&
    !z.nido_alfa &&
    !z.habitante_acrilico &&
    !z.regalo_pokemon?.presente
  );
}

function zoneMatchesFilter(z: Zone, key: CollectionFilterKey): boolean {
  switch (key) {
    case "paginas":
      return !!z.pagina_alquimia?.presente;
    case "mts":
      return (z.mts?.length ?? 0) > 0;
    case "nidos":
      return !!z.nido_alfa;
    case "habitantes":
      return !!z.habitante_acrilico;
  }
}

function ZoneBadgeDots({ zone, visited }: { zone: Zone; visited: boolean }) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      {visited && <Check className="h-3.5 w-3.5 text-emerald-400" />}
      {zone.pokemon_salvajes.length > 0 && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399]" title="Pokémon salvajes" />
      )}
      {zone.objetos.length > 0 && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_#fbbf24]" title="Objetos" />
      )}
      {zone.entrenadores.length > 0 && (
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_4px_#f87171]" title="Entrenadores" />
      )}
      {zone.pagina_alquimia?.presente && (
        <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_4px_#e879f9]" title="Página de alquimia" />
      )}
      {zone.nido_alfa && <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_4px_#fb923c]" title="Nido Alfa" />}
      {zone.habitante_acrilico && (
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_4px_#818cf8]" title="Habitante de Pueblo Acrílico" />
      )}
    </span>
  );
}

/**
 * El rótulo de una fila de la lista: la cara de lo que se atrapa, si la entrada
 * es un objetivo de captura, y el nombre ya sin el "(Opcional)" — eso lo dice
 * aparte el ChipOpcional, y repetirlo en un nombre truncado se come el sitio de
 * lo que sí distingue una fila de otra.
 *
 * El nombre llega hecho: en Historia es el de la entrada, y en Zonas el del
 * lugar entero, que no es lo mismo.
 */
function EtiquetaFila({
  nombre,
  zone,
  getSpriteUrl,
}: {
  nombre: string;
  zone: Zone;
  getSpriteUrl: (speciesName: string, spriteBase?: string) => string | null;
}) {
  const primera = zone.capturas?.[0];
  return (
    <>
      {primera && (
        <ZoneSpriteImg
          rawUrl={getSpriteUrl(primera)}
          alt={primera}
          className="h-5 w-5 shrink-0 [image-rendering:pixelated]"
          placeholderClassName="h-3.5 w-3.5 shrink-0 opacity-40"
        />
      )}
      {/* Se vuelve a pasar por nombreZona: "PETROCUEVA (Opcional)" no era del
          todo mayúsculas por culpa del paréntesis, así que se quedaba sin
          formatear. Sin el sufijo ya sí, y sale "Petrocueva". */}
      <span className="truncate">{zone.opcional ? nombreZona(sinSufijoOpcional(nombre)) : nombre}</span>
    </>
  );
}

// Totales conocidos de cada colección: ver components/guia/collectionTotals.ts.

function CollectionRow({
  icon: Icon,
  label,
  color,
  count,
  total,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-slate-400">{label}</span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-300">
            {count}/{total}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800/80">
          <div className={`h-full rounded-full ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function GuiaPage() {
  const { zones, loading, error } = useZonesData();
  const { search: globalSearch } = useGlobalSearchIndex(zones);
  const { getSpriteUrl } = usePokemonZSprites();
  const { isVisited, toggleVisited, visitedCount } = useZoneProgress();

  const { collection, paginasProgress, mtsProgress, nidosProgress, habitantesProgress } = useGuideCollections(zones);

  const pendientes = usePendientes();

  const [search, setSearch] = useState("");
  const [activeZoneId, setActiveZoneId] = usePreferenciaLocal(`${LS_KEY_ZONE}:v2`, null, activeZoneCodec, LS_KEY_ZONE);
  const activeZoneIndex = zones.findIndex((zone) => zone.id === activeZoneId);
  const setActiveZoneIndex = (index: number) => setActiveZoneId(zones[index]?.id ?? null);
  const [view, setView] = usePreferenciaLocal(LS_KEY_VIEW, "lista", codecVista);
  const [modo, setModo] = usePreferenciaLocal(LS_KEY_MODO, "historia", codecModo);
  const [activeFilters, setActiveFilters] = useState<Set<CollectionFilterKey>>(new Set());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function toggleFilter(key: CollectionFilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Lista filtrada, conservando el índice original de cada zona (clave
  // real de identidad) junto al objeto.
  const filteredZones = useMemo(() => {
    const f = search.trim().toLowerCase();
    let withIndex = zones.map((z, index) => ({ z, index })).filter(({ z }) => !sinNadaQueMostrar(z));
    if (f) withIndex = withIndex.filter(({ z }) => z.zona.toLowerCase().includes(f));
    if (activeFilters.size > 0) {
      withIndex = withIndex.filter(({ z }) => {
        for (const key of activeFilters) {
          if (zoneMatchesFilter(z, key)) return true;
        }
        return false;
      });
    }
    return withIndex;
  }, [zones, search, activeFilters]);

  // Los arcos narrativos no son sitios que visitar, y las entradas vacías ni
  // siquiera se listan, así que ninguno cuenta para el porcentaje de
  // exploración.
  const zonasReales = zones.filter((z) => !z.arco && !z.separador && !sinNadaQueMostrar(z)).length;

  const activeIndex = activeZoneIndex !== null && zones[activeZoneIndex] ? activeZoneIndex : zones.length > 0 ? 0 : -1;
  const activeZone = activeIndex >= 0 ? zones[activeIndex] : null;

  // Cada sitio una sola vez, en el mismo orden de historia: el de su primera
  // visita. Ver components/guia/lugares.ts.
  const lugares = useMemo(() => resolverLugares(zones), [zones]);

  const lugaresFiltrados = useMemo(() => {
    const f = search.trim().toLowerCase();
    return lugares.filter((l) => {
      // Se busca por el nombre del lugar Y por el de sus entradas: quien
      // escribe "parte 2" está buscando la Ruta 8 igual.
      if (
        f &&
        !l.nombre.toLowerCase().includes(f) &&
        !l.entradas.some((i) => zones[i].zona.toLowerCase().includes(f))
      ) {
        return false;
      }
      if (activeFilters.size === 0) return true;
      return l.entradas.some((i) => {
        for (const key of activeFilters) {
          if (zoneMatchesFilter(zones[i], key)) return true;
        }
        return false;
      });
    });
  }, [lugares, zones, search, activeFilters]);

  // En la vista de Zonas lo que se enseña es el LUGAR que contiene la entrada
  // activa. La navegación usa su primera visita; al persistir se convierte
  // ese índice al ID estable de la zona.
  const lugarActivo = modo === "zonas" && activeIndex >= 0 ? lugarDeZona(zones, activeIndex) : null;
  const zonaMostrada = lugarActivo ? fusionarLugar(zones, lugarActivo) : activeZone;
  const indiceMostrado = lugarActivo ? lugarActivo.principal : activeIndex;
  const posicionLugar = lugarActivo ? lugares.indexOf(lugarActivo) : -1;

  // Un lugar está visitado cuando lo están todas sus visitas; marcarlo marca
  // todas de golpe, que es lo que el botón promete.
  const lugarVisitado = lugarActivo ? lugarActivo.entradas.every((i) => isVisited(zones[i].id)) : false;
  const toggleLugarVisitado = () => {
    if (!lugarActivo) return;
    const nombres = Array.from(new Set(lugarActivo.entradas.map((i) => zones[i].id)));
    for (const nombre of nombres) {
      if (isVisited(nombre) === lugarVisitado) toggleVisited(nombre);
    }
  };

  /**
   * Ir a una entrada concreta desde fuera de la lista (buscador global, mapa,
   * pills de conexiones). Si en la vista de Zonas el destino no es un sitio
   * sino un paso de guion, se cambia a Historia: es donde ese paso existe.
   */
  function irAZona(idx: number) {
    setActiveZoneIndex(idx);
    setMobileNavOpen(false);
    if (modo === "zonas" && !lugarQueContiene(zones, idx)) setModo("historia");
  }

  // (la persistencia de vista/modo/zona la lleva usePreferenciaLocal, arriba:
  // se escribe al cambiarlas, no en un efecto que las siga)

  // La lista de zonas se recorre desde fuera: con las flechas de anterior/
  // siguiente del detalle, con los pills de conexiones, con el buscador global.
  // Sin esto la lista se queda donde estaba y la zona activa acaba fuera de
  // pantalla, así que se centra sola en cuanto cambia.
  const listaRef = useRef<HTMLDivElement>(null);
  const activoRef = useRef<HTMLButtonElement>(null);
  // El primer centrado (restaurar la zona guardada al abrir) va sin animación:
  // ver la lista desplazándose sola nada más entrar parece un fallo.
  const yaCentro = useRef(false);

  useEffect(() => {
    const lista = listaRef.current;
    const activo = activoRef.current;
    if (!lista || !activo) return;

    // Por rect y no por offsetTop: el botón no tiene por qué tener al contenedor
    // como offsetParent, y con cualquier ancestro posicionado en medio la cuenta
    // saldría desplazada.
    const rActivo = activo.getBoundingClientRect();
    const rLista = lista.getBoundingClientRect();
    const delta = rActivo.top - rLista.top - (rLista.height - rActivo.height) / 2;
    if (Math.abs(delta) < 2) return;

    lista.scrollBy({ top: delta, behavior: yaCentro.current ? "smooth" : "auto" });
    yaCentro.current = true;
  }, [indiceMostrado, view, modo, filteredZones, lugaresFiltrados]);

  // Navegación por nombre (usada por los pills de "conexiones" en el
  // detalle, y por el buscador global si en algún caso solo tiene el
  // nombre) — resuelve a la primera zona con ese nombre.
  function navigateByName(zoneName: string) {
    const idx = zones.findIndex((z) => z.zona === zoneName);
    if (idx >= 0) irAZona(idx);
  }

  return (
    // `pantalla-segura` (globals.css): laterales e inferior respetando la
    // muesca y la barra de gestos del móvil. El superior lo pone Tailwind.
    <div className="min-h-screen pantalla-segura pt-4 sm:pt-6 bg-linear-to-b from-slate-900 via-[#041229] to-[#031022] text-slate-100">
      <div className="w-full">
        <GuiaHeader
          visitedCount={visitedCount}
          totalZones={zonasReales}
          view={view}
          onViewChange={setView}
          collection={{
            paginas: paginasProgress.checkedCount,
            mts: mtsProgress.checkedCount,
            nidos: nidosProgress.checkedCount,
            habitantes: habitantesProgress.checkedCount,
          }}
        >
          {!loading && !error && zones.length > 0 && (
            <GlobalSearch onSearch={globalSearch} onSelect={irAZona} />
          )}
        </GuiaHeader>

        <ListaPendientes
          entries={pendientes.entries}
          getSpriteUrl={getSpriteUrl}
          onRemove={pendientes.remove}
          onNavigate={(id) => {
            const index = zones.findIndex((zone) => zone.id === id);
            if (index < 0) return;
            irAZona(index);
            setModo("historia");
            setView("lista");
            requestAnimationFrame(() => document.getElementById("guide-zone-detail")?.scrollIntoView());
          }}
        />

        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/40 py-24 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando zonas…</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            No se pudo cargar la guía: {error}
          </div>
        )}

        {!loading && !error && zones.length > 0 && view === "mapa" && (
          <ZoneMapImageView
            zones={zones}
            activeZoneIndex={activeIndex}
            isVisited={isVisited}
            onSelect={(index) => {
              irAZona(index);
              setView("lista");
            }}
          />
        )}

        {!loading && !error && zones.length > 0 && view === "lista" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] items-start">
            {/* Sidebar — panel estilo Pokédex */}
          <aside className={`relative rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-3.5 flex flex-col overflow-hidden shadow-lg shadow-black/30 md:sticky md:top-4 md:max-h-[calc(100vh-32px)] ${mobileNavOpen ? "max-h-[70vh]" : "max-h-[60px] md:max-h-[calc(100vh-32px)]"}`}>
              {/* Marcas de esquina, detalle HUD */}
              <span className="pointer-events-none absolute left-2.5 top-2.5 h-2.5 w-2.5 border-l border-t border-sky-500/40" />
              <span className="pointer-events-none absolute right-2.5 top-2.5 h-2.5 w-2.5 border-r border-t border-sky-500/40" />

              <button type="button" aria-expanded={mobileNavOpen} aria-controls="guide-navigation" onClick={() => setMobileNavOpen((open) => !open)} className="flex min-h-8 items-center justify-between gap-2 text-left text-base font-semibold uppercase tracking-[0.15em] text-slate-300 md:hidden">
                <span className="flex min-w-0 items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_5px_#38bdf8]" /><span className="truncate">Guía: {nombreZona(zonaMostrada?.zona ?? "Explorar zonas")}</span></span>
                <span className="text-xs font-medium tracking-normal text-sky-300">{mobileNavOpen ? "Cerrar" : "Explorar"}</span>
              </button>
              <div id="guide-navigation" className={`${mobileNavOpen ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
              <h2 className="mb-2.5 hidden items-center gap-2 text-base font-semibold uppercase tracking-[0.15em] text-slate-400 md:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_5px_#38bdf8]" />
                Guía
              </h2>
              {/* Historia = el recorrido tal cual, con sus vueltas. Zonas = cada
                  sitio una vez, con todo lo suyo junto. Mismos datos, dos ejes. */}
              <div className="mb-2.5 flex rounded-lg border border-slate-700/60 bg-slate-950/60 p-0.5">
                {MODOS.map(({ key, label, icon: Icon, title }) => {
                  const activo = modo === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={title}
                      onClick={() => setModo(key)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] transition ${
                        activo
                          ? "bg-sky-500/15 text-sky-300 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.4)]"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="relative mb-2.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={modo === "zonas" ? "Buscar lugar" : "Buscar zona"}
                  placeholder="Buscar zona…"
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 py-2 pl-8 pr-3 text-base text-slate-100 outline-none focus:border-sky-500/60"
                />
              </div>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {COLLECTION_FILTERS.map(({ key, label, icon: Icon, activeClass, hoverClass }) => {
                  const active = activeFilters.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFilter(key)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        active ? activeClass : `border-slate-700/60 text-slate-400 ${hoverClass}`
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mb-2 text-sm text-slate-500">
                {modo === "zonas"
                  ? `Mostrando ${lugaresFiltrados.length} de ${lugares.length} lugares`
                  : `Mostrando ${filteredZones.length} de ${zones.length}`}
              </p>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700/60 to-transparent mb-2" />
              {/* `overscroll-contain`: al llegar al final de la lista de zonas
                  el gesto dejaba de mover la lista y empezaba a mover la página
                  entera, que es de lo más desconcertante en un móvil.

                  `content-visibility: auto` es el sustituto barato de
                  virtualizar: son 204 filas en Historia y 137 en Zonas, y el
                  navegador se salta el layout y el pintado de las que están
                  fuera de la vista. `contain-intrinsic-size` le da una altura
                  estimada a las no pintadas para que la barra de scroll no
                  pegue saltos. Sin librerías y sin tocar el marcado. */}
              <div
                ref={listaRef}
                className="flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 max-h-[35vh] md:max-h-[62vh] [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_36px]"
              >
                {modo === "zonas" &&
                  lugaresFiltrados.map((lugar) => {
                    const isActive = lugar.principal === indiceMostrado;
                    const fusionada = fusionarLugar(zones, lugar);
                    const visitado = lugar.entradas.every((i) => isVisited(zones[i].id));
                    return (
                      <button
                        key={lugar.clave}
                        ref={isActive ? activoRef : undefined}
                        type="button"
                        onClick={() => { setActiveZoneIndex(lugar.principal); setMobileNavOpen(false); }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-base transition ${
                          isActive
                            ? "border-sky-400/50 bg-sky-500/10 text-white shadow-[inset_2px_0_0_0_#38bdf8]"
                            : "border-transparent text-slate-300 hover:bg-slate-800/40 hover:text-slate-100"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <EtiquetaFila nombre={lugar.nombre} zone={fusionada} getSpriteUrl={getSpriteUrl} />
                          {/* Cuántas veces pasa la historia por aquí. Es lo que
                              explica que este sitio traiga más cosas de las que
                              se ven en la primera visita. */}
                          {lugar.entradas.length > 1 && (
                            <span
                              title={`La guía pasa ${lugar.entradas.length} veces por aquí.`}
                              className="shrink-0 rounded-full border border-slate-600/50 bg-slate-800/50 px-1.5 text-[12px] font-bold tabular-nums text-slate-400"
                            >
                              ×{lugar.entradas.length}
                            </span>
                          )}
                          {fusionada.opcional && <ChipOpcional />}
                        </span>
                        <ZoneBadgeDots zone={fusionada} visited={visitado} />
                      </button>
                    );
                  })}
                {modo === "historia" &&
                  filteredZones.map(({ z, index }) => {
                  const isActive = index === activeIndex;
                  return (
                    // Un arco no es un sitio al que se pueda ir, así que deja de
                    // ser un botón: es un separador de capítulo, con la
                    // instrucción de a dónde toca ir escrita ahí mismo. Su
                    // contenido no se pierde — la batalla importante que hay
                    // dentro del arco Yveltal sigue llegando por el banner, que
                    // navega por índice.
                    z.separador === "acto" ? (
                      // Un ACTO parte la historia en tres. Pesa más que un arco
                      // (medio juego contra un capítulo del final), así que se
                      // pinta como una regla de ancho completo en vez de un
                      // rótulo: es la división más grande que hay en la lista.
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2.5 pb-2 pt-5 select-none"
                      >
                        <span className="h-px flex-1 bg-linear-to-r from-transparent to-slate-600/70" />
                        <span className="shrink-0 text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          {nombreZona(z.zona).replace(/^Comienzo del\s+/i, "")}
                        </span>
                        <span className="h-px flex-1 bg-linear-to-l from-transparent to-slate-600/70" />
                      </div>
                    ) : z.arco ? (
                      <div
                        key={index}
                        className="flex flex-col gap-0.5 px-2.5 pb-1.5 pt-3 text-amber-300/70"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em]">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{nombreZona(z.zona)}</span>
                          <span className="ml-auto shrink-0 text-[11px] font-semibold tracking-normal text-amber-400/60">
                            Arco
                          </span>
                        </span>
                        {z.notas_generales.map((n, i) => (
                          <span key={i} className="text-[13px] leading-snug text-slate-500">
                            {n}
                          </span>
                        ))}
                      </div>
                    ) : (
                    <button
                      key={index}
                      ref={isActive ? activoRef : undefined}
                      type="button"
                      onClick={() => { setActiveZoneIndex(index); setMobileNavOpen(false); }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-base transition ${
                        isActive
                          ? "border-sky-400/50 bg-sky-500/10 text-white shadow-[inset_2px_0_0_0_#38bdf8]"
                          : "border-transparent text-slate-300 hover:bg-slate-800/40 hover:text-slate-100"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {/* Las zonas de dentro de un arco van sangradas con un
                            raíl a la izquierda, para que se lea la pertenencia
                            sin tener que repetir el nombre del arco en cada
                            una. */}
                        {z.arcoDe && <span className="ml-1 h-4 w-px shrink-0 bg-amber-400/30" />}
                        <EtiquetaFila nombre={nombreZona(z.zona)} zone={z} getSpriteUrl={getSpriteUrl} />
                        {z.opcional && <ChipOpcional />}
                      </span>
                      <ZoneBadgeDots zone={z} visited={isVisited(z.id)} />
                    </button>
                    )
                  );
                })}
              </div>

              {/* Resumen de colección */}
              <div className="mt-3 border-t border-slate-800/70 pt-3 space-y-2.5">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]" />
                  Colección
                </h3>
                <CollectionRow
                  icon={FlaskConical}
                  label="Páginas de alquimia"
                  color="text-fuchsia-400"
                  count={paginasProgress.checkedCount}
                  total={COLLECTION_TOTALS.paginas}
                />
                <CollectionRow
                  icon={Disc}
                  label="MTs"
                  color="text-sky-400"
                  count={mtsProgress.checkedCount}
                  total={COLLECTION_TOTALS.mts}
                />
                <CollectionRow
                  icon={Sparkles}
                  label="Nidos Alfa"
                  color="text-orange-400"
                  count={nidosProgress.checkedCount}
                  total={COLLECTION_TOTALS.nidos}
                />
                <CollectionRow
                  icon={UserPlus}
                  label="Habitantes Acrílico"
                  color="text-indigo-400"
                  count={habitantesProgress.checkedCount}
                  total={COLLECTION_TOTALS.habitantes}
                />
              </div>
              </div>
            </aside>

            {/* Detail */}
            <section id="guide-zone-detail" className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-5 min-h-[500px] shadow-lg shadow-black/30">
              {/* Grid blueprint muy tenue, como en el hero del Builder */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.035]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg,#7dd3fc 0,#7dd3fc 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#7dd3fc 0,#7dd3fc 1px,transparent 1px,transparent 32px)",
                }}
              />
              <div className="relative">
                {zonaMostrada && (
                  <>
                    <NextImportantBattle
                      zones={zones}
                      activeIndex={indiceMostrado}
                      getSpriteUrl={getSpriteUrl}
                      onNavigate={irAZona}
                    />
                    <ZoneDetail
                      zone={zonaMostrada}
                      zones={zones}
                      zoneIndex={indiceMostrado}
                      onNavigate={navigateByName}
                      onNavigateIndex={(idx) => setActiveZoneIndex(idx)}
                      // En Zonas, anterior/siguiente saltan al lugar de al lado,
                      // que puede estar veinte entradas más allá.
                      navegacion={
                        lugarActivo
                          ? {
                              anterior:
                                posicionLugar > 0
                                  ? {
                                      nombre: lugares[posicionLugar - 1].nombre,
                                      ir: () => setActiveZoneIndex(lugares[posicionLugar - 1].principal),
                                    }
                                  : null,
                              siguiente:
                                posicionLugar >= 0 && posicionLugar < lugares.length - 1
                                  ? {
                                      nombre: lugares[posicionLugar + 1].nombre,
                                      ir: () => setActiveZoneIndex(lugares[posicionLugar + 1].principal),
                                    }
                                  : null,
                            }
                          : undefined
                      }
                      onVerEnHistoria={(idx) => {
                        setActiveZoneIndex(idx);
                        setModo("historia");
                      }}
                      getSpriteUrl={getSpriteUrl}
                      // El botón de visitada pasa a ser del lugar entero: marca
                      // (o desmarca) todas sus visitas a la vez.
                      isVisited={lugarActivo ? () => lugarVisitado : isVisited}
                      onToggleVisited={lugarActivo ? toggleLugarVisitado : toggleVisited}
                      collection={collection}
                      pendientes={pendientes}
                    />
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
