import { Modal } from "@/components/shared/Modal";
import { useMemo, useCallback } from "react";
import type { Lang } from "../types";
import { SpriteImg } from "./SpriteImg";
import { SearchIcon } from "./SearchIcon";

// Modal de búsqueda de objetos de Pokémon Z: busca por nombre o por
// descripción y permite filtrar solo los objetos originales del hackrom
// (hackrom: true en items_pokemon_z.json). Es de solo consulta (no asigna
// nada a ningún Pokémon), por eso no recibe onSelect.
export function ItemsBrowserModal({
  items,
  combatUseful,
  lang,
  search,
  onSearchChange,
  onlyZOriginals,
  onToggleOnlyZOriginals,
  onlyCombat,
  onToggleOnlyCombat,
  onClose,
  isStandardDex = false,
  hideBerries = false,
  onToggleHideBerries,
}: {
  items: { id: number; internalName: string; name: string; nameEn?: string; namePlural: string; description: string; descriptionEn?: string; hackrom: boolean; sprite?: string | null; category?: string | null }[];
  combatUseful: Record<string, boolean>;
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  onlyZOriginals: boolean;
  onToggleOnlyZOriginals: () => void;
  onlyCombat: boolean;
  onToggleOnlyCombat: () => void;
  onClose: () => void;
  isStandardDex?: boolean;
  hideBerries?: boolean;
  onToggleHideBerries?: () => void;
}) {
  const normalized = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const itemName = useCallback((it: { name: string; nameEn?: string }) => (lang === "en" ? it.nameEn || it.name : it.name), [lang]);
  const itemDesc = useCallback((it: { description: string; descriptionEn?: string }) =>
    (lang === "en" ? it.descriptionEn || it.description : it.description) ?? "", [lang]);

  const filtered = useMemo(() => {
    const BERRY_CATEGORIES = new Set(["in-a-pinch", "picky-healing", "type-protection"]);
    const q = normalized(search.trim());
    return items
      .filter((it) => isStandardDex || !onlyZOriginals || it.hackrom)
      .filter((it) => isStandardDex || !onlyCombat || combatUseful[String(it.id)])
      .filter((it) => !isStandardDex || !hideBerries || !BERRY_CATEGORIES.has(it.category ?? ""))
      .filter((it) => q.length === 0 || normalized(itemName(it)).includes(q) || normalized(itemDesc(it)).includes(q))
      .sort((a, b) => itemName(a).localeCompare(itemName(b)));
  }, [items, search, onlyZOriginals, onlyCombat, combatUseful, itemName, itemDesc, isStandardDex, hideBerries]);

  if (typeof document === "undefined") return null;

  return (
    <Modal label={lang === "es" ? "Objetos" : "Items"} onClose={onClose} className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-black/70 p-3 sm:p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-100">
              {lang === "es" ? "Objetos" : "Items"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {lang === "es"
                ? "Busca por nombre o por descripción."
                : "Search by name or description."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            {lang === "es" ? "Cerrar" : "Close"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {filtered.length} {lang === "es" ? "resultados" : "results"}
          </span>
          <div className="relative w-full max-w-[300px]">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={lang === "es" ? "Buscar por nombre o descripción…" : "Search by name or description…"}
              className="w-full rounded-lg border border-blue-800/40 bg-slate-900/70 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
          </div>
        </div>

        {isStandardDex && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <label
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              hideBerries
                ? "border-rose-500 bg-rose-950/40 text-rose-300"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={hideBerries}
              onChange={onToggleHideBerries}
              className="h-3.5 w-3.5 rounded accent-rose-500"
            />
            {lang === "es" ? "Ocultar bayas" : "Hide berries"}
          </label>
        </div>
        )}

        {!isStandardDex && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <label
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              onlyCombat
                ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={onlyCombat}
              onChange={onToggleOnlyCombat}
              className="h-3.5 w-3.5 rounded accent-emerald-500"
            />
            {lang === "es" ? "⚔ Solo objetos de combate" : "⚔ Only battle items"}
          </label>
          <label
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              onlyZOriginals
                ? "border-amber-500 bg-amber-950/40 text-amber-300"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={onlyZOriginals}
              onChange={onToggleOnlyZOriginals}
              className="h-3.5 w-3.5 rounded accent-amber-500"
            />
            {lang === "es" ? "Solo originales Z" : "Only Z originals"}
          </label>
        </div>
        )}

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Cargando objetos…" : "Loading items…"}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Sin resultados." : "No results."}
            </div>
          ) : (
            filtered.map((it) => (
              <div
                key={it.id}
                className="flex w-full items-start gap-3 border-b border-slate-800/60 px-3 py-2.5 text-left text-sm last:border-b-0"
              >
                <div className="w-9 h-9 shrink-0 bg-[#031421] rounded-lg overflow-hidden flex items-center justify-center">
                  <SpriteImg
                    src={it.sprite ?? null}
                    alt={itemName(it)}
                    className="w-7 h-7 object-contain"
                    placeholderClassName="h-5 w-5 opacity-40"
                  />
                </div>
                <div className="flex flex-1 min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">{itemName(it)}</span>
                    {it.hackrom && (
                      <span
                        title={lang === "es" ? "Objeto exclusivo de Pokémon Z" : "Pokémon Z exclusive item"}
                        className="shrink-0 rounded-full border border-amber-500/50 bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300"
                      >
                        {lang === "es" ? "Original Z" : "Z Original"}
                      </span>
                    )}
                    {!isStandardDex && combatUseful[String(it.id)] && (
                      <span
                        title={lang === "es" ? "Útil en combate" : "Useful in battle"}
                        className="shrink-0 rounded-full border border-emerald-500/50 bg-emerald-950/40 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300"
                      >
                        {lang === "es" ? "⚔ Combate" : "⚔ Battle"}
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] text-slate-500 italic">
                    {itemDesc(it) || (lang === "es" ? "Sin descripción disponible" : "No description available")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
