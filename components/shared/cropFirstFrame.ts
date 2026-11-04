// components/shared/cropFirstFrame.ts
//
// Recorta el primer frame de un spritesheet horizontal de batalla (Pokémon Z).
// El sprite crudo es una tira de frames cuadrados: el alto de la imagen ya es
// el lado del frame, así que el primero es el cuadrado [0,0,lado,lado].
//
// Había dos versiones. La de la Guía cacheaba y recortaba al contenido; la del
// Builder estaba declarada DENTRO del componente (se recreaba en cada render),
// sin caché y sin deduplicar peticiones en vuelo, así que el mismo sprite se
// volvía a decodificar una y otra vez.
//
// Se unifican aquí, pero el recorte al contenido queda como OPCIÓN, no como
// comportamiento por defecto: el Builder no lo hacía y lo aplica en un segundo
// paso propio (zSpritesTrimmed). Fundirlos sin más habría cambiado el tamaño
// con el que se ven los sprites del equipo, que no es lo que se venía a hacer.

import { normalizeSpriteUrl } from "./spriteUrls";

type Rect = { x: number; y: number; w: number; h: number };

export type OpcionesRecorte = {
  /**
   * Reescala el resultado con "nearest neighbor" (bordes duros, sin
   * interpolar), que es como se ve el pixel art en el juego. Con CSS
   * `transform: scale` quedaría borroso.
   */
  escala?: number;
  /**
   * Recorta al rectángulo de píxeles no transparentes y lo centra en un
   * cuadrado. Sin esto, cada especie ocupa una fracción muy distinta de su
   * frame: Murkrow llena sus 44px al 100% y Solosis ocupa 24x31 dentro de uno
   * de 96 — un 32%. En una caja fija de 36px, Solosis acababa a ~11px reales.
   */
  alContenido?: boolean;
};

const cache = new Map<string, string>();
const enVuelo = new Map<string, Promise<string>>();

/**
 * Rectángulo que ocupa realmente el sprite dentro del primer frame, ignorando
 * el relleno transparente. Devuelve el frame entero si los píxeles no se
 * pueden leer (canvas contaminado por CORS) o si el frame está vacío.
 */
function contenidoDelFrame(img: HTMLImageElement, lado: number): Rect {
  const completo: Rect = { x: 0, y: 0, w: lado, h: lado };
  try {
    const medidor = document.createElement("canvas");
    medidor.width = lado;
    medidor.height = lado;
    const mctx = medidor.getContext("2d", { willReadFrequently: true });
    if (!mctx) return completo;
    mctx.drawImage(img, 0, 0, lado, lado, 0, 0, lado, lado);
    const { data } = mctx.getImageData(0, 0, lado, lado);

    let minX = lado, minY = lado, maxX = -1, maxY = -1;
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        // Umbral bajo en vez de > 0: los sprites traen un halo de píxeles casi
        // transparentes en el borde que ensancharía el recorte sin aportar nada.
        if (data[(y * lado + x) * 4 + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return completo;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch {
    return completo;
  }
}

export function cropFirstFrame(rawUrl: string, opciones: OpcionesRecorte = {}): Promise<string> {
  const url = normalizeSpriteUrl(rawUrl);
  const { escala = 1, alContenido = false } = opciones;
  // La clave lleva las opciones: el mismo sprite pedido recortado y sin
  // recortar, o a dos tamaños, son resultados distintos y no deben pisarse.
  const clave = `${url}::${escala}::${alContenido ? "c" : "f"}`;

  const hecho = cache.get(clave);
  if (hecho) return Promise.resolve(hecho);

  const pendiente = enVuelo.get(clave);
  if (pendiente) return pendiente;

  const promesa = new Promise<string>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const lado = img.naturalHeight; // alto = lado del frame cuadrado
        const salida = Math.round(lado * escala);
        const canvas = document.createElement("canvas");
        canvas.width = salida;
        canvas.height = salida;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.warn("[cropFirstFrame] sin contexto 2d, uso URL cruda:", url);
          resolve(url);
          return;
        }
        ctx.imageSmoothingEnabled = false;

        if (alContenido) {
          const recorte = contenidoDelFrame(img, lado);
          const caja = Math.max(recorte.w, recorte.h);
          const dx = Math.round((caja - recorte.w) / 2);
          const dy = Math.round((caja - recorte.h) / 2);
          const f = salida / caja;
          ctx.drawImage(
            img,
            recorte.x, recorte.y, recorte.w, recorte.h,
            Math.round(dx * f), Math.round(dy * f),
            Math.round(recorte.w * f), Math.round(recorte.h * f)
          );
        } else {
          ctx.drawImage(img, 0, 0, lado, lado, 0, 0, salida, salida);
        }

        const dataUrl = canvas.toDataURL("image/png");
        cache.set(clave, dataUrl);
        resolve(dataUrl);
      } catch (err) {
        // Típicamente SecurityError por "tainted canvas": el CDN no manda
        // Access-Control-Allow-Origin y crossOrigin="anonymous" bloquea la
        // lectura de píxeles aunque la imagen se vea bien en un <img> normal.
        console.warn("[cropFirstFrame] fallo al recortar, uso URL cruda:", url, err);
        resolve(url);
      }
    };
    img.onerror = (err) => {
      // Con crossOrigin="anonymous" puesto, si el servidor no responde CORS la
      // carga en sí puede fallar (no solo el recorte).
      console.warn("[cropFirstFrame] la imagen no cargó en absoluto:", url, err);
      resolve(url);
    };
    img.src = url;
  }).finally(() => {
    enVuelo.delete(clave);
  });

  enVuelo.set(clave, promesa);
  return promesa;
}
