// components/guia/useEvolutions.ts
//
// Carga /generated/evoluciones.json y expone la cadena evolutiva como un grafo
// dirigido "de → a", para poder responder a la pregunta que de verdad importa
// al recomendar una captura: con el tope de nivel de ESTE tramo, ¿hasta dónde
// llega este bicho antes del combate?
//
// El JSON lo escribe scripts/generate-evoluciones.mjs desde los CSV de PokéAPI
// (la Pokédex Z no trae evoluciones). Ver ahí la advertencia sobre los niveles.
//
// La descarga y su caché las pone recursoJson (components/shared): el hook lo
// usan el banner de próxima batalla y el detalle de zona a la vez, y sin eso
// cada uno se traía el archivo por su lado.

import { useMemo } from "react";
import { clave as normalize } from "@/components/shared/normalizar";
import { recursoJson } from "@/components/shared/recursoJson";

export type PasoEvolucion = {
  de: string;
  a: string;
  /** Nivel al que evoluciona, o null si no depende del nivel (piedra, intercambio…). */
  nivel: number | null;
  /** Texto listo para enseñar: "nivel", "Piedra Trueno", "intercambio con Roca del Rey". */
  metodo: string;
  /**
   * El objeto que hace falta, suelto del texto de `metodo`. Solo lo traen los
   * pasos que piden uno. Sirve para marcar en cada zona los objetos que valen
   * para evolucionar algo sin tener que parsear la frase.
   */
  objeto?: string;
};

/** Todos los objetos que aparecen como requisito de alguna evolución. */
export function objetosEvolutivos(pasos: PasoEvolucion[]): Set<string> {
  const set = new Set<string>();
  for (const p of pasos) if (p.objeto) set.add(normalize(p.objeto));
  return set;
}

type Archivo = { fuente?: string; advertencia?: string; evoluciones: PasoEvolucion[] };

const Evolucion = recursoJson<PasoEvolucion[]>("/generated/evoluciones.json", {
  etiqueta: "useEvolutions",
  transformar: (a: Archivo) => a.evoluciones ?? [],
});

export type Evoluciones = {
  /** Pasos que salen de una especie. Vacío si es forma final o no está en la tabla. */
  pasosDesde: (especie: string) => PasoEvolucion[];
  /** ¿Este objeto sirve para evolucionar a alguien? Nombre ya normalizado por dentro. */
  esObjetoEvolutivo: (nombre: string) => boolean;
  cargado: boolean;
};

export function useEvolutions(): Evoluciones {
  const { datos: pasos } = Evolucion.useRecurso();

  const porOrigen = useMemo(() => {
    const map = new Map<string, PasoEvolucion[]>();
    for (const paso of pasos ?? []) {
      const clave = normalize(paso.de);
      const lista = map.get(clave);
      if (lista) lista.push(paso);
      else map.set(clave, [paso]);
    }
    return map;
  }, [pasos]);

  const objetos = useMemo(() => objetosEvolutivos(pasos ?? []), [pasos]);

  return useMemo(
    () => ({
      pasosDesde: (especie: string) => porOrigen.get(normalize(especie)) ?? [],
      esObjetoEvolutivo: (nombre: string) => objetos.has(normalize(nombre)),
      cargado: pasos !== null,
    }),
    [porOrigen, objetos, pasos]
  );
}
