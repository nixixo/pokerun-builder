// scripts/extraer-entrenadores-pdf.mjs
//
// Extrae las secciones "Entrenadores <zona>:" de la guía en PDF y las vuelca a
// data-src/entrenadores-pdf.json, que es lo que consume clean-guia-names.mjs.
//
// Por qué hace falta: la extracción original del .docx no reconoció esas
// secciones y repartió su contenido entre `pokemon_salvajes` y `objetos`. Un
// Pokémon de entrenador terminaba en la lista de salvajes sin porcentaje, con
// sus movimientos pegados y heredando el `metodo` del bloque anterior — de ahí
// que "Solosis Z, nivel 16" apareciera dos veces "pescable" en Bosque Ladera
// Parte 2, cuando en realidad son de Recluta Azoth Rubenchu y Recluta Azoth
// Winona. El PDF sí trae la sección completa y con los nombres.
//
// El resultado se versiona en data-src/ a propósito: así el build no depende de
// tener pdftotext instalado. Solo hay que volver a correr esto si cambia el PDF.
//
// Uso:  node scripts/extraer-entrenadores-pdf.mjs [ruta-al-pdf]

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PDF = process.argv[2] ?? "Guía Oficial de Pokémon Z.pdf";
const GUIA = join(process.cwd(), "data-src", "pokemon_z_guia.json");
const SALIDA = join(process.cwd(), "data-src", "entrenadores-pdf.json");

/**
 * Secciones cuyo título no se parece al nombre de la zona en el JSON. El resto
 * se resuelve solo (match exacto, o la zona empieza por el título de la sección).
 */
const ALIAS_ZONA = {
  "Bosque Ladera": "BOSQUE LADERA ZONA 1",
  "Bastión Pokémon Ciudad Óleo": "BASTIÓN DEL REGENTE HISOPO (2º MEDALLA)",
  "Zona Este del barco": "BARCO DEL CAPITÁN LOTO (5º MEDALLA )",
  "Palacio Luminalia": "PALACIO LUMINALIA (MAZMORRA FINAL PARTE 1)",
  "Prisión del Olvido": "PRISIÓN DEL OLVIDO (MATERIALES)",
  "Fábrica de Pokéball Interior": "FÁBRICA DE POKÉBALL (INTERIOR)",
  "Forja Inundada": "ANTIGUA FORJA INUNDADA",
  "Pirineos de Kalos": "PIRINEOS DE KALOS",
};

const SALTO = new RegExp("\\r?\\n");
const INVISIBLES = new RegExp("\\u200b", "g");
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
const NO_ALFANUM = new RegExp("[^a-z0-9]", "g");

const nz = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(DIACRITICOS, "").replace(NO_ALFANUM, "");

function textoDelPdf(ruta) {
  // pdftotext se atraganta con los acentos del nombre en Windows: se copia a
  // un temporal con nombre ASCII antes de invocarlo.
  const dir = mkdtempSync(join(tmpdir(), "guia-"));
  const tmp = join(dir, "guia.pdf");
  copyFileSync(ruta, tmp);
  return execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", tmp, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

// El nombre de la zona puede faltar: los tramos largos (El Arma Definitiva,
// Ruta 25) abren varios bloques con un "Entrenadores:" a secas. En ese caso la
// zona se resuelve por el último título que el PDF traía por encima.
const ENCABEZADO = /^\s*\f?\s*Entrenadores\s*(?:en\s+)?(?:la\s+|el\s+)?(.*?):\s*$/i;
// Cierra la sección en cuanto empieza otro bloque de la guía. El \s* inicial no
// es opcional: pdftotext -layout conserva la sangría del PDF, así que sin él
// ningún marcador coincidía y la sección se tragaba los objetos de la zona.
// El `[\s:]` tras "Entrenadores" no es cosmético: los bloques sin nombre de
// zona se abren con "Entrenadores:" a secas, y sin los dos puntos una sección
// no cerraba al empezar la siguiente y se tragaba sus entrenadores por duplicado.
const FIN = /^\s*(Objetos obtenibles|Lista de Pok|Cosas a destacar|Entrenadores[\s:]|Notas|MT\d)/i;
// Título de zona: línea entera en mayúsculas, como "BOSQUE LADERA PARTE 2".
const TITULO_ZONA = /^\s*[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ()º°:,.\-]{5,70}$/;
const BULLET = /^\s*[●•*]\s*(.+)$/;

/**
 * Una línea de equipo es "<Especie>, nivel N." con lo que siga. En la parte
 * final de la guía el nivel se escribe sin la palabra: "Starmie, al 95.". Y a
 * veces el nivel no es un número sino relativo al tuyo: "Excadrill, a un nivel
 * menos que la media de nivel de tu equipo."
 *
 * Los bullets de las secciones de objetos ("Piedra Trueno: Al sur de la
 * granja…") son lo que se colaba cuando el corte de sección fallaba; por eso el
 * número tiene que ir pegado a la coma y no vale cualquier cifra suelta.
 */
const LINEA_MON = /,\s*(?:al\s+)?(?:nivel\s*)?\d+|\bnivel\s*\d+|,\s*a un nivel\b/i;

function parsearSecciones(lineas) {
  const out = [];

  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(ENCABEZADO);
    if (!m) continue;

    const entrenadores = [];
    let actual = null;
    for (let j = i + 1; j < lineas.length; j++) {
      if (FIN.test(lineas[j])) break;
      if (TITULO_ZONA.test(lineas[j])) break;
      const linea = lineas[j].trim();
      if (!linea) continue;

      const b = linea.match(BULLET);
      if (b) {
        const mon = b[1].trim();
        // Sin nivel no es un Pokémon: es un objeto o una tarea de otra sección.
        if (actual && LINEA_MON.test(mon)) actual.equipo.push(mon);
        continue;
      }
      // Línea suelta en mayúscula inicial y corta: es un nombre de entrenador.
      if (/^[A-ZÁÉÍÓÚÑ¡]/.test(linea) && linea.length < 60 && !/\.$/.test(linea)) {
        actual = { nombre: linea.replace(/:$/, "").trim(), equipo: [] };
        entrenadores.push(actual);
      }
    }

    const conEquipo = entrenadores.filter((e) => e.equipo.length > 0);
    if (conEquipo.length) out.push({ seccion: m[1].trim(), linea: i, entrenadores: conEquipo });
  }
  return out;
}

