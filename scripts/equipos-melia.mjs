// scripts/equipos-melia.mjs
//
// Equipos de la Rival Melia, transcritos de "Guía Oficial de Pokémon Z.pdf"
// (páginas 42, 112, 174, 277 y 432).
//
// Por qué existe este archivo: la extracción del .docx tomó el equipo del
// PRIMER combate — dos Pokémon a Nv.21 — y lo repitió en las cinco
// apariciones, además de perder la columna de especie (ver el alias "Veneno"
// en clean-guia-names.mjs). En realidad el equipo de Melia crece de 3 a 6
// miembros y de Nv.21 a Nv.100.
//
// Las tablas del PDF no traen el nombre de la especie: viene en el texto de
// consejos o hay que deducirlo de la habilidad. Cada nombre de acá está
// confirmado por al menos una de esas dos vías:
//   Munna / Musharna  → citados en los consejos de cada combate
//   Lucario           → "Mega Lucario solo tiene ataques de su tipo" (pág. 277)
//   Golurk            → única especie con PUÑO FÉRREO que aprende los cuatro
//                       movimientos (Puño Sombra, Terremoto, Machada, Puño Hielo)
//   Eevee y evoluciones, iniciales → nombrados en el propio PDF
//
// Dos ranuras dependen del inicial que eligió el jugador, porque Melia siempre
// lleva el que es fuerte contra el nuestro. El PDF lo enuncia al revés ("tendrá
// a Vaporeon si tiene a Delphox"), así que acá se traduce a la elección del
// jugador, que es lo que se puede mostrar en pantalla:
//
//   elegiste Chespin  (Planta) → Melia lleva la línea de Fennekin + Vaporeon
//   elegiste Fennekin (Fuego)  → Melia lleva la línea de Froakie  + Jolteon
//   elegiste Froakie  (Agua)   → Melia lleva la línea de Chespin  + Flareon

const SI_CHESPIN = "Si elegiste Chespin";
const SI_FENNEKIN = "Si elegiste Fennekin";
const SI_FROAKIE = "Si elegiste Froakie";

const NEUTRA = "NEUTRA";
const ATK_FISICA = "+ATK / -ATK.ESP";
const ATK_ESPECIAL = "-ATK / +ATK.ESP";

/** Atajo para no repetir la forma del objeto en 40 entradas. */
const mon = (especie, nivel, objeto, habilidad, naturaleza, movimientos, condicion) => ({
  especie,
  nivel: String(nivel),
  objeto,
  habilidad,
  naturaleza,
  movimientos,
  ...(condicion ? { condicion } : {}),
});

// Sets del inicial de Melia, que se repiten entre combates.
const QUILLADIN_42 = ["HOJA AFILADA", "TRITURAR", "EXCAVAR", "DRENADORAS"];
const BRAIXEN_42 = ["COLMILLO ÍGNEO", "PUÑO TRUENO", "CABEZAZO ZEN", "AFILAGARRAS"];
const FROGADIER_42 = ["HIDROPULSO", "PSICOCARGA", "PULSO UMBRÍO", "PAZ MENTAL"];
const CHESNAUGHT = ["BRAZO PINCHO", "TRITURAR", "EXCAVAR", "DRENADORAS"];
const DELPHOX = ["PUÑO FUEGO", "PUÑO TRUENO", "CABEZAZO ZEN", "AFILAGARRAS"];
const GRENINJA = ["AGUA LODOSA", "PSICOCARGA", "PULSO UMBRÍO", "PAZ MENTAL"];

// Evoluciones de Eevee, idénticas salvo el nivel.
const eeveelutions = (nivel, habFuego = "AGALLAS") => [
  mon("Vaporeon", nivel, "AGUA MÍSTICA", "ABSORBER AGUA", ATK_ESPECIAL,
    ["HIDROBOMBA", "RAYO AURORA", "ARMADURA ÁCIDA", "BOLA SOMBRA"], SI_CHESPIN),
  mon("Jolteon", nivel, "IMÁN", "ABSORBER ELEC.", ATK_ESPECIAL,
    ["RAYO", "VOLTIO CAMBIO", "RAYO SEÑAL", "BOLA SOMBRA"], SI_FENNEKIN),
  mon("Flareon", nivel, "CARBÓN", habFuego, ATK_FISICA,
    ["PATADA ÍGNEA", "COLA FÉRREA", "FUERZA", "FUEGO FATUO"], SI_FROAKIE),
];

