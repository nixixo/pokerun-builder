import { useState, type ReactNode } from "react";

export function IconoTarjetaObjeto({ sprite, fallback }: { sprite: string | null; fallback: ReactNode }) {
  const [fallido, setFallido] = useState<string | null>(null);
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
      {sprite && sprite !== fallido ? (
        <img
          src={sprite}
          alt=""
          className="h-6 w-6 object-contain [image-rendering:pixelated]"
          loading="lazy"
          onError={() => setFallido(sprite)}
        />
      ) : fallback}
    </span>
  );
}
