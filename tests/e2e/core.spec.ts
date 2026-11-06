import { expect, test } from "@playwright/test";
import markers from "../../mapa.json" with { type: "json" };

test.beforeEach(async ({ page }) => {
  // Los flujos bajo prueba son locales y deben funcionar sin servicios externos.
  await page.route("https://**/*", (route) => route.abort());
});

test("el mapa muestra los puntos publicados, ignora ediciones locales y permite navegar", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("guia:lastView", "mapa");
    localStorage.setItem("pokemon-z-guia-mapa-marcadores", "[]");
    localStorage.setItem("pokemon-z-guia-mapa-marcadores:v2", "[]");
  });
  await page.goto("/guia");
  const map = page.getByRole("region", { name: "Mapa de zonas" });
  await expect(map.getByText(/87 zonas ubicadas/)).toBeVisible();
  await expect(map.getByRole("button")).toHaveCount(markers.length, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Editar mapa|Exportar JSON/ })).toHaveCount(0);
  await map.getByRole("img").click({ position: { x: 5, y: 5 } });
  await expect(map.getByRole("button")).toHaveCount(markers.length);
  await map.getByRole("button").first().click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("guia:lastZoneIndex:v2"))).toBe(markers[0].zoneId);
});

test("el modal confina el foco, cierra con Escape y devuelve el foco", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Objetos", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Objetos" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test("restaura un equipo antiguo y rechaza una importación inválida sin perderlo", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("seeded")) return;
    const team = Array.from({ length: 6 }, (_, index) => ({
      name: index === 0 ? "Pikachu" : "", isFake: false,
      types: index === 0 ? ["electric"] : ["", ""], sprite: null,
      moves: Array.from({ length: 4 }, () => ({ name: "", category: "Physical", type: null })),
    }));
    localStorage.setItem("pokerun-builder-team-standard", JSON.stringify(team));
    localStorage.setItem("seeded", "yes");
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Plantillas/ }).click();
  const dialog = page.getByRole("dialog", { name: /Plantillas guardadas/ });
  await dialog.getByRole("button", { name: "Importar equipo", exact: true }).click();
  await dialog.getByPlaceholder("Pega el JSON aquí…").fill("[null,null,null,null,null,null]");
  await dialog.getByRole("button", { name: "Importar equipo", exact: true }).last().click();
  await expect(dialog.getByText(/6 espacios válidos/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pokerun-builder-team-standard")!)[0].name)).toBe("Pikachu");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Limpiar equipo", exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pokerun-builder-team-standard")!)[0].name)).toBe("");
});

test("la guía restaura una zona y el progreso legado sin errores de ejecución", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("guia:lastZoneIndex", "0"));
  await page.goto("/guia");
  await expect(page.getByRole("button", { name: /Marcar visitada|Visitada/, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Marcar visitada", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pokemon-z-guia-zonas-visitadas:v2"))).toContain("zone-");
  await page.reload();
  await expect(page.getByRole("button", { name: "Visitada", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("la guía se adapta al móvil y el buscador global navega a una coincidencia", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/guia");
  const mobileNavigation = page.getByRole("button", { name: /Guía:.*Explorar/ });
  await expect(mobileNavigation).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("textbox", { name: "Buscar en toda la guía" }).fill("luciano");
  const result = page.getByRole("button").filter({ hasText: "Habitante de Acrílico" }).filter({ hasText: "Fábrica de Pokéball" });
  await expect(result).toHaveCount(1);
  await expect(result).toBeVisible();
  await result.click();
  await expect(mobileNavigation).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("Pokémon Z sugiere movimientos y respeta Solo aprendibles", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pokerun-builder-active-pokedex", "pokemon-z");
  });
  await page.goto("/");

  const pokemon = page.getByPlaceholder("Buscar Pokémon por nombre", { exact: true }).first();
  await pokemon.fill("pikachu");
  await expect(page.getByRole("button", { name: "Pikachu", exact: true }).first()).toBeVisible();
  await pokemon.press("ArrowDown");
  await pokemon.press("Enter");

  const slot = page.locator('[data-slot-idx="0"]');
  await expect(slot.getByText("Eléctrico", { exact: true })).toBeVisible();
  const move = slot.getByPlaceholder("Movimiento", { exact: true }).first();
  const suggestions = page.locator("body > [data-move-dropdown]");
  const learnable = page.getByRole("button", { name: "Solo aprendibles", exact: true });

  await expect(learnable).toHaveAttribute("aria-pressed", "true");
  await move.fill("rayo");
  await expect(suggestions.getByRole("button", { name: /^Rayo(?:\s|$)/ }).first()).toBeVisible();
  await move.press("Escape");
  await learnable.click();
  await expect(learnable).toHaveAttribute("aria-pressed", "false");
  await move.fill("lanzallamas");
  await expect(suggestions.getByRole("button", { name: "Lanzallamas", exact: true })).toBeInViewport();
  await move.press("ArrowDown");
  await move.press("Enter");
  await expect(move).toHaveValue("Lanzallamas");
});

test("el selector conserva equipos y plantillas separados por juego", async ({ page }) => {
  await page.addInitScript(() => {
    for (const [id, name, type] of [
      ["standard", "Pikachu", "electric"],
      ["pokemon-z", "Bulbasaur", "grass"],
    ]) {
      const team = Array.from({ length: 6 }, (_, index) => ({
        name: index === 0 ? name : "", isFake: false, types: index === 0 ? [type] : ["", ""],
        moves: Array.from({ length: 4 }, () => ({ name: "", category: "Physical", type: null })),
      }));
      localStorage.setItem(`pokerun-builder-team-${id}`, JSON.stringify(team));
      localStorage.setItem(`pokerun-builder-saved-teams-${id}`, JSON.stringify([
        { id: 1, name: `Plantilla ${name}`, savedAt: "2026-11-06", team },
      ]));
    }
  });
  await page.goto("/");
  const firstPokemon = page.getByPlaceholder("Buscar Pokémon por nombre", { exact: true }).first();
  await expect(firstPokemon).toHaveValue("Pikachu");

  await page.getByRole("button", { name: "Pokédex: Pokedex", exact: true }).click();
  await page.getByRole("button", { name: /^Pokémon Z / }).click();
  await expect(firstPokemon).toHaveValue("Bulbasaur");
  await page.getByRole("button", { name: /Plantillas/ }).click();
  const dialog = page.getByRole("dialog", { name: /Plantillas guardadas/ });
  await expect(dialog.getByText("Plantilla Bulbasaur", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Pokédex: Pokémon Z", exact: true }).click();
  await page.getByRole("button", { name: /^Pokedex Pokedex Nacional/ }).click();
  await expect(firstPokemon).toHaveValue("Pikachu");
  await page.getByRole("button", { name: /Plantillas/ }).click();
  await expect(dialog.getByText("Plantilla Pikachu", { exact: true })).toBeVisible();
});

test("la guía guarda un objeto pendiente y permite volver desde el mapa", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guia");
  const bookmark = page.getByRole("button", { name: "Guardar pendiente: Superball (X3)", exact: true });
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await bookmark.click();
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  const summary = page.locator("summary").filter({ hasText: "Pendientes" });
  await expect(summary).toContainText("(1)");
  await summary.click();
  await expect(page.getByText(/cuando capturemos 5 Pokémon/)).toBeVisible();

  await page.getByRole("button", { name: "Ir a la zona de Superball (X3)", exact: true }).click();
  await expect(bookmark).toBeVisible();
  await page.getByRole("button", { name: "Marcar como hecho: Superball (X3)", exact: true }).click();
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await expect(summary).toContainText("(0)");
});
