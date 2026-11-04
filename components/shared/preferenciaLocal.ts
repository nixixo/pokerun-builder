// components/shared/preferenciaLocal.ts
//
// Una preferencia del usuario guardada en localStorage.
//
// El patrón que había repetido por todo el proyecto era este:
//
//   const [v, setV] = useState(pordefecto);
//   useEffect(() => { const s = localStorage.getItem(K); if (s) setV(s); }, []);
//   useEffect(() => { localStorage.setItem(K, v); }, [v]);
//
// Funciona, pero tiene dos problemas. El primero es que el primer render pinta
// SIEMPRE el valor por defecto y luego salta al guardado, con su parpadeo. El
// segundo es que React lo marca como error (`react-hooks/set-state-in-effect`):
// un setState síncrono dentro de un efecto provoca un render en cascada.
//
// La solución no es leer en el inicializador del useState — eso rompería la
// hidratación, porque el servidor no tiene localStorage y pintaría otra cosa.
// Es useSyncExternalStore, que existe justo para esto: se le da una lectura
// para el cliente y otra para el servidor, y React se encarga del resto.
//
// De regalo, al suscribirse al evento `storage` las preferencias quedan
// sincronizadas entre pestañas.

import { useCallback, useSyncExternalStore } from "react";
import { almacenLocal } from "./almacenLocal";

/** Cómo se convierte el valor a texto y de vuelta. */
export type Codec<T> = {
  leer: (crudo: string | null, porDefecto: T) => T;
  escribir: (valor: T) => string;
};

export const codecBooleano: Codec<boolean> = {
  leer: (crudo, porDefecto) => (crudo === "1" ? true : crudo === "0" ? false : porDefecto),
  escribir: (v) => (v ? "1" : "0"),
};

/** Para textos de un conjunto cerrado ("simple" | "advanced", ids de pokédex…). */
export function codecTexto<T extends string>(validos: readonly T[]): Codec<T> {
  return {
    leer: (crudo, porDefecto) =>
      crudo !== null && (validos as readonly string[]).includes(crudo) ? (crudo as T) : porDefecto,
    escribir: (v) => v,
  };
}

/** Enteros. Cualquier cosa que no lo sea (texto viejo, NaN) cae al defecto. */
export const codecEntero: Codec<number> = {
  leer: (crudo, porDefecto) => {
    if (crudo === null) return porDefecto;
    const n = Number(crudo);
    return Number.isInteger(n) ? n : porDefecto;
  },
  escribir: (v) => String(v),
};

/**
 * JSON arbitrario. `sanear` recibe lo que salió de `JSON.parse` y decide si
 * sirve: devuelve el valor ya normalizado, o `null` para caer al defecto.
 *
 * Lo de sanear no es paranoia: localStorage guarda lo que escribió una versión
 * ANTERIOR del proyecto, con otro esquema, y el usuario no lo va a borrar.
 */
export function codecJson<T>(sanear: (crudo: unknown) => T | null): Codec<T> {
  return {
    leer: (crudo, porDefecto) => {
      if (crudo === null) return porDefecto;
      try {
        return sanear(JSON.parse(crudo)) ?? porDefecto;
      } catch {
        return porDefecto;
      }
    },
    escribir: (v) => JSON.stringify(v),
  };
}

/** Un conjunto de textos, guardado como array JSON. */
export const codecConjunto: Codec<Set<string>> = {
  leer: (crudo, porDefecto) => {
    if (crudo === null) return porDefecto;
    try {
      const parsed: unknown = JSON.parse(crudo);
      if (!Array.isArray(parsed)) return porDefecto;
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    } catch {
      return porDefecto;
    }
  },
  escribir: (v) => JSON.stringify(Array.from(v)),
};

/**
 * Conjunto vacío compartido, para pasarlo como defecto sin crear uno nuevo en
 * cada render (`getServerSnapshot` tiene que devolver siempre lo mismo).
 * No se muta: los toggles siempre hacen `new Set(prev)`.
 */
export const CONJUNTO_VACIO: Set<string> = new Set<string>();

/**
 * Lo que hay guardado, o el valor por defecto.
 *
 * `getSnapshot` tiene que devolver algo estable entre llamadas o React entra en
 * bucle, así que se cachea el resultado por clave y solo se recalcula cuando el
 * texto crudo de localStorage cambia. Con codecs que devuelven objetos (JSON)
 * esto no es un detalle: sin la caché, cada llamada daría una referencia nueva.
 */
const cache = new Map<string, { crudo: string | null; valor: unknown }>();

function leer<T>(clave: string, porDefecto: T, codec: Codec<T>, claveAnterior?: string): T {
  const crudo = almacenLocal.leer(clave, claveAnterior);
  const previo = cache.get(clave);
  if (previo && previo.crudo === crudo) return previo.valor as T;
  const valor = codec.leer(crudo, porDefecto);
  cache.set(clave, { crudo, valor });
  return valor;
}

/**
 * Igual de usar que useState, pero persistido y sin parpadeo en el primer
 * render del cliente.
 */
export function usePreferenciaLocal<T>(
  clave: string,
  porDefecto: T,
  codec: Codec<T>,
  claveAnterior?: string
): [T, (valor: T | ((previo: T) => T)) => void] {
  const valor = useSyncExternalStore(
    almacenLocal.suscribir,
    () => leer(clave, porDefecto, codec, claveAnterior),
    // En el servidor no hay localStorage: se pinta el valor por defecto, que es
    // exactamente lo que el cliente pintará antes de hidratar.
    () => porDefecto
  );

  const guardar = useCallback(
    (siguiente: T | ((previo: T) => T)) => {
      const resuelto =
        typeof siguiente === "function"
          ? (siguiente as (previo: T) => T)(leer(clave, porDefecto, codec, claveAnterior))
          : siguiente;
      almacenLocal.escribir(clave, codec.escribir(resuelto));
    },
    [clave, porDefecto, codec, claveAnterior]
  );

  return [valor, guardar];
}

// El render de hidratación tiene que pintar lo mismo que pintó el servidor, así
// que ahí el valor guardado todavía no está disponible. Para no mostrar "0 de
// 204 zonas" durante un instante, quien lo necesite pinta un esqueleto mientras
// esto sea `false`.
const nuncaCambia = () => () => {};

/** `false` en el servidor y al hidratar; `true` a partir del render siguiente. */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    nuncaCambia,
    () => true,
    () => false
  );
}
