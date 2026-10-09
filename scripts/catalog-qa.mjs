/* global document, innerWidth, structuredClone */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { philippineMenu } from "../src/lib/philippine-menus.mjs";
const baseURL = "http://127.0.0.1:3300";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const start = Date.now(),
    r = await context.request.get("/api/bootstrap"),
    data = await r.json();
  const loadMs = Date.now() - start;
  const foreignMenus = data.places.filter(
    (p) => p.menuUrl && (p.menuCountry !== "PH" || !philippineMenu(p.menuUrl)),
  );
  if (foreignMenus.length)
    throw new Error("Unconfirmed Philippine menu sources remain");
  const museums = data.places.filter(
    (p) => p.category === "Museum" && !p.sample,
  );
  if (museums.length !== data.catalog.museums?.count || !museums.length)
    throw new Error("Museum directory not imported");
  if (
    museums.some(
      (p) =>
        p.locationStatus === "address_only" &&
        (p.lat !== null || p.lng !== null),
    )
  )
    throw new Error("Unconfirmed museum has a guessed pin");
  if (
    !data.catalog.count ||
    data.catalog.cities.length !== 17 ||
    data.catalog.cities.reduce((sum, city) => sum + city.count, 0) !==
      data.catalog.count
  )
    throw new Error("Incomplete city coverage");
  const logos = [
    ...new Set(
      data.places
        .filter((p) => p.catalogRegion === "Metro Manila" && p.logo)
        .map((p) => p.logo),
    ),
  ];
  let at = 0;
  const failed = [];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (at < logos.length) {
        const url = logos[at++];
        try {
          const res = await context.request.get(url);
          if (res.status() !== 200) throw new Error("HTTP " + res.status());
          const meta = await sharp(await res.body()).metadata();
          if (meta.format !== "webp" || meta.width > 160 || meta.height > 160)
            throw new Error("Invalid dimensions");
        } catch (e) {
          failed.push({ url, error: e.message });
        }
      }
    }),
  );
  if (failed.length) throw new Error(JSON.stringify(failed));
  const results = [];
  for (const [name, viewport, id] of [
    [
      "metro-museum-desktop",
      { width: 1440, height: 1000 },
      museums.find((p) => p.name === "Ayala Museum")?.id,
    ],
    [
      "metro-museum-address-mobile",
      { width: 390, height: 844 },
      museums.find((p) => p.name === "Ateneo Art Gallery")?.id,
    ],
    [
      "metro-museum-closed-mobile",
      { width: 390, height: 844 },
      museums.find((p) => p.visitingNotice)?.id,
    ],
    ["metro-map-desktop", { width: 1440, height: 1000 }, null],
    [
      "metro-menu-mobile",
      { width: 390, height: 844 },
      data.places.find((p) => p.priceText)?.id,
    ],
    [
      "metro-guide-desktop",
      { width: 1280, height: 900 },
      data.places.find((p) => p.guideUrl && /odd/i.test(p.name))?.id ||
        data.places.find((p) => p.guideUrl)?.id,
    ],
    [
      "metro-official-menu",
      { width: 1280, height: 900 },
      data.places.find((p) => p.brandId === "Q60741625" && p.logo)?.id,
    ],
    [
      "metro-unconfirmed-mobile",
      { width: 390, height: 844 },
      data.places.find((p) => p.catalogRegion === "Metro Manila")?.id,
    ],
  ]) {
    if (name === "metro-unconfirmed-mobile") {
      const fixture = structuredClone(data);
      fixture.places.find((p) => p.id === id).mapStatus = "unconfirmed";
      await page.route("**/api/bootstrap", (route) =>
        route.fulfill({ json: fixture }),
      );
    }
    await page.setViewportSize(viewport);
    await page.goto(id ? "/explore?place=" + encodeURIComponent(id) : "/map");
    if (id) await page.getByRole("dialog").waitFor();
    else {
      await page
        .locator(".map-panel-footer")
        .getByText(
          new RegExp(
            data.catalog.count.toLocaleString("en-PH") + " mapped food places",
          ),
        )
        .waitFor();
      await page
        .getByRole("status")
        .filter({ hasText: /places in view/ })
        .waitFor();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
    );
    if (id) await page.locator(".place-menu").scrollIntoViewIfNeeded();
    if (name.startsWith("metro-museum")) {
      if (
        !(await page
          .getByRole("heading", { name: "Admission & visiting" })
          .count())
      )
        throw new Error("Museum admission section missing");
      if (
        await page.getByRole("link", { name: "View menu", exact: true }).count()
      )
        throw new Error("Museum displays a restaurant menu");
      if (
        name.includes("address") &&
        !(await page
          .getByText(
            "The address is listed, but an exact map pin hasn’t been confirmed yet.",
          )
          .count())
      )
        throw new Error("Unconfirmed pin notice missing");
      if (
        name.includes("closed") &&
        !(await page
          .getByRole("status")
          .filter({ hasText: /temporarily closed/ })
          .count())
      )
        throw new Error("Museum closure notice missing");
    }
    if (name === "metro-guide-desktop")
      await page
        .getByRole("link", { name: "Café Guide PH listing" })
        .scrollIntoViewIfNeeded();
    if (name === "metro-unconfirmed-mobile") {
      await page
        .getByRole("status")
        .filter({ hasText: "not found in the latest map scan" })
        .scrollIntoViewIfNeeded();
      if (
        !(await page
          .getByRole("button", { name: "Write a review", exact: true })
          .isEnabled()) ||
        !(await page
          .getByRole("button", { name: "Post photos here", exact: true })
          .isEnabled())
      )
        throw new Error("Unconfirmed listings lost their rating/photo journey");
    }
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
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
  }
  await page.unroute("**/api/bootstrap");
  const blocked = data.places.find(
    (p) => p.websiteStatus === "identity_unconfirmed",
  );
  if (blocked) {
    await page.goto("/explore?place=" + encodeURIComponent(blocked.id));
    await page.getByRole("dialog").waitFor();
    if (await page.getByRole("link", { name: "Visit website" }).count())
      throw new Error("Unrelated restaurant website is still linked");
  }
  writeFileSync(
    "docs/frontend/catalog-verification.json",
    JSON.stringify(
      {
        count: data.catalog.count,
        museums: data.catalog.museums,
        confirmedPhilippineMenus: data.places.filter((p) => p.menuUrl).length,
        cities: data.catalog.cities,
        logoAssets: logos.length,
        unrelatedWebsiteHidden: !!blocked,
        failed,
        loadMs,
        errors,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      count: data.catalog.count,
      logos: logos.length,
      loadMs,
      errors,
      results,
    }),
  );
  if (errors.length || results.some((r) => r.overflow || r.violations.length))
    throw new Error("Catalog browser QA has unresolved issues");
} finally {
  await browser.close();
}
