// scripts/extraer-salvajes-cueva-pdf.mjs
//
// Extrae las listas "Lista de Pokémon (salvajes) en nubes de polvo" de la guía
// en PDF y las vuelca a data-src/salvajes-cueva-pdf.json, que es lo que consume
// clean-guia-names.mjs.
//
// Por qué hace falta: en las cuevas no hay hierba alta, los encuentros salen de
// las nubes de polvo. La extracción original del .docx solo reconoció "hierba
// alta" y "caña de pescar", así que TODAS estas listas se perdieron: el JSON
// tenía 0 Pokémon con ese método y las cuevas se quedaban con lo que se pesca y
// nada más.
//
// El resultado se versiona en data-src/ a propósito: así el build no depende de
// tener pdftotext instalado. Solo hay que volver a correr esto si cambia el PDF.
//
// Uso:  node scripts/extraer-salvajes-cueva-pdf.mjs [ruta-al-pdf]

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PDF = process.argv[2] ?? "Guía Oficial de Pokémon Z.pdf";
const GUIA = join(process.cwd(), "data-src", "pokemon_z_guia.json");
const SALIDA = join(process.cwd(), "data-src", "salvajes-cueva-pdf.json");

/**
 * Cabecera de la lista. La guía la escribe de seis maneras distintas: con y sin
 * "salvajes", con y sin dos puntos finales, con el matiz entre paréntesis
 * ("(Alcantarillas)") o pegado al final sin más ("Planta Baja", "Sótano 1"). Y
 * en una de ellas la extracción del PDF se comió la "L" inicial, de ahí `L?`.
 */
const CABECERA = /(?:^|\s)L?ista de\s+Pok.mon\s+(?:salvajes\s+)?(?:en\s+)?nubes de polvo\s*(.*)$/i;

/**
 * Una entrada. La guía las escribe en los dos órdenes posibles:
 *   "● 25% Rattata (Dropea Pelaje Fino y raramente Baya Chilan)."
 *   "● Gengar 20% (No tiene drop)."
 */
const ENTRADA_PCT_DELANTE = /^\s*●?\s*(\d{1,3})\s*%\s*(.+)$/;
const ENTRADA_PCT_DETRAS = /^\s*●?\s*(.+?)\s+(\d{1,3})\s*%\s*(.*)$/;

/**
 * Separa "Rattata (Dropea Pelaje Fino)." en nombre y drop. El paréntesis puede
 * quedar sin cerrar cuando el drop sigue en la línea siguiente, así que no vale
 * exigir el cierre.
 */
function partirNombreYDrop(resto) {
  const i = resto.indexOf("(");
  if (i < 0) return { nombre: resto.replace(/[.,\s]+$/, "").trim(), drop: "" };
  return {
    nombre: resto.slice(0, i).replace(/[.,\s]+$/, "").trim(),
    drop: resto.slice(i + 1).replace(/[).\s]+$/, "").trim(),
  };
}

/** Subtítulo dentro de una misma lista: "Planta Baja:". */
const SUBTITULO = /^\s*([A-ZÁÉÍÓÚÑ][^:●%]{2,40}):\s*$/;

/** Corta la lista: otra cabecera de sección de la guía. */
const FIN = /^\s*(Lista de|Objetos obteni|Entrenadores|Cosas a destacar|Notas|MT\s?\d|PISTA|Dato)/i;

