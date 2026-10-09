/* global document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  baseURL: "http://127.0.0.1:3300",
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const data = await (await context.request.get("/api/bootstrap")).json();
  const result = [];
  for (const name of ["Pickup Coffee", "Army Navy", "Bo's Coffee"]) {
    const p = data.places.find((p) => p.name === name && p.logo);
    if (!p) throw new Error("Missing verified logo for " + name);
    await page.goto("/explore?place=" + p.id);
    await page.getByRole("dialog").waitFor();
    await page.locator(".place-menu").scrollIntoViewIfNeeded();
    if (name === "Pickup Coffee") {
      await expect(page.getByText("Published items: ₱30–₱155")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "View menu", exact: true }),
      ).toHaveAttribute("href", "https://www.pickup-coffee.com/menu");
    }
    if (name === "Army Navy") {
      await expect(
        page.getByRole("link", { name: "View menu", exact: true }),
      ).toHaveAttribute(
        "href",
        "https://menu.klikit.io/menu/RgjhghP61njsX01UKZELO4L9",
      );
    }
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
        name.toLowerCase().replace(/[^a-z]/g, "-") +
        "-verified-mobile.png",
    });
    result.push({
      name,
      violations: axe.violations.map((v) => v.id),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      logo: p.logo,
    });
  }
  const sillon = data.places.find((p) => p.name === "Sillon All Day Breakfast");
  if (sillon?.logo) throw new Error("Provider mark still visible");
  fs.writeFileSync(
    "docs/frontend/philippine-chain-verification.json",
    JSON.stringify({ result, errors }, null, 2),
  );
  console.log(JSON.stringify({ result, errors }));
  if (errors.length || result.some((r) => r.overflow || r.violations.length))
    throw new Error("Screen QA failed");
} finally {
  await browser.close();
}
