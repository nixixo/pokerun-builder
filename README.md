# 🎴 PokéRun Builder

Herramientas para preparar un equipo y orientarte durante la aventura de
**Pokémon Z**, con un Builder que también admite la Pokédex estándar. El objetivo
es ayudarte a avanzar con los Pokémon que te gustan, sin exigir optimización
competitiva.

- **Builder** (`/`) — armas un equipo de 6 y te dice qué le falta: debilidades
  compartidas, cobertura ofensiva, roles, stats flojas y qué Pokémon te
  convendría meter. Funciona con la Pokédex estándar y con la de Pokémon Z, y
  admite Fakemon con sprite propio.
- **Guía** (`/guia`) — una adaptación navegable de la guía del romhack. Cada zona con sus
  salvajes, objetos, MTs, entrenadores y notas; progreso de coleccionables;
  mapa; y un panel de **próxima batalla importante** que cruza el equipo que
  tengas en el Builder con el del rival para sugerir opciones según tipos,
  movimientos y stats base. Es una orientación, no un cálculo de daño ni una
  garantía de ganar el combate.

La guía permite recorrer la historia o agrupar las visitas por lugar. Su búsqueda
global incluye zonas, Pokémon, objetos, MTs, entrenadores y sus equipos,
intercambios, conversiones, iniciales, páginas de alquimia, regalos, nidos,
habitantes, requisitos y notas; acepta términos con o sin tildes. En móvil, la
navegación de zonas se puede desplegar para dejar más espacio al contenido.

**Estado del contenido:** la precisión de la guía está en revisión durante una
partida completa. Algunos equipos de entrenador tienen datos incompletos; las
evoluciones parten de los juegos oficiales y pueden diferir en el romhack.
Las discrepancias se corrigen en las fuentes y scripts de datos.

Español (la Guía) e inglés/español (el Builder).

---

## 🚀 Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
`motion` · `lucide-react`. Sin base de datos y sin backend: todo el estado del
usuario vive en `localStorage` y los catálogos son JSON estáticos. Si falla el
guardado local, se muestra un aviso y se conservan los cambios pendientes en
memoria mientras la página siga abierta. Los sprites de Pokémon Z se cargan
desde el proveedor externo Fakedex (`assets.fakedex.es`).

---

## 📦 Puesta en marcha

Node **22.18 o posterior de la rama 22**, definido en `.nvmrc` y `package.json`.

```bash
npm ci
npm run dev
```

En `http://localhost:3000`. `predev` prepara los datos automáticamente.

Para ejecutar la versión de producción localmente:

```bash
npm run build
npm start
```

---

## 📂 Estructura

```text
app/
  page.tsx              → monta el Builder
  guia/page.tsx         → monta la Guía
components/
  team-builder/         → Builder (components/ hooks/ utils/ context/ data/)
  shared/               → almacenamiento, recursos JSON y Modal accesible
  guia/                 → Guía, colecciones e identidades persistentes
data-src/               → datos FUENTE (se editan acá)
public/generated/       → derivados de data-src/, los hace el build
public/pokeapi/         → datos de PokéAPI congelados
scripts/                → el pipeline de datos
```

---

## 🗃️ Los datos

Es la parte con más trampa del proyecto. Hay tres orígenes distintos y no se
tratan igual:

### 1. `data-src/` → `public/generated/`

Automático. `scripts/build-data.mjs` corre en `predev` y `prebuild`: minifica
cada JSON y separa los learnsets de la Pokédex Z (el 70% del archivo, y solo
hacen falta al mirar los movimientos de un Pokémon). De 4,8 MB a 3,1 MB.

`public/generated/` está en `.gitignore` — es derivado, se regenera solo.

### 2. `public/pokeapi/`

**Manual, y tiene que estar versionado.**

```bash
npm run data:pokeapi
```

Sale a la red contra PokéAPI, así que no puede correr en cada build. Son la
tabla de tipos, los índices de autocompletado y el dataset de candidatos. Si
falta, el Builder se queda sin nada de eso *sin romperse visiblemente* — por
eso `build-data.mjs` verifica que estén los 5 archivos y aborta el build si no.
Volver a correrlo solo cuando salga una generación nueva.

### 3. La guía del romhack

`data-src/pokemon_z_guia.raw.json` es el volcado del `.docx` original. Trae de
todo: niveles, porcentajes y drops pegados dentro del campo `nombre`, tablas de
encuentros perdidas en las notas, equipos de entrenador con la columna corrida.

```bash
node scripts/clean-guia-names.mjs            # dry-run, solo reporta
node scripts/clean-guia-names.mjs --apply    # regenera el JSON limpio
```

Lee `pokemon_z_guia.raw.json` y escribe `pokemon_z_guia.json`. **El crudo no se
toca nunca**. La regeneración conserva los IDs de la salida anterior; no borres
el JSON limpio para regenerarlo. Si hay una correspondencia ambigua, el script
aborta antes de escribir y hay que resolverla explícitamente.

