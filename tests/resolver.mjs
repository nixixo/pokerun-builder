// tests/resolver.mjs
//
// Node 22 ya ejecuta TypeScript por su cuenta (quita los tipos y listo), pero
// no resuelve imports sin extensión: el código escribe `./typeChart` y Node
// exige `./typeChart.ts`. Eso, y el alias `@/` del tsconfig, es todo lo que
// falta para poder probar los motores puros sin bundler ni dependencias.
//
// Se engancha con `node --import ./tests/registrar.mjs`.

import { statSync } from "node:fs";
import { dirname, resolve as unirRutas } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = unirRutas(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONES = [".ts", ".tsx", ".mjs", ".js"];

/** ¿Es un archivo de verdad? (no una carpeta, no algo que no está) */
function esArchivo(ruta) {
  try {
    return statSync(ruta).isFile();
  } catch {
    return false;
  }
}

/** Primer archivo que exista probando las extensiones, o null. */
function conExtension(rutaBase) {
  for (const ext of EXTENSIONES) {
    if (esArchivo(rutaBase + ext)) return rutaBase + ext;
  }
  // Carpeta con index
  for (const ext of EXTENSIONES) {
    const indice = unirRutas(rutaBase, "index" + ext);
    if (esArchivo(indice)) return indice;
  }
  return null;
}

export async function resolve(especificador, contexto, siguiente) {
  let rutaBase = null;

  if (especificador.startsWith("@/")) {
    rutaBase = unirRutas(RAIZ, especificador.slice(2));
  } else if (especificador.startsWith(".") && contexto.parentURL?.startsWith("file:")) {
    rutaBase = unirRutas(dirname(fileURLToPath(contexto.parentURL)), especificador);
  }

  if (rutaBase) {
    // Si ya trae extensión y es un archivo, se deja pasar tal cual.
    if (esArchivo(rutaBase)) return siguiente(pathToFileURL(rutaBase).href, contexto);
    const encontrado = conExtension(rutaBase);
    if (encontrado) return siguiente(pathToFileURL(encontrado).href, contexto);
    // Ni archivo ni carpeta con index: que se queje Node, no nosotros.
  }

  return siguiente(especificador, contexto);
}
