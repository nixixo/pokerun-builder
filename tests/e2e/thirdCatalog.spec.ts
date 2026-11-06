import { expect, test } from "@playwright/test";
import { prepareCatalog } from "../../scripts/prepare-catalog.mjs";
import fixture from "../fixtures/third-catalog.json" with { type: "json" };

test.skip(process.env.NEXT_PUBLIC_TEST_CATALOG !== "1", "Requiere un build con catálogo de prueba.");

test("un tercer juego permite buscar, elegir movimientos, consultar objetos y restaurar el equipo", async ({ page }) => {
  const prepared = prepareCatalog("catalog-test", fixture);
  const data: Record<string, unknown> = {
    "pokemon.json": prepared.core,
    "learnsets.json": prepared.learnsets,
    "moves.json": fixture.moves,
    "abilities.json": fixture.abilities,
    "items.json": fixture.items,
  };
  await page.route("**/__catalog_test/*.json", (route) => {
    const file = new URL(route.request().url()).pathname.split("/").at(-1)!;
    return route.fulfill({ json: data[file] });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Pokédex: Pokedex", exact: true }).click();
  await page.getByRole("button", { name: /Catálogo de prueba/ }).click();

  const species = page.getByPlaceholder("Buscar Pokémon por nombre", { exact: true }).first();
  await species.fill("nimbo");
  await expect(page.getByRole("button", { name: "Nimbo", exact: true })).toBeInViewport();
  await species.press("ArrowDown");
  await species.press("Enter");
  await expect(page.locator('[data-slot-idx="0"]').getByText("Bruma", { exact: true })).toBeVisible();

  const move = page.getByPlaceholder("Movimiento", { exact: true }).first();
  await move.fill("eco");
  await expect(page.getByRole("button", { name: /^Eco de prueba/ })).toBeInViewport();
  await move.press("ArrowDown");
  await move.press("Enter");
  await expect(move).toHaveValue("Eco de prueba");

  await page.getByRole("button", { name: "Objetos", exact: true }).click();
  const items = page.getByRole("dialog", { name: "Objetos" });
  await expect(items.getByText("Brújula de Nimbo", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Pokédex: Catálogo de prueba", exact: true })).toBeVisible();
  await expect(species).toHaveValue("Nimbo");
  await expect(move).toHaveValue("Eco de prueba");
});
