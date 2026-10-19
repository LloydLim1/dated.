/* global document, innerWidth */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const baseURL = process.env.QA_BASE_URL || "http://127.0.0.1:3400";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 1000 },
});
const companion = await browser.newContext({ baseURL });
const page = await context.newPage();
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
mkdirSync("docs/frontend", { recursive: true });
const password = "frontend-test-password-123";
const stamp = Date.now().toString(36);
async function signup(target, username, name) {
  const response = await target.request.post("/api/auth/signup", {
    data: {
      email: username + "@test.example",
      username,
      name,
      password,
      adult: true,
      terms: true,
    },
  });
  if (!response.ok()) throw new Error(await response.text());
}
async function scan(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  await page.screenshot({
    path: `docs/frontend/${name}.png`,
    fullPage: (await page.getByRole("dialog").count()) === 0,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  results.push({
    name,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    violations: audit.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    })),
  });
}
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["laptop", 1280, 720],
    ["tablet", 820, 1180],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page
      .getByRole("heading", { name: /Find your kind of place/ })
      .waitFor();
    await scan(name + "-landing");
    await page.goto("/app");
    await page
      .getByRole("heading", { name: "Fern & Fable", exact: true })
      .waitFor();
    await scan(name + "-home");
  }
  await page.goto("/explore?auth=signup");
  await page.getByRole("dialog").waitFor();
  await scan("customer-signup-entry");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/business?auth=login");
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Welcome back" })
    .waitFor();
  await scan("business-login-entry");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/explore");
  await page
    .getByRole("button", { name: "Explore Fern & Fable", exact: true })
    .click();
  await scan("mobile-place");
  await page
    .getByRole("button", { name: "Write a review", exact: true })
    .click();
  await scan("mobile-auth");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/a-little-detour");
  await scan("mobile-404");
  await signup(context, "qa" + stamp, "Adrian Flores");
  await signup(companion, "qafriend" + stamp, "Sam Rivera");
  const initial = await (await context.request.get("/api/bootstrap")).json();
  await context.request.post("/api/collections/items", {
    data: {
      collectionId: initial.collections[0].id,
      placeId: "fern-and-fable",
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  await context.request.post("/api/outings", {
    data: {
      title: "A slow afternoon in the city",
      date: today,
      visibility: "private",
      notes: "Coffee first, then a little culture. Meet after lunch.",
      stops: ["fern-and-fable", "the-gallery"],
      invitees: [],
    },
  });
  await context.request.post("/api/reviews", {
    data: {
      placeId: "fern-and-fable",
      title: "A quiet corner worth coming back to",
      body: "The garden seats were a lovely place to spend the afternoon. Coffee was thoughtful and service was friendly. Come early for a quiet table.",
      visitDate: today,
      spending: 420,
      visibility: "private",
      incentive: false,
      media: [],
      ratings: { "Coffee & drinks": 4, Atmosphere: 5, Service: 4, Value: 4 },
    },
  });
  await companion.request.post("/api/outings", {
    data: {
      title: "Coffee with Sam",
      date: today,
      visibility: "private",
      notes: "Meet by the garden table, then walk to the gallery.",
      stops: ["fern-and-fable", "the-gallery"],
      invitees: ["qa" + stamp],
    },
  });
  for (const [size, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const view of [
      "explore",
      "saved",
      "outings",
      "community",
      "profile",
    ]) {
      await page.goto("/" + view);
      await page.locator(".loading-content").waitFor({ state: "hidden" });
      await scan(size + "-" + view);
    }
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await scan(size + "-profile-form");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: /Notifications/ }).click();
    await scan(size + "-invitations");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.goto("/outings");
    await page.getByRole("button", { name: "Edit plan", exact: true }).click();
    await scan(size + "-outing-form");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.goto("/profile");
    await page
      .getByRole("button", { name: "Write a review", exact: true })
      .click();
    await scan(size + "-review-form");
    await page.getByRole("dialog").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await scan(size + "-review-form-bottom");
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
} finally {
  for (const target of [context, companion])
    await target.request.delete("/api/account", { data: { password } });
  await browser.close();
  writeFileSync(
    "docs/frontend/verification.json",
    JSON.stringify({ results, errors }, null, 2),
  );
}
console.log(
  JSON.stringify({
    screens: results.map(({ name, overflow, violations }) => ({
      name,
      overflow,
      violations: violations.length,
    })),
    errors,
  }),
);
if (errors.length || results.some((r) => r.overflow || r.violations.length))
  process.exitCode = 1;
