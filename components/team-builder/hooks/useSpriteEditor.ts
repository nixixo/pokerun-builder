import { useState } from "react";
import { formatForAPI, formatForDisplay } from "../utils/typeHelpers";
import { EMPTY_STAT_INPUT } from "./useRecommendations";
import type { BaseStats, BaseStatsInput, Slot, SpriteTransform } from "../types";

const DEFAULT_TRANSFORM: SpriteTransform = { x: 0, y: 0, zoom: 0 };

/**
 * Encapsula el modal "Configurar Fakemon" completo: búsqueda/carga de
 * sprite (autocompletado contra PokeAPI + subida de archivo local), el
 * editor de encuadre del sprite (recorte/zoom, delegado al componente
 * `SpriteEditorModal` ya extraído en la Fase 3), y el draft de tipos/stats
 * que se guarda al slot al confirmar.
 *
 * Nota de diseño: `updateSlot` y `pokemonList` se reciben como parámetros.
 * `updateSlot` es el helper genérico de escritura sobre `team` (vive en
 * TeamBuilder.tsx, no es específico de este hook) y `pokemonList` es la
 * lista completa de nombres para el autocompletado de sprite, cargada junto
 * al resto de datos de la pokédex — ninguno de los dos es lógica de "editor
 * de sprite" en sí.
 *
 * `EMPTY_STAT_INPUT` se reutiliza desde `useRecommendations` (ahí vive el
 * mismo objeto vacío de stats) para no declarar dos constantes idénticas;
 * si en algún momento se migra a `utils/constants.ts` conviene importarlo
 * desde ahí en los dos hooks en vez de uno del otro.
 */
