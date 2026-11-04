// scripts/limpieza/informe.mjs
//
// Todo lo que la limpieza IMPRIME, y nada de lo que hace.
//
// Estaba dentro de main(), que por eso pasaba de 590 líneas: más de un tercio
// eran console.log. Sacarlo no cambia una coma de la salida — el cuerpo está
// tal cual estaba — pero deja main() contando solo la secuencia de pasadas,
// que es lo que hay que poder leer de un vistazo.

/**
 * Imprime el resumen de la pasada.
 *
 * Recibe de una vez todo lo que las pasadas fueron devolviendo. La lista de
 * campos es larga porque es un informe del run entero: no es un olor, es el
 * argumento correcto.
 */
export function informe(datos) {
  const {
    APPLY,
    aclarados,
    arcos,
    bosses,
    cambios,
    coleccion,
    conBase,
    conexiones,
    consejos,
    cuevas,
    degradados,
    drops,
    equiposEnObjetos,
    especieCorrida,
    fusionPdf,
    habitantes,
    intercambiados,
    marcadosSecuencia,
    mudados,
    normalizado,
    notasEntrenador,
    notasEspurias,
    notasPartidas,
    objetosStats,
    opcionales,
    partidos,
    reparto,
    requisitos,
    rescate,
    recuperadas,
    rivales,
    sacadosDeArco,
    salvajes,
    separadores,
    sinResolver,
    sospechas,
    subsecciones,
    tablas,
    zonaNueva,
  } = datos;

  console.log(`\nPokémon salvajes revisados: ${salvajes}`);
  console.log(
    `Nubes de polvo volcadas:    ${cuevas.volcadas.reduce((n, v) => n + v.n, 0)} en ${cuevas.volcadas.length} zonas` +
      (cuevas.sinZona.length ? ` · ${cuevas.sinZona.length} sin zona` : "")
  );
  console.log(
    `Conexiones resueltas:       ${conexiones.cambiadas.length} · ` +
      `${conexiones.retiradas.length} retiradas · ${conexiones.irresolubles.length} sin destino`
  );
  console.log(
    `Bosses marcados:            ${bosses.length}${bosses.length ? ` (${bosses.map((b) => b.nombre).join(", ")})` : ""}`
  );
  console.log(
    `Arcos narrativos:           ${arcos.length}${arcos.length ? ` (${arcos.join(", ")})` : ""}`
  );
  console.log(
    `Separadores de acto:        ${separadores.length}${separadores.length ? ` (${separadores.join(", ")})` : ""}`
  );
  console.log(
    `Entradas opcionales:        ${opcionales.opcionales.length} · ` +
      `${opcionales.capturas.length} son objetivos de captura ` +
      `(${opcionales.capturas.reduce((n, c) => n + c.especies.length, 0)} especies)`
  );
  if (opcionales.sinTabla.length) {
    console.log("  AVISO — entradas de captura sin especie en CAPTURAS_POR_ZONA:");
    for (const z of opcionales.sinTabla) console.log(`    ${z}`);
  }
  console.log(`Entrenadores fuera de arco: ${sacadosDeArco.length}`);
  for (const m of sacadosDeArco) {
    console.log(`    ${m.nombre}: "${m.desde}" -> "${m.hasta}"`);
  }
  console.log(
    `Equipos rescatados:         ${rescate.creados.length} entrenadores nuevos · ${rescate.rellenados.length} rellenados · ` +
      `${rescate.borrados} entradas quitadas de objetos`
  );
  for (const c of [...rescate.creados, ...rescate.rellenados]) {
    console.log(`    ${String(c.n).padStart(2)} mons  ${c.nombre.padEnd(38)} ${c.zona}`);
  }
  if (rescate.sinDestino.length) {
    console.log("  AVISO — se borraron Pokémon en zonas sin equipo definido:");
    for (const s of rescate.sinDestino) console.log(`    ${s.n}  ${s.zona}`);
  }
  console.log(
    `Consejos de batalla:        ${consejos.movidos.length} movidos de objetos al Pokémon que comentan` +
      (consejos.sinDestino.length ? ` · ${consejos.sinDestino.length} sin destino` : "")
  );
  for (const s of consejos.sinDestino) console.log(`    ${s.motivo}: ${s.nombre} (${s.zona})`);
  console.log(
    `Notas repartidas a su combate: ${reparto.consejos.length} consejos · ${reparto.notas.length} notas · ` +
      `${reparto.quitadas.length} cabeceras/repetidas fuera` +
      (reparto.ambiguas.length ? ` · ${reparto.ambiguas.length} ambiguas (se quedan)` : "")
  );
  for (const a of reparto.ambiguas) console.log(`    ambigua: ${a.nombre} (${a.zona})`);
  for (const p of partidos) console.log(`    consejo partido reunido: ${p.especie} (${p.zona})`);
  for (const i of intercambiados) console.log(`    consejos intercambiados: ${i.a} <-> ${i.b} (${i.zona})`);
  for (const a of aclarados) console.log(`    aviso puesto en el consejo de ${a.especie} (${a.zona})`);
  for (const s of sospechas) {
    console.log(
      `  REVISAR — consejo de ${s.especie} (${s.trainer}, ${s.zona}) habla de "${s.habilidad}", ` +
        `que en ese equipo la tiene ${s.de}`
    );
  }
  for (const n of reparto.notas) console.log(`    nota -> ${n.trainer} (${n.zona}): ${n.nota.slice(0, 80)}`);
  for (const q of notasEspurias) console.log(`Nota espuria quitada: ${q.nombre} (${q.zona})`);
  console.log(`Notas duplicadas de entrenador: ${notasEntrenador.length} quitadas`);
  for (const q of notasEntrenador) console.log(`    ${q.zona}: "${q.nota}"`);
  console.log(
    `Normalizado:                ${normalizado.stats.movimientos} movs · ${normalizado.stats.habilidades} habs · ` +
      `${normalizado.stats.objetos} objetos · ${normalizado.stats.naturalezas} naturalezas · ` +
      `${normalizado.stats.notas} notas · ${normalizado.stats.aclaraciones} aclaraciones a nota`
  );
  if (normalizado.movsDudosos.size) {
    console.log("\n--- MOVIMIENTOS QUE NO EXISTEN EN LA BASE ---");
    for (const [mv, n] of [...normalizado.movsDudosos].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}x  ${mv}`);
    }
    console.log("");
  }
  console.log(
    `Requisitos anotados:        ${requisitos.conRequisito} · ` +
      Object.entries(requisitos.cuenta)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${v}`)
        .join(" ")
  );
  console.log(
    `Subsecciones creadas:       ${subsecciones.length}` +
      (subsecciones.length ? ` (${subsecciones.join(", ")})` : "") +
      (mudados.length ? ` · mudado al faro: ${mudados.join(", ")}` : "")
  );
  console.log(`Nombres reescritos:         ${cambios.length}`);
  console.log(`Variantes con spriteBase:   ${conBase.size} distintas`);
  console.log(`Especies recuperadas:       ${recuperadas.length}`);
  console.log(`Equipos de rival reescritos:${String(rivales.length).padStart(4)}`);
  console.log(`Degradados a "menor":       ${degradados.length}`);
  console.log(`Marcados en secuencia:      ${marcadosSecuencia.length}`);
  console.log(`Notas -> procedencia:       ${notasPartidas.length}`);
  console.log(
    `Tablas fuera de notas:      ${tablas.borradas.length} líneas borradas · ${tablas.movidas.length} subidas a salvajes`
  );
  console.log(`Drops normalizados:         ${drops.cambios.length}`);
  for (const r of drops.rescatados) {
    console.log(`    consejos rescatados de un drop -> ${r.entrenador} (${r.zona}), ${r.largo} car.`);
  }
  if (!APPLY && drops.cambios.length > 0) {
    // Solo los que cambian algo más que el punto final: el resto son 700
    // líneas de ruido que tapan lo que de verdad hay que revisar.
    const defondo = drops.cambios.filter((c) => `${c.antes}.` !== c.despues);
    console.log(`\n--- DROPS: cambios de fondo (${defondo.length} de ${drops.cambios.length}) ---`);
    for (const c of defondo.slice(0, 40)) {
      console.log(`  ${JSON.stringify(c.antes).slice(0, 90)}\n      -> ${JSON.stringify(c.despues)}`);
    }
  }
  if (tablas.movidas.length > 0) {
    for (const m of tablas.movidas) console.log(`    ${m.zona} | ${m.metodo} | ${m.texto}`);
  }
  console.log(`Habitantes Acrílico:        ${habitantes.creados.length} creados · ${habitantes.renombrados.length} renombrados`);
  console.log(
    `Colección:                  ${coleccion.mts.length} MTs añadidas · ` +
      `${coleccion.movimientos.length} nombres corregidos · ${coleccion.alquimias.length} alquimias · ` +
      `${coleccion.espurias.reduce((n, e) => n + e.n, 0)} espurias · ${coleccion.adicionales.length} 2ª página · ` +
      `${coleccion.principales.length} 1ª página corregida · ${coleccion.espuriasAlquimia.length} alquimias espurias`
  );

  if (conexiones.irresolubles.length) {
    console.log("\n--- CONEXIONES SIN DESTINO ---");
    for (const c of conexiones.irresolubles) console.log(`  ${c.de}  ->  ${c.destino}`);
  }

  if (coleccion.mts.length || coleccion.movimientos.length || coleccion.alquimias.length) {
    console.log("\n--- COLECCIÓN ---");
    for (const m of coleccion.mts) console.log(`  MT NUEVA   ${m.numero.padEnd(6)} ${m.movimiento.padEnd(14)} ${m.zona}`);
    for (const m of coleccion.movimientos) console.log(`  MOVIMIENTO ${String(m.numero).padEnd(6)} "${m.de}" -> "${m.a}"`);
    for (const a of coleccion.alquimias) console.log(`  ALQUIMIA   ${a.zona}`);
    for (const e of coleccion.espurias) console.log(`  ESPURIA    ${e.numero.padEnd(6)} x${e.n}  ${e.zona}`);
    for (const a of coleccion.adicionales) console.log(`  2ª PÁGINA  ${a.zona}`);
  }

  if (habitantes.creados.length || habitantes.renombrados.length) {
    console.log("\n--- HABITANTES DE PUEBLO ACRÍLICO ---");
    for (const h of habitantes.creados) console.log(`  NUEVO      ${h.nombre.padEnd(20)} ${h.zona}`);
    for (const h of habitantes.renombrados) console.log(`  RENOMBRADO ${String(h.de).padEnd(24)} -> ${h.a}`);
  }
  console.log(
    `Entrenadores del PDF:       ${fusionPdf.reduce((n, f) => n + f.nuevos, 0)} nuevos en ${fusionPdf.length} zonas` +
      `  ·  ${fusionPdf.reduce((n, f) => n + f.retirados, 0)} falsos salvajes retirados`
  );
  for (const f of fusionPdf) {
    for (const r of f.reasignados) {
      console.log(`    equipo reasignado: ${r.nombre} (${f.zona})  ${r.antes} -> ${r.ahora} mons`);
    }
  }
  console.log(
    `Objetos repartidos:         ${Object.entries(objetosStats)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join("  ")}`
  );
  console.log(`Especie corrida (sin tocar):${String(especieCorrida.length).padStart(4)}`);
  console.log(`Sin resolver:               ${sinResolver.length}`);
  if (zonaNueva) console.log(`Zona nueva:                 ${zonaNueva}`);

  if (marcadosSecuencia.length) {
    console.log("\n--- SECUENCIAS TIPO ALTO MANDO ---");
    for (const m of marcadosSecuencia) console.log(`  ${m.secuencia}  #${m.orden}  ${m.nombre}`);
  }

  if (equiposEnObjetos.length) {
    const tot = equiposEnObjetos.reduce((s, x) => s + x.n, 0);
    console.log(`\n--- EQUIPOS DE ENTRENADOR DENTRO DE "objetos" (${tot}, sin tocar) ---`);
    for (const e of equiposEnObjetos) console.log(`  ${String(e.n).padStart(3)} en ${e.zona}`);
  }

  if (degradados.length) {
    console.log("\n--- YA NO SON \"IMPORTANTE\" ---");
    for (const d of degradados) console.log(`  ${d.zona.slice(0, 38).padEnd(38)} | ${d.nombre}`);
  }

  if (rivales.length) {
    console.log("\n--- EQUIPOS DE RIVAL (desde el PDF) ---");
    for (const m of rivales) {
      console.log(`  ${m.rival.padEnd(15)} ${m.zona.padEnd(32)} ${m.antes} -> ${String(m.despues).padStart(2)} miembros  (pág. ${m.pagina})`);
    }
  }

  if (recuperadas.length) {
    console.log("\n--- ESPECIES RECUPERADAS ---");
    for (const r of recuperadas) {
      console.log(`  "${r.antes}" -> ${r.especie.padEnd(16)} ${r.zona}${r.entrenador ? " | " + r.entrenador : ""}`);
    }
  }

  if (conBase.size) {
    console.log("\n--- spriteBase ---");
    for (const [n, b] of [...conBase].sort()) console.log(`  ${n.padEnd(32)} -> ${b}`);
  }

  if (especieCorrida.length) {
    console.log("\n--- ESPECIE CORRIDA: requiere la guía original ---");
    for (const e of especieCorrida) {
      console.log(`  ${e.zona} | ${e.entrenador}`);
      console.log(`      especie="${e.mon.especie}" Nv.${e.mon.nivel} ${e.mon.habilidad} / ${e.mon.objeto} — ${(e.mon.movimientos || []).join(", ")}`);
    }
  }

  if (sinResolver.length) {
    console.log("\n--- SIN RESOLVER (siguen sin sprite) ---");
    for (const s of sinResolver) console.log(`  ${(s.tipo || "salvaje").padEnd(11)} ${JSON.stringify(s.nombre).padEnd(28)} (original: ${JSON.stringify(s.antes)}) — ${s.zona}`);
  }

  if (!APPLY) {
    console.log("\n--- MUESTRA DE REESCRITURAS (primeras 25) ---");
    for (const c of cambios.slice(0, 25)) {
      const extra = Object.entries(c.despues).filter(([k]) => k !== "nombre").map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
      console.log(`  ${JSON.stringify(c.antes)}\n      -> ${JSON.stringify(c.despues.nombre)}  ${extra}`);
    }
  }
}
