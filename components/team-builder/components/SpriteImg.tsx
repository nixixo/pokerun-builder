import { normalizeSpriteUrl } from "@/components/shared/spriteUrls";
import { useState } from "react";
import { PokeballIcon } from "./PokeballIcon";

/** <img> que evita el "parpadeo" de sprites:
 *  - Mientras la imagen (src) no haya terminado de cargar, muestra el
 *    placeholder (Pokéball) en vez de una imagen vieja o sin estilo aplicar.
 *  - Precarga la imagen real oculta (display:none) y, recién en su onLoad,
 *    la muestra ya con el style/transform puesto — así nunca se ve "cruda"
 *    (sin recortar/redimensionar) un instante antes de ajustarse.
 *  - Si `src` cambia (nuevo Pokémon), no se sigue mostrando el anterior: lo
 *    que se guarda es QUÉ url terminó de cargar, no un booleano, así que en
 *    cuanto `src` es otro deja de coincidir y vuelve el placeholder solo.
 */
export function SpriteImg({
  src: rawSrc,
  alt,
  className,
  style,
  onError,
  placeholderClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: () => void;
  placeholderClassName?: string;
}) {
  const src = rawSrc ? normalizeSpriteUrl(rawSrc) : rawSrc;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  if (!src) {
    return <PokeballIcon className={placeholderClassName ?? "h-5 w-5 opacity-40"} />;
  }

  const isReady = loadedSrc === src;

  return (
    <>
      {isReady ? (
        <img src={src} alt={alt} className={className} style={style} onError={onError} />
      ) : (
        <PokeballIcon className={placeholderClassName ?? "h-5 w-5 opacity-40"} />
      )}
      {!isReady && (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          style={{ display: "none" }}
          onLoad={() => setLoadedSrc(src)}
          onError={onError}
        />
      )}
    </>
  );
}
