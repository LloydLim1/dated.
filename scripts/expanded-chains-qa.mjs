/* global document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { officialSource } from "../src/lib/place-catalog.mjs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const ctx = await browser.newContext({
    baseURL: "http://127.0.0.1:3300",
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const data = await (await ctx.request.get("/api/bootstrap")).json();
  const report = [];
  const requestedNames = process.argv.slice(2);
  const names = requestedNames.length ? requestedNames : [
    "Hap Chan",
    "Tapa King",
    "North Park",
    "Angel's Pizza",
    "Gerry's Grill",
    "Serenitea",
    "Turks",
    "24 Chicken",
  ];
  for (const name of names) {
    const matches = data.places.filter((p) => officialSource(p)?.name === name);
    const p = matches.find((p) => p.logo);
    if (!p) throw new Error("Verified logo not imported for " + name);
    await page.goto("/explore?place=" + p.id);
    await page.getByRole("dialog").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    if (p.menuUrl) {
      await page.locator(".place-menu").scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("link", { name: "View menu", exact: true }),
      ).toHaveAttribute("href", p.menuUrl);
    } else {
      await expect(page.getByRole("link", { name: "View menu", exact: true })).toHaveCount(0);
    }
    if (p.priceText)
      await expect(page.getByText(p.priceText, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Write a review", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Post photos here", exact: true }),
    ).toBeEnabled();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await page.screenshot({
      path:
        "docs/frontend/" +
        name.toLowerCase().replace(/[^a-z0-9]/g, "-") +
        "-chain-mobile.png",
    });
    report.push({
      name,
      count: matches.length,
      logos: matches.filter((p) => p.logo).length,
      menu: p.menuUrl,
      price: p.priceText,
      violations: axe.violations.map((v) => v.id),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
  }
  fs.writeFileSync(
    requestedNames.length
      ? "docs/frontend/additional-chain-verification.json"
      : "docs/frontend/expanded-chain-verification.json",
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(JSON.stringify({ report, errors }));
  if (errors.length || report.some((r) => r.overflow || r.violations.length))
    throw new Error("Expanded chain UI checks failed");
} finally {
  await browser.close();
}
