import { Modal } from "@/components/shared/Modal";
import { useMemo } from "react";
import type { Lang } from "../types";
import { TYPE_COLORS } from "../utils/constants";

export type MoveFilterEntry = {
  internalName: string;
  name: string;
  nameEn: string;
  category: "Physical" | "Special" | "Status";
  type: string | null;
  hackrom: boolean;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  descriptionEs: string;
  descriptionEn: string;
};

// Mismo ícono SVG (espada/destello/remolino) que se usa en las tarjetas de
// ataque del equipo, para que la categoría se identifique de un vistazo sin
// tener que leer el texto "Físico/Especial/Estado".
const CategoryIcon = ({ cat, size = 16 }: { cat: string; size?: number }) => {
  if (cat === "Physical") return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="8.5" fill="#C03028" stroke="#7f1010" strokeWidth="1"/>
      <path d="M5 13L9 5L13 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="9" cy="5" r="1.5" fill="white"/>
    </svg>
  );
  if (cat === "Special") return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="8.5" fill="#6890F0" stroke="#1e3a8a" strokeWidth="1"/>
      <path d="M9 4L10.2 7.5H14L11 9.8L12.2 13.2L9 11L5.8 13.2L7 9.8L4 7.5H7.8L9 4Z" fill="white"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="8.5" fill="#705898" stroke="#3b1e6b" strokeWidth="1"/>
      <circle cx="9" cy="9" r="3.5" fill="white" opacity="0.9"/>
      <circle cx="9" cy="9" r="1.5" fill="#705898"/>
    </svg>
  );
};

