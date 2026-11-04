// components/shared/recursoJson.ts
//
// Un JSON estático de /public, pedido una vez y compartido por todos.
//
// Este patrón estaba copiado a mano en nueve sitios (useZonesData, useMoveTypes,
// useSpeciesData, useEvolutions, useAbilityDescriptions, usePokemonZSprites,
// useItemSprites, useItemsFilter y staticPokeData): siempre las mismas ~25
// líneas de `let cache` + `let inflight` + un useEffect que hace setState al
// resolver. Nueve copias es nueve sitios donde arreglar un fallo.
//
// Y traía un defecto que solo se ve juntándolas: useSpeciesData y
// usePokemonZSprites piden EL MISMO archivo (pokemon_z_completo.json, 392 KB)
// con dos cachés distintas, así que se descargaba y se parseaba dos veces y se
// quedaba dos veces en memoria. Aquí el registro va por RUTA, de modo que dos
// recursos sobre el mismo archivo comparten descarga y parseo aunque cada uno
// lo transforme a su manera.

import { useEffect, useState } from "react";

/** Lo que se sabe de una ruta concreta: el JSON crudo y la petición en curso. */
type EstadoRuta = { crudo: unknown; resuelto: boolean; enVuelo: Promise<unknown> | null };

const rutas = new Map<string, EstadoRuta>();

function estadoDe(ruta: string): EstadoRuta {
  let e = rutas.get(ruta);
  if (!e) {
    e = { crudo: null, resuelto: false, enVuelo: null };
    rutas.set(ruta, e);
  }
  return e;
}

/** Descarga y parsea la ruta, o devuelve lo ya hecho / lo que está en camino. */
function pedirRuta(ruta: string): Promise<unknown> {
  const e = estadoDe(ruta);
  if (e.resuelto) return Promise.resolve(e.crudo);
  if (e.enVuelo) return e.enVuelo;

  e.enVuelo = fetch(ruta)
    .then((res) => {
      if (!res.ok) throw new Error(`No se pudo cargar ${ruta} (${res.status})`);
      return res.json();
    })
    .then((json) => {
      e.crudo = json;
      e.resuelto = true;
      return json;
    })
    .finally(() => {
      // A null pase lo que pase: si falló, el siguiente que lo pida reintenta
      // en vez de quedarse enganchado a una promesa ya rechazada.
      e.enVuelo = null;
    });

  return e.enVuelo;
}

export type LecturaRecurso<T> = {
  datos: T | null;
  cargando: boolean;
  error: string | null;
};

export type Recurso<T> = {
  /** Para quien lo necesite fuera de un componente. */
  cargar: () => Promise<T>;
  /**
   * Hook: devuelve los datos y re-renderiza cuando llegan.
   *
   * Se llama `useRecurso` y no `usar` por una razón que no es de estilo: React
   * reconoce los hooks POR EL NOMBRE, y eso incluye los llamados a través de un
   * objeto (`X.useAlgo()` cuenta, `X.usar()` no). Con el nombre en español, el
   * React Compiler lo tomaba por una función normal, la memoizaba, y el orden
   * de hooks del componente cambiaba entre renders — "Should have a queue. You
   * are likely calling Hooks conditionally".
   */
  useRecurso: () => LecturaRecurso<T>;
};

type Opciones<T> = {
  /**
   * Del JSON crudo a lo que quiere el consumidor. Se aplica por recurso, no
   * por ruta: dos recursos sobre el mismo archivo comparten la descarga pero
   * cada uno se queda con su forma.
   */
  transformar?: (crudo: never) => T;
  /** Para los avisos por consola cuando falla. */
  etiqueta?: string;
};

export function recursoJson<T>(ruta: string, opciones: Opciones<T> = {}): Recurso<T> {
  const { transformar, etiqueta = ruta } = opciones;

  // Caché del resultado ya transformado, para no rehacer el map/filter cada
  // vez que se monta un componente que use este recurso.
  let listo: { valor: T } | null = null;

  const aplicar = (crudo: unknown): T => {
    if (!listo) listo = { valor: transformar ? transformar(crudo as never) : (crudo as T) };
    return listo.valor;
  };

  const cargar = () => pedirRuta(ruta).then(aplicar);

  function useRecurso(): LecturaRecurso<T> {
    // Inicialización perezosa desde la caché: si ya está, el primer render lo
    // tiene y no hay parpadeo de estado vacío.
    const [lectura, setLectura] = useState<LecturaRecurso<T>>(() =>
      listo
        ? { datos: listo.valor, cargando: false, error: null }
        : { datos: null, cargando: true, error: null }
    );

    useEffect(() => {
      if (listo) return;
      let vivo = true;
      cargar()
        .then((valor) => {
          if (vivo) setLectura({ datos: valor, cargando: false, error: null });
        })
        .catch((err: unknown) => {
          const mensaje = err instanceof Error ? err.message : "Error desconocido";
          console.warn(`[recursoJson] ${etiqueta}:`, err);
          if (vivo) setLectura({ datos: null, cargando: false, error: mensaje });
        });
      return () => {
        vivo = false;
      };
    }, []);

    return lectura;
  }

  return { cargar, useRecurso };
}
