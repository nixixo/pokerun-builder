import { useMemo, useState } from "react";
import { codecBooleano, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";
import { formatForDisplay } from "../utils/typeHelpers";
import { normalizeApostrophe } from "../utils/stringNormalization";
import type { AvailablePokemon } from "../types";

const REC_ABILITY_MODAL_ONLY_Z_KEY = "pokerun-builder-rec-ability-modal-only-z";

type AbilitiesZDescData = Record<
  string,
  { nameEn: string | null; nameEnDisplay?: string; description: string; descriptionEn?: string; customAbility?: boolean }
>;

type AbilitiesStandardData = { slug: string; nameEs: string; nameEn: string; descriptionEs: string; descriptionEn: string }[];

export interface AbilityModalEntry {
  value: string;
  name: string;
  description: string;
  isOriginal?: boolean;
}

/**
 * Encapsula el filtro "por habilidad" del panel de recomendaciones: el
 * input con autocompletado (recFilterAbility + sugerencias) y el modal
 * "estilo movimientos" para explorar habilidades con descripción.
 *
 * Nota de diseño: `activeCandidates`, `abilitiesZDescData`, `abilitiesStandardData`,
 * `activePokedex`, `lang` y `getAbilityDisplayName` siguen viviendo fuera de este
 * hook (son datos/lógica compartidos con el motor de recomendaciones y con el
 * render de las tarjetas de equipo), así que se reciben como parámetros en vez
 * de gestionarse acá. `getAbilityDisplayName` en particular depende de estado
 * adicional (abilityEnDisplayNames, CUSTOM_ABILITY_EN_NAMES) que sigue en
 * TeamBuilder.tsx.
 */
export function useAbilityFilter(
  activePokedex: string,
  usesCatalog: boolean,
  lang: "es" | "en",
  activeCandidates: AvailablePokemon[],
  abilitiesZDescData: AbilitiesZDescData,
  abilitiesStandardData: AbilitiesStandardData,
  getAbilityDisplayName: (esName: string) => string
) {
  // ─── Input con autocompletado ────────────────────────────────────────────
  const [recFilterAbility, setRecFilterAbility] = useState<string>(""); // texto libre: filtra por habilidad (normal u oculta)
  const [recFilterAbilityOpen, setRecFilterAbilityOpen] = useState(false); // dropdown de sugerencias abierto
  const [recFilterAbilitySelectedIdx, setRecFilterAbilitySelectedIdx] = useState(-1); // índice resaltado (flechas ↑↓)

  // ─── Modal "estilo movimientos" para explorar habilidades con descripción ──
  const [recAbilityModalOpen, setRecAbilityModalOpen] = useState(false);
  const [recAbilityModalSearch, setRecAbilityModalSearch] = useState("");
  const [recAbilityModalDescSearch, setRecAbilityModalDescSearch] = useState(""); // texto libre: filtra habilidades por su descripción
  const [soloZGuardado, setSoloZGuardado] = usePreferenciaLocal(
    REC_ABILITY_MODAL_ONLY_Z_KEY,
    false,
    codecBooleano
  );

  // "Solo habilidades Z" no tiene sentido fuera de la Pokédex Z, así que ahí se
  // ignora. Se calcula al vuelo en vez de apagarlo con un efecto, que era lo que
  // había: aquello ESCRIBÍA `false` en localStorage, de modo que pasar por la
  // dex estándar y volver perdía el ajuste para siempre. Así sobrevive.
  const recAbilityModalOnlyZ = activePokedex === "pokemon-z" && soloZGuardado;

  // Lista de nombres de habilidad únicos entre todos los candidatos activos,
  // usada para las sugerencias del autocompletado del filtro por habilidad.
  // En modo Z se muestran tal cual (ya en español); en modo estándar se
  // formatean desde el slug de PokéAPI (ej. "water-absorb" → "Water Absorb").
  const allAbilityNamesForFilter = useMemo(() => {
    const set = new Set<string>();
    activeCandidates.forEach((c) => {
      (c.abilities ?? []).forEach((ab) => set.add(usesCatalog ? ab : formatForDisplay(ab)));
      if (c.hiddenAbility) set.add(usesCatalog ? c.hiddenAbility : formatForDisplay(c.hiddenAbility));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeCandidates, usesCatalog]);

  const recFilterAbilitySuggestions = useMemo(() => {
    const q = normalizeApostrophe(recFilterAbility.trim().toLowerCase());
    if (q.length < 2) return [];
    return allAbilityNamesForFilter.filter((ab) => ab.toLowerCase().includes(q)).slice(0, 8);
  }, [allAbilityNamesForFilter, recFilterAbility]);

  // Lista para el modal "estilo movimientos": nombre + descripción de cada
  // habilidad. Z usa las descripciones locales precargadas; dex estándar usa
  // el dataset de PokéAPI ya traducido.
  const abilityModalEntries = useMemo((): AbilityModalEntry[] => {
    if (usesCatalog) {
      return Object.entries(abilitiesZDescData).map(([esName, data]) => ({
        // Guardamos el nombre en español (esName) como valor real seleccionable,
        // ya que recFilterAbility/el resto del filtro trabaja con ese formato;
        // solo la etiqueta visible cambia según el idioma.
        value: esName,
        name: lang === "es" ? esName : getAbilityDisplayName(esName),
        description: (lang === "es" ? data.description : data.descriptionEn ?? data.description) ?? "",
        isOriginal: !!data.customAbility,
      }));
    }
    // Dex estándar: el valor seleccionable es el slug en inglés de PokéAPI
    // (ej. "chlorophyll"), igual formato que usa el resto del filtro.
    return abilitiesStandardData.map((a) => ({
      value: a.slug,
      name: lang === "es" ? a.nameEs : a.nameEn,
      description: (lang === "es" ? a.descriptionEs : a.descriptionEn) || (lang === "es" ? a.descriptionEn : a.descriptionEs) || "",
    }));
  }, [abilitiesZDescData, abilitiesStandardData, usesCatalog, lang, getAbilityDisplayName]);

  // ─── Handlers del input con autocompletado ─────────────────────────────
  const handleAbilityInputChange = (value: string) => {
    setRecFilterAbility(value);
    setRecFilterAbilityOpen(value.trim().length >= 2);
    setRecFilterAbilitySelectedIdx(-1);
  };

  const handleAbilityInputFocus = () => {
    if (recFilterAbility.trim().length >= 2) setRecFilterAbilityOpen(true);
  };

  const handleAbilityInputBlur = () => {
    // Delay para permitir que el click en una sugerencia registre antes de cerrar
    setTimeout(() => setRecFilterAbilityOpen(false), 150);
  };

  const handleAbilityInputKeyDown = (key: string, preventDefault: () => void) => {
    if (!recFilterAbilityOpen || recFilterAbilitySuggestions.length === 0) return;
    if (key === "ArrowDown") {
      preventDefault();
      setRecFilterAbilitySelectedIdx((prev) => Math.min(prev + 1, recFilterAbilitySuggestions.length - 1));
    } else if (key === "ArrowUp") {
      preventDefault();
      setRecFilterAbilitySelectedIdx((prev) => Math.max(prev - 1, -1));
    } else if (key === "Enter") {
      preventDefault();
      setRecFilterAbilitySelectedIdx((prevIdx) => {
        if (prevIdx >= 0) {
          setRecFilterAbility(recFilterAbilitySuggestions[prevIdx]);
          setRecFilterAbilityOpen(false);
        }
        return prevIdx;
      });
    } else if (key === "Escape") {
      setRecFilterAbilityOpen(false);
    }
  };

  const selectAbilitySuggestion = (ability: string) => {
    setRecFilterAbility(ability);
    setRecFilterAbilityOpen(false);
  };

  // ─── Handlers del modal ─────────────────────────────────────────────────
  const openAbilityModal = () => {
    setRecAbilityModalSearch("");
    setRecAbilityModalDescSearch("");
    setRecAbilityModalOpen(true);
  };

  const closeAbilityModal = () => setRecAbilityModalOpen(false);

  const toggleAbilityModalOnlyZ = () => setSoloZGuardado((v) => !v);

  const selectAbilityFromModal = (value: string) => {
    setRecFilterAbility(value);
    setRecAbilityModalOpen(false);
  };

  // Aquí había un useMemo sobre el objeto de retorno, con la idea de que el
  // componente que lo recibe como prop pudiera memoizarse. No servía de nada:
  // nueve de sus dependencias son las funciones de abajo, que se redefinen en
  // cada render, así que el memo se recalculaba siempre. Era coste sin ventaja.
  //
  // Para que sirviera de verdad habría que envolver esas nueve en useCallback,
  // y eso lo hace ya el React Compiler cuando compila este hook.
  return {
    // Input + sugerencias
    recFilterAbility,
    setRecFilterAbility,
    recFilterAbilityOpen,
    setRecFilterAbilityOpen,
    recFilterAbilitySelectedIdx,
    setRecFilterAbilitySelectedIdx,
    recFilterAbilitySuggestions,
    allAbilityNamesForFilter,
    handleAbilityInputChange,
    handleAbilityInputFocus,
    handleAbilityInputBlur,
    handleAbilityInputKeyDown,
    selectAbilitySuggestion,
    // Modal de exploración
    recAbilityModalOpen,
    openAbilityModal,
    closeAbilityModal,
    recAbilityModalSearch,
    setRecAbilityModalSearch,
    recAbilityModalDescSearch,
    setRecAbilityModalDescSearch,
    recAbilityModalOnlyZ,
    toggleAbilityModalOnlyZ,
    abilityModalEntries,
    selectAbilityFromModal,
  };
}
