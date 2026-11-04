import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
  {
    rules: {
      // Un guion bajo delante significa "esto existe porque la posición lo
      // exige, no porque se use": el primer elemento de un `[_, valor]` al
      // destructurar una entrada de Object.entries, o un parámetro que hay que
      // declarar para llegar al siguiente. Marcarlos como no usados es ruido.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      // Aquí no hay una sola imagen de contenido: todos los <img> del proyecto
      // son sprites de pixel-art, y `next/image` no ayuda con ninguno.
      //
      //  - Los del recorte de spritesheets y los del editor de fakemon son
      //    dataURLs sacados de un <canvas>. Ya están decodificados en memoria y
      //    el optimizador no puede tocarlos.
      //  - Los de PokéAPI son PNG de 24-96 px que se pintan con
      //    `image-rendering: pixelated`. Pasarlos por el optimizador cuesta una
      //    petición extra, obliga a declarar `remotePatterns` para un host que
      //    solo sirve sprites, y su reescalado suave es justo lo que no
      //    queremos.
      //
      // Si algún día entra una imagen de verdad (una captura, un banner), esto
      // se quita y se resuelve caso por caso.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
