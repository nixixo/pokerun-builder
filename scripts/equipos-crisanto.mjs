// scripts/equipos-crisanto.mjs
//
// Equipos del Rival Crisanto, transcritos de "Guía Oficial de Pokémon Z.pdf"
// (páginas 37, 85, 146, 254 y 430).
//
// Mismo defecto que con Melia (ver equipos-melia.mjs): la extracción del .docx
// repitió el equipo del primer combate — dos Pokémon a Nv.18/19 — en cuatro de
// las cinco apariciones, incluida la del Postgame, donde debería estar a Nv.100.
// Solo la de la Fábrica de Pokéball se había revisado a mano.
//
// OJO con las notas del PDF: no son fiables para saber qué lleva el rival. En
// el primer combate los "Consejos de batalla" hablan de Cubone y Goomy, pero
// las tablas muestran Jigglypuff, Ralts y el inicial — Cubone y Goomy no están
// en el equipo. Las especies de acá salen de los SPRITES de cada tabla, que es
// el único dato que no se contradice, verificados renderizando las páginas.
//
// Crisanto lleva el inicial DÉBIL frente al nuestro — al revés que Melia, que
// lleva el fuerte. Por eso las condiciones están invertidas respecto de
// equipos-melia.mjs:
//
//   elegiste Chespin  (Planta) → Crisanto lleva la línea de Froakie  (Agua)
//   elegiste Fennekin (Fuego)  → Crisanto lleva la línea de Chespin  (Planta)
//   elegiste Froakie  (Agua)   → Crisanto lleva la línea de Fennekin (Fuego)

const SI_CHESPIN = "Si elegiste Chespin";
const SI_FENNEKIN = "Si elegiste Fennekin";
const SI_FROAKIE = "Si elegiste Froakie";

const NEUTRA = "NEUTRA";
const ATK_FISICA = "+ATK / -ATK.ESP";
const ATK_ESPECIAL = "-ATK / +ATK.ESP";

const mon = (especie, nivel, objeto, habilidad, naturaleza, movimientos, condicion) => ({
  especie,
  nivel: String(nivel),
  objeto,
  habilidad,
  naturaleza,
  movimientos,
  ...(condicion ? { condicion } : {}),
});

