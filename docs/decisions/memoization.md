# Memoización parcial — DECISIÓN: no continuar (2026-07-31)

> **Se probó la app y escribir en los buscadores no se demora nada.**
> Completar esta memoización solo mejoraría la fluidez al tipear, así que no
> aporta nada medible. **No es una tarea pendiente.**
>
> El resto del documento queda como referencia, por si en el futuro el equipo
> crece o la lista de candidatos se vuelve más pesada y sí empieza a notarse.

## Estado al momento de la decisión

La infraestructura está puesta y funcionando (build y `tsc` limpios): los dos
contextos existen, los 4 paneles están envueltos en `memo` y varios callbacks
ya están estabilizados. Nada de esto molesta ni tiene costo.

Lo que falta es que algunos callbacks que llegan a los paneles —directamente o
vía `SlotSearchContext`— se recrean en cada render, así que `memo` casi nunca
acierta. En la práctica el comportamiento es el mismo que antes del refactor,
que es exactamente el que ya funciona bien.

## Qué falta estabilizar

Todos en [`components/team-builder/TeamBuilder.tsx`](components/team-builder/TeamBuilder.tsx).
Conviene ir de abajo hacia arriba en la cadena, porque unos dependen de otros:

### Nivel 1 — triviales, solo usan setters funcionales (deps `[]`)

| Callback | Línea |
|---|---|
| `updateSlot` | ~738 |
| `updateMove` | ~1005 |
| `setSlotManualRole` | ~1076 |

Los tres son `setTeam((t) => ...)` puro. `useCallback(fn, [])` y listo.

### Nivel 2 — dependen del nivel 1 y/o de datos

| Callback | Línea | Depende de |
|---|---|---|
| `fetchPokemon` | ~1182 | revisar: `pokemonList`, `pokemonZData`, `activePokedex`, `updateSlot` |
| `fetchMove` | ~1330 | revisar: `moveList`, `movesZData`, `updateMove`, `lang` |
| `getMoveLearnBadge` | ~987 | `team`, learn methods |

### Nivel 3 — dependen del nivel 2

| Callback | Línea | Depende de |
|---|---|---|
| `selectPokemonSuggestion` | ~1110 | `fetchPokemon` |
| `selectMoveSuggestion` | ~393 | `fetchMove` |

Estos dos son los que entran en las deps de `slotSearchValue`
(TeamBuilder.tsx ~2308), así que hasta que estén estables el contexto de
búsqueda se invalida en cada render.

## Ya está hecho (no tocar)

`tn`, `getAbilityDisplayName`, `toggleRecFilterSortStat`, `showToast`,
`addCandidateToTeam`, `getStdAbilityLabel`, `getStdAbilityDescription`.

También: `STAT_LABELS`, `STAT_ORDER`, `getStatColor` y `badgeClass` viven a
nivel de módulo justamente para ser estables, y el retorno de
`useRecommendations` / `useAbilityFilter` ya está envuelto en `useMemo`.

## Cómo verificar que sirvió

No hay tests. La forma práctica:

1. React DevTools → Profiler → activar **"Highlight updates when components render"**.
2. Escribir en el buscador de nombre de un slot.
3. **Objetivo**: que solo parpadeen `TeamGrid` y `TeamBuilder`.
   Hoy parpadean además `RecommendationsPanel`, `TeamAnalysisPanel`,
   `AdvancedDashboardRow` y `WhoToReplacePanel`.

## Cuidado con esto

- `useCallback` con deps mal puestas **introduce bugs de stale closure**, y acá
  no hay tests que los atajen. Ante la duda, poner la dependencia de más:
  un memo que falla de vez en cuando es mucho mejor que un callback que lee
  estado viejo.
- `npx eslint .` marca `react-hooks/exhaustive-deps` — vale la pena mirarlo
  después de cada `useCallback` que agregues, aunque el archivo ya arrastra
  warnings previos (~121 errores preexistentes, mayormente `any`).

## Pendiente aparte (no bloquea lo de arriba)

Aplicar `BuilderChromeContext` a los paneles que todavía reciben
`lang`/`t`/`tn`/`badgeClass` por props: `TeamAnalysisPanel`,
`AdvancedDashboardRow`, `WhoToReplacePanel`, `RecommendationsPanel` y
`BuilderHeader`. TeamGrid ya lo consume (pasó de 58 a 28 props) y sirve de
modelo.
