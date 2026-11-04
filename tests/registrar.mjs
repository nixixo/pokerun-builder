// tests/registrar.mjs
//
// Engancha el resolver de al lado antes de que se cargue ningún test.
// Uso: node --import ./tests/registrar.mjs --test tests/

import { register } from "node:module";

// import.meta.url ya es una URL: pasarla por pathToFileURL la codificaría dos
// veces y el resolver no se encontraría a sí mismo.
register("./resolver.mjs", import.meta.url);