export const EQUIPOS_MELIA = [
  {
    zona: "SANTUARIO DE LOS REYES",
    pagina: 42,
    curativos: "Tiene disponible una Superpoción como objeto curativo.",
    equipo: [
      mon("Floette", 21, "NINGUNO", "FLORACIÓN", NEUTRA,
        ["BESO DRENAJE", "HOJA MÁGICA", "AGUA FRÍA", "ENCANTO"]),
      mon("Munna", 21, "NINGUNO", "SINCRONÍA", NEUTRA,
        ["CONFUSIÓN", "ONDA VOLTIO", "HIPNOSIS", "LUZ LUNAR"]),
      mon("Quilladin", 22, "BAYA ARANJA", "ESPESURA", NEUTRA,
        ["LÁTIGO CEPA", "MORDISCO", "DISPARO LODO", "DRENADORAS"], SI_FROAKIE),
      mon("Braixen", 22, "BAYA ARANJA", "MAR LLAMAS", NEUTRA,
        ["ASCUAS", "IMPACTRUENO", "MOFLETE ESTÁTICO", "GOLPE ROCA"], SI_CHESPIN),
      mon("Frogadier", 22, "BAYA ARANJA", "TORRENTE", NEUTRA,
        ["BURBUJA", "CONFUSIÓN", "GOLPE AÉREO", "LADRÓN"], SI_FENNEKIN),
    ],
  },
  {
    zona: "Ruta 9 Parte 2",
    pagina: 112,
    curativos: "Tiene disponible dos Hiperpociones como objeto curativo.",
    equipo: [
      mon("Floette", 40, "MINERAL EVOLUTIVO", "FLORACIÓN", NEUTRA,
        ["BRILLO MÁGICO", "GIGADRENADO", "AGUA FRÍA", "ENCANTO"]),
      mon("Musharna", 40, "CASCO DENTADO", "SINCRONÍA / ALERTA", NEUTRA,
        ["PSICOCARGA", "ENERGIBOLA", "RAYO SEÑAL", "LUZ LUNAR"]),
      mon("Eevee", 40, "PAÑUELO SEDA", "ADAPTABLE", ATK_FISICA,
        ["DERRIBO", "ENCANTO", "MORDISCO", "BOLA SOMBRA"]),
      mon("Quilladin", 42, "BAYA ZIDRA", "ESPESURA", ATK_FISICA, QUILLADIN_42, SI_FROAKIE),
      mon("Braixen", 42, "BAYA ZIDRA", "MAR LLAMAS", ATK_FISICA, BRAIXEN_42, SI_CHESPIN),
      mon("Frogadier", 42, "BAYA ZIDRA", "TORRENTE", ATK_ESPECIAL, FROGADIER_42, SI_FENNEKIN),
    ],
  },
  {
    zona: "CIUDAD LUMINALIA NORTE",
    pagina: 174,
    curativos: "Tiene disponible dos Hiperpociones como objeto curativo.",
    equipo: [
      mon("Floette", 54, "NINGUNO", "FLORACIÓN", NEUTRA,
        ["FUERZA LUNAR", "GIGADRENADO", "PSÍQUICO", "ENCANTO"]),
      mon("Musharna", 54, "CASCO DENTADO", "SINCRONÍA / ALERTA", NEUTRA,
        ["PSICOCARGA", "PAZ MENTAL", "RAYO SEÑAL", "LUZ LUNAR"]),
      ...eeveelutions(54),
      mon("Chesnaught", 55, "BAYA ZIDRA", "ESPESURA", ATK_FISICA, CHESNAUGHT, SI_FROAKIE),
      mon("Delphox", 55, "BAYA ZIDRA", "MAR LLAMAS", ATK_FISICA, DELPHOX, SI_CHESPIN),
      mon("Greninja", 55, "BAYA ZIDRA", "TORRENTE", ATK_ESPECIAL, GRENINJA, SI_FENNEKIN),
    ],
  },
  {
    zona: "Ruta 18 Parte 2",
    pagina: 277,
    curativos: "Tiene disponible dos Restaurar Todo como objetos curativos.",
    equipo: [
      // Con la Floettita pasa a Mega Floette: cambia la habilidad a Realeza.
      mon("Floette", 73, "FLOETTITA", "REALEZA", ATK_ESPECIAL,
        ["FUERZA LUNAR", "GIGADRENADO", "PSÍQUICO", "ENCANTO"]),
      mon("Musharna", 73, "CASCO DENTADO", "SINCRONÍA", NEUTRA,
        ["PSICOCARGA", "PAZ MENTAL", "RAYO SEÑAL", "LUZ LUNAR"]),
      mon("Lucario", 73, "BANDA FOCUS", "ADAPTABLE", NEUTRA,
        ["ESFERA AURAL", "FOCO RESPLANDOR", "ONDA VACÍO", "PAZ MENTAL"]),
      ...eeveelutions(73, "ABSORBER FUEGO"),
      mon("Chesnaught", 75, "BAYA ZIDRA", "ESPESURA", ATK_FISICA, CHESNAUGHT, SI_FROAKIE),
      mon("Delphox", 75, "BAYA ZIDRA", "MAR LLAMAS", ATK_FISICA, DELPHOX, SI_CHESPIN),
      mon("Greninja", 75, "BAYA ZIDRA", "TORRENTE", ATK_ESPECIAL, GRENINJA, SI_FENNEKIN),
    ],
  },
  {
    zona: "Postgame",
    pagina: 432,
    curativos: "Tiene disponible dos Restaurar Todo como objetos curativos.",
    equipo: [
      mon("Floette", 100, "VIDASFERA", "FLORACIÓN", ATK_ESPECIAL,
        ["FUERZA LUNAR", "GIGADRENADO", "PSÍQUICO", "ENCANTO"]),
      mon("Musharna", 98, "CASCO DENTADO", "SINCRONÍA", ATK_ESPECIAL,
        ["PSICOCARGA", "PAZ MENTAL", "RAYO SEÑAL", "LUZ LUNAR"]),
      mon("Lucario", 99, "BANDA FOCUS", "ADAPTABLE", ATK_ESPECIAL,
        ["ESFERA AURAL", "FOCO RESPLANDOR", "ONDA VACÍO", "PAZ MENTAL"]),
      mon("Golurk", 98, "VIDASFERA", "PUÑO FÉRREO", ATK_FISICA,
        ["PUÑO SOMBRA", "TERREMOTO", "MACHADA", "PUÑO HIELO"]),
      ...eeveelutions(99, "ABSORBER FUEGO"),
      // En el combate final el inicial ya lleva su megapiedra Z.
      mon("Mega Chesnaught Z", 100, "CHESNAUGHTITA Z", "ARMADURA BATALLA", ATK_FISICA,
        ["DISPARO ESPINA", "TRITURAR", "TALADRADORA", "CORPULENCIA"], SI_FROAKIE),
      mon("Mega Delphox Z", 100, "DELPHOXITA Z", "RELAMPAGUEO", ATK_FISICA,
        ["SABLE ARDIENTE", "ELECTROPUNZADA", "DANZA ESPADA", "ESPADA SANTA"], SI_CHESPIN),
      mon("Mega Greninja Z", 100, "GRENINJITA Z", "TOQUE MÁGICO", ATK_ESPECIAL,
        ["HIDROBOMBA", "TRUCO HUEVO", "RAYO HIELO", "PAZ MENTAL"], SI_FENNEKIN),
    ],
  },
];
