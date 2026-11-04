"use client";

// components/guia/ZoneSpriteImg.tsx
//
// Muestra el primer frame recortado del spritesheet de batalla. A
// diferencia de la primera versión, NO pasa por el SpriteImg del
// Builder (ese componente agrega una capa extra de preload pensada
// para sprites que cambian dinámicamente en un slot de equipo; acá
// solo generaba una segunda cadena de estado async encima del recorte
// que terminaba sin resolverse en pantalla). Como el resultado del
// recorte ya es un dataURL completamente decodificado en memoria
// (viene de un <canvas> ya cargado), no hace falta precargarlo de
// nuevo: se puede asignar directo a un <img> sin parpadeo real.

import { useEffect, useState } from "react";
import { PokeballIcon } from "../team-builder/components/PokeballIcon";
import { cropFirstFrame } from "./cropFirstFrame";

export function ZoneSpriteImg({
  rawUrl,
  alt,
  className,
  placeholderClassName,
  onError,
}: {
  rawUrl: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  onError?: () => void;
}) {
  // El recorte se guarda JUNTO a la url de la que salió. Así, cuando `rawUrl`
  // cambia, el recorte viejo deja de coincidir y se vuelve al placeholder solo,
  // sin tener que borrarlo a mano en un efecto (que además provoca un render de
  // más en cada cambio de sprite).
  const [recorte, setRecorte] = useState<{ rawUrl: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!rawUrl) return;
    let cancelado = false;
    cropFirstFrame(rawUrl)
      .then((url) => {
        if (!cancelado) setRecorte({ rawUrl, url });
      })
      .catch(() => {
        // url = null es "este sprite no se pudo recortar": se recuerda para no
        // reintentarlo en cada render.
        if (!cancelado) setRecorte({ rawUrl, url: null });
      });
    return () => {
      cancelado = true;
    };
  }, [rawUrl]);

  const croppedUrl = recorte && recorte.rawUrl === rawUrl ? recorte.url : null;

  if (!rawUrl || !croppedUrl) {
    return <PokeballIcon className={placeholderClassName ?? "h-5 w-5 opacity-40"} />;
  }

  return (
    <img
      src={croppedUrl}
      alt={alt}
      className={className}
      onError={() => {
        // El dataURL ya venía decodificado, así que esto casi no pasa; si pasa,
        // se marca este rawUrl como fallido para no volver a intentarlo.
        setRecorte({ rawUrl, url: null });
        onError?.();
      }}
    />
  );
}