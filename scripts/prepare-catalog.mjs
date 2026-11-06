const LEARNSET_FIELDS = ["moves", "tmMoves", "eggMoves", "tutorMoves"];
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const validId = (value) => Number.isSafeInteger(value) && value > 0;

export function prepareCatalog(gameId, { pokemon, moves, abilities, items }) {
  const fail = (message) => { throw new Error(`Catálogo ${gameId}: ${message}`); };
  if (!Array.isArray(pokemon) || !pokemon.length) fail("pokemon debe contener especies.");
  if (!Array.isArray(moves) || !moves.length) fail("moves debe contener movimientos.");
  if (!isRecord(abilities)) fail("abilities debe ser un objeto.");
  if (!Array.isArray(items)) fail("items debe ser una lista.");

  const legacyZ = gameId === "pokemon-z";
  const warnings = new Set();
  const moveNames = new Set();
  for (const move of moves) {
    if (!isRecord(move) || !hasText(move.internal_name) ||
        !(hasText(move.name) || hasText(move.name?.es))) fail("movimiento sin identificador o nombre.");
    if (moveNames.has(move.internal_name)) {
      if (legacyZ && move.internal_name === "SECRETSWORD") {
        warnings.add("SECRETSWORD duplicado; el Builder usa la primera entrada.");
      } else {
        fail(`movimiento duplicado ${move.internal_name}.`);
      }
    }
    moveNames.add(move.internal_name);
  }

  const itemIds = new Set();
  for (const item of items) {
    if (!isRecord(item) || !validId(item.id) || !hasText(item.name)) fail("objeto sin ID válido o nombre.");
    if (itemIds.has(item.id)) fail(`objeto con ID duplicado ${item.id}.`);
    itemIds.add(item.id);
  }

  const speciesIds = new Set();
  const core = [];
  const learnsets = {};
  for (const entry of pokemon) {
    if (!isRecord(entry) || !validId(entry.id) || !hasText(entry.name) || !hasText(entry.internalName)) {
      fail("especie sin ID válido, nombre o identificador interno.");
    }
    if (speciesIds.has(entry.id)) fail(`especie con ID duplicado ${entry.id} (${entry.name}).`);
    speciesIds.add(entry.id);
    if (!Array.isArray(entry.types) || !entry.types.length || !entry.types.every(hasText)) {
      fail(`${entry.name} no tiene tipos válidos.`);
    }
    if (entry.abilities !== undefined && (!Array.isArray(entry.abilities) || !entry.abilities.every(hasText))) {
      fail(`${entry.name} tiene una lista de habilidades inválida.`);
    }
    for (const ability of [...(entry.abilities ?? []), entry.hiddenAbility].filter(Boolean)) {
      if (!Object.hasOwn(abilities, ability)) fail(`${entry.name} apunta a la habilidad inexistente ${ability}.`);
    }

    const coreEntry = { ...entry };
    const learnset = {};
    for (const key of LEARNSET_FIELDS) {
      if (!(key in entry)) continue;
      const entries = entry[key];
      if (!Array.isArray(entries)) fail(`${entry.name} tiene ${key} inválido.`);
      for (const value of entries) {
        const move = key === "moves" ? value?.move : value;
        if (!hasText(move)) fail(`${entry.name} tiene un movimiento inválido en ${key}.`);
        if (!moveNames.has(move)) {
          if (legacyZ && move === "HYPERSPACEFURY") {
            warnings.add("HYPERSPACEFURY está en los learnsets pero falta en el catálogo de movimientos.");
          } else {
            fail(`${entry.name} apunta al movimiento inexistente ${move} en ${key}.`);
          }
        }
      }
      learnset[key] = entries;
      delete coreEntry[key];
    }
    core.push(coreEntry);
    if (Object.keys(learnset).length) learnsets[entry.id] = learnset;
  }
  return { core, learnsets, warnings };
}