export function MoveFilterModal({
  moves,
  lang,
  search,
  onSearchChange,
  categories,
  onToggleCategory,
  types,
  onToggleType,
  onlyZOriginals,
  onToggleOnlyZOriginals,
  showOnlyZFilter,
  onClearFilters,
  learnMethods,
  onlyLearnable,
  learnableSet,
  badgeClass,
  tn,
  onSelect,
  onClose,
  sortPower,
  onSortPowerChange,
}: {
  moves: MoveFilterEntry[];
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  categories: Set<string>;
  onToggleCategory: (c: string) => void;
  types: Set<string>;
  onToggleType: (ty: string) => void;
  onlyZOriginals: boolean;
  onToggleOnlyZOriginals: () => void;
  showOnlyZFilter: boolean;
  onClearFilters: () => void;
  learnMethods: Record<string, { type: "level" | "mt" | "tutor" | "egg"; level?: number }> | null | undefined;
  onlyLearnable: boolean;
  learnableSet: Set<string> | null;
  badgeClass: (t: string) => string;
  tn: (apiKey: string) => string;
  onSelect: (move: MoveFilterEntry) => void;
  onClose: () => void;
  // Orden por potencia: ahora vive en el estado del padre (por Pokémon) para
  // que se recuerde entre aperturas del modal, en vez de resetearse cada vez.
  sortPower: "asc" | "desc" | null;
  onSortPowerChange: (v: "asc" | "desc" | null) => void;
}) {
  const allTypesList = Object.keys(TYPE_COLORS);
  const catLabel = (c: string) =>
    c === "Physical" ? (lang === "es" ? "Físico" : "Physical")
    : c === "Special" ? (lang === "es" ? "Especial" : "Special")
    : (lang === "es" ? "Estado" : "Status");

  const learnBadgeFor = (mv: MoveFilterEntry): string | null => {
    const info = learnMethods?.[mv.internalName];
    if (!info) return null;
    if (info.type === "level") return info.level ? `${lang === "es" ? "Nv." : "Lv."} ${info.level}` : (lang === "es" ? "Nivel" : "Level");
    if (info.type === "mt") return "MT";
    if (info.type === "tutor") return lang === "es" ? "Tutor" : "Tutor";
    if (info.type === "egg") return lang === "es" ? "Huevo" : "Egg";
    return null;
  };

  const normalized = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = useMemo(() => {
    const q = normalized(search.trim());
    return moves
      .filter((mv) => {
        if (onlyLearnable && learnableSet && !learnableSet.has(mv.internalName)) return false;
        if (categories.size > 0 && !categories.has(mv.category)) return false;
        if (types.size > 0 && (!mv.type || !types.has(mv.type))) return false;
        if (onlyZOriginals && showOnlyZFilter && !mv.hackrom) return false;
        if (q.length > 0) {
          const hay =
            normalized(mv.name).includes(q) ||
            normalized(mv.nameEn).includes(q) ||
            normalized(mv.internalName).includes(q);
          if (!hay) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Si el usuario activó el orden por potencia, manda por sobre todo lo demás.
        if (sortPower) {
          const pa = a.power ?? 0;
          const pb = b.power ?? 0;
          if (pa !== pb) return sortPower === "asc" ? pa - pb : pb - pa;
          const nameA = lang === "es" ? a.name : a.nameEn;
          const nameB = lang === "es" ? b.name : b.nameEn;
          return nameA.localeCompare(nameB);
        }
        // Aprendibles primero (por nivel, MT, tutor, huevo), luego alfabético
        const rank = (mv: MoveFilterEntry) => {
          const info = learnMethods?.[mv.internalName];
          if (!info) return 4;
          if (info.type === "level") return 0;
          if (info.type === "mt") return 1;
          if (info.type === "tutor") return 2;
          return 3;
        };
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 0) {
          const la = learnMethods?.[a.internalName]?.level ?? 0;
          const lb = learnMethods?.[b.internalName]?.level ?? 0;
          if (la !== lb) return la - lb;
        }
        const nameA = lang === "es" ? a.name : a.nameEn;
        const nameB = lang === "es" ? b.name : b.nameEn;
        return nameA.localeCompare(nameB);
      });
  }, [moves, search, categories, types, onlyZOriginals, showOnlyZFilter, onlyLearnable, learnableSet, learnMethods, lang, sortPower]);

  if (typeof document === "undefined") return null;

  return (
    <Modal label={lang === "es" ? "Movimientos" : "Moves"} onClose={onClose} className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-black/70 p-3 sm:p-4">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-100">
              {lang === "es" ? "Filtrar movimientos" : "Filter moves"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {lang === "es"
                ? "Busca por categoría, tipo o nombre y selecciona el movimiento."
                : "Search by category, type or name and pick the move."}
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

        {/* Filtros de categoría y tipo, en la misma fila, en dos columnas */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Filtro por categoría */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              {lang === "es" ? "Categoría" : "Category"}
            </div>
            <div className="flex flex-col gap-1.5">
              {["Physical", "Special", "Status"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onToggleCategory(c)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    categories.has(c)
                      ? "border-sky-500 bg-sky-600/30 text-sky-200"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <CategoryIcon cat={c} size={20} />
                  {catLabel(c)}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por tipo */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              {lang === "es" ? "Tipo" : "Type"}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {allTypesList.map((ty) => (
                <button
                  key={ty}
                  type="button"
                  onClick={() => onToggleType(ty)}
                  className={`${badgeClass(ty)} type-picker-badge min-h-8 w-full px-2 py-1 transition ${
                    types.has(ty) ? "ring-2 ring-white/70 opacity-100" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {tn(ty)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {filtered.length} {lang === "es" ? "resultados" : "results"}
          </span>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
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
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={lang === "es" ? "Buscar movimiento…" : "Search move…"}
              className="w-full max-w-[220px] rounded-lg border border-blue-800/40 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() =>
                onSortPowerChange(sortPower === null ? "asc" : sortPower === "asc" ? "desc" : null)
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                sortPower
                  ? "border-orange-500 bg-orange-600/20 text-orange-300"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
              }`}
              title={lang === "es" ? "Ordenar por potencia" : "Sort by power"}
            >
              <span aria-hidden>{sortPower === "asc" ? "🔼" : sortPower === "desc" ? "🔽" : "↕️"}</span>
              {lang === "es" ? "Potencia" : "Power"}
            </button>
            <button
              type="button"
              onClick={() => { onClearFilters(); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-800/50 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-500 hover:bg-rose-900/40 hover:text-rose-200"
            >
              <span aria-hidden>🧹</span>
              {lang === "es" ? "Limpiar filtros" : "Clear filters"}
            </button>
          </div>
        </div>

        {/* Lista de resultados */}
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {lang === "es" ? "Sin resultados." : "No results."}
            </div>
          ) : (
            filtered.map((mv, mvIdx) => {
              const label = lang === "es" ? mv.name : mv.nameEn;
              const badge = learnBadgeFor(mv);
              const powerText = mv.power && mv.power > 0 ? String(mv.power) : "—";
              const accText = mv.accuracy && mv.accuracy > 0 ? `${mv.accuracy}%` : "—";
              const ppText = mv.pp !== null && mv.pp !== undefined ? String(mv.pp) : "—";
              const description = (lang === "es" ? mv.descriptionEs : mv.descriptionEn) || (lang === "es" ? mv.descriptionEn : mv.descriptionEs) || "";
              return (
                <button
                  key={`${mv.internalName}__${mvIdx}`}
                  type="button"
                  onClick={() => onSelect(mv)}
                  className="flex w-full items-stretch gap-2 border-b border-slate-800/60 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-slate-800/80"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className="grid w-full min-w-0 items-center gap-2"
                      style={{ gridTemplateColumns: "minmax(0,1fr) 246px" }}
                    >
                      <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                        <span className="shrink-0" title={catLabel(mv.category)}>
                          <CategoryIcon cat={mv.category} size={22} />
                        </span>
                        {mv.type && (
                          <span className={`${badgeClass(mv.type)} shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold`}>
                            {tn(mv.type)}
                          </span>
                        )}
                        <span className="truncate font-medium text-slate-100">{label}</span>
                        {mv.hackrom && (
                          <span
                            title={lang === "es" ? "Movimiento exclusivo de Pokémon Z" : "Pokémon Z exclusive move"}
                            className="shrink-0 rounded-full border border-amber-500/50 bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300"
                          >
                            {lang === "es" ? "Original Z" : "Z Original"}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="flex flex-1 items-center justify-center whitespace-nowrap rounded-md border border-orange-700/40 bg-orange-950/40 px-1.5 py-0.5 text-[13px] font-bold text-orange-300">
                          {lang === "es" ? "Pot." : "Pow."} {powerText}
                        </span>
                        <span className="flex flex-1 items-center justify-center whitespace-nowrap rounded-md border border-emerald-700/40 bg-emerald-950/40 px-1.5 py-0.5 text-[13px] font-bold text-emerald-300">
                          {lang === "es" ? "Prec." : "Acc."} {accText}
                        </span>
                        <span className="flex flex-1 items-center justify-center whitespace-nowrap rounded-md border border-sky-700/40 bg-sky-950/40 px-1.5 py-0.5 text-[13px] font-bold text-sky-300">
                          PP {ppText}
                        </span>
                      </span>
                    </span>
                    {description && (
                      <span className="truncate text-[13px] text-slate-500">{description}</span>
                    )}
                  </span>
                  {badge && (
                    <span className="flex w-16 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-slate-950/80 px-1 text-center text-[12px] font-semibold leading-tight text-emerald-300">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
