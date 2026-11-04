import { Modal } from "@/components/shared/Modal";
import { useMemo } from "react";
import type { Lang } from "../types";
import { SearchIcon } from "./SearchIcon";

// Modal de exploración de habilidades — versión simplificada del
// MoveFilterModal: solo busca por nombre y muestra la descripción de cada
// habilidad. Solo se usa con datos de Pokémon Z (única pokédex con
// descripciones locales precargadas).
export function AbilityFilterModal({
  abilities,
  lang,
  search,
  onSearchChange,
  descSearch,
  onDescSearchChange,
  onlyZOriginals,
  onToggleOnlyZOriginals,
  showOnlyZFilter,
  onSelect,
  onClose,
}: {
  abilities: { value: string; name: string; description: string; isOriginal?: boolean }[];
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  descSearch: string;
  onDescSearchChange: (v: string) => void;
  onlyZOriginals: boolean;
  onToggleOnlyZOriginals: () => void;
  showOnlyZFilter: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const normalized = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = useMemo(() => {
    const qName = normalized(search.trim());
    const qDesc = normalized(descSearch.trim());
    return abilities
      .filter((ab) => qName.length === 0 || normalized(ab.name).includes(qName))
      .filter((ab) => qDesc.length === 0 || normalized(ab.description).includes(qDesc))
      .filter((ab) => !(onlyZOriginals && showOnlyZFilter) || !!ab.isOriginal)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [abilities, search, descSearch, onlyZOriginals, showOnlyZFilter]);

  if (typeof document === "undefined") return null;

  return (
    <Modal label={lang === "es" ? "Habilidades" : "Abilities"} onClose={onClose} className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-black/70 p-3 sm:p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-100">
              {lang === "es" ? "Filtrar habilidades" : "Filter abilities"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {lang === "es"
                ? "Busca por nombre y selecciona la habilidad."
                : "Search by name and pick the ability."}
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
          <div className="relative w-full max-w-[260px]">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={lang === "es" ? "Buscar por nombre…" : "Search by name…"}
              className="w-full rounded-lg border border-blue-800/40 bg-slate-900/70 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
          </div>
        </div>

        {/* Buscador por descripción: filtra habilidades cuyo texto descriptivo
            contenga lo escrito (ej. "quita el sueño"), independiente del
            buscador por nombre de arriba. */}
        <div className="mt-2 relative">
          <SearchIcon />
          <input
            type="text"
            value={descSearch}
            onChange={(e) => onDescSearchChange(e.target.value)}
            placeholder={lang === "es" ? "Buscar por descripción…" : "Search by description…"}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
          />
        </div>

        <div className="mt-2 flex justify-end">
          {showOnlyZFilter && (
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
          )}
        </div>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Sin resultados." : "No results."}
            </div>
          ) : (
            filtered.map((ab) => (
              <button
                key={ab.value}
                type="button"
                onClick={() => onSelect(ab.value)}
                className="flex w-full flex-col gap-1 border-b border-slate-800/60 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-slate-800/80"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{ab.name}</span>
                  {ab.isOriginal && (
                    <span
                      title={lang === "es" ? "Habilidad exclusiva de Pokémon Z" : "Pokémon Z exclusive ability"}
                      className="shrink-0 rounded-full border border-amber-500/50 bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300"
                    >
                      {lang === "es" ? "Original Z" : "Z Original"}
                    </span>
                  )}
                </span>
                {ab.description && (
                  <span className="text-[13px] text-slate-500">{ab.description}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
