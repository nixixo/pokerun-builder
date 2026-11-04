// components/guia/monBadges.tsx
//
// Trozos de la tarjeta de un Pokémon de entrenador que se repiten igual en el
// detalle de zona y en el panel de próxima batalla. Viven acá para no tener el
// mismo markup duplicado en dos archivos.

import { Atom, Dna, Hammer, Shuffle } from "lucide-react";

/** Línea de naturaleza, con el mismo formato que las de habilidad y objeto. */
export function NaturalezaLine({ naturaleza }: { naturaleza: string | null | undefined }) {
  if (!naturaleza) return null;
  return (
    <div className="flex items-start gap-1.5 text-[13px] leading-snug text-slate-500">
      <Dna className="h-3 w-3 shrink-0 translate-y-[1.5px] text-teal-400" />
      <span>{naturaleza}</span>
    </div>
  );
}

export type AttackProfile = "Físico" | "Especial" | "Mixto";

const PERFIL = {
  Físico: { Icono: Hammer, clase: "border-orange-400/35 bg-orange-400/10 text-orange-300" },
  Especial: { Icono: Atom, clase: "border-sky-400/35 bg-sky-400/10 text-sky-300" },
  Mixto: { Icono: Shuffle, clase: "border-violet-400/35 bg-violet-400/10 text-violet-300" },
} as const;

/**
 * Por dónde ataca el Pokémon, deducido de la categoría de sus movimientos
 * (ver getAttackProfile en useMoveTypes). Sirve para saber de un vistazo si
 * conviene bajarle el ataque físico o el especial, o si da igual.
 */
export function CategoriaBadge({ perfil }: { perfil: AttackProfile | null }) {
  if (!perfil) return null;
  const { Icono, clase } = PERFIL[perfil];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wide ${clase}`}
    >
      <Icono className="h-2.5 w-2.5" />
      {perfil}
    </span>
  );
}
