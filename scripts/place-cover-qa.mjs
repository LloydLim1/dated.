/* global document, innerWidth, getComputedStyle */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3300",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [],
    results = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3300/explore");
  await page
    .getByRole("textbox", { name: "Search places", exact: true })
    .fill("H Proper");
  await page
    .getByRole("heading", {
      name: "H Proper Coffee Roasters - Ayala Triangle Garden",
      exact: true,
    })
    .waitFor();
  for (const [name, viewport] of [
    ["photo-cards-desktop", { width: 1440, height: 1000 }],
    ["photo-cards-mobile", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    const cover = page.locator(".place-photo-cover > img");
    await cover.evaluate((img) => img.decode());
    await page.screenshot({
      path: `docs/frontend/${name}.png`,
      fullPage: true,
    });
    if (name === "photo-cards-desktop") await page.locator(".place-card").screenshot({path:"docs/frontend/revised-location-card.png"});
    const photo = await cover.evaluate((img) => ({
      width: img.getBoundingClientRect().width,
      containerWidth: img.parentElement.getBoundingClientRect().width,
      height: img.getBoundingClientRect().height,
      objectFit: getComputedStyle(img).objectFit,
      src: img.getAttribute("src"),
      loaded: img.complete && img.naturalWidth > 0,
    }));
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    results.push({
      name,
      photo,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      violations: audit.violations.map((v) => ({ id: v.id, impact: v.impact })),
    });
    if (
      photo.width !== photo.containerWidth ||
      !photo.loaded ||
      photo.objectFit !== "cover"
    )
      throw new Error("Photo cover did not fill its section");
  }
  await page
    .getByRole("button", {
      name: "Explore H Proper Coffee Roasters - Ayala Triangle Garden",
      exact: true,
    })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.screenshot({
    path: "docs/frontend/photo-place-detail-mobile.png",
  });
  const detailAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  results.push({
    name: "photo-place-detail-mobile",
    violations: detailAudit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
    })),
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  });
  const summary = { verifiedAt: new Date().toISOString(), results, errors };
  writeFileSync(
    "docs/frontend/photo-cover-verification.json",
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length || results.some((r) => r.overflow || r.violations.length))
    throw new Error("Photo cover verification failed");
} finally {
  await browser.close();
}