function normalizar(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function textoDelPdf(ruta) {
  // pdftotext se atraganta con los acentos del nombre en Windows, así que se
  // copia a un nombre ASCII antes de invocarlo (mismo truco que en
  // extraer-entrenadores-pdf.mjs).
  const dir = mkdtempSync(join(tmpdir(), "guia-"));
  const copia = join(dir, "guia.pdf");
  copyFileSync(ruta, copia);
  const salida = join(dir, "guia.txt");
  execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", copia, salida]);
  return readFileSync(salida, "utf8").replace(/[​⁠]/g, "");
}

/** Huella de una lista, para detectar pisos con exactamente los mismos encuentros. */
const huella = (pokemon) => pokemon.map((p) => `${p.porcentaje} ${p.nombre} ${p.drop}`).join("|");

/** El matiz del método de una lista ("Planta Baja"), o "" si no tiene. */
const matizDe = (lista) => (lista.pokemon[0].metodo.split(" - ")[1] ?? "").trim();

/**
 * En Cueva Desenlace la guía repite la MISMA lista para Planta Baja, Sótano 1 y
 * Sótano 2. Volcarla tres veces llenaría la zona de 27 filas idénticas, así que
 * se deja una sola con los tres pisos en el método.
 */
function fusionarPisosIguales(listas) {
  const salida = [];
  for (const lista of listas) {
    const previa = salida[salida.length - 1];
    if (previa && previa.zona === lista.zona && huella(previa.pokemon) === huella(lista.pokemon)) {
      const pisos = [...previa.pisos, matizDe(lista)].filter(Boolean);
      const etiqueta = pisos.length > 1 ? pisos.slice(0, -1).join(", ") + " y " + pisos.at(-1) : pisos[0];
      previa.pisos = pisos;
      for (const p of previa.pokemon) p.metodo = etiqueta ? `nubes de polvo - ${etiqueta}` : "nubes de polvo";
      continue;
    }
    salida.push({ ...lista, pisos: [matizDe(lista)].filter(Boolean) });
  }
  // `pisos` es estado del bucle de arriba, no parte del resultado: se descarta.
  return salida.map(({ pisos: _pisos, ...resto }) => resto);
}

function main() {
  const zonas = JSON.parse(readFileSync(GUIA, "utf8"));
  const porNorm = new Map();
  for (const z of zonas) {
    const k = normalizar(z.zona);
    if (!porNorm.has(k)) porNorm.set(k, z.zona);
  }

  // \r?\n y no "\n" a secas: pdftotext deja saltos de Windows, y un "\r" al
  // final de línea impide que el `$` de CABECERA llegue a cerrar.
  const lineas = textoDelPdf(PDF).split(/\r?\n/);
  const listas = [];
  let zonaActual = null;

  for (let i = 0; i < lineas.length; i++) {
    const k = normalizar(lineas[i]);
    if (k.length > 3 && k.length < 80 && porNorm.has(k)) zonaActual = porNorm.get(k);

    const cab = lineas[i].match(CABECERA);
    if (!cab) continue;

    // Lo que venga tras "nubes de polvo" matiza el método, igual que ya se hace
    // con "hierba alta - Zona del Puerto".
    const matizCabecera = (cab[1] || "")
      .replace(/[():]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\bSotano\b/g, "Sótano") // errata de la guía en "Sotano 2"
      .trim();
    let sub = "";
    const encontrados = [];

    for (let j = i + 1; j < lineas.length; j++) {
      const l = lineas[j];
      if (!l.trim()) continue;
      if (FIN.test(l)) break;

      const st = l.match(SUBTITULO);
      if (st && !/%/.test(l)) {
        sub = st[1].trim();
        continue;
      }

      const delante = l.match(ENTRADA_PCT_DELANTE);
      const detras = delante ? null : l.match(ENTRADA_PCT_DETRAS);
      if (!delante && !detras) {
        // Línea de continuación de un drop partido en dos ("... muy raramente\n
        // Fragmento Cometa)."): se pega a la anterior en vez de cortar la lista.
        // El salto cae donde cae, así que no vale fiarse de la mayúscula: lo que
        // descarta es que sea otra entrada (● o %) o una cabecera (FIN).
        const previo = encontrados[encontrados.length - 1];
        if (previo && !l.includes("●")) {
          const cola = l.trim().replace(/[).\s]+$/, "");
          previo.drop = (previo.drop ? previo.drop + " " + cola : cola).replace(/\s+/g, " ");
          continue;
        }
        break;
      }

      const pct = delante ? delante[1] : detras[2];
      const resto = delante ? delante[2] : `${detras[1]} ${detras[3]}`;
      const { nombre, drop } = partirNombreYDrop(resto.trim());
      const matices = [matizCabecera, sub].filter(Boolean).join(" - ");
      encontrados.push({
        porcentaje: `${pct}%`,
        nombre,
        drop,
        metodo: matices ? `nubes de polvo - ${matices}` : "nubes de polvo",
      });
    }

    listas.push({ zona: zonaActual, linea: i + 1, pokemon: encontrados });
  }

  const vacias = listas.filter((l) => !l.pokemon.length);

  const conZona = fusionarPisosIguales(listas.filter((l) => l.zona && l.pokemon.length));
  const sinZona = listas.filter((l) => !l.zona && l.pokemon.length);

  writeFileSync(
    SALIDA,
    JSON.stringify(
      {
        generado: new Date().toISOString().slice(0, 10),
        fuente: "Guía Oficial de Pokémon Z.pdf",
        listas: conZona,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const total = conZona.reduce((n, l) => n + l.pokemon.length, 0);
  console.log(`Listas de nubes de polvo: ${listas.length} (${conZona.length} con zona)`);
  console.log(`Pokémon extraídos:        ${total}`);
  for (const l of conZona) console.log(`  ${String(l.pokemon.length).padStart(2)}  ${l.zona}`);
  if (sinZona.length) {
    console.log("\nSIN ZONA RECONOCIDA (no se escriben):");
    for (const l of sinZona) console.log(`  L${l.linea}  ${l.pokemon.map((p) => p.nombre).join(", ")}`);
  }
  if (vacias.length) {
    console.log("\nCABECERAS SIN ENTRADAS (revisar a mano):");
    for (const l of vacias) console.log(`  L${l.linea}  ${l.zona ?? "(sin zona)"}`);
  }
}

main();
