// components/guia/useItemSprites.ts
//
// Carga /items_pokemon_z.json (public/) una sola vez y arma un mapa
// nombre en español -> URL de sprite (ya viene completa en el JSON,
// alojada en fakedex — mismo host que los sprites de Pokémon). Igual
// criterio que useMoveTypes.ts: match por nombre exacto normalizado
// (minúsculas, sin tildes), porque la Guía solo tiene el nombre del
// ítem como string (ej. "Baya Zreza"), no su id/internalName.

import { useMemo } from "react";
import { clave as normalize } from "@/components/shared/normalizar";
import { recursoJson } from "@/components/shared/recursoJson";
import { useEvolutions } from "./useEvolutions";

type ItemEntry = {
  id: number;
  internalName: string;
  name: string;
  description?: string;
  sprite: string;
};

/**
 * Objetos que merecen destacarse en la lista de una zona. La guía lista todo
 * lo que hay en el suelo por igual — bayas, pepitas, repelentes — y en zonas de
 * veinte objetos lo que de verdad importa se pierde entre lo demás.
 *
 * El orden de la unión es el orden de prioridad al clasificar: un objeto solo
 * lleva una etiqueta, y gana la más específica.
 */
export type ClaseObjeto = "efigie" | "mega" | "evolutivo" | "mejora" | "combate";

export type DestacadoObjeto = {
  clase: ClaseObjeto;
  etiqueta: string;
  /** Por qué está destacado, para el title del chip. */
  motivo: string;
};

const ETIQUETA: Record<ClaseObjeto, { etiqueta: string; motivo: string }> = {
  efigie: {
    etiqueta: "Efigie",
    motivo: "Objeto clave de la historia: hace falta para el legendario de su arco.",
  },
  mega: {
    etiqueta: "Megapiedra",
    motivo: "Megaevoluciona a su Pokémon durante el combate si se la equipas.",
  },
  evolutivo: {
    etiqueta: "Evolución",
    motivo: "Con este objeto evoluciona algún Pokémon.",
  },
  mejora: {
    etiqueta: "Mejora",
    motivo: "Sube estadísticas de forma permanente (IVs o Puntos de Esfuerzo). No se pierde.",
  },
  combate: {
    etiqueta: "Combate",
    motivo: "Objeto para equipar que cambia cómo pelea el Pokémon que lo lleva.",
  },
};

/**
 * La gu\u00eda escribe los objetos de zona a mano, as\u00ed que no siempre coinciden con
 * el nombre del \u00edtem: le pega la cantidad detr\u00e1s ("Madera (x2)") o lo escribe
 * de otra forma ("Superball", "Miniseta"). Claves ya normalizadas.
 */
const ALIAS_ITEM: Record<string, string> = {
  "restaurar todo": "Restaura Todo",
  miniseta: "Mini Seta",
  "mini setas": "Mini Seta",
  superball: "Super Ball",
  piedraeterna: "Piedra Eterna",
  "flor repelente grande": "Flor Rep. Grande",
  "flor repelente pequena": "Flor Rep. Peque\u00f1a",
  "mejora de pokevial": "Pok\u00e9vial",
  "arbusto de bayas": "Baya Aranja",
};

/** Quita la cantidad pegada al final: "Madera (x2)", "Guijarro x3". */
function sinCantidad(nombre: string): string {
  return String(nombre)
    .replace(/\s*\(\s*x?\s*\d+\s*\)\s*$/i, "")
    .replace(/\s*x\s*\d+\s*$/i, "")
    .trim();
}

const Objetos = recursoJson<ItemEntry[]>("/generated/items_pokemon_z.json", {
  etiqueta: "useItemSprites/objetos",
});

// Ids de los objetos que sirven de verdad en combate. Lista curada a mano
// (data-src/items_combat_useful.json): deja fuera bayas, curativos y balls,
// que son la mitad de lo que hay en el suelo y no cambian ningún combate.
const UtilesEnCombate = recursoJson<Record<string, boolean>>(
  "/generated/items_combat_useful.json",
  { etiqueta: "useItemSprites/combate" }
);

