// components/guia/GlobalSearch.tsx
//
// Input independiente del buscador de la sidebar (ese filtra la lista de
// zonas por nombre; este busca DENTRO del contenido — Pokémon, objetos,
// Pokémon de equipos de entrenador — en las 201 zonas y te lleva directo
// a la zona correspondiente).

import { useState } from "react";
import { Search, Leaf, Package, Swords, X, Disc, MapPin, Users, ArrowLeftRight, FlaskConical, Gift, Sparkles, StickyNote, Shuffle, Egg } from "lucide-react";
import type { SearchHit } from "./useGlobalSearchIndex";
import { nombreZona } from "./formato";

const KIND_ICON: Record<SearchHit["kind"], React.ReactNode> = {
  zona: <MapPin className="h-3.5 w-3.5 text-sky-400" />,
  salvaje: <Leaf className="h-3.5 w-3.5 text-emerald-400" />,
  objeto: <Package className="h-3.5 w-3.5 text-amber-400" />,
  mt: <Disc className="h-3.5 w-3.5 text-cyan-400" />,
  entrenador: <Users className="h-3.5 w-3.5 text-red-400" />,
  equipo: <Swords className="h-3.5 w-3.5 text-red-400" />,
  intercambio: <ArrowLeftRight className="h-3.5 w-3.5 text-violet-400" />,
  conversion: <Shuffle className="h-3.5 w-3.5 text-violet-400" />,
  inicial: <Egg className="h-3.5 w-3.5 text-yellow-400" />,
  alquimia: <FlaskConical className="h-3.5 w-3.5 text-fuchsia-400" />,
  regalo: <Gift className="h-3.5 w-3.5 text-pink-400" />,
  nido: <Sparkles className="h-3.5 w-3.5 text-orange-400" />,
  habitante: <Users className="h-3.5 w-3.5 text-indigo-400" />,
  nota: <StickyNote className="h-3.5 w-3.5 text-slate-400" />,
};

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  zona: "Zona o conexión",
  salvaje: "Pokémon salvaje",
  objeto: "Objeto",
  mt: "MT",
  entrenador: "Entrenador",
  equipo: "Equipo de entrenador",
  intercambio: "Intercambio",
  conversion: "Conversión",
  inicial: "Inicial del rival",
  alquimia: "Página de alquimia",
  regalo: "Regalo o captura",
  nido: "Nido Alfa",
  habitante: "Habitante de Acrílico",
  nota: "Nota de la guía",
};

export function GlobalSearch({
  onSearch,
  onSelect,
}: {
  onSearch: (query: string) => SearchHit[];
  onSelect: (zoneIndex: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = query.trim() ? onSearch(query) : [];

  return (
    <div className="relative w-full min-w-0 basis-full sm:w-72 sm:basis-auto sm:flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Buscar en toda la guía"
        placeholder="¿Dónde encuentro…?"
        className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 py-2 pl-8 pr-8 text-base text-slate-100 outline-none focus:border-sky-500/60"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(false);
          }}
          aria-label="Limpiar la búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-950/98 p-1.5 shadow-2xl shadow-black/60">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">Sin resultados para «{query}».</div>
          ) : (
            results.map((hit) => (
              <button
                key={hit.key}
                type="button"
                onClick={() => {
                  onSelect(hit.zoneIndex);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-800/60"
              >
                <span className="mt-0.5 shrink-0">{KIND_ICON[hit.kind]}</span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-slate-100">{hit.label}</span>
                  <span className="block text-sm text-slate-500">
                    {KIND_LABEL[hit.kind]} · <span className="text-sky-300">{nombreZona(hit.zoneName)}</span>
                  </span>
                  {hit.detail && <span className="block truncate text-sm text-slate-600">{hit.detail}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
