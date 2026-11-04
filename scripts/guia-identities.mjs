import { randomUUID } from "node:crypto";

const fresh = (prefix) => `${prefix}-${randomUUID().replaceAll("-", "")}`;
const stripIds = (value) => JSON.stringify(value, (key, v) => key === "id" || key === "progressIds" ? undefined : v);

/** Preserva identidades al regenerar la guía. Una ambigüedad aborta antes de escribir. */
export function preserveGuideIds(zones, previous) {
  const used = new Set();
  for (const zone of zones) {
    const candidates = previous.filter((old) => !used.has(old.id) && old.zona === zone.zona);
    const exact = candidates.filter((old) => stripIds(old) === stripIds(zone));
    if (candidates.length > 1 && exact.length !== 1) {
      throw new Error(`Identidad ambigua para ${zone.zona}. Conserva su ID manualmente antes de regenerar.`);
    }
    const old = exact[0] ?? candidates[0];
    zone.id = old?.id ?? fresh("zone");
    used.add(zone.id);
    const usedMts = new Set();
    for (const mt of zone.mts ?? []) {
      const matches = (old?.mts ?? []).filter((m) => !usedMts.has(m.id) && m.numero === mt.numero);
      const matching = matches.find((m) => stripIds(m) === stripIds(mt)) ?? (matches.length === 1 ? matches[0] : undefined);
      if (matches.length > 1 && !matching) throw new Error(`MT ambigua en ${zone.zona}: ${mt.numero}`);
      mt.id = matching?.id ?? fresh("mt");
      usedMts.add(mt.id);
    }
    for (const field of ["nido_alfa", "habitante_acrilico"]) {
      if (zone[field]) zone[field].id = old?.[field]?.id ?? fresh(field === "nido_alfa" ? "nest" : "person");
    }
    const page = zone.pagina_alquimia;
    if (page?.presente) {
      const prior = old?.pagina_alquimia?.progressIds ?? {};
      const descriptions = [page.descripcion ?? "", ...(page.adicionales ?? [])];
      const missing = descriptions.filter((d) => !prior[d]);
      const orphaned = Object.keys(prior).filter((d) => !descriptions.includes(d));
      if (missing.length && orphaned.length && (missing.length !== 1 || orphaned.length !== 1)) {
        throw new Error(`Páginas ambiguas en ${zone.zona}. Conserva sus progressIds manualmente.`);
      }
      page.progressIds = Object.fromEntries(descriptions.map((d) => [d, prior[d] ??
        (missing.length === 1 && orphaned.length === 1 ? prior[orphaned[0]] : fresh("page"))]));
    }
  }
  validateGuideIds(zones);
  return zones;
}

export function validateGuideIds(zones) {
  const seen = new Set();
  const check = (id) => {
    if (typeof id !== "string" || !id || seen.has(id)) throw new Error(`ID de guía ausente o duplicado: ${id}`);
    seen.add(id);
  };
  for (const z of zones) {
    check(z.id);
    for (const mt of z.mts ?? []) check(mt.id);
    if (z.nido_alfa) check(z.nido_alfa.id);
    if (z.habitante_acrilico) check(z.habitante_acrilico.id);
    const a = z.pagina_alquimia;
    if (a?.presente) for (const d of [a.descripcion ?? "", ...(a.adicionales ?? [])]) check(a.progressIds?.[d]);
  }
}