export function useItemSprites() {
  const { datos: items } = Objetos.useRecurso();
  const { datos: utilesCombate } = UtilesEnCombate.useRecurso();
  // La tabla de evoluciones ya está cacheada, así que pedirla desde aquí no
  // cuesta una descarga más: es de donde salen los objetos que hacen
  // evolucionar a alguien, sin tener que mantener una segunda lista.
  const { esObjetoEvolutivo } = useEvolutions();

  const byName = useMemo(() => {
    const map = new Map<string, string>(); // nombre normalizado -> sprite URL
    const descMap = new Map<string, string>(); // nombre normalizado -> descripción
    const entryMap = new Map<string, ItemEntry>(); // nombre normalizado -> entrada entera
    for (const it of items ?? []) {
      if (it.sprite) map.set(normalize(it.name), it.sprite);
      if (it.description) descMap.set(normalize(it.name), it.description);
      if (!entryMap.has(normalize(it.name))) entryMap.set(normalize(it.name), it);
    }
    return { spriteMap: map, descMap, entryMap };
  }, [items]);

  /**
   * Tres intentos, de más a menos literal: tal cual, sin la cantidad pegada
   * detrás, y por alias. Devuelve null si no hay nada — quien llama enseña su
   * icono genérico, que es mejor que un sprite equivocado.
   */
  function buscar(mapa: Map<string, string>, itemName: string): string | null {
    const directo = mapa.get(normalize(itemName));
    if (directo) return directo;
    const limpio = sinCantidad(itemName);
    const porCantidad = mapa.get(normalize(limpio));
    if (porCantidad) return porCantidad;
    const alias = ALIAS_ITEM[normalize(limpio)];
    return alias ? mapa.get(normalize(alias)) ?? null : null;
  }

  function getItemSpriteUrl(itemName: string): string | null {
    return buscar(byName.spriteMap, itemName);
  }

  function getItemDescription(itemName: string): string | null {
    return buscar(byName.descMap, itemName);
  }

  /**
   * Qué clase de objeto útil es, o null si no destaca en nada. Se resuelve con
   * la misma cascada de nombres que el sprite (tal cual, sin la cantidad
   * pegada, por alias), porque los nombres de la guía están escritos a mano.
   *
   * Casi todo se reconoce por la DESCRIPCIÓN y no por listas de ids: hay 120
   * megapiedras en el romhack y salen nuevas con cada versión, así que una
   * lista a mano quedaría desfasada al primer parche. La única lista de ids es
   * la de objetos de combate, que sí es un criterio de gusto y no un hecho
   * que se pueda leer del propio objeto.
   *
   * El orden importa: un objeto lleva una sola etiqueta y gana la primera que
   * case. Las Piedras Imbuidas del romhack evolucionan Y suben IVs, y salen
   * como "Evolución" a propósito — es lo que vas a hacer con ellas; que además
   * mejoren se lee en su descripción.
   */
  function getItemHighlight(itemName: string): DestacadoObjeto | null {
    const it = buscarEntrada(itemName);
    if (!it) return null;
    const desc = it.description ?? "";

    let clase: ClaseObjeto | null = null;
    if (/^efigie\b/i.test(it.name)) clase = "efigie";
    else if (/megaevolucionar/i.test(desc)) clase = "mega";
    // Por descripción además de por la tabla de evoluciones: las Piedras
    // Imbuidas son exclusivas del romhack y PokéAPI no sabe que existen.
    else if (esObjetoEvolutivo(it.name) || /hace evolucionar/i.test(desc)) clase = "evolutivo";
    // Chapas (+7 IVs), Sustancia Dorada y Pokésencia Refinada: subidas
    // permanentes. Son 51 repartidas por la guía y no las coge la lista de
    // objetos de combate, que solo cubre lo que se equipa.
    else if (/\bIVs?\b|Puntos de Esfuerzo/i.test(desc)) clase = "mejora";
    else if (utilesCombate?.[String(it.id)]) clase = "combate";

    return clase ? { clase, ...ETIQUETA[clase] } : null;
  }

  function buscarEntrada(itemName: string): ItemEntry | null {
    const mapa = byName.entryMap;
    const directo = mapa.get(normalize(itemName));
    if (directo) return directo;
    const limpio = sinCantidad(itemName);
    const porCantidad = mapa.get(normalize(limpio));
    if (porCantidad) return porCantidad;
    const alias = ALIAS_ITEM[normalize(limpio)];
    return alias ? mapa.get(normalize(alias)) ?? null : null;
  }

  return { getItemSpriteUrl, getItemDescription, getItemHighlight, loaded: items !== null };
}