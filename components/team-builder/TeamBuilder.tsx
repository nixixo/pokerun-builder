"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Move,
  BaseStats,
  Slot,
  SavedTeam,
  AvailablePokemon,
  Lang,
} from "./types";

import {
  CUSTOM_ABILITY_EN_NAMES,
  VIEW_MODE_KEY,
  POKEDEX_KEY,
  FAKEMON_MODE_KEY,
  MAX_PLANTILLAS,
  POKEDEX_OPTIONS,
  type PokedexId,
} from "./utils/constants";
import {
  Z_FORM_SPECIES,
  Z_FORM_NO_STANDARD_DUPLICATE,
  POKEMON_Z_PRE_EVOS,
} from "./utils/pokemonDefinitions";
import { normalizeTypeToApi } from "./utils/stringNormalization";
import { getZDisplayName, getZSpriteUrl } from "./utils/spriteHelpers";
import { EMPTY_MOVE, normalizeMoveSearch, buildLearnMethodsFromApi } from "./utils/moveHelpers";
import { formatForAPI, formatForDisplay, getStandardForm } from "./utils/typeHelpers";
import { getTypeName, UI } from "./utils/i18n";
import { STAT_LABELS, STAT_NAMES_I18N, STAT_ORDER, getStatColor } from "./utils/stats";
import type { MoveZ } from "./types/pokemonZ";
import type {
  PokeApiMove,
  PokeApiPokemon,
} from "./types/pokeapi";
import { cropFirstFrame } from "@/components/shared/cropFirstFrame";
import { codecBooleano, codecTexto, useHidratado, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";

import dynamic from "next/dynamic";

import { DragGhostPortal } from "./components/panels/DragGhostPortal";
import { BuilderHeader } from "./components/panels/BuilderHeader";
import { WhoToReplacePanel } from "./components/panels/WhoToReplacePanel";
import { AdvancedDashboardRow } from "./components/panels/AdvancedDashboardRow";
import { RecommendationsPanel } from "./components/panels/RecommendationsPanel";
import { TeamAnalysisPanel } from "./components/panels/TeamAnalysisPanel";
import { TeamGrid } from "./components/panels/TeamGrid";

// Modales: arrancan cerrados y muchos usuarios no los abren nunca, así que su
// código se pide recién la primera vez que se montan en vez de viajar en el
// bundle inicial. Los tres se renderizan bajo una condición, que es lo que
// dispara la carga del chunk.
//
// `ssr: false` es lo que hace efectivo el code-splitting acá: con el default
// (ssr: true) Next tiene que dejar el módulo disponible para hidratar el
// render del servidor, y el código termina igual en el chunk inicial. Como
// estos modales dependen de estado de cliente que arranca cerrado, nunca
// forman parte del HTML del servidor y no hay nada que perder.
const SpriteEditorModal = dynamic(
  () => import("./components/SpriteEditorModal").then((m) => m.SpriteEditorModal),
  { ssr: false }
);
const ItemsBrowserModal = dynamic(
  () => import("./components/ItemsBrowserModal").then((m) => m.ItemsBrowserModal),
  { ssr: false }
);
const SavedTeamsModal = dynamic(
  () => import("./components/panels/SavedTeamsModal").then((m) => m.SavedTeamsModal),
  { ssr: false }
);
const FakemonConfigModal = dynamic(
  () => import("./components/FakemonConfigModal").then((m) => m.FakemonConfigModal),
  { ssr: false }
);

import { useStaticPokeData } from "./data/staticPokeData";
import { BuilderChromeProvider } from "./context/BuilderChromeContext";
import { SlotSearchProvider } from "./context/SlotSearchContext";

// EMPTY_SLOT vive junto al hook que lo usa (useTeamStorage).
import { createRequestTracker } from "./utils/requestTracker";
import { useStandardCatalogs } from "./hooks/useStandardCatalogs";
import { usePokemonZData } from "./hooks/usePokemonZData";
import { pokemonZResources } from "./data/pokemonZData";
import { useTeamStorage, EMPTY_SLOT } from "./hooks/useTeamStorage";
import { useMoveFilter } from "./hooks/useMoveFilter";
import { useItemsFilter } from "./hooks/useItemsFilter";
import { useAbilityFilter } from "./hooks/useAbilityFilter";
import { useDragDrop } from "./hooks/useDragDrop";
import { useSpriteEditor } from "./hooks/useSpriteEditor";
import { useRecommendations } from "./hooks/useRecommendations";
import { useTeamAnalysis } from "./hooks/useTeamAnalysis";
import { useTeamSummary } from "./hooks/useTeamSummary";

// ─── Banderas de idioma (SVG inline, sin depender de emoji del sistema) ─────
// NOTA: no migrado a components/ todavía (fuera del alcance de las Fases 1-4).
const FlagES = ({ className = "h-3.5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 3 2" className={className} aria-hidden="true">
    <rect width="3" height="2" y="0" fill="#AA151B" />
    <rect width="3" height="1" y="0.5" fill="#F1BF00" />
  </svg>
);

const FlagGB = ({ className = "h-3.5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
    <clipPath id="flag-gb-clip">
      <rect width="60" height="30" />
    </clipPath>
    <g clipPath="url(#flag-gb-clip)">
      <rect width="60" height="30" fill="#00247d" />
      <path d="M0,0 60,30 M60,0 0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 60,30 M60,0 0,30" stroke="#cf142b" strokeWidth="2" />
      <path d="M30,0 30,30 M0,15 60,15" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 30,30 M0,15 60,15" stroke="#cf142b" strokeWidth="6" />
    </g>
  </svg>
);

// STAT_ORDER, STAT_LABELS, STAT_NAMES_I18N y getStatColor: ahora en
// utils/stats.ts (importados arriba). Siguen a nivel de módulo por lo mismo de
// siempre — identidad estable entre renders para no invalidar el contexto.

// Codecs de las preferencias persistidas. A nivel de módulo porque
// usePreferenciaLocal los mete en las dependencias de su setter: creados en
// cada render, ese setter cambiaría de identidad continuamente.
const CODEC_POKEDEX = codecTexto(POKEDEX_OPTIONS.map((p) => p.id));
const CODEC_VISTA = codecTexto(["simple", "advanced"] as const);

const badgeClass = (type: string) =>
  `type-badge type-${type.replace(/\s+/g, "-").toLowerCase()}`;

// Z_SPRITE_ZOOM_OVERRIDES (zoom de sprites de candidatos) ahora vive dentro
// de components/panels/RecommendationsPanel.tsx, el único lugar que lo usa.

// PokemonZEntry y MoveZ: ahora en types/pokemonZ.ts, para que los paneles que
// las reciben por props puedan nombrarlas en vez de tiparlas como any[].

export default function TeamBuilder() {
  // El equipo se pinta solo en cliente: sus datos salen de localStorage, que en
  // el servidor no existe.
  const isMounted = useHidratado();
  const [lang, setLang] = useState<Lang>("es");
  const [activePokedex, setActivePokedex] = usePreferenciaLocal<PokedexId>(
    POKEDEX_KEY,
    "standard",
    CODEC_POKEDEX
  );

  const [pokedexDropdownOpen, setPokedexDropdownOpen] = useState(false);
  const pokedexDropdownRef = useRef<HTMLDivElement>(null);
  const zData = usePokemonZData(activePokedex === "pokemon-z");
  const { pokemon: pokemonZData, moves: movesZData, abilities: abilitiesZDescData } = zData;
  const requests = useMemo(() => createRequestTracker(activePokedex), [activePokedex]);
  useEffect(() => () => requests.invalidateAll(), [requests]);
  // Catálogo de objetos del buscador del header: carga, mapa de "útiles en
  // combate" y estado del modal/filtros, todo en useItemsFilter.
  const {
    itemsData,
    itemsCombatUseful,
    itemsModalOpen,
    openItemsModal,
    closeItemsModal,
    itemsSearch,
    setItemsSearch,
    itemsOnlyZ,
    toggleItemsOnlyZ,
    itemsOnlyCombat,
    toggleItemsOnlyCombat,
    itemsHideBerries,
    toggleItemsHideBerries,
  } = useItemsFilter(activePokedex);
  const { movesStandardData, abilitiesStandardData, moveEsMap, moveEsDisplay } = useStandardCatalogs();
  // Mapa "NOMBREENSINGUIONES" (ej. "WATERABSORB", tal como viene en nameEn)
  // → nombre legible en inglés (ej. "Water Absorb"), construido una sola vez
  // a partir del listado oficial de PokéAPI. abilities_descriptions.json NO
  // trae un campo "nameEnDisplay" utilizable, así que sin este mapa el
  // nombre de la habilidad se quedaba siempre en español aunque la
  // descripción sí cambiara de idioma.
  // (abilityEnDisplayNames ahora sale de useStaticPokeData, más abajo.)
  // Nombre de una habilidad Z según el idioma activo: en español se muestra
  // tal cual viene del JSON (clave del registro); en inglés se busca el
  // nombre legible, ya sea en el propio JSON (nameEnDisplay, si algún día
  // se agrega) o en el mapa derivado de PokéAPI (abilityEnDisplayNames), y
  // si ninguno está disponible cae al nombre en español como último recurso.
  // Cache de sprites recortados para las tarjetas de recomendación en modo Z
  // key = id del Pokémon Z (string), value = dataURL del primer frame
  const [zSpritesCache, setZSpritesCache] = useState<Record<string, string>>({});
  // Tamaño natural (px) de cada sprite Z una vez que carga, para escalar dinámicamente
  const [zSpriteNaturalSizes, setZSpriteNaturalSizes] = useState<Record<string, number>>({});
  // Cache de sprites Z con bounding box recortado (sin transparencia vacía alrededor)
  // Generado en el onLoad del <img> a partir de zSpritesCache
  const [zSpritesTrimmed, setZSpritesTrimmed] = useState<Record<string, string>>({});
  const t = UI[lang];
  // useCallback: `tn` es parte de BuilderChromeContext. Si su identidad
  // cambiara en cada render, el contexto se invalidaría en cada render y
  // todos los paneles memoizados volverían a renderizar igual — es decir, el
  // contexto no serviría de nada.
  const tn = useCallback((apiKey: string) => getTypeName(apiKey, lang), [lang]);
  // Modo de vista: "simple" para usuarios casuales (oculta detalle técnico),
  // "advanced" muestra absolutamente todo (comportamiento original de la app).
  // Se persiste en localStorage para recordar la preferencia entre visitas.
  const [viewMode, setViewMode] = usePreferenciaLocal(VIEW_MODE_KEY, "simple", CODEC_VISTA);
  const isAdvanced = viewMode === "advanced";

  // Aquí vivía un apaño de ~20 líneas: un useRef para saltarse la PRIMERA
  // ejecución del efecto que persistía la pokédex, porque en ese mismo montaje
  // el efecto que la LEÍA todavía no había aplicado su setState — y escribir en
  // ese instante pisaba el valor bueno con el default ("standard"), justo al
  // volver de la Guía en modo Pokémon Z.
  //
  // Con usePreferenciaLocal esa ventana no existe: no hay un render en el que
  // el estado valga el default mientras en localStorage hay otra cosa.

  // Interruptor maestro: muestra/oculta los checks de "Fakemon" (por Pokémon)
  // y "Movimiento inventado" (por ataque) en toda la sección Mi Equipo, para
  // no saturar visualmente cuando no se están usando fakemon.
  const [fakemonModeOn, setFakemonModeOn] = usePreferenciaLocal(
    FAKEMON_MODE_KEY,
    false,
    codecBooleano
  );
  const {
    team,
    setTeam: setTeamRaw,
    savedTeams,
    saveCurrentTeam: saveCurrentTeamAs,
    loadSavedTeam: loadSavedTeamRaw,
    deleteSavedTeam,
    overwriteSavedTeam,
  } = useTeamStorage(activePokedex);
  const setTeam = (next: Slot[] | ((previous: Slot[]) => Slot[])) => {
    requests.invalidateAll();
    setTeamRaw(next);
  };
  // Datos estáticos de PokéAPI (tipos + relaciones, índices de nombres para
  // autocompletar, nombres de habilidades en inglés y el dataset base de
  // candidatos). Congelados en public/generated/ por
  // scripts/generate-pokeapi-data.mjs: antes esto eran ~22 requests
  // cross-origin encadenados entre renders en CADA carga de página, para
  // datos que solo cambian cuando sale una generación nueva.
  const { data: staticData, loading: loadingStaticData } = useStaticPokeData();
  const {
    allTypes,
    typeRelations,
    pokemonNames: pokemonList,
    moveNames: moveList,
    abilityDisplayNames: abilityEnDisplayNames,
    allPokemonData: allPokemonCore,
    speciesWithEvolution,
  } = staticData;
  const loadingRelations = loadingStaticData;
  const loadingAllPokemonData = loadingStaticData;

  // useCallback: `abilityModalEntries` (useAbilityFilter) lo tiene como
  // dependencia de un useMemo que mapea cientos de habilidades. Sin una
  // identidad estable ese memo se recalculaba en CADA render — es decir, en
  // cada tecla tipeada en cualquier buscador de la página.
  const getAbilityDisplayName = useCallback((esName: string): string => {
    if (lang === "es") return esName;
    const entry = abilitiesZDescData[esName];
    if (entry?.nameEnDisplay) return entry.nameEnDisplay;
    if (CUSTOM_ABILITY_EN_NAMES[esName]) return CUSTOM_ABILITY_EN_NAMES[esName];
    const nameEn = entry?.nameEn;
    if (nameEn && abilityEnDisplayNames[nameEn]) return abilityEnDisplayNames[nameEn];
    return esName;
  }, [lang, abilitiesZDescData, abilityEnDisplayNames]);

  // (statLabels, getStatColor y badgeClass viven a nivel de módulo: no
  // dependen de nada del render, y así su identidad es estable — de lo
  // contrario invalidarían el contexto del chrome en cada render.)
  // ─── Estado del motor de recomendaciones: migrado a useRecommendations ──
  // (hook llamado más abajo, después de `analysis`, `activeCandidates` y
  // `useAbilityFilter`, de los que depende). Acá solo queda el wrapper
  // `toggleRecFilterSortStat`, que combina dos setters que el hook expone
  // sueltos (no hace falta que viva dentro del hook).
  // (toggleRecFilterSortStat vive justo después de useRecommendations, que es
  // de donde salen los dos setters que combina.)
  // showRestContribution: ahora vive dentro de WhoToReplacePanel (estado de UI local a ese panel).
  const [toast, setToast] = useState<string | null>(null); // notificación flotante estilo la página (reemplaza los alert() feos del navegador)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // useCallback: lo consumen callbacks memoizados (addCandidateToTeam y
  // familia); solo toca un setter y un ref, así que no tiene dependencias.
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);
  // (moveEsMap y moveEsDisplay se derivan de movesStandardData más abajo)
  const [pokemonSearch, setPokemonSearch] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  // Borrador del input de nombre de Pokémon del equipo: mientras el usuario
  // está escribiendo/editando, el texto vive acá (no en slot.name), para que
  // cosas que dependen del nombre YA CONFIRMADO (ej. Z_SLOT_SPRITE_ZOOM_OVERRIDES,
  // el ajuste de sprite de "Mega Delphox Z") no se rompan a mitad de tipeo.
  // null = no está editando (se muestra slot.name tal cual).
  const [pokemonInputDraft, setPokemonInputDraft] = useState<(string | null)[]>(() => Array.from({ length: 6 }, () => null));
  // failedSpriteUrls/markSpriteFailed: ahora viven dentro de TeamGrid.
  const [pokemonResults, setPokemonResults] = useState<string[][]>(() => Array.from({ length: 6 }, () => []));
  const [pokemonOpen, setPokemonOpen] = useState<boolean[]>(() => Array.from({ length: 6 }, () => false));
  const [pokemonSelectedIdx, setPokemonSelectedIdx] = useState<number[]>(() => Array.from({ length: 6 }, () => -1));
  // moveInputDraft: what the user is currently TYPING in each move input (independent of m.name/m.nameEs)
  // null = not editing (show translated name from move data)
  const [moveInputDraft, setMoveInputDraft] = useState<(string | null)[][]>(
    () => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => null))
  );
  const [moveResults, setMoveResults] = useState<string[][][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => [])));
  const [moveOpen, setMoveOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const [moveSelectedIdx, setMoveSelectedIdx] = useState<number[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => -1)));

  // ── Modal de filtros de movimientos (Pokémon Z) ──────────────────────────
  // `selectMoveSuggestion` se declara con `function` y más abajo, junto a
  // `fetchMove`: usa a ese y a `updateMove`, que viven al final del componente.
  // Como declaración de función sí puede nombrarse aquí arriba — el binding
  // existe desde que se entra al cuerpo — y solo se LLAMA cuando el usuario
  // elige un movimiento, mucho después de que todo esté definido.
  const moveFilter = useMoveFilter(selectMoveSuggestion);
  const { onlyLearnableMoves } = moveFilter;
  // ── Drag & drop simple de movimientos (reordenar los 4 ataques de un mismo
  // Pokémon). A diferencia del drag&drop de Pokémon del equipo (que sigue el
  // puntero con una tarjeta fantasma), este usa el drag&drop nativo de HTML5:
  // mucho más simple porque solo reordena un array corto (4 elementos) dentro
  // del mismo slot, sin necesitar sprite fantasma ni cálculos de posición.
  // roleSelectOpenIdx, slotCollapsed (+ toggleSlotCollapsed), openRoleKeys
  // (+ toggleRoleOpen), moveInputWrapRefs/pokemonInputWrapRefs,
  // statsTooltipOpen (+ open/scheduleClose), hpTypeOpen/fakeTypeOpen
  // (+ toggles): todo esto ahora vive dentro de TeamGrid (estado de UI
  // exclusivo de esa sección, nada más en TeamBuilder.tsx lo necesitaba).
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [plantillaDraftName, setPlantillaDraftName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);


  // NOTA: el mapa "NOMBREENSINGUIONES" → "Nombre Legible" (ej. "WATERABSORB"
  // → "Water Absorb") se pedía acá a /ability?limit=400 en cada carga; ahora
  // viene precalculado en public/generated/ability-display-names.json vía
  // useStaticPokeData.

  // NOTA: antes acá había un useEffect que precargaba y recortaba los
  // sprites de TODO el roster Z apenas se entraba al modo pokemon-z
  // (~700-900 requests de golpe, la causa principal de las ~1500
  // solicitudes / 50 MB al cargar la página). Se sacó porque el panel de
  // recomendados ya carga sus sprites bajo demanda (ver el useEffect de
  // "priorizar carga de candidatos visibles" más abajo) con spinner +
  // fade-in, así que la precarga global no aportaba nada que el usuario
  // fuera a notar, solo costo de red/CPU al abrir la app.


  // ── Equipo guardado por Pokédex ─────────────────────────────────────────
  // La carga/guardado en localStorage (equipo activo + plantillas, por dex)
  // ahora vive en el hook useTeamStorage. Acá solo quedan los wrappers que
  // conectan ese hook con la UI local de "plantillas" (plantillaDraftName,
  // savingNew, showPlantillas), que el hook deliberadamente no conoce.

  // When lang changes, fetch missing translations for moves that don't have them yet
  useEffect(() => {
    team.forEach((slot, slotIdx) => {
      slot.moves.forEach((m, moveIdx) => {
        if (!m.name || m.isFake) return;
        if (/hidden.?power|poder.?oculto/i.test(m.name)) return;
        // If switching to ES and no Spanish name stored, or switching to EN and name looks Spanish → re-fetch
        const needsFetch = lang === "es" ? !m.nameEs : false;
        if (needsFetch) {
          fetchMove(m.name, slotIdx, moveIdx);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /** Wrapper: usa el nombre en borrador de la UI y limpia el form de "nueva plantilla" al guardar. */
  const saveCurrentTeam = () => {
    saveCurrentTeamAs(plantillaDraftName);
    setPlantillaDraftName("");
    setSavingNew(false);
  };

  /** Wrapper: además de cargar el equipo, cierra el panel de plantillas. */
  const loadSavedTeam = (saved: SavedTeam) => {
    requests.invalidateAll();
    loadSavedTeamRaw(saved);
    setShowPlantillas(false);
  };

  // NOTA: acá vivían cuatro efectos que en CADA carga de página pedían a
  // PokéAPI la lista de tipos, las 18 tablas de relaciones (encadenadas
  // detrás de la anterior, un waterfall entre renders), los índices de
  // nombres para autocompletar y el dataset masivo de candidatos vía
  // GraphQL — más de 20 requests cross-origin para datos que solo cambian
  // cuando sale una generación nueva. Todo eso está congelado en
  // public/generated/ y se carga en un único lote paralelo desde
  // useStaticPokeData (ver components/team-builder/data/staticPokeData.ts).
  //
  // Los nombres en español de movimientos se derivan de movesStandardData
  // en un useEffect más abajo, sin red extra.

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      // El dropdown de movimientos se renderiza vía createPortal en
      // document.body (para poder posicionarse "fixed" y escapar overflows),
      // así que queda fuera de rootRef. Sin este chequeo, cualquier mousedown
      // ahí adentro —incluido arrastrar su propio scrollbar— se detectaba
      // como "click afuera" y cerraba el dropdown al instante.
      if ((target as HTMLElement)?.closest?.("[data-move-dropdown]")) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setPokemonOpen((prev) => prev.map(() => false));
        setMoveOpen((prev) => prev.map((arr) => arr.map(() => false)));
      }
      if (pokedexDropdownRef.current && !pokedexDropdownRef.current.contains(target)) {
        setPokedexDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    if (patch.name !== undefined || patch.isFake !== undefined) requests.invalidateSlot(idx);
    setTeamRaw((t) =>
      t.map((s, i) => {
        if (i !== idx) return s;
        if (patch.name !== undefined && patch.name.trim() === "") {
          return EMPTY_SLOT();
        }
        return { ...s, ...patch };
      })
    );
  };

  // ── Modal "Configurar Fakemon" (tipos/stats/sprite + editor de encuadre) ──
  // El objeto entero viaja a FakemonConfigModal; aquí solo se sacan los pocos
  // valores que usa el propio TeamBuilder (abrir el modal y el editor de
  // encuadre). Antes se desestructuraban los 26, la mayoría solo para volver a
  // pasarlos al JSX del modal que vivía más abajo.
  const spriteEditor = useSpriteEditor(team, updateSlot, pokemonList);
  const {
    configSlotIndex,
    openFakemonConfig,
    spriteEditorOpen,
    spriteEditorSrc,
    editorTransform,
    handleSpriteEditorSave,
    handleSpriteEditorCancel,
  } = spriteEditor;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    pokemonSearch.forEach((query, idx) => {
      const isFake = team[idx]?.isFake;
      if (query.trim().length >= 2 && !isFake) {
        const timer = setTimeout(() => {
          let filtered: string[];
          if (activePokedex === "pokemon-z" && pokemonZData.length > 0) {
            // Buscar en el JSON de Pokémon Z por nombre crudo O por el label
            // ya formateado (ej. "Gigamax", "Mega", "Alola"), para que el
            // buscador devuelva resultados tanto al escribir "Butterfree" como
            // al escribir "Gigamax".
            const matches = pokemonZData.filter((p) => {
              const label = getZDisplayName(p).toLowerCase();
              return (
                label.includes(query.toLowerCase()) ||
                p.name?.toLowerCase().includes(query.toLowerCase())
              );
            });
            // Solo las especies con una forma Z realmente distinta (lista
            // curada Z_FORM_SPECIES) se etiquetan con el sufijo " Z" y reciben
            // su contraparte "estándar" vía PokéAPI. Las 4 especies "solo
            // mega" (Z_MEGA_ONLY_SPECIES) muestran su entrada base sin
            // sufijo, ya que es 1:1 igual a la oficial; solo su Mega lleva
            // sufijo " Z". El resto de la Pokedex Z (copia 1:1 de stats
            // oficiales, sin mega) se muestra igual que antes: una sola
            // entrada, sin sufijo. getZDisplayName centraliza estas reglas,
            // incluyendo el caso especial de Raichu → "Raichu Alola".
            const zMatches = matches.map((p) => {
              const label = getZDisplayName(p);
              return `${label}#z:${p.id}`;
            });
            // Para las especies de la lista curada (forma Z realmente
            // alterada), además ofrecemos su forma "estándar" (Pokedex
            // normal) buscada en vivo contra PokéAPI. Las 4 especies "solo
            // mega" (Z_MEGA_ONLY_SPECIES) NO entran acá: su entrada base del
            // JSON Z ya es 1:1 igual a la oficial, así que pedirla de nuevo
            // a PokéAPI generaría una entrada duplicada con el mismo nombre.
            // Si esa forma estándar todavía no existe en PokéAPI, simplemente
            // no se agrega (sin romper nada).
            const stdBaseNames = new Set(
              matches
                .filter((p) => Z_FORM_SPECIES.has(p.name?.toLowerCase() ?? ""))
                .filter((p) => !Z_FORM_NO_STANDARD_DUPLICATE.has(p.name?.toLowerCase() ?? ""))
                .map((p) => p.name?.toLowerCase())
                .filter(Boolean)
            );
            const stdMegaBaseNames = new Set(
              matches
                .filter((p) => p.formLabel === "Mega")
                .map((p) => p.name?.toLowerCase())
                .filter(Boolean)
            );
            const stdMatches: string[] = [];
            stdBaseNames.forEach((baseName) => {
              // getStandardForm resuelve el slug/nombre correctos de PokéAPI,
              // usando REGIONAL_FORM_OVERRIDE cuando la especie tiene una
              // forma regional/alterna como contraparte "estándar" relevante
              // (ej. Raichu → Raichu-Alola) en vez de su forma base nacional.
              const { slug, display } = getStandardForm(baseName);
              if (!pokemonList.includes(slug)) return; // no existe esa forma en PokéAPI
              stdMatches.push(`${display}#std:${slug}`);
            });
            stdMegaBaseNames.forEach((baseName) => {
              const slug = baseName.replace(/\s+/g, "-");
              const display = formatForDisplay(slug);
              // Algunas especies tienen una sola mega oficial ("-mega"), otras
              // tienen mega dual ("-mega-x" / "-mega-y", ej. Raichu, Charizard).
              // Probamos los 3 sufijos posibles y agregamos los que existan
              // realmente en PokéAPI.
              ["-mega", "-mega-x", "-mega-y"].forEach((suffix) => {
                const megaSlug = `${slug}${suffix}`;
                if (pokemonList.includes(megaSlug)) {
                  const suffixLabel = suffix === "-mega" ? "" : suffix.endsWith("x") ? " X" : " Y";
                  stdMatches.push(`Mega ${display}${suffixLabel}#std:${megaSlug}`);
                }
              });
            });
            filtered = [...zMatches, ...stdMatches].slice(0, 12);
          } else {
            filtered = pokemonList
              .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8);
          }
          setPokemonResults((prev) => prev.map((list, i) => (i === idx ? filtered : list)));
          setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? true : open)));
        }, 300);
        timers.push(timer);
      } else {
        setPokemonResults((prev) => prev.map((list, i) => (i === idx ? [] : list)));
        setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
      }
    });
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [pokemonSearch, pokemonList, team, activePokedex, pokemonZData]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    moveInputDraft.forEach((slotDrafts, idx) => {
      // Si el filtro "solo movimientos aprendibles" está activo, restringimos
      // las sugerencias de este slot al learnset real del Pokémon elegido
      // (null = sin learnset conocido todavía → no se filtra, para no dejar
      // el buscador vacío mientras carga o si el slot está vacío).
      const learnableSet =
        onlyLearnableMoves && team[idx]?.learnableMoves
          ? new Set(team[idx]!.learnableMoves as string[])
          : null;

      slotDrafts.forEach((draft, mi) => {
        // Caso especial: si "solo aprendibles" está activo y el campo está
        // vacío (recién enfocado, sin escribir nada todavía), mostramos de
        // una vez la lista completa y ordenada del learnset, sin esperar a
        // que el usuario escriba algo.
        if (draft !== null && draft.trim().length === 0 && learnableSet) {
          const lm = team[idx]?.learnMethods || {};
          // Orden: nivel (ascendente) → MT → tutor → huevo → sin dato conocido.
          const rank = (key: string) => {
            const info = lm[key];
            if (!info) return 4;
            if (info.type === "level") return 0;
            if (info.type === "mt") return 1;
            if (info.type === "tutor") return 2;
            if (info.type === "egg") return 3;
            return 4;
          };
          const compareByLearnMethod = (keyA: string, keyB: string, labelA: string, labelB: string) => {
            const ra = rank(keyA);
            const rb = rank(keyB);
            if (ra !== rb) return ra - rb;
            if (ra === 0) {
              const la = lm[keyA]?.level ?? 0;
              const lb = lm[keyB]?.level ?? 0;
              if (la !== lb) return la - lb;
            }
            return labelA.localeCompare(labelB);
          };
          let fullList: string[];
          if (activePokedex === "pokemon-z" && movesZData.length > 0) {
            fullList = movesZData
              .filter((m) => learnableSet.has(m.internalName))
              .sort((a, b) => compareByLearnMethod(a.internalName, b.internalName, a.name ?? "", b.name ?? ""))
              .map((m) => m.name as string);
          } else {
            fullList = moveList
              .filter((enSlug) => learnableSet.has(enSlug))
              .sort((a, b) => {
                const la = lang === "es" ? (moveEsDisplay[a] ?? a) : a;
                const lb = lang === "es" ? (moveEsDisplay[b] ?? b) : b;
                return compareByLearnMethod(a, b, la, lb);
              });
          }
          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? fullList : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? fullList.length > 0 : o) : s));
          return;
        }
        // Only search when there's an active draft
        if (draft === null || draft.trim().length < 2) {
          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? [] : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s));
          return;
        }
        const timer = setTimeout(() => {
          const query = normalizeMoveSearch(draft);
          let merged: string[];

          if (activePokedex === "pokemon-z" && movesZData.length > 0) {
            // En modo Z: buscar por nombre español o internalName en el JSON Z
            merged = movesZData
              .filter((m) => {
                const matchesQuery =
                  normalizeMoveSearch(m.name ?? "").includes(query) ||
                  normalizeMoveSearch(m.internalName ?? "").includes(query);
                if (!matchesQuery) return false;
                if (learnableSet && !learnableSet.has(m.internalName)) return false;
                return true;
              })
              .map((m) => m.name)
              .slice(0, 8);
          } else {
            const matches = moveList.filter((enSlug) => {
              const en = normalizeMoveSearch(enSlug.replace(/-/g, " "));
              const es = normalizeMoveSearch(moveEsDisplay[enSlug] ?? "");
              const matchesQuery = en.includes(query) || es.includes(query);
              if (!matchesQuery) return false;
              if (learnableSet && !learnableSet.has(enSlug)) return false;
              return true;
            });
            merged = matches.slice(0, 8);
          }

          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? merged : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? merged.length > 0 : o) : s));
        }, 250);
        timers.push(timer);
      });
    });
    return () => timers.forEach(clearTimeout);
  }, [moveInputDraft, moveList, moveEsDisplay, activePokedex, movesZData, onlyLearnableMoves, team, lang]);

  // Dado el nombre mostrado en una sugerencia del buscador de movimientos
  // (slug en inglés en modo estándar, nombre en español en modo Pokémon Z),
  // resuelve la etiqueta a mostrar a la derecha: "Nv. X" (nivel), "MT",
  // "Tutor" o "Huevo". Devuelve null si no se conoce el método.
  const getMoveLearnBadge = (slotIdx: number, name: string): string | null => {
    const slot = team[slotIdx];
    const lm = slot?.learnMethods;
    if (!lm) return null;
    let key = name;
    if (activePokedex === "pokemon-z" && movesZData.length > 0) {
      const zm = movesZData.find((m) => m.name === name || m.internalName === name);
      if (zm?.internalName) key = zm.internalName;
    }
    const info = lm[key];
    if (!info) return null;
    if (info.type === "level") return info.level ? `${t.moveBadgeLevelPrefix} ${info.level}` : t.moveBadgeLevelPrefix;
    if (info.type === "mt") return t.moveBadgeMt;
    if (info.type === "tutor") return t.moveBadgeTutor;
    if (info.type === "egg") return t.moveBadgeEgg;
    return null;
  };

  const updateMove = (slotIdx: number, moveIdx: number, patch: Partial<Move>) => {
    requests.invalidate(`move:${slotIdx}:${moveIdx}`);
    setTeamRaw((t) =>
      t.map((s, i) => {
        if (i !== slotIdx) return s;
        const moves = s.moves.map((m, j) => {
          if (j !== moveIdx) return m;
          // Only reset to EMPTY_MOVE when explicitly clearing the name on a real (non-fake) move
          if (patch.name !== undefined && patch.name.trim() === "" && !m.isFake && patch.isFake === undefined) {
            return EMPTY_MOVE();
          }
          // When toggling isFake off, preserve the name but clear API-derived fields
          if (patch.isFake === false) {
            return { ...m, isFake: false, type: null, category: "Physical" as Move["category"] };
          }
          // When toggling isFake on, just set the flag (keep existing name/type)
          if (patch.isFake === true) {
            return { ...m, isFake: true };
          }
          // Name update from autocomplete: also bring type + category + nameEs from patch
          if (patch.name !== undefined) {
            return {
              ...m,
              name: patch.name,
              type: patch.type ?? m.type ?? null,
              category: patch.category ?? m.category,
              // Preserve nameEs from patch if provided, else keep existing
              nameEs: patch.nameEs !== undefined ? patch.nameEs : m.nameEs,
              // Datos para el tooltip de descripción: si vienen en el patch los
              // tomamos, si no, mantenemos los que ya tenía el movimiento.
              descriptionEs: patch.descriptionEs !== undefined ? patch.descriptionEs : m.descriptionEs,
              descriptionEn: patch.descriptionEn !== undefined ? patch.descriptionEn : m.descriptionEn,
              power: patch.power !== undefined ? patch.power : m.power,
              accuracy: patch.accuracy !== undefined ? patch.accuracy : m.accuracy,
              pp: patch.pp !== undefined ? patch.pp : m.pp,
            };
          }
          // Generic partial update (hiddenPowerType, category, type, etc.)
          return { ...m, ...patch };
        });
        return { ...s, moves };
      })
    );
  };

  // Intercambia dos movimientos dentro del mismo Pokémon (drag & drop simple).
  // También resetea el estado de UI por-movimiento (draft de búsqueda, dropdown
  // abierto, índice seleccionado, etc.) de ese slot para evitar que quede
  // desalineado con su nueva posición.
  const swapMoves = (slotIdx: number, fromMoveIdx: number, toMoveIdx: number) => {
    if (fromMoveIdx === toMoveIdx) return;
    requests.invalidate(`move:${slotIdx}:${fromMoveIdx}`);
    requests.invalidate(`move:${slotIdx}:${toMoveIdx}`);
    setTeamRaw((t) =>
      t.map((s, i) => {
        if (i !== slotIdx) return s;
        const moves = [...s.moves];
        const tmp = moves[fromMoveIdx];
        moves[fromMoveIdx] = moves[toMoveIdx];
        moves[toMoveIdx] = tmp;
        return { ...s, moves };
      })
    );
    const resetRow4 = <TVal,>(fill: TVal) => Array.from({ length: 4 }, () => fill);
    setMoveInputDraft((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4(null) : row)));
    setMoveResults((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4([] as string[]) : row)));
    setMoveOpen((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4(false) : row)));
    setMoveSelectedIdx((prev) => prev.map((row, i) => (i === slotIdx ? resetRow4(-1) : row)));
  };

  // Fija (o borra, con null) el rol elegido a mano para un Pokémon puntual
  // del equipo, que reemplaza al rol calculado automáticamente por stats en
  // TODOS los cálculos del equipo (resumen de roles, redundancia, rol que
  // le falta al equipo, recomendaciones), no solo en su propia tarjeta.
  const setSlotManualRole = (slotIdx: number, roleEn: string | null) => {
    setTeamRaw((t) => t.map((s, i) => (i === slotIdx ? { ...s, manualRoleEn: roleEn } : s)));
  };

  const swapSlots = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setTeam((t) => {
      const next = [...t];
      const tmp = next[fromIdx];
      next[fromIdx] = next[toIdx];
      next[toIdx] = tmp;
      return next;
    });
  };

  // ── Drag & drop (slots del equipo + movimientos de un slot) ──────────────
  const {
    dragFromIdx,
    dragOverIdx,
    dragPointerPos,
    teamCardRefs,
    dragGhostEl,
    dragGhostSize,
    dragGrabOffset,
    captureSlotRects,
    startSlotDrag,
    dragMoveFrom,
    moveDragOverIdx,
    handleMoveDragStart,
    handleMoveDragEnd,
    handleMoveDragOver,
    handleMoveDrop,
  } = useDragDrop(team, swapSlots, swapMoves);

  // selectPokemonSuggestion y addCandidateToTeam viven más abajo, después de
  // fetchPokemon y de useRecommendations: son de los que dependen. Declarados
  // aquí arriba eran referencias hacia adelante a un `const` todavía en su zona
  // muerta temporal — funcionaba solo porque nadie los llamaba tan pronto.

  // cropFirstFrame: ahora en @/components/shared/cropFirstFrame (importado
  // arriba). Estaba declarado aquí dentro, o sea recreado en cada render, sin
  // caché y sin deduplicar peticiones en vuelo: el mismo sprite se volvía a
  // descargar y decodificar cada vez que se pedía.

  const fetchPokemon = async (name: string, idx: number) => {
    if (!name) return;
    const isCurrent = requests.begin(`pokemon:${idx}`);
    let zEntries = pokemonZData;
    if (activePokedex === "pokemon-z") {
      try {
        zEntries = await pokemonZResources.pokemon();
        if (!isCurrent()) return;
      } catch {
        if (isCurrent()) showToast(lang === "es" ? "No se pudieron cargar los datos de Pokémon Z. Reintenta la selección." : "Could not load Pokémon Z data. Try selecting again.");
        return;
      }
    }

    // ── Pokémon Z: usar datos del JSON local ─────────────────────────────────
    if (activePokedex === "pokemon-z" && zEntries.length > 0) {
      // El selector codifica la forma exacta como "Label#z:id" (entradas del
      // JSON local de Pokémon Z, ej. "Mega Delphox Z#z:90005") o como
      // "Label#std:slug" (formas estándar/oficiales buscadas en PokéAPI, ej.
      // "Mega Delphox#std:delphox-mega"). Si no viene codificado así (flujos
      // viejos), caemos al match por nombre dentro del JSON local.
      const hashIdx = name.lastIndexOf("#");
      const encoded = hashIdx >= 0 ? name.slice(hashIdx + 1) : "";
      const needle = (hashIdx >= 0 ? name.slice(0, hashIdx) : name).toLowerCase().trim();

      // Forma estándar/oficial (Pokedex normal o su Mega real) vía PokéAPI,
      // aunque estemos en modo Pokémon Z.
      if (encoded.startsWith("std:")) {
        const slug = encoded.slice(4);
        try {
          const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
          if (!r.ok) throw new Error("not found");
          const data = (await r.json()) as PokeApiPokemon;
          const types = data.types.map((t) => t.type.name);
          const sprite = data.sprites.front_default || data.sprites.other?.["official-artwork"]?.front_default || null;
          const stats: BaseStats = {
            HP: data.stats.find((s) => s.stat.name === "hp")?.base_stat ?? 0,
            ATK: data.stats.find((s) => s.stat.name === "attack")?.base_stat ?? 0,
            DEF: data.stats.find((s) => s.stat.name === "defense")?.base_stat ?? 0,
            "SP.ATK": data.stats.find((s) => s.stat.name === "special-attack")?.base_stat ?? 0,
            "SP.DEF": data.stats.find((s) => s.stat.name === "special-defense")?.base_stat ?? 0,
            SPE: data.stats.find((s) => s.stat.name === "speed")?.base_stat ?? 0,
          };
          const isMega = /-mega(-x|-y)?$/.test(slug);
          const baseSlug = isMega ? slug.replace(/-mega(-x|-y)?$/, "") : slug;
          const xyMatch = slug.match(/-mega-(x|y)$/);
          const megaSuffix = xyMatch ? ` ${xyMatch[1].toUpperCase()}` : "";
          const displayName = isMega ? `Mega ${formatForDisplay(baseSlug)}${megaSuffix}` : formatForDisplay(baseSlug);
          const learnableMoves: string[] = Array.isArray(data.moves)
            ? Array.from(new Set(data.moves.map((mv) => mv?.move?.name).filter(Boolean)))
            : [];
          const learnMethods = buildLearnMethodsFromApi(data.moves);
          if (!isCurrent()) return;
          updateSlot(idx, { name: displayName, types, sprite, stats, abilities: null, hiddenAbility: null, learnableMoves, learnMethods });
        } catch {
          if (isCurrent()) showToast("Pokémon no encontrado: " + name);
        }
        return;
      }

      const encodedId = encoded.startsWith("z:") ? parseInt(encoded.slice(2), 10) : NaN;

      // Buscamos primero por id (comparando como número en ambos lados, ya
      // que algunos JSON pueden traer el id como string) y, si no aparece
      // nada (id inconsistente o ausente), caemos a buscar por nombre en vez
      // de seguir de largo hacia el fetch estándar de la API con un nombre
      // codificado (p.ej. "Pikachu#z:25") que ahí sí fallaría siempre. Esto
      // evita que el sprite quede sin cargar al agregar un Pokémon desde el
      // botón "+" de recomendados.
      const zEntry =
        (!isNaN(encodedId)
          ? zEntries.find((p) => Number(p.id) === encodedId)
          : undefined) ??
        zEntries.find(
          (p) =>
            p.name?.toLowerCase() === needle ||
            p.internalName?.toLowerCase() === needle ||
            formatForDisplay(p.name ?? "").toLowerCase() === needle ||
            getZDisplayName(p).toLowerCase() === needle
        );
      if (zEntry) {
        // Tipos del JSON vienen en español → convertir a slugs de API
        const types = (zEntry.types as string[])
          .map((t) => normalizeTypeToApi(t))
          .filter(Boolean)
          .slice(0, 2);
        const stats: BaseStats = zEntry.stats ?? null;
        // Corregir URL: usar id con padding de 3 dígitos (001.png en vez de 1.png),
        // salvo las 8 entradas Mega Z (id 90001-90008), cuyo sprite real tiene un
        // sufijo "_N" distinto del dexId base (ver Z_MEGA_SPRITE_SUFFIX).
        const rawSprite = getZSpriteUrl(zEntry);
        // Recortar primer frame del spritesheet
        const sprite = rawSprite ? await cropFirstFrame(rawSprite) : null;
        // Nombre final centralizado en getZDisplayName: Z_FORM_SPECIES lleva
        // sufijo " Z", Z_MEGA_ONLY_SPECIES no, Megas llevan "Mega X Z", y
        // Raichu base se muestra como "Raichu Alola" (ver definición arriba).
        const displayName = getZDisplayName(zEntry);
        const abilities: string[] | null = Array.isArray(zEntry.abilities) && zEntry.abilities.length > 0 ? zEntry.abilities : null;
        const hiddenAbility: string | null = zEntry.hiddenAbility ?? null;
        // Learnset real: movimientos por nivel + tutor + huevo, como
        // internalNames (ej. "THUNDERBOLT"), para poder filtrar el
        // autocompletado contra movesZData (que también trae internalName).
        const learnableMoves: string[] = Array.from(new Set([
          ...(Array.isArray(zEntry.moves) ? zEntry.moves.map((mv) => mv?.move).filter(Boolean) : []),
          ...(Array.isArray(zEntry.tutorMoves) ? zEntry.tutorMoves : []),
          ...(Array.isArray(zEntry.eggMoves) ? zEntry.eggMoves : []),
          ...(Array.isArray(zEntry.tmMoves) ? zEntry.tmMoves : []),
        ]));
        const learnMethods: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> = {};
        if (Array.isArray(zEntry.moves)) {
          zEntry.moves.forEach((mv) => {
            const mname = mv?.move;
            if (!mname) return;
            // El JSON escribe siempre `level` (comprobado sobre los 1225
            // registros). Aquí había además un `?? mv?.lvl` que no se evaluaba
            // nunca; se va, junto con el `any` que lo dejaba pasar.
            const rawLevel: unknown = mv?.level;
            const lvl = typeof rawLevel === "number" ? rawLevel : (typeof rawLevel === "string" ? parseInt(rawLevel, 10) : undefined);
            learnMethods[mname] = { type: "level", level: Number.isFinite(lvl) ? lvl : undefined };
          });
        }
        // Movimientos por MT: vienen en el arreglo "tmMoves" del JSON.
        (zEntry.tmMoves ?? []).forEach?.((mname: string) => {
          if (mname && !learnMethods[mname]) learnMethods[mname] = { type: "mt" };
        });
        (zEntry.tutorMoves ?? []).forEach?.((mname: string) => {
          if (mname && !learnMethods[mname]) learnMethods[mname] = { type: "tutor" };
        });
        (zEntry.eggMoves ?? []).forEach?.((mname: string) => {
          if (mname && !learnMethods[mname]) learnMethods[mname] = { type: "egg" };
        });
        if (!isCurrent()) return;
        updateSlot(idx, { name: displayName, types, sprite, stats, abilities, hiddenAbility, learnableMoves, learnMethods });
        return;
      }
      // Si no está en el JSON Z, cae al fetch normal de la API
    }

    // ── Estándar: PokéAPI ────────────────────────────────────────────────────
    try {
      const apiName = formatForAPI(name);
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
      if (!r.ok) throw new Error("not found");
      const data = (await r.json()) as PokeApiPokemon;
      const types = data.types.map((t) => t.type.name);
      const sprite = data.sprites.front_default || data.sprites.other?.['official-artwork']?.front_default || null;
      const stats: BaseStats = {
        HP: data.stats.find((s) => s.stat.name === "hp")?.base_stat ?? 0,
        ATK: data.stats.find((s) => s.stat.name === "attack")?.base_stat ?? 0,
        DEF: data.stats.find((s) => s.stat.name === "defense")?.base_stat ?? 0,
        "SP.ATK": data.stats.find((s) => s.stat.name === "special-attack")?.base_stat ?? 0,
        "SP.DEF": data.stats.find((s) => s.stat.name === "special-defense")?.base_stat ?? 0,
        SPE: data.stats.find((s) => s.stat.name === "speed")?.base_stat ?? 0,
      };
      const learnableMoves: string[] = Array.isArray(data.moves)
        ? Array.from(new Set(data.moves.map((mv) => mv?.move?.name).filter(Boolean)))
        : [];
      const learnMethods = buildLearnMethodsFromApi(data.moves);
      if (!isCurrent()) return;
      updateSlot(idx, { name: formatForDisplay(data.name), types, sprite, stats, abilities: null, hiddenAbility: null, learnableMoves, learnMethods });
    } catch {
      if (isCurrent()) showToast("Pokémon no encontrado: " + name);
    }
  };

  // También `function` y no `const`: se la llama desde varios sitios de más
  // arriba (el efecto que completa los nombres ES, selectMoveSuggestion) y
  // solo así el binding existe en todo el cuerpo del componente.
  async function fetchMove(moveName: string, slotIdx: number, moveIdx: number) {
    if (!moveName) return;
    const isCurrent = requests.begin(`move:${slotIdx}:${moveIdx}`);
    // Skip API fetch for fake moves or Hidden Power (no real data needed)
    const isHiddenPower = /hidden.?power|poder.?oculto/i.test(moveName);
    if (isHiddenPower) {
      updateMove(slotIdx, moveIdx, { name: moveName, category: "Special", type: "normal" });
      return;
    }

    // ── Pokémon Z: buscar en el JSON de movimientos ──────────────────────────
    if (activePokedex === "pokemon-z") {
      let zMoves: MoveZ[];
      try {
        zMoves = await pokemonZResources.moves();
        if (!isCurrent()) return;
      } catch {
        if (isCurrent()) showToast(lang === "es" ? "No se pudieron cargar los movimientos. Reintenta la selección." : "Could not load moves. Try selecting again.");
        return;
      }
      const needle = moveName.toLowerCase().trim();
      const zMove = zMoves.find(
        (m) =>
          m.internalName?.toLowerCase() === needle ||
          m.name?.toLowerCase() === needle ||
          // también buscar por slug estilo API (guiones → sin espacios)
          m.internalName?.toLowerCase().replace(/_/g, "") === needle.replace(/[-\s]/g, "")
      );
      if (zMove) {
        const category: Move["category"] =
          zMove.category === "Special" ? "Special" :
          zMove.category === "Status"  ? "Status"  : "Physical";
        updateMove(slotIdx, moveIdx, {
          type: zMove.type ?? null,
          category,
          name: zMove.name,       // nombre en español del juego Z
          nameEs: zMove.name,
          descriptionEs: zMove.descriptionEs ?? null,
          descriptionEn: zMove.descriptionEn ?? null,
          power: zMove.power ?? null,
          accuracy: zMove.accuracy ?? null,
          pp: zMove.pp ?? null,
        });
        return;
      }
      // Si no está en el JSON Z, cae al fetch normal de la API
    }

    // ── Estándar: PokéAPI ────────────────────────────────────────────────────
    try {
      const apiName = formatForAPI(moveName);
      const r = await fetch(`https://pokeapi.co/api/v2/move/${apiName}`);
      if (!r.ok) throw new Error("move not found");
      const data = (await r.json()) as PokeApiMove;
      const mType = data.type.name;
      const category = data.damage_class?.name?.toLowerCase() === "status" ? "Status" : data.damage_class?.name?.toLowerCase() === "special" ? "Special" : "Physical";
      // Try to get Spanish name, fallback to formatted English
      const esName = data.names?.find((n) => n.language.name === "es")?.name ?? null;
      const enName = formatForDisplay(data.name);
      // Descripción ("flavor text"): tomamos la entrada más reciente disponible
      // para cada idioma (el array trae una por versión de juego).
      const flavorEntries: NonNullable<PokeApiMove["flavor_text_entries"]> =
        Array.isArray(data.flavor_text_entries) ? data.flavor_text_entries : [];
      const cleanFlavor = (txt: string) => txt.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
      const descEs = [...flavorEntries].reverse().find((f) => f.language?.name === "es")?.flavor_text;
      const descEn = [...flavorEntries].reverse().find((f) => f.language?.name === "en")?.flavor_text;
      // Store both so we can switch language without re-fetching
      if (!isCurrent()) return;
      updateMove(slotIdx, moveIdx, {
        type: mType,
        category,
        name: enName,
        nameEs: esName ?? enName,
        descriptionEs: descEs ? cleanFlavor(descEs) : null,
        descriptionEn: descEn ? cleanFlavor(descEn) : null,
        power: typeof data.power === "number" ? data.power : null,
        accuracy: typeof data.accuracy === "number" ? data.accuracy : null,
        pp: typeof data.pp === "number" ? data.pp : null,
      });
    } catch {
      // ignore, leave type null
    }
  }

  // Elegir un movimiento de la lista de sugerencias: cierra el desplegable de
  // ese hueco, lo escribe en el equipo y pide sus datos. Se pasa a
  // useMoveFilter allá arriba (ver la nota de por qué es `function`).
  function selectMoveSuggestion(slotIdx: number, moveIdx: number, name: string) {
    // Clear the draft (back to display mode)
    setMoveInputDraft((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((d, mi) => mi === moveIdx ? null : d) : s)
    );
    setMoveResults((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((l, mi) => mi === moveIdx ? [] : l) : s)
    );
    setMoveOpen((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((o, mi) => mi === moveIdx ? false : o) : s)
    );
    setMoveSelectedIdx((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((sel, mi) => mi === moveIdx ? -1 : sel) : s)
    );
    updateMove(slotIdx, moveIdx, { name });
    fetchMove(name, slotIdx, moveIdx);
  }

  // ─── Análisis del equipo por tipos ──────────────────────────────────────
  // Debilidades y resistencias compartidas, cobertura ofensiva, qué tipo
  // convendría añadir, movimientos repetidos y quién aporta menos. Eran ~360
  // líneas de useMemo aquí mismo; ahora en hooks/useTeamAnalysis.ts.
  const {
    analysis,
    typeAddSuggestions,
    coverage,
    teamContribution,
    attackSuggestions,
    weakCoverageSuggestion,
    moveTypeRedundancy,
    sharedWeaknesses,
  } = useTeamAnalysis(team, typeRelations, allTypes);

  // Pokémon recommendados: análisis 100% dinámico sobre TODOS los Pokémon
  // disponibles en el Builder (allPokemonData), sin ninguna lista fija.
  // Para cada uno se simula cómo cambiaría el perfil defensivo del equipo,
  // se puntúa según las prioridades del motor de scoring, y se muestran
  // únicamente los mejores candidatos pasando todos los filtros activos.

  // Candidatos activos según la Pokedex seleccionada.
  // En modo Z: convierte pokemonZData al mismo formato AvailablePokemon.
  // En modo estándar: usa allPokemonData cargado desde PokéAPI/GraphQL.
  const activeCandidates = useMemo((): AvailablePokemon[] => {
    if (activePokedex === "pokemon-z" && pokemonZData.length > 0) {
      return pokemonZData.map((p) => {
        const displayName = getZDisplayName(p);
        return {
          slug: displayName.toLowerCase().replace(/\s+/g, "-"),
          name: displayName,
          id: p.id ?? 0,
          dexId: p.dexId ?? p.id ?? 0,
          types: ((p.types as string[]) ?? [])
            .map((t) => normalizeTypeToApi(t))
            .filter(Boolean)
            .slice(0, 2) as [string] | [string, string],
          stats: p.stats ?? null,
          // fakemon/megas (id >= 899) siempre cuentan como evolución final.
          // Para especies reales: combinamos el set dinámico de PokéAPI
          // (speciesWithEvolution, evoluciones "oficiales") CON la lista
          // estática POKEMON_Z_PRE_EVOS. Antes, una vez terminaba el fetch
          // dinámico, este pisaba por completo a la lista estática — y como
          // PokéAPI real no sabe que, por ejemplo, Marowak(Z) evoluciona a
          // Marolier (evolución exclusiva de Pokémon Z), Marowak quedaba mal
          // marcado como "última evolución". Ahora un Pokémon NO es evolución
          // final si CUALQUIERA de las dos fuentes dice que evoluciona.
          isFinalEvo:
            p.id >= 899 ||
            !(speciesWithEvolution.has(p.id) || POKEMON_Z_PRE_EVOS.has(p.id)),
          formLabel: p.formLabel ?? null,
          abilities: Array.isArray(p.abilities) && p.abilities.length > 0 ? p.abilities : null,
          hiddenAbility: p.hiddenAbility ?? null,
          // Learnset completo (nivel + MT + tutor + huevo), como internalNames,
          // igual que el que se calcula al elegir un Pokémon para el equipo
          // (ver fetchPokemon), pero acá se precalcula para TODOS los
          // candidatos para poder filtrar recomendaciones por movimiento.
          learnableMoveNames: Array.from(new Set([
            ...(Array.isArray(p.moves) ? p.moves.map((mv) => mv?.move).filter(Boolean) : []),
            ...(Array.isArray(p.tutorMoves) ? p.tutorMoves : []),
            ...(Array.isArray(p.eggMoves) ? p.eggMoves : []),
            ...(Array.isArray(p.tmMoves) ? p.tmMoves : []),
          ])),
        };
      });
    }
    return allPokemonCore;
  }, [activePokedex, pokemonZData, allPokemonCore, speciesWithEvolution]);

  const ability = useAbilityFilter(activePokedex, lang, activeCandidates, abilitiesZDescData, abilitiesStandardData, getAbilityDisplayName);
  // Solo estos dos se siguen usando directo acá (recFilterAbility se pasa a
  // useRecommendations() más abajo, y setRecFilterAbility lo usa el header
  // al cambiar de pokédex). El resto del retorno de useAbilityFilter vive
  // encapsulado dentro de RecommendationsPanel.
  const { recFilterAbility, setRecFilterAbility } = ability;


  // Lista para el modal "estilo movimientos": nombre + descripción de cada
  // habilidad de Pokémon Z. Solo tiene sentido en esa pokédex porque es la
  // única con descripciones locales precargadas.
  const abilitiesStandardBySlug = useMemo(() => {
    const map = new Map<string, { nameEs: string; nameEn: string; descriptionEs: string; descriptionEn: string }>();
    abilitiesStandardData.forEach((a) => map.set(a.slug, a));
    return map;
  }, [abilitiesStandardData]);

  // Etiqueta a mostrar para una habilidad de la dex estándar: nombre en
  // español si ya cargó el dataset (y el idioma activo es ES), si no cae al
  // nombre formateado desde el slug en inglés (ej. "Water Absorb").
  // useCallback: ambos son props de RecommendationsPanel (memoizado).
  const getStdAbilityLabel = useCallback((slug: string): string => {
    const entry = abilitiesStandardBySlug.get(slug);
    if (entry) return lang === "es" ? entry.nameEs : entry.nameEn;
    return formatForDisplay(slug);
  }, [abilitiesStandardBySlug, lang]);

  const getStdAbilityDescription = useCallback((slug: string): string => {
    const entry = abilitiesStandardBySlug.get(slug);
    if (!entry) return "";
    return (lang === "es" ? entry.descriptionEs : entry.descriptionEn) || (lang === "es" ? entry.descriptionEn : entry.descriptionEs) || "";
  }, [abilitiesStandardBySlug, lang]);


  // ─── Motor de recomendaciones (panel "Pokémon recomendados") ───────────
  const rec = useRecommendations(
    team,
    analysis,
    typeRelations,
    activeCandidates,
    lang,
    activePokedex,
    abilitiesStandardData,
    recFilterAbility
  );
  // pokemonRecommendations: lo lee otro useMemo (candidatos prioritarios).
  // setRecFilterMoves: lo usa el header al cambiar de pokédex.
  // setRecFilterSortStat/setRecFilterMinStats: los usa toggleRecFilterSortStat.
  // setRecDiscarded: lo usa addCandidateToTeam (deja de recomendar lo ya agregado).
  // El resto del retorno de useRecommendations vive encapsulado dentro de
  // RecommendationsPanel.
  const { pokemonRecommendations, setRecFilterMoves, setRecFilterSortStat, setRecFilterMinStats, setRecDiscarded } = rec;

  // ─── Lo que depende de fetchPokemon y de useRecommendations ─────────────
  // Estos tres estaban declarados mucho más arriba, antes que las cosas que
  // usan. Aquí abajo el orden es el real y no hay referencias hacia adelante.

  // useCallback: es prop de RecommendationsPanel, que está memoizado.
  // Solo usa setters de estado (estables), así que no necesita dependencias.
  const toggleRecFilterSortStat = useCallback((key: keyof BaseStats) => {
    setRecFilterSortStat((prev) => {
      const next = prev === key ? null : key;
      if (next) {
        setRecFilterMinStats((prevMin) => ({ ...prevMin, [key]: "" }));
      }
      return next;
    });
  }, [setRecFilterSortStat, setRecFilterMinStats]);

  const selectPokemonSuggestion = (idx: number, name: string) => {
    setPokemonSearch((prev) => prev.map((value, i) => (i === idx ? "" : value)));
    setPokemonInputDraft((prev) => prev.map((value, i) => (i === idx ? null : value)));
    setPokemonResults((prev) => prev.map((list, i) => (i === idx ? [] : list)));
    setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
    setPokemonSelectedIdx((prev) => prev.map((sel, i) => (i === idx ? -1 : sel)));
    // `name` puede venir codificado como "Label#id" (formas/megas Z). Guardamos
    // el label limpio de inmediato para evitar parpadeo; fetchPokemon resuelve
    // la forma exacta por id y confirma el nombre final al terminar.
    const hashIdx = name.lastIndexOf("#");
    const displayLabel = hashIdx >= 0 ? name.slice(0, hashIdx) : name;
    // Limpiamos el sprite y su transform de inmediato: si no lo hacemos, el
    // sprite del Pokémon ANTERIOR se queda visible mientras fetchPokemon (que
    // es async) trae el nuevo, dando la sensación de que "el cambio de imagen
    // se mantiene un poco". Con esto se ve la Pokéball de placeholder en su
    // lugar hasta que el sprite nuevo esté listo.
    updateSlot(idx, { name: displayLabel, isFake: false, sprite: null, spriteTransform: null });
    fetchPokemon(name, idx);
  };

  // Agrega un candidato de "Pokémon recomendados" directo al primer slot
  // vacío del equipo (si hay lugar). Reutiliza el mismo pipeline de fetch
  // que usa el buscador normal (selectPokemonSuggestion → fetchPokemon),
  // así el sprite/stats/tipos quedan idénticos a como si lo hubieras
  // buscado a mano.
  // useCallback: prop de RecommendationsPanel (memoizado).
  const addCandidateToTeam = useCallback((candidate: AvailablePokemon) => {
    const emptyIdx = team.findIndex((s) => s.name.trim() === "");
    if (emptyIdx === -1) {
      showToast(
        lang === "es"
          ? "Tu equipo ya está completo (6/6). Elimina alguno primero."
          : "Your team is already full (6/6). Remove one first."
      );
      return;
    }
    const encodedName =
      activePokedex === "pokemon-z" && pokemonZData.length > 0
        ? `${candidate.name}#z:${candidate.id}`
        : candidate.slug;
    selectPokemonSuggestion(emptyIdx, encodedName);
    // Ya no tiene sentido seguir recomendándolo una vez que está en el equipo
    setRecDiscarded((prev) => new Set([...prev, candidate.slug]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, lang, activePokedex, pokemonZData, showToast, setRecDiscarded]);


  // Priorizar la carga de sprites de los candidatos visibles actualmente
  useEffect(() => {
    if (activePokedex !== "pokemon-z" || pokemonZData.length === 0) return;
    let cancelled = false;
    const priorityEntries = pokemonRecommendations.map(({ candidate }) => candidate);
    if (priorityEntries.length === 0) return;
    Promise.all(priorityEntries.map(async (c) => {
      const key = String(c.id);
      if (zSpritesCache[key]) return;
      const url = getZSpriteUrl(c);
      const cropped = await cropFirstFrame(url);
      if (!cancelled) setZSpritesCache((prev) => ({ ...prev, [key]: cropped }));
    }));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePokedex, pokemonRecommendations]);

  // ─── Lectura de alto nivel del equipo ───────────────────────────────────
  // Balance de stats, reparto de roles, dashboard, desglose por tipo, resumen
  // y nota global. Eran ~385 líneas aquí mismo; ahora en hooks/useTeamSummary.
  // Parte de lo que ya calculó useTeamAnalysis, por eso recibe analysis y coverage.
  const { statsAnalysis, rolesSummary, dashboard, typeDetail, teamSummary, teamScore } =
    useTeamSummary(team, typeRelations, allTypes, lang, analysis, coverage);

  // ── Valores de contexto ────────────────────────────────────────────────
  // El chrome solo se invalida al cambiar idioma, pokédex, modo de vista o
  // la lista de tipos; el estado de búsqueda cambia en cada tecla. Están
  // separados justamente para que lo segundo no arrastre a lo primero.
  const chromeValue = useMemo(
    () => ({
      lang, t, tn, badgeClass, isAdvanced, activePokedex,
      statLabels: STAT_LABELS, statOrder: STAT_ORDER, statNamesI18n: STAT_NAMES_I18N,
      allTypes, getStatColor,
    }),
    [lang, t, tn, isAdvanced, activePokedex, allTypes]
  );

  const slotSearchValue = {
      pokemonInputDraft, setPokemonInputDraft, pokemonSearch, setPokemonSearch,
      pokemonResults, pokemonOpen, setPokemonOpen, pokemonSelectedIdx, setPokemonSelectedIdx,
      fetchPokemon, selectPokemonSuggestion,
      moveInputDraft, setMoveInputDraft, moveResults, moveOpen, setMoveOpen,
      moveSelectedIdx, setMoveSelectedIdx, updateMove, fetchMove, selectMoveSuggestion,
  };

  return (
    <BuilderChromeProvider value={chromeValue}>
    <SlotSearchProvider value={slotSearchValue}>
    {/* `pantalla-segura` (globals.css) pone los laterales y el inferior
        teniendo en cuenta la muesca y la barra de gestos del móvil; el
        superior se queda en Tailwind porque no depende de ellas. */}
    <div ref={rootRef} className="min-h-screen pantalla-segura pt-4 sm:pt-6 bg-linear-to-b from-slate-900 via-[#041229] to-[#031022] text-slate-100">
      {/* Notificación flotante estilo la página (reemplaza los alert() del navegador) */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] max-w-xs rounded-lg border border-amber-500/40 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-xl shadow-black/40 animate-[fadeInUp_0.2s_ease-out]">
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-none">⚠️</span>
            <span className="text-sm text-slate-200 leading-snug">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-auto shrink-0 text-slate-500 hover:text-slate-300 text-xs leading-none"
            >✕</button>
          </div>
        </div>
      )}
      {/* El CSS que vivía acá (keyframes, switch de Fakemon, checkbox custom,
          scrollbars y el breakpoint xs) está en app/globals.css. Metido en el
          JSX se reinsertaba en el árbol en cada render de este componente y,
          al ser un <style> de una página, no lo veía la Guía. */}
      <BuilderHeader
        lang={lang}
        onLangChange={setLang}
        FlagES={FlagES}
        FlagGB={FlagGB}
        t={t}
        activePokedex={activePokedex}
        onSwitchPokedex={(id) => {
          requests.invalidateAll();
          setActivePokedex(id);
          setPokedexDropdownOpen(false);
          setRecFilterMoves([]);
          setRecFilterAbility("");
        }}
        pokedexDropdownOpen={pokedexDropdownOpen}
        onTogglePokedexDropdown={() => setPokedexDropdownOpen((v) => !v)}
        pokedexDropdownRef={pokedexDropdownRef}
        pokemonZCount={pokemonZData.length}
        movesZCount={movesZData.length}
        isAdvanced={isAdvanced}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenItemsModal={openItemsModal}
        team={team}
        teamScore={teamScore}
        getStatColor={getStatColor}
      />
      {activePokedex === "pokemon-z" && (zData.error || zData.loading) && (
        <div role="status" className="my-3 rounded-xl border border-amber-500/40 bg-slate-950 p-3 text-sm text-amber-200">
          {zData.loading ? (lang === "es" ? "Cargando datos de Pokémon Z…" : "Loading Pokémon Z data…") :
            (lang === "es" ? zData.error : "Some Pokémon Z data could not be loaded.")}
          {!zData.loading && <button type="button" onClick={zData.retry} className="ml-3 underline">{lang === "es" ? "Reintentar" : "Retry"}</button>}
        </div>
      )}
      {isMounted && (
      <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-4">
        <TeamGrid
          team={team}
          updateSlot={updateSlot}
          setSlotManualRole={setSlotManualRole}
          moveEsMap={moveEsMap}
          moveEsDisplay={moveEsDisplay}
          getMoveLearnBadge={getMoveLearnBadge}
          movesZData={movesZData}
          movesStandardData={movesStandardData}
          moveFilter={moveFilter}
          teamCardRefs={teamCardRefs}
          dragFromIdx={dragFromIdx}
          dragOverIdx={dragOverIdx}
          startSlotDrag={startSlotDrag}
          captureSlotRects={captureSlotRects}
          dragMoveFrom={dragMoveFrom}
          moveDragOverIdx={moveDragOverIdx}
          handleMoveDragStart={handleMoveDragStart}
          handleMoveDragEnd={handleMoveDragEnd}
          handleMoveDragOver={handleMoveDragOver}
          handleMoveDrop={handleMoveDrop}
          abilitiesZDescData={abilitiesZDescData}
          getAbilityDisplayName={getAbilityDisplayName}
          fakemonModeOn={fakemonModeOn}
          setFakemonModeOn={setFakemonModeOn}
          openFakemonConfig={openFakemonConfig}
          savedTeams={savedTeams}
          setShowPlantillas={setShowPlantillas}
          setTeam={setTeam}
        />

        <TeamAnalysisPanel
          lang={lang}
          t={t}
          tn={tn}
          badgeClass={badgeClass}
          isAdvanced={isAdvanced}
          loadingRelations={loadingRelations}
          analysis={analysis}
          typeRelations={typeRelations}
          typeDetail={typeDetail}
          sharedWeaknesses={sharedWeaknesses}
          typeAddSuggestions={typeAddSuggestions}
          coverage={coverage}
          attackSuggestions={attackSuggestions}
          weakCoverageSuggestion={weakCoverageSuggestion}
          moveTypeRedundancy={moveTypeRedundancy}
          statsAnalysis={statsAnalysis}
          rolesSummary={rolesSummary}
          getStatColor={getStatColor}
        />
      </div>
      {/* ── DASHBOARD + POKÉMON IDEAL (fila 1) — solo modo avanzado ──── */}
      {isAdvanced && (
        <AdvancedDashboardRow
          lang={lang}
          t={t}
          dashboard={dashboard}
          teamSummary={teamSummary}
          coverageSupCount={coverage.supCount}
          totalTypes={Object.keys(typeRelations).length}
          tn={tn}
          badgeClass={badgeClass}
        />
      )}
      {/* ── ¿QUIÉN CONVIENE REEMPLAZAR? ─────────────────────────────── */}
      <WhoToReplacePanel
        lang={lang}
        isAdvanced={isAdvanced}
        t={t}
        teamContribution={teamContribution}
        onRemoveSlot={(idx) => updateSlot(idx, { name: "" })}
        tn={tn}
        badgeClass={badgeClass}
      />
      {/* ── POKÉMON RECOMENDADOS (fila 2 — ancho completo) ───────────── */}
      <RecommendationsPanel
        rec={rec}
        ability={ability}
        lang={lang}
        t={t}
        tn={tn}
        badgeClass={badgeClass}
        isAdvanced={isAdvanced}
        activePokedex={activePokedex}
        team={team}
        typeRelations={typeRelations}
        statLabels={STAT_LABELS}
        allTypes={allTypes}
        statNamesI18n={STAT_NAMES_I18N}
        statOrder={STAT_ORDER}
        toggleRecFilterSortStat={toggleRecFilterSortStat}
        movesZData={movesZData}
        movesStandardData={movesStandardData}
        getStatColor={getStatColor}
        getAbilityDisplayName={getAbilityDisplayName}
        getStdAbilityLabel={getStdAbilityLabel}
        getStdAbilityDescription={getStdAbilityDescription}
        abilitiesZDescData={abilitiesZDescData}
        zSpritesCache={zSpritesCache}
        zSpriteNaturalSizes={zSpriteNaturalSizes}
        zSpritesTrimmed={zSpritesTrimmed}
        setZSpriteNaturalSizes={setZSpriteNaturalSizes}
        setZSpritesTrimmed={setZSpritesTrimmed}
        addCandidateToTeam={addCandidateToTeam}
        loadingAllPokemonData={loadingAllPokemonData}
      />
      </div>
      )}
      
      {showPlantillas && (
      <SavedTeamsModal
        show={showPlantillas}
        onClose={() => { setShowPlantillas(false); setSavingNew(false); setPlantillaDraftName(""); }}
        lang={lang}
        team={team}
        onImportTeam={(imported) => {
          setTeam(imported);
          setPokemonInputDraft(Array.from({ length: 6 }, () => null));
          setPokemonSearch(Array.from({ length: 6 }, () => ""));
        }}
        savedTeams={savedTeams}
        maxPlantillas={MAX_PLANTILLAS}
        savingNew={savingNew}
        onStartSavingNew={() => setSavingNew(true)}
        onCancelSavingNew={() => { setSavingNew(false); setPlantillaDraftName(""); }}
        plantillaDraftName={plantillaDraftName}
        onDraftNameChange={setPlantillaDraftName}
        onSaveCurrentTeam={saveCurrentTeam}
        onLoadTeam={loadSavedTeam}
        onOverwriteTeam={overwriteSavedTeam}
        onDeleteTeam={deleteSavedTeam}
        t={t}
        tn={tn}
        badgeClass={badgeClass}
      />
      )}
      {configSlotIndex !== null && (
        <FakemonConfigModal
          editor={spriteEditor}
          t={t}
          tn={tn}
          badgeClass={badgeClass}
          allTypes={allTypes}
        />
      )}
      {/* ── Tarjeta fantasma de drag & drop (sigue al cursor/dedo) ── */}
      <DragGhostPortal
        dragFromIdx={dragFromIdx}
        dragPointerPos={dragPointerPos}
        dragGhostEl={dragGhostEl}
        dragGhostSize={dragGhostSize}
        dragGrabOffset={dragGrabOffset}
        team={team}
      />
      {/* ── Sprite Editor Modal ── */}
      {spriteEditorOpen && spriteEditorSrc && (
        <SpriteEditorModal
          src={spriteEditorSrc}
          initialTransform={editorTransform}
          lang={lang}
          onSave={handleSpriteEditorSave}
          onCancel={handleSpriteEditorCancel}
        />
      )}
      {/* ── Modal de búsqueda de objetos (botón "Objetos" del header). ── */}
      {itemsModalOpen && (
        <ItemsBrowserModal
          items={itemsData}
          combatUseful={itemsCombatUseful}
          isStandardDex={activePokedex === "standard"}
          lang={lang}
          search={itemsSearch}
          onSearchChange={setItemsSearch}
          onlyZOriginals={itemsOnlyZ}
          onToggleOnlyZOriginals={toggleItemsOnlyZ}
          onlyCombat={itemsOnlyCombat}
          onToggleOnlyCombat={toggleItemsOnlyCombat}
          hideBerries={itemsHideBerries}
          onToggleHideBerries={toggleItemsHideBerries}
          onClose={closeItemsModal}
        />
      )}
      {/* ── Footer ── */}
      <footer className="mt-10 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-[#050f1f] to-[#03091a] px-4 py-5 text-center shadow-xl shadow-black/40">
        <p className="text-xs text-slate-400 leading-relaxed">
          {lang === "es" ? (
            <>
              Sprites de Pokémon Z gracias a{" "}
              <a
                href="https://www.fakedex.es"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-400 hover:text-sky-300 underline underline-offset-2 transition"
              >
                Fakedex
              </a>
              , por facilitar su carga y uso.
            </>
          ) : (
            <>
              Pokémon Z sprites courtesy of{" "}
              <a
                href="https://www.fakedex.es"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-400 hover:text-sky-300 underline underline-offset-2 transition"
              >
                Fakedex
              </a>
              , for making them easy to load and use.
            </>
          )}
        </p>
      </footer>
    </div>
    </SlotSearchProvider>
    </BuilderChromeProvider>
  );
}
