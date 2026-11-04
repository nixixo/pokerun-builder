// components/guia/collectionTotals.ts
//
// Totales de cada colección del juego. Vivían duplicados en app/guia/page.tsx y
// en guiaHeader.tsx, con el riesgo de que se fueran separando.
//
// `paginas` son 47, según el apéndice "LISTADO DE UBICACIÓN DE RECETAS" de la
// guía: 43 zonas, cuatro de ellas con dos páginas (Taller Quemado, Luminalia
// Norte, Ruta 15 y Ruta 23).
//
// Ni 48 ni 50. Los objetos crafteables son 50, pero cada uno lleva anotado
// cuántas recetas exige: tres piden 0 (están disponibles sin ninguna página) y
// el último, el Embrión M, pide 47. De ahí que circule por ahí un "48 slots
// (0 → 47)": es haber leído esos tres ceros como slots vacíos.
//
// Comprobación cruzada: la Llave Mercúrica pide 9 recetas y la guía da por
// hecho que ya la tienes al ir a por la Montura Gogoat; contando las páginas de
// las zonas anteriores a ese punto salen exactamente 9.
export const COLLECTION_TOTALS = {
  paginas: 47,
  mts: 108,
  nidos: 18,
  habitantes: 18,
} as const;
