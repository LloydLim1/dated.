/* global document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({
  baseURL: "http://127.0.0.1:3300",
  viewport: { width: 1440, height: 1000 },
});
const page = await ctx.newPage();
const errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
const zoomTo = async (target) => {
  let actual = Number(
    await page.locator(".map-workspace").getAttribute("data-zoom"),
  );
  while (Math.abs(target - actual) > 0.1) {
    const delta = target > actual ? 1 : -1;
    await page
      .getByRole("button", {
        name: delta > 0 ? "Zoom in" : "Zoom out",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          Number(
            await page.locator(".map-workspace").getAttribute("data-zoom"),
          ),
        { timeout: 10000 },
      )
      .toBeCloseTo(actual + delta, 1);
    actual = Number(
      await page.locator(".map-workspace").getAttribute("data-zoom"),
    );
  }
};
try {
  await page.goto("/map");
  await page.locator(".map-result").first().waitFor();
  await page
    .getByRole("status")
    .filter({ hasText: /places in view/ })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const [name, viewport, target] of [
    ["map-city-desktop", { width: 1440, height: 1000 }, 12.2],
    ["map-wide-desktop", { width: 1440, height: 1000 }, 11.2],
    ["map-neighborhood-desktop", { width: 1440, height: 1000 }, 14.2],
    ["map-street-desktop", { width: 1440, height: 1000 }, 16.2],
    ["map-city-tablet", { width: 900, height: 1000 }, 12.2],
    ["map-city-mobile", { width: 390, height: 844 }, 12.2],
  ]) {
    await page.setViewportSize(viewport);
    await zoomTo(target);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "docs/frontend/" + name + ".png" });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      name,
      violations: axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      ...(await page.evaluate(() => {
        const workspace = document.querySelector(".map-workspace"),
          canvas = document.querySelector(".map-canvas");
        return {
          zoom: workspace?.getAttribute("data-zoom"),
          pins: document.querySelectorAll(".map-poi").length,
          names: [...document.querySelectorAll(".map-poi .poi-name")]
            .slice(0, 12)
            .map((n) => n.textContent),
          ids: [...document.querySelectorAll(".map-poi")].map((n) =>
            n.getAttribute("data-place-id"),
          ),
          overflow: document.documentElement.scrollWidth > innerWidth,
          status: document.querySelector(".map-result-status")?.textContent,
          mapWidth: canvas?.clientWidth,
          mapBottom: workspace?.getBoundingClientRect().bottom,
          navTop: document.querySelector(".mobile-nav")?.getBoundingClientRect()
            .top,
          tilesFailed: !!document.querySelector(".map-notice"),
        };
      })),
    });
  }
  expect(results[1].pins).toBeLessThan(results[0].pins);
  expect(
    results[2].ids.some((id) => !results[1].ids.includes(id)),
  ).toBeTruthy();
  expect(
    results[3].ids.some((id) => !results[2].ids.includes(id)),
  ).toBeTruthy();
  expect(results[5].mapBottom).toBeLessThanOrEqual(results[5].navTop + 1);
  await page.getByRole("button", { name: "Hide map results" }).click();
  await expect(page.locator(".map-results-panel")).toBeHidden();
  await page.getByRole("button", { name: "Show map results" }).click();
  await expect(page.locator(".map-results-panel")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Cinemas", exact: true }).click();
  await expect(page.locator(".map-poi.cinema").first()).toBeVisible();
  await expect(page.locator(".map-poi:not(.cinema)")).toHaveCount(0);
  await page.locator(".map-result-open").first().click();
  await expect(
    page.getByRole("heading", { name: "Tickets & showtimes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write a review", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search places on the map" })
    .fill("Ateneo Art Gallery");
  await expect(page.locator(".map-result-open")).toHaveCount(1);
  await page.locator(".map-result-open").click();
  await expect(
    page.getByText(/an exact map pin hasn’t been confirmed yet/),
  ).toBeVisible();
  fs.writeFileSync(
    "docs/frontend/map-hierarchy-verification.json",
    JSON.stringify(
      {
        results,
        errors,
        journeys: [
          "panel collapse",
          "cinema category",
          "cinema review enabled",
          "address-only search",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      results: results.map((r) => ({
        name: r.name,
        zoom: r.zoom,
        pins: r.pins,
        violations: r.violations,
        overflow: r.overflow,
        tilesFailed: r.tilesFailed,
      })),
      errors,
    }),
  );
  if (
    errors.length ||
    results.some((r) => r.overflow || r.violations.length || r.tilesFailed)
  )
    throw new Error("Map QA has unresolved issues");
} finally {
  await browser.close();
}