export const EQUIPOS_CRISANTO = [
  {
    zona: "PUEBLO COLLAGE",
    pagina: 37,
    curativos: "Tiene disponible una Superpoción como objeto curativo.",
    equipo: [
      mon("Jigglypuff", 18, "NINGUNO", "TENACIDAD", NEUTRA,
        ["CANTO", "ANTOJO", "GOLPE CUERPO", "GOLPE ROCA"]),
      // El JSON traía "Cubone" acá, copiado del texto de consejos. El sprite de
      // la tabla es Ralts, y RASTRO es su habilidad: Cubone no tiene ninguno de
      // los cuatro movimientos. Encaja además con la línea que Crisanto
      // arrastra el resto del juego: Ralts -> Kirlia -> Gallade.
      mon("Ralts", 19, "BAYA KEBIA", "RASTRO", NEUTRA,
        ["PSICORRAYO", "VIENTO HIELO", "BESO DRENAJE", "RAYO CONFUSO"]),
      mon("Quilladin", 20, "BAYA ARANJA", "ESPESURA", NEUTRA,
        ["LÁTIGO CEPA", "MORDISCO", "DISPARO LODO", "DRENADORAS"], SI_FENNEKIN),
      mon("Braixen", 20, "BAYA ARANJA", "MAR LLAMAS", NEUTRA,
        ["ASCUAS", "IMPACTRUENO", "MOFLETE ESTÁTICO", "GOLPE ROCA"], SI_FROAKIE),
      mon("Frogadier", 20, "BAYA ARANJA", "TORRENTE", NEUTRA,
        ["BURBUJA", "CONFUSIÓN", "GOLPE AÉREO", "LADRÓN"], SI_CHESPIN),
    ],
  },
  {
    zona: "Ruta 8 Parte 3",
    pagina: 85,
    curativos: "Tiene disponible dos Hiperpociones como objetos curativos.",
    equipo: [
      mon("Wigglytuff", 35, "NINGUNO", "TENACIDAD", NEUTRA,
        ["VOZARRÓN", "BESO DRENAJE", "VIENTO HIELO", "CANTO"]),
      mon("Kirlia", 34, "MINERAL EVOLUTIVO", "CALCO", NEUTRA,
        ["PARANORMAL", "BESO DRENAJE", "RAYO CARGA", "BOLA SOMBRA"]),
      mon("Gogoat", 34, "BAYA ATANIA", "HERBÍVORO", NEUTRA,
        ["ASTA DRENAJE", "TERRATEMBLOR", "AVALANCHA", "DESCANSO"]),
      mon("Quilladin", 36, "BAYA ZIDRA", "ESPESURA", ATK_FISICA,
        ["HOJA AFILADA", "TRITURAR", "TERRATEMBLOR", "DRENADORAS"], SI_FENNEKIN),
      mon("Braixen", 36, "BAYA ZIDRA", "MAR LLAMAS", ATK_FISICA,
        ["COLMILLO ÍGNEO", "COLMILLO RAYO", "MOFLETE ESTÁTICO", "DEMOLICIÓN"], SI_FROAKIE),
      mon("Frogadier", 36, "BAYA ZIDRA", "TORRENTE", ATK_ESPECIAL,
        ["HIDROPULSO", "PSICORRAYO", "PUÑO HIELO", "PULSO UMBRÍO"], SI_CHESPIN),
    ],
  },
  {
    zona: "Ruta 12",
    pagina: 146,
    curativos: "Tiene disponible dos Hiperpociones como objetos curativos.",
    equipo: [
      mon("Wigglytuff", 46, "VIDASFERA", "TENACIDAD", ATK_ESPECIAL,
        ["VOZARRÓN", "BESO DRENAJE", "PSICOCARGA", "PAZ MENTAL"]),
      mon("Gallade", 47, "LUPA", "IMPASIBLE", NEUTRA,
        ["PSICOCORTE", "DEMOLICIÓN", "TAJO UMBRÍO", "HIPNOSIS"]),
      mon("Gogoat", 47, "CINTA EXPERTO", "HERBÍVORO", NEUTRA,
        ["ASTA DRENAJE", "TERRATEMBLOR", "AVALANCHA", "CABEZAZO ZEN"]),
      mon("Chesnaught", 48, "BAYA ZIDRA", "ESPESURA", ATK_FISICA,
        ["BRAZO PINCHO", "TRITURAR", "EXCAVAR", "DRENADORAS"], SI_FENNEKIN),
      mon("Delphox", 48, "BAYA ZIDRA", "MAR LLAMAS", ATK_FISICA,
        ["PUÑO FUEGO", "PUÑO TRUENO", "MOFLETE ESTÁTICO", "DEMOLICIÓN"], SI_FROAKIE),
      mon("Greninja", 48, "BAYA ZIDRA", "TORRENTE", ATK_ESPECIAL,
        ["AGUA LODOSA", "PSICOCARGA", "VIENTO HIELO", "PULSO UMBRÍO"], SI_CHESPIN),
    ],
  },
  {
    zona: "FÁBRICA DE POKÉBALL (INTERIOR)",
    pagina: 254,
    curativos: "Tiene disponible dos Restaurar Todo como objetos curativos.",
    equipo: [
      // Con la Galladita combate como Mega Gallade.
      mon("Gallade", 70, "GALLADITA", "ACOMETIDA", ATK_FISICA,
        ["PSICOCORTE", "HOJA AGUDA", "ESPADA SANTA", "DANZA ESPADA"]),
      mon("Wigglytuff", 70, "VIDASFERA", "TENACIDAD", ATK_ESPECIAL,
        ["VOZARRÓN", "FUERZA LUNAR", "PSICOCARGA", "MAQUINACIÓN"]),
      mon("Gogoat", 70, "CINTURÓN EXPERTO", "PIEL HERBÁCEA", NEUTRA,
        ["DOBLE FILO", "AVALANCHA", "TERREMOTO", "CABEZAZO ZEN"]),
      mon("Goodra", 70, "CHALECO ASALTO", "HERBÍVORO", ATK_ESPECIAL,
        ["PULSO DRAGÓN", "AGUA LODOSA", "FOCO RESPLANDOR", "RAYO HIELO"]),
      mon("Chesnaught", 71, "BAYA ZIDRA", "ESPESURA", ATK_FISICA,
        ["DISPARO ESPINA", "TRITURAR", "TALADRADORA", "CORPULENCIA"], SI_FENNEKIN),
      mon("Delphox", 71, "BAYA ZIDRA", "MAR LLAMAS", ATK_FISICA,
        ["SABLE ARDIENTE", "ELECTROPUNZADA", "DANZA ESPADA", "ESPADA SANTA"], SI_FROAKIE),
      mon("Greninja", 71, "BAYA ZIDRA", "TORRENTE", ATK_ESPECIAL,
        ["HIDROBOMBA", "TRUCO HUEVO", "RAYO HIELO", "PAZ MENTAL"], SI_CHESPIN),
    ],
  },
  {
    zona: "Postgame",
    pagina: 430,
    curativos: "Tiene disponible dos Restaurar Todo como objetos curativos.",
    equipo: [
      mon("Gallade", 98, "BAYA ZIDRA", "CORTANTE", ATK_FISICA,
        ["PSICOCORTE", "HOJA AGUDA", "ESPADA SANTA", "DANZA ESPADA"]),
      mon("Wigglytuff", 100, "VIDASFERA", "TENACIDAD", ATK_ESPECIAL,
        ["VOZARRÓN", "FUERZA LUNAR", "PSICOCARGA", "MAQUINACIÓN"]),
      mon("Gogoat", 99, "CINTURÓN EXPERTO", "PIEL HERBÁCEA", ATK_FISICA,
        ["DOBLE FILO", "AVALANCHA", "TERREMOTO", "CABEZAZO ZEN"]),
      // El Marowak común, no el de Alola: el sprite lleva el casco de acero y
      // la espada, coherente con que en este romhack Marowak es Tierra/Acero
      // (de ahí el STAB de Ferroespada). Es la evolución del Cubone que la guía
      // le atribuye a Crisanto.
      mon("Marowak", 98, "HUESO GRUESO", "POTENCIA BRUTA", ATK_FISICA,
        ["FERROESPADA", "HUESO SOMBRÍO", "ENVITE ÍGNEO", "TERREMOTO"]),
      mon("Goodra", 99, "CHALECO ASALTO", "HERBÍVORO", ATK_ESPECIAL,
        ["PULSO DRAGÓN", "AGUA LODOSA", "FOCO RESPLANDOR", "RAYO HIELO"]),
      mon("Mega Chesnaught Z", 100, "CHESNAUGHTITA Z", "ARMADURA BATALLA", ATK_FISICA,
        ["DISPARO ESPINA", "TRITURAR", "TALADRADORA", "CORPULENCIA"], SI_FENNEKIN),
      mon("Mega Delphox Z", 100, "DELPHOXITA Z", "RELAMPAGUEO", ATK_FISICA,
        ["SABLE ARDIENTE", "ELECTROPUNZADA", "DANZA ESPADA", "ESPADA SANTA"], SI_FROAKIE),
      mon("Mega Greninja Z", 100, "GRENINJITA Z", "TOQUE MÁGICO", ATK_ESPECIAL,
        ["HIDROBOMBA", "TRUCO HUEVO", "RAYO HIELO", "PAZ MENTAL"], SI_CHESPIN),
    ],
  },
];
