// ─── Tipos y formateo de nombres ─────────────────────────────────────────────
// Nota: TYPE_ES_TO_API / TYPE_ES_TO_API_NORMALIZED / normalizeTypeToApi viven
// en utils/constants.ts, y normalizeApostrophe en utils/stringNormalization.ts.
// Se quitaron las copias duplicadas que había acá (mismo nombre, distinta
// firma en el caso de normalizeTypeToApi) porque rompían `export *` en
// utils/index.ts ("Module has already exported a member named ...").

/** Convierte espacios a guiones y pasa a minúsculas, para armar queries a PokéAPI (ej. "Mega Charizard" → "mega-charizard"). */
export const formatForAPI = (name: string): string => name.toLowerCase().replace(/\s+/g, "-");

/** Convierte guiones a espacios y capitaliza cada palabra, para mostrar nombres que vienen de PokéAPI (ej. "mega-charizard" → "Mega Charizard"). */
export const formatForDisplay = (name: string): string =>
  name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// ─── Formas regionales / alternas de PokéAPI ────────────────────────────────

/**
 * Mapeo general (no exclusivo de Pokémon Z) para cuando la contraparte
 * "estándar" de una especie no es su forma base de Kanto/nacional, sino una
 * variante regional/alterna específica (ej. Raichu → Raichu-Alola). Útil en
 * cualquier punto de la app que busque el slug oficial de PokéAPI a partir
 * de un nombre de especie: en vez de asumir siempre `nombre.toLowerCase()`,
 * se consulta este mapeo primero. Clave: nombre de especie en minúsculas tal
 * como aparece en el JSON de Pokémon Z. Valor: { slug, display } de la forma
 * de PokéAPI que se debe usar en su lugar.
 * Para agregar un nuevo caso (otra especie con forma regional/alterna),
 * simplemente se agrega una entrada más acá; no hace falta tocar nada más.
 */
export const REGIONAL_FORM_OVERRIDE: Record<string, { slug: string; display: string }> = {
  raichu: { slug: "raichu-alola", display: "Raichu Alola" },
};

/**
 * Dado el nombre "plano" de una especie (sin sufijos " Z"/"Mega"), devuelve
 * el slug de PokéAPI y el nombre a mostrar que corresponden a su forma
 * "estándar" relevante: la regional/alterna si está en REGIONAL_FORM_OVERRIDE,
 * o si no, la forma base normal (slug = nombre con guiones).
 */
export const getStandardForm = (speciesName: string): { slug: string; display: string } => {
  const key = speciesName.toLowerCase();
  if (REGIONAL_FORM_OVERRIDE[key]) return REGIONAL_FORM_OVERRIDE[key];
  const slug = speciesName.toLowerCase().replace(/\s+/g, "-");
  return { slug, display: formatForDisplay(slug) };
};

// ─── Proxy de rol basado en tipos ────────────────────────────────────────────
// Para candidatos sin stats, estima el rol más probable a partir de los tipos.
// Se usa para filtrar recomendaciones: descarta candidatos cuyo perfil de tipo
// sugiera un rol completamente opuesto al que el equipo necesita.
// No es un sustituto del cálculo real con stats; solo excluye los casos más obvios.
export const TYPE_ROLE_AFFINITY: Record<string, string[]> = {
  // Tipos ofensivos físicos
  fighting:  ["Fast Physical Attacker", "Aggressive Physical Tank", "Tough Physical Attacker", "All-Around Physical"],
  rock:      ["Fast Physical Attacker", "Aggressive Physical Tank", "Defensive Tank"],
  ground:    ["Fast Physical Attacker", "Aggressive Physical Tank", "Defensive Tank"],
  normal:    ["Fast Physical Attacker", "Tough Physical Attacker", "All-Around Physical"],
  dragon:    ["Fast Physical Attacker", "Fast Special Attacker", "Versatile Attacker"],
  // Tipos ofensivos especiales
  fire:      ["Fast Special Attacker", "Aggressive Special Tank", "All-Around Special"],
  electric:  ["Fast Special Attacker", "Fast Special Defender", "Tough Special Attacker"],
  ice:       ["Fast Special Attacker", "Aggressive Special Tank"],
  psychic:   ["Fast Special Attacker", "Aggressive Special Tank", "Special Tank"],
  water:     ["Fast Special Attacker", "All-Around Special", "Resilient Pivot"],
  grass:     ["Fast Special Attacker", "All-Around Special", "Special Tank"],
  // Tipos defensivos
  steel:     ["Defensive Tank", "Sturdy Wall", "Resilient Pivot"],
  fairy:     ["Special Tank", "Sturdy Wall", "Resilient Pivot"],
  ghost:     ["Special Tank", "Fast Defender", "Fast Special Defender"],
  dark:      ["Fast Physical Attacker", "Fast Defender", "Tough Physical Attacker"],
  poison:    ["Defensive Tank", "Special Tank", "Resilient Pivot"],
  bug:       ["Fast Physical Attacker", "Fast Defender"],
  flying:    ["Fast Physical Attacker", "Fast Defender", "Versatile Attacker"],
};

// Muro total (todos los walls): solo tipos genuinamente defensivos.
// Nota: verificado contra TeamBuilder.tsx real — está definido pero
// actualmente no se usa en ningún otro punto del archivo (posible código
// muerto ya en el original). Se migra tal cual, sin agregar uso nuevo.
export const FULL_WALL_TYPES = new Set(["steel", "fairy", "rock", "poison"]);

/**
 * Devuelve true si el candidato (por tipos) es plausiblemente compatible
 * con el rol requerido. Se usa para dar un bonus de puntuación, NO para filtrar.
 */
export const typeMatchesRole = (types: string[], roleLabelEn: string): boolean => {
  if (!roleLabelEn) return true;
  // Construir set de roles afines a los tipos del candidato
  const affinities = new Set<string>();
  types.forEach((ty) => {
    (TYPE_ROLE_AFFINITY[ty] ?? []).forEach((r) => affinities.add(r));
  });
  if (affinities.size === 0) return true; // sin afinidades: tipo nuevo, no excluir
  // Verificar si el rol requerido está en las afinidades
  return affinities.has(roleLabelEn);
};