export function useSpriteEditor(team: Slot[], updateSlot: (idx: number, patch: Partial<Slot>) => void, pokemonList: string[]) {
  // ─── Draft del modal de configuración (tipos, stats, sprite) ──────────
  const [configSlotIndex, setConfigSlotIndex] = useState<number | null>(null);
  const [configDraftTypes, setConfigDraftTypes] = useState<string[]>([]);
  const [configDraftStats, setConfigDraftStats] = useState<BaseStatsInput>(EMPTY_STAT_INPUT);
  const [configStatsVisible, setConfigStatsVisible] = useState(false);
  const [configDraftSprite, setConfigDraftSprite] = useState<string | null>(null);
  const [configDraftTransform, setConfigDraftTransform] = useState<SpriteTransform>(DEFAULT_TRANSFORM);

  // ─── Buscador de sprite (autocompletado contra PokeAPI) ────────────────
  const [fakeSpriteSearch, setFakeSpriteSearch] = useState("");
  const [fakeSpriteLoading, setFakeSpriteLoading] = useState(false);
  const [fakeSpriteResults, setFakeSpriteResults] = useState<string[]>([]);
  const [fakeSpriteOpen, setFakeSpriteOpen] = useState(false);
  const [fakeSpriteSelectedIdx, setFakeSpriteSelectedIdx] = useState(-1);

  // ─── Editor de encuadre (recorte/zoom) ──────────────────────────────────
  const [spriteEditorOpen, setSpriteEditorOpen] = useState(false);
  const [spriteEditorSrc, setSpriteEditorSrc] = useState<string | null>(null);
  const [editorTransform, setEditorTransform] = useState<SpriteTransform>(DEFAULT_TRANSFORM);

  const openFakemonConfig = (idx: number) => {
    const slot = team[idx];
    setConfigSlotIndex(idx);
    setConfigDraftTypes(slot.types.filter(Boolean));
    setConfigDraftSprite(slot.sprite ?? null);
    setConfigDraftTransform(slot.spriteTransform ?? DEFAULT_TRANSFORM);
    setFakeSpriteSearch("");
    setConfigDraftStats({
      HP: slot.stats?.HP ? String(slot.stats.HP) : "",
      ATK: slot.stats?.ATK ? String(slot.stats.ATK) : "",
      DEF: slot.stats?.DEF ? String(slot.stats.DEF) : "",
      "SP.ATK": slot.stats?.["SP.ATK"] ? String(slot.stats["SP.ATK"]) : "",
      "SP.DEF": slot.stats?.["SP.DEF"] ? String(slot.stats["SP.DEF"]) : "",
      SPE: slot.stats?.SPE ? String(slot.stats.SPE) : "",
    });
    setConfigStatsVisible(Boolean(slot.stats));
  };

  const closeFakemonConfig = () => {
    setConfigSlotIndex(null);
    setConfigDraftTypes([]);
    setConfigDraftStats(EMPTY_STAT_INPUT);
    setConfigStatsVisible(false);
    setConfigDraftSprite(null);
    setConfigDraftTransform(DEFAULT_TRANSFORM);
    setFakeSpriteSearch("");
  };

  const toggleConfigType = (type: string) => {
    setConfigDraftTypes((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      if (prev.length >= 2) return prev;
      return [...prev, type];
    });
  };

  const updateDraftStat = (key: keyof BaseStats, value: string) => {
    setConfigDraftStats((prev) => ({ ...prev, [key]: value }));
  };

  const saveFakemonConfig = () => {
    if (configSlotIndex === null) return;

    const parsed: Partial<BaseStats> = {};
    let hasStats = false;
    (Object.keys(configDraftStats) as Array<keyof BaseStats>).forEach((key) => {
      const text = configDraftStats[key].trim();
      const value = text === "" ? null : Math.max(1, Math.min(255, Number(text)));
      if (value !== null && !Number.isNaN(value)) {
        parsed[key] = value;
        hasStats = true;
      }
    });

    const nextTypes: [string, string] = [configDraftTypes[0] || "", configDraftTypes[1] || ""];
    updateSlot(configSlotIndex, {
      types: nextTypes,
      sprite: configDraftSprite,
      spriteTransform: configDraftSprite ? configDraftTransform : null,
      stats: hasStats
        ? ({
            HP: parsed.HP ?? 1,
            ATK: parsed.ATK ?? 1,
            DEF: parsed.DEF ?? 1,
            "SP.ATK": parsed["SP.ATK"] ?? 1,
            "SP.DEF": parsed["SP.DEF"] ?? 1,
            SPE: parsed.SPE ?? 1,
          } as BaseStats)
        : null,
    });
    closeFakemonConfig();
  };

  // Trae el sprite de PokeAPI para `name` (slug o nombre display) y lo
  // aplica como draft, reseteando el encuadre. Compartido por las tres vías
  // de selección: autocompletado con flecha+Enter, click en sugerencia, y
  // botón "Buscar".
  const fetchSpriteFor = (name: string) => {
    setFakeSpriteLoading(true);
    return fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
      .then((r) => r.json())
      .then((d) => {
        const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null;
        setConfigDraftSprite(sp);
        setConfigDraftTransform(DEFAULT_TRANSFORM);
      })
      .finally(() => setFakeSpriteLoading(false));
  };

  const handleSpriteSearchChange = (value: string) => {
    setFakeSpriteSearch(value);
    setFakeSpriteSelectedIdx(-1);
    if (value.trim().length >= 2) {
      const filtered = pokemonList.filter((n) => n.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
      setFakeSpriteResults(filtered);
      setFakeSpriteOpen(filtered.length > 0);
    } else {
      setFakeSpriteResults([]);
      setFakeSpriteOpen(false);
    }
  };

  const selectSpriteSuggestion = (name: string) => {
    setFakeSpriteSearch(formatForDisplay(name));
    setFakeSpriteOpen(false);
    setFakeSpriteSelectedIdx(-1);
    fetchSpriteFor(name).catch(() => {});
  };

  const searchSpriteFromInput = () => {
    setFakeSpriteOpen(false);
    const name = formatForAPI(fakeSpriteSearch);
    fetchSpriteFor(name).catch(() => alert("Pokémon no encontrado"));
  };

  // Firma reducida (key, preventDefault) para no acoplar el hook a
  // KeyboardEvent de React, igual criterio que en useAbilityFilter.
  const handleSpriteSearchKeyDown = (key: string, preventDefault: () => void) => {
    if (fakeSpriteOpen && fakeSpriteResults.length > 0) {
      if (key === "ArrowDown") {
        preventDefault();
        setFakeSpriteSelectedIdx((prev) => Math.min(prev + 1, fakeSpriteResults.length - 1));
        return;
      }
      if (key === "ArrowUp") {
        preventDefault();
        setFakeSpriteSelectedIdx((prev) => Math.max(prev - 1, -1));
        return;
      }
      if (key === "Enter" && fakeSpriteSelectedIdx >= 0) {
        preventDefault();
        selectSpriteSuggestion(fakeSpriteResults[fakeSpriteSelectedIdx]);
        return;
      }
    }
    if (key === "Enter") {
      preventDefault();
      searchSpriteFromInput();
    } else if (key === "Escape") {
      setFakeSpriteOpen(false);
      setFakeSpriteSelectedIdx(-1);
    }
  };

  const handleSpriteFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setConfigDraftSprite(dataUrl);
      // Reset transform y abre el editor directo para subidas custom
      setEditorTransform(DEFAULT_TRANSFORM);
      setSpriteEditorSrc(dataUrl);
      setSpriteEditorOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const removeConfigDraftSprite = () => {
    setConfigDraftSprite(null);
    setConfigDraftTransform(DEFAULT_TRANSFORM);
  };

  const openSpriteFrameEditor = () => {
    if (!configDraftSprite) return;
    setEditorTransform(configDraftTransform);
    setSpriteEditorSrc(configDraftSprite);
    setSpriteEditorOpen(true);
  };

  const handleSpriteEditorSave = (transform: SpriteTransform) => {
    setConfigDraftTransform(transform);
    setSpriteEditorOpen(false);
    setSpriteEditorSrc(null);
  };

  const handleSpriteEditorCancel = () => {
    setSpriteEditorOpen(false);
    setSpriteEditorSrc(null);
  };

  return {
    // Config draft
    configSlotIndex,
    configDraftTypes,
    configDraftStats,
    configStatsVisible,
    setConfigStatsVisible,
    configDraftSprite,
    configDraftTransform,
    openFakemonConfig,
    closeFakemonConfig,
    toggleConfigType,
    updateDraftStat,
    saveFakemonConfig,
    // Buscador de sprite
    fakeSpriteSearch,
    fakeSpriteLoading,
    fakeSpriteResults,
    fakeSpriteOpen,
    fakeSpriteSelectedIdx,
    setFakeSpriteSelectedIdx,
    handleSpriteSearchChange,
    handleSpriteSearchKeyDown,
    selectSpriteSuggestion,
    searchSpriteFromInput,
    handleSpriteFileUpload,
    removeConfigDraftSprite,
    // Editor de encuadre
    spriteEditorOpen,
    spriteEditorSrc,
    editorTransform,
    openSpriteFrameEditor,
    handleSpriteEditorSave,
    handleSpriteEditorCancel,
  };
}
