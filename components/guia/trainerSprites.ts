// components/guia/trainerSprites.ts
//
// Sprite de entrenador para los combates IMPORTANTES. Salen del mismo sitio que
// los de Pokémon y objetos (fakedex), en /sprites/Characters/trainerNNN.png.
//
// El mapa es a mano y no automático porque el nombre no basta: un mismo
// personaje tiene un sprite distinto por combate (Melia tiene quince, Crisanto
// catorce), y el JSON de la guía los llama a todos igual. Emparejar por nombre
// pondría siempre el primero y saldría el atuendo equivocado en casi todos.
//
// La clave es `nombre del entrenador` tal cual está en el JSON, y cuando ese
// nombre se repite en varias zonas se afina con `zona:nombre`. Lo que no está
// en el mapa no enseña sprite — es preferible a enseñar uno que no toca.

import { FAKEDEX_SPRITES_BASE } from "@/components/shared/spriteUrls";

const BASE = `${FAKEDEX_SPRITES_BASE}/Characters`;

/**
 * Los doce regentes tienen dos versiones: la del bastión y la de la revancha de
 * la Misión del Campanero, con el atuendo cambiado. Van seguidas en el
 * catálogo (021→163, 029→164, …), lo que confirma que son pares.
 */
const SPRITES: Record<string, string> = {
  // --- Regentes: bastión ---
  "Regente Canola": "trainer021",
  "Regente Hisopo": "trainer029",
  "Regente F3": "trainer042",
  "Regente Zafra": "trainer052",
  "Regente Loto": "trainer063",
  "Regente Belladona": "trainer072",
  "Regente Hibis": "trainer104",
  "Regente Anturia": "trainer111",
  "Regente Rúpico": "trainer119",
  "Regente Cendera": "trainer126",
  "Regente Siempreviva": "trainer139",
  "Regente Arrayan": "trainer156",

  // --- Regentes: revancha del Campanero ---
  "Regente Canola (Revancha)": "trainer163",
  "Regente Hisopo (Revancha)": "trainer164",
  "Regente F3 (Revancha)": "trainer165",
  "Regente Zafra (Revancha)": "trainer166",
  "Regente Loto (Revancha)": "trainer167",
  "Regente Belladona (Revancha)": "trainer168",
  "Regente Hibis (Revancha)": "trainer169",
  "Regente Anturia (Revancha)": "trainer170",
  "Regente Rúpico (Revancha)": "trainer171",
  "Regente Cendera (Revancha)": "trainer172",
  "Regente Siempreviva (Revancha)": "trainer173",
  "Regente Arrayan (Revancha)": "trainer174",
  "Campanero Rosmarino": "trainer182",

  // --- Historia principal ---
  "Capitán Merlot": "trainer036",
  "Rey de los Acertijos": "trainer058",
  "Alquimista Azoth Genos": "trainer066",
  "Malhechor Plumanegra": "trainer075",
  "Entrenadora Prodigiosa Cintia": "trainer091",
  "Prisionero Loco Ferrofaz": "trainer092",
  "Alcaide Pinot": "trainer094",
  "Hombre del Saco": "trainer103",
  "Fantasma de Montesanto": "trainer120",
  "Papa Loto": "trainer121",
  "Antiguo Rey Errante AZ": "trainer116",
  "Guardián de la Forja": "trainer127",
  "Jefe Flare Lysson": "trainer158",
  "Payaso Mecánico Anticuado": "trainer138",

  // --- Alto Mando I (Cámaras de Reflexión) ---
  "Alto Caballero Tileo": "trainer083",
  "Alta Dama Drácena": "trainer084",
  "Alto Caballero Narciso": "trainer085",
  "Alta Dama Malva": "trainer086",
  "Rey Áster Zephir": "trainer087",
  "Reyes Áster y Angeline": "trainer088",
  "Entrenadora Angeline": "trainer144", // el Juicio de Yveltal, en Pesadilla de Circo

  // --- Alto Mando II (El Arma Definitiva) ---
  "Alto Mando Tornasola": "trainer188",
  "Alto Mando Aure": "trainer189",
  "Alto Mando Prímula": "trainer190",
  "Alto Mando Malvo": "trainer191",
  "Malvo del linaje Rojo": "trainer192",
  "Alca: El Arma Definitiva": "trainer194",

  // --- Rescatados de `objetos` ---
  "Antiguas Reinas Prímula y Tornasola": "trainer132",
  "Revolucionarios Marcel y Marcela": "trainer062",
  "Reclutas Azoth Curt y Debra": "trainer015",
  "Reclutas Azoth Amicia y Hugo": "trainer015",
  "Brujita Xenia": "trainer034",
  "Cazador Wulfric": "trainer035",
  "Vampiro Azoth Edward": "trainer046",
  "Recluta Azoth Micolash": "trainer013",
  "Mosquetero/a Spartoi": "trainer020",

  // --- Rivales: Crisanto y Melia ---
  // Cambian de atuendo a lo largo del juego. La guía numera sus combates del 1
  // al 5 ("Combate n° 3 contra rival Crisanto"): el atuendo de los cuatro
  // primeros es el mismo (crisanto2 / melia2) y el quinto ya es el definitivo.
  // OJO: el quinto NO es el último — después hay una revancha en el Postgame
  // que la guía no numera, y que lógicamente lleva también el atuendo final.
  "Rival Crisanto:": "trainer024",
  "Rival Crisanto": "trainer024",
  "Rival Melia:": "trainer026",
  "Rival Melia": "trainer026",
  "FÁBRICA DE POKÉBALL (INTERIOR):Rival Crisanto": "trainer107", // combate n° 5
  "Postgame:Rival Crisanto:": "trainer107",
  "Ruta 18 Parte 2:Rival Melia:": "trainer117", // combate n° 5
  "Postgame:Rival Melia:": "trainer117",

  // --- Repetidos con dos atuendos ---
  "BOSQUE LADERA PARTE 2:Alquimista Azoth Núbila": "trainer023",
  "CHATEAU LANTO:Alquimista Azoth Núbila": "trainer047",
  "CIUDAD NOVARTE (2º VISITA):Alquimista Azoth Wolfram": "trainer041",
  "HOSPICIO CADUCO:Alquimista Azoth Wolfram": "trainer067",
  "CHATEAU LANTO:Monsieur Lanto": "trainer048",
  "PALACIO LUMINALIA (MAZMORRA FINAL PARTE 1):Monsieur Lanto": "trainer082",

  // En la cima de la Torre Prisma se pelea dos veces seguidas contra ella: como
  // Clériga y, tras fundirse con Aure, como Heraldo del Oro (otro atuendo).
  "Clérigo Mirra": "trainer147",
  "Mirra Heraldo del Oro": "trainer148",
  "Profesora Olivier": "trainer123",

  // --- Alca ---
  // Se la pelea "caduca" en Kalos Este y vuelve a su aspecto normal después.
  // La fase final doble es la que saca a los cuatro legendarios.
  "BATALLA DE KALOS ESTE:Entrenadora Alca Caduca": "trainer131",
  "El Arma Definitiva:Entrenadora Alca": "trainer061",
};

/**
 * Los combates contra un Pokémon suelto (Furfrou, Blastoise Gigamax, los tres
 * legendarios…) no tienen sprite de entrenador porque no hay entrenador. El
 * banner ya los presenta con la calavera de "Jefe".
 */
export function getTrainerSpriteUrl(nombre: string, zona?: string): string | null {
  const porZona = zona ? SPRITES[`${zona}:${nombre}`] : undefined;
  const archivo = porZona ?? SPRITES[nombre];
  return archivo ? `${BASE}/${archivo}.png` : null;
}
