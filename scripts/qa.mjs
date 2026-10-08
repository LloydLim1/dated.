/* global document, navigator, innerWidth */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["laptop", 1280, 720],
  ["tablet", 820, 1180],
  ["mobile", 390, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.goto("http://127.0.0.1:3300");
  await page
    .getByRole("heading", { name: "Fern & Fable", exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/${name}-final.png`, fullPage: true });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  results.push({
    name,
    width,
    height,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    violations: axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
}
await page.emulateMedia({ reducedMotion: "reduce" });
await page.getByRole("button", { name: "Find your next place" }).click();
await page.getByRole("button", { name: "Filters", exact: true }).click();
const dialogAxe = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .analyze();
results.push({
  name: "filter-dialog",
  violations: dialogAxe.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  })),
});
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Map view", exact: true }).click();
await page.locator(".map-canvas").waitFor();
await page.screenshot({ path: "docs/map-final.png", fullPage: true });
await page.goto("http://127.0.0.1:3300");
await page.evaluate(() => navigator.serviceWorker.ready);
await page.context().setOffline(true);
await page.goto("http://127.0.0.1:3300/offline-check");
const offline = await page
  .getByRole("heading", { name: "See you in a moment." })
  .isVisible();
await page.context().setOffline(false);
await browser.close();
writeFileSync(
  "docs/accessibility-results.json",
  JSON.stringify({ results, errors, offline }, null, 2),
);
console.log(
  JSON.stringify({
    screens: results.map((r) => ({
      name: r.name,
      overflow: r.overflow,
      violations: r.violations.length,
    })),
    errors,
    offline,
  }),
);
