import { useEffect, useRef, useState } from "react";
import { codecBooleano, usePreferenciaLocal } from "@/components/shared/preferenciaLocal";
import { ITEMS_ONLY_Z_KEY, ITEMS_ONLY_COMBAT_KEY } from "../utils/constants";
import type { PokeApiItem } from "../types/pokeapi";

export interface ItemEntry {
  id: number;
  internalName: string;
  name: string;
  nameEn?: string;
  namePlural: string;
  description: string;
  descriptionEn?: string;
  hackrom: boolean;
  sprite?: string | null;
  category?: string | null;
}

// Categorías de objetos que realmente aportan a una estrategia de equipo
// (held items permanentes durante el combate): held items, objetos "malos"
// usados estratégicamente, choice, potenciadores de tipo, species-specific,
// placas, gemas, y bayas que se activan solas en combate. Se excluyen
// mega-piedras y cristales Z (ya no aplican en el formato de equipo), curas
// de estado y medicinas de curación (consumibles de un solo uso, no objetos
// held estratégicos), y potenciadores temporales tipo "X Ataque" (se pierden
// al cambiar de Pokémon). Tampoco vitaminas EV, objetos evolutivos, llaves
// de historia, coleccionables, TMs/HMs ni correo.
const COMBAT_ITEM_CATEGORIES = [
  "held-items",
  "bad-held-items",
  "choice",
  "type-enhancement",
  "species-specific",
  "plates",
  "jewels",
  "in-a-pinch",
  "picky-healing",
  "type-protection",
];

// Objetos puntuales que, aunque técnicamente son "held items", son llaves de
// trama/leyenda sin uso real en la construcción de equipos (su única
// descripción disponible es lore, no función de juego).
const EXCLUDED_ITEM_SLUGS = new Set(["rusted-sword", "rusted-shield", "red-nectar", "yellow-nectar", "pink-nectar", "purple-nectar"]);

/**
 * Encapsula el catálogo de objetos del buscador del header (botón
 * "Objetos"): la carga de datos (PokeAPI para dex estándar, JSON local del
 * hack rom para Pokémon Z), el mapa de "útiles en combate", y el estado del
 * modal/filtros (búsqueda, solo-Z, solo-combate, ocultar bayas).
 */
export function useItemsFilter(activePokedex: string) {
  // Catálogo de objetos para el buscador de objetos del header.
  // - Pokédex estándar → PokeAPI (categorías con función real en combate)
  // - Pokédex Pokémon Z → items_pokemon_z.json (objetos del hack rom)
  // Se recarga cada vez que cambia la pokédex activa.
  const [itemsData, setItemsData] = useState<ItemEntry[]>([]);
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [itemsSearch, setItemsSearch] = useState("");
  const [itemsOnlyZ, setItemsOnlyZ] = usePreferenciaLocal(
    ITEMS_ONLY_Z_KEY,
    false,
    codecBooleano
  );
  const [itemsOnlyCombat, setItemsOnlyCombat] = usePreferenciaLocal(
    ITEMS_ONLY_COMBAT_KEY,
    false,
    codecBooleano
  );
  // Filtro de bayas, solo para la pokédex estándar (objetos de la PokeAPI)
  const [itemsHideBerries, setItemsHideBerries] = useState(false);



  // Se dispara SOLO cuando el usuario abre el modal de objetos por primera
  // vez para cada pokédex (no apenas cambia activePokedex), y no vuelve a
  // recargar si ya se cargó antes para ese mismo modo. Antes se disparaba
  // apenas se entraba a la pokédex estándar, trayendo ~100-150 requests
  // individuales a PokeAPI (una por cada ítem) aunque el usuario nunca
  // hubiera tocado el botón "Objetos".
  const loadedItemsForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!itemsModalOpen) return;
    if (loadedItemsForRef.current === activePokedex) return;
    loadedItemsForRef.current = activePokedex;

    if (activePokedex !== "standard") {
      fetch("/generated/items_pokemon_z.json")
        .then((r) => r.json())
        .then((data) => setItemsData(data))
        .catch((err) => console.error("[PokeRun] Error loading items_pokemon_z.json:", err));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const categoryResults = await Promise.all(
          COMBAT_ITEM_CATEGORIES.map((slug) =>
            fetch(`https://pokeapi.co/api/v2/item-category/${slug}`)
              .then((r) => (r.ok ? r.json() : { items: [] }))
              .catch(() => ({ items: [] }))
          )
        );

        // Deduplicar por nombre (algunas categorías se solapan) y sacar la blacklist
        const uniqueRefs = Array.from(
          new Map(
            categoryResults
              .flatMap((c) => c.items ?? [])
              .filter((it) => !EXCLUDED_ITEM_SLUGS.has(it.name))
              .map((it) => [it.name, it])
          ).values()
        );

        const details = await Promise.all(
          uniqueRefs.map(async (ref) => {
            try {
              const d: PokeApiItem = await fetch(ref.url).then((r) => r.json());
              const prettyFallback = String(d.name)
                .split("-")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
              const nameEs = d.names?.find((n) => n.language?.name === "es")?.name ?? prettyFallback;
              const nameEn = d.names?.find((n) => n.language?.name === "en")?.name ?? prettyFallback;
              const effectEs = d.effect_entries?.find((e) => e.language?.name === "es");
              const effectEn = d.effect_entries?.find((e) => e.language?.name === "en");
              const flavorEs = d.flavor_text_entries?.find((f) => f.language?.name === "es");
              const flavorEn = d.flavor_text_entries?.find((f) => f.language?.name === "en");
              const descEs =
                effectEs?.short_effect || flavorEs?.text?.replace(/\n|\f/g, " ") || effectEn?.short_effect || flavorEn?.text?.replace(/\n|\f/g, " ") || "";
              const descEn = effectEn?.short_effect || flavorEn?.text?.replace(/\n|\f/g, " ") || descEs;
              return {
                id: d.id,
                internalName: String(d.name).toUpperCase().replace(/-/g, "_"),
                name: nameEs,
                nameEn,
                namePlural: nameEs,
                description: descEs,
                descriptionEn: descEn,
                hackrom: false,
                sprite: d.sprites?.default ?? null,
                category: d.category?.name ?? null,
              };
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          const clean = details.filter(Boolean) as ItemEntry[];
          clean.sort((a, b) => a.name.localeCompare(b.name));
          setItemsData(clean);
        }
      } catch (err) {
        console.error("[PokeRun] Error loading items from PokeAPI:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePokedex, itemsModalOpen]);

  // Objetos con efecto real en combate (choice items, potenciadores de tipo,
  // objetos defensivos, gemas, tablas, etc). Mapa id -> true. Cargado desde
  // un archivo aparte para no tener que tocar items_pokemon_z.json.
  const [itemsCombatUseful, setItemsCombatUseful] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!itemsModalOpen) return;
    if (Object.keys(itemsCombatUseful).length > 0) return;
    fetch("/generated/items_combat_useful.json")
      .then((r) => r.json())
      .then((data) => setItemsCombatUseful(data))
      .catch((err) => console.error("[PokeRun] Error loading items_combat_useful.json:", err));
  }, [itemsModalOpen, itemsCombatUseful]);

  const openItemsModal = () => setItemsModalOpen(true);
  const closeItemsModal = () => setItemsModalOpen(false);
  const toggleItemsOnlyZ = () => setItemsOnlyZ((v) => !v);
  const toggleItemsOnlyCombat = () => setItemsOnlyCombat((v) => !v);
  const toggleItemsHideBerries = () => setItemsHideBerries((v) => !v);

  return {
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
  };
}