/**
 * Resuelve el título de la sección contra el nombre real de la zona. Si el
 * título no identifica la zona por sí solo — "Bastión Pokémon 2º Sala" aparece
 * en dos bastiones distintos — se cae al último encabezado de zona que el PDF
 * traía por encima de la sección.
 */
function resolverZona(seccion, zonas, linea, lineas) {
  if (!seccion) return zonaMasCercanaArriba(linea, lineas, zonas);
  const directo = zonas.find((z) => nz(z) === nz(seccion));
  if (directo) return directo;

  const alias = ALIAS_ZONA[seccion];
  if (alias && zonas.includes(alias)) return alias;

  // "Ruta 16 Norte" -> "Ruta 16 Norte (Opcional)"
  const porPrefijo = zonas.filter((z) => nz(z).startsWith(nz(seccion)));
  if (porPrefijo.length === 1) return porPrefijo[0];

  return zonaMasCercanaArriba(linea, lineas, zonas);
}

/** Último título de zona del PDF que aparece antes de `linea`. */
function zonaMasCercanaArriba(linea, lineas, zonas) {
  for (let i = linea - 1; i >= 0 && linea - i < 400; i--) {
    const t = lineas[i].trim();
    if (t.length < 6 || t.length > 70) continue;
    const z = zonas.find((zz) => nz(zz) === nz(t) || nz(zz).endsWith(nz(t)));
    if (z) return z;
  }
  return null;
}

function main() {
  const zonas = JSON.parse(readFileSync(GUIA, "utf8")).map((z) => z.zona);
  const lineas = textoDelPdf(PDF).split(SALTO).map((l) => l.replace(INVISIBLES, ""));
  const secciones = parsearSecciones(lineas);

  const resuelto = [];
  const sinZona = [];
  for (const s of secciones) {
    const zona = resolverZona(s.seccion, zonas, s.linea, lineas);
    if (zona) resuelto.push({ zona, seccion: s.seccion, entrenadores: s.entrenadores });
    else sinZona.push(s);
  }

  const nMon = resuelto.reduce((n, s) => n + s.entrenadores.reduce((k, e) => k + e.equipo.length, 0), 0);
  console.log(`Secciones en el PDF:      ${secciones.length}`);
  console.log(`  mapeadas a una zona:    ${resuelto.length}`);
  console.log(`  sin zona (descartadas): ${sinZona.length}`);
  console.log(`Entrenadores:             ${resuelto.reduce((n, s) => n + s.entrenadores.length, 0)}`);
  console.log(`Pokémon:                  ${nMon}`);

  if (sinZona.length) {
    console.log("\n--- SIN ZONA (revisar ALIAS_ZONA) ---");
    for (const s of sinZona) console.log(`  "${s.seccion}"  (${s.entrenadores.length} entrenadores)`);
  }

  writeFileSync(SALIDA, JSON.stringify(resuelto, null, 2) + "\n", "utf8");
  console.log(`\n✓ Escrito ${SALIDA}`);
}

main();