Los scripts `extraer-*.mjs` son extractores puntuales del PDF y no forman parte
del build. `generate-evoluciones.mjs` obtiene las cadenas evolutivas de los CSV
de PokéAPI y aplica las correcciones del romhack definidas en `ANULACIONES`;
requiere red y se ejecuta manualmente cuando hay que actualizar esos datos.

> El PDF de la guía oficial no está en el repo: es material de terceros.

---

## 🧭 Convenciones útiles

- El progreso se guarda por **IDs persistentes**, nunca por posiciones o nombres.
  La migración v1 → v2 usa `components/guia/data/legacyProgress.json`, una tabla
  congelada que no debe regenerarse al reordenar la guía. Las claves anteriores
  se conservan. Las visitas antiguas con nombres repetidos migran a todas sus
  ocurrencias, porque el formato anterior no permitía distinguirlas.
- Cada zona, MT, nido y habitante tiene `id`. Las páginas tienen un mapa
  `pagina_alquimia.progressIds` por descripción: al editar una descripción,
  conserva su ID y actualiza también la clave del mapa. El build rechaza IDs
  ausentes o repetidos. Para entradas nuevas usa un UUID nuevo; no recicles IDs.
- Los índices solo se usan como adaptador de navegación en la interfaz.
- El progreso de MT cuenta **108 números distintos**, aunque la guía contiene
  114 referencias: las entradas del mismo número comparten el estado marcado.
  Las marcas guardadas con los IDs de cada entrada siguen siendo válidas.
- Hay **18 habitantes** en 17 entradas de reclutamiento: Mariano y Luciano
  se marcan juntos y suman dos al progreso. Las otras colecciones son 47 páginas
  de alquimia y 18 nidos Alfa.
- `mapa.json` contiene los 87 puntos publicados del mapa (coordenadas porcentuales
  y `zoneId`). La web los muestra como puntos fijos para navegar: no permite
  editarlos ni toma marcadores del almacenamiento local. Para corregir un punto,
  edita este archivo y vuelve a publicar el proyecto.
- La Guía **lee** el equipo del Builder (`pokerun-builder-team-*`) pero nunca
  escribe en esas claves.
- Los nombres de zona se arreglan solo para mostrar (`components/guia/formato.ts`);
  el dato queda como está porque es la clave de media docena de tablas.

---

## Añadir un catálogo al Builder

1. Convierte los datos al formato de los JSON de `data-src/`. Usa una carpeta propia, por ejemplo `data-src/games/mi-juego/`, con especies, movimientos, habilidades y objetos.
2. Añade una entrada en `data-src/builder-catalogs.json` con un ID estable, `label`, `description.es`, `description.en` y las rutas relativas a `data-src/`. Usa `pokemon`, `moves`, `abilities` e `items` para los archivos fuente. `learnsets` es la ruta de salida que generará el build; el archivo de especies incluye las listas originales.
3. Ejecuta `npm run build`. El build valida IDs duplicados y referencias de movimientos y habilidades. El Builder incorpora el catálogo al selector y guarda equipos y plantillas con el ID del juego.

Cada especie usa un `id` numérico estable y puede declarar `sprite` como URL o ruta pública. Las listas `moves`, `tmMoves`, `eggMoves` y `tutorMoves` apuntan al `internal_name` de cada movimiento. `moves` contiene pares `{ move, level }`; las demás listas contienen IDs. Los nombres de las habilidades apuntan a claves del archivo de habilidades. Puedes consultar `tests/fixtures/third-catalog.json` como ejemplo del formato.

Para ejecutar la prueba de integración del tercer catálogo en PowerShell:

```powershell
$env:NEXT_PUBLIC_TEST_CATALOG = '1'
npm run build
npm run test:e2e -- --grep 'un tercer juego'
Remove-Item Env:NEXT_PUBLIC_TEST_CATALOG
```

El catálogo ficticio recibe sus datos de Playwright y solo figura en el selector de ese build de prueba.

## Comprobaciones

```bash
npm run check                 # lint sin advertencias, tipos, pruebas y build
npx playwright install chromium
npm run test:e2e              # requiere el build anterior
```

GitHub Actions ejecuta estas comprobaciones en push y pull request. Las pruebas
unitarias cubren datos, migraciones, persistencia y concurrencia. Playwright
comprueba foco/Escape, importación inválida, restauración y progreso de la Guía,
los puntos fijos del mapa y la búsqueda y navegación en móvil. Las pruebas
unitarias también comprueban la búsqueda global, los totales de colecciones
y las correcciones de nombres de especies.
El build descarga Geist Mono desde Google Fonts y necesita acceso a red.

Convenciones y responsabilidades: [docs/architecture.md](docs/architecture.md).
La decisión histórica sobre memoización está en
[docs/decisions/memoization.md](docs/decisions/memoization.md).

## 📄 Licencia

El código del proyecto se distribuye bajo [MIT](LICENSE). Los recursos de terceros
conservan sus derechos y licencias de origen. Pokémon es marca de Nintendo/Game Freak/The Pokémon Company; este es un
proyecto de fans sin ánimo de lucro.
