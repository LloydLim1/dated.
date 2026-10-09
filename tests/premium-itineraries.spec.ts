import { test, expect, type APIRequestContext } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

test.beforeAll(async ({ request }) => {
  await request.get("/api/bootstrap");
  const db = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  db.prepare("DELETE FROM limits").run();
  db.close();
  mkdirSync("docs/frontend", { recursive: true });
});
const stamp = Date.now().toString(36);
async function signup(request: APIRequestContext, name: string) {
  const r = await request.post("/api/auth/signup", {
    data: {
      email: name + stamp + "@test.example",
      username: name + stamp,
      name: name + " Explorer",
      password: "test-long-password-123",
      adult: true,
      terms: true,
    },
  });
  expect(r.status()).toBe(201);
}
const outing = {
  title: "A coffee and culture day",
  date: "2026-10-15",
  visibility: "private",
  notes: "PRIVATE HOST NOTES - not for sharing",
  stops: ["fern-and-fable", "the-gallery"],
  invitees: [],
};
const design = {
  title: "Coffee, culture, and company",
  intro: "An afternoon together.",
  format: "timeline",
  theme: "forest",
  showDate: false,
  showAddress: false,
  showBudget: false,
  stops: outing.stops.map((placeId) => ({
    placeId,
    time: "13:00",
    minutes: 60,
    note: "Meet by the entrance.",
    budget: 500,
  })),
};

test("itinerary shares are host-only, explicit snapshots, minimal, revocable, and exportable", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  const guest = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  await signup(owner, "planhost");
  await signup(other, "planother");
  const create = await owner.post("/api/outings", { data: outing });
  expect(create.status()).toBe(201);
  const id = (await create.json()).id,
    path = `/api/outings/${id}/itinerary`;
  expect((await guest.get(path)).status()).toBe(401);
  expect((await other.get(path)).status()).toBe(404);
  const initial = await (await owner.get(path)).json();
  expect(initial.token).toBeNull();
  expect(initial.settings.intro).toBe("");
  expect(
    (
      await other.patch(path, { data: { settings: design, publish: true } })
    ).status(),
  ).toBe(404);
  for (const stops of [
    [...design.stops, design.stops[0]],
    [{ ...design.stops[0], placeId: "made-up" }],
    [{ ...design.stops[0], time: "25:00" }],
  ])
    expect(
      (
        await owner.patch(path, {
          data: { settings: { ...design, stops }, publish: true },
        })
      ).status(),
    ).toBe(400);
  const draft = await owner.patch(path, { data: { settings: design } });
  expect(draft.status()).toBe(200);
  expect((await draft.json()).token).toBeNull();
  const publish = await owner.patch(path, {
    data: { settings: design, publish: true },
  });
  expect(publish.status()).toBe(200);
  const token = (await publish.json()).token;
  const shared = await guest.get(`/api/itineraries/${token}`);
  expect(shared.status()).toBe(200);
  expect(shared.headers()["cache-control"]).toBe("no-store");
  const doc = await shared.json();
  expect(doc.date).toBe("");
  expect(doc.stops[0].address).toBe("");
  expect(doc.stops[0].budget).toBeNull();
  expect(doc.title).toBe(design.title);
  for (const privateValue of [
    "PRIVATE HOST NOTES",
    "owner_id",
    "participants",
    "@test.example",
  ])
    expect(JSON.stringify(doc)).not.toContain(privateValue);
  await owner.patch(path, {
    data: { settings: { ...design, title: "Private draft edits" } },
  });
  expect(
    (await (await guest.get(`/api/itineraries/${token}`)).json()).title,
  ).toBe(design.title);
  expect((await (await owner.get(path)).json()).settings.title).toBe(
    "Private draft edits",
  );
  const exported = await (await owner.get("/api/account/export")).json();
  expect(
    exported.itineraryDesigns.some(
      (d: { outing_id: string }) => d.outing_id === id,
    ),
  ).toBe(true);
  expect((await other.delete(path)).status()).toBe(404);
  await owner.delete(path);
  expect((await guest.get(`/api/itineraries/${token}`)).status()).toBe(404);
  const republish = await (
    await owner.patch(path, { data: { settings: design, publish: true } })
  ).json();
  expect(republish.token).not.toBe(token);
  await owner.delete(`/api/outings/${id}`);
  expect(
    (await guest.get(`/api/itineraries/${republish.token}`)).status(),
  ).toBe(404);
  await Promise.all([owner.dispose(), other.dispose(), guest.dispose()]);
});

test("Premium designer persists layouts, shares with guests, exports calendar and prints at mobile width", async ({
  page,
  browser,
}) => {
  await signup(page.request, "planui");
  const created = await page.request.post("/api/outings", { data: outing });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/premium");
  await expect(page.getByLabel("Itinerary title")).toBeEnabled();
  await page.getByLabel("Itinerary title").fill("A day to keep with friends");
  await page
    .getByLabel("A little introduction")
    .fill("Coffee first, a little art after.");
  await page
    .getByRole("combobox", { name: "Palette", exact: true })
    .selectOption("rose");
  await page
    .getByRole("combobox", { name: "Layout", exact: true })
    .selectOption("compact");
  await page.getByLabel("Start time", { exact: true }).first().fill("13:30");
  await page.getByLabel("Show my planned budgets").check();
  await page.getByLabel("My planned budget (₱)").first().fill("500");
  await page.getByRole("button", { name: "Move stop down" }).first().click();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Design saved");
  await page.reload();
  await expect(page.getByLabel("Itinerary title")).toHaveValue(
    "A day to keep with friends",
  );
  await expect(page.locator(".itinerary-sheet")).toHaveClass(
    /itinerary-compact itinerary-rose/,
  );
  expect(
    (await (await page.request.get(`/api/outings/${id}/itinerary`)).json())
      .settings.stops[0].placeId,
  ).toBe("the-gallery");
  await page
    .getByRole("button", { name: "Create share link", exact: true })
    .click();
  await expect(page.getByLabel("Shareable link")).toBeVisible();
  const link = await page.getByLabel("Shareable link").inputValue();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "docs/frontend/premium-designer-desktop.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/frontend/premium-designer-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".footer")).toBeHidden();
  expect(
    await page
      .locator(".main-shell")
      .evaluate((el) => getComputedStyle(el).marginLeft),
  ).toBe("0px");
  const hostPdf = await page.pdf({
    path: "docs/frontend/premium-designer-print.pdf",
    preferCSSPageSize: true,
  });
  expect(hostPdf.length).toBeGreaterThan(5000);
  await page.emulateMedia({ media: "screen" });
  const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    shared = await guest.newPage();
  await shared.goto(link);
  await expect(shared.getByRole("heading", { level: 1 })).toHaveText(
    "A day to keep with friends",
  );
  await shared.screenshot({
    path: "docs/frontend/premium-shared-mobile.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page: shared })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const download = shared.waitForEvent("download");
  await shared.getByRole("button", { name: "Add to calendar" }).click();
  const calendar = await download;
  expect(calendar.suggestedFilename()).toBe("dated-itinerary.ics");
  const calendarText = readFileSync((await calendar.path())!, "utf8");
  expect(calendarText).toContain("DTSTART;TZID=Asia/Manila:20261015T133000");
  expect(calendarText).toContain("DTEND;TZID=Asia/Manila:20261015T143000");
  expect(calendarText).not.toContain("PRIVATE HOST NOTES");
  await shared.emulateMedia({ media: "print" });
  await expect(shared.locator(".no-print").first()).toBeHidden();
  const pdf = await shared.pdf({
    path: "docs/frontend/premium-itinerary-print.pdf",
    preferCSSPageSize: true,
  });
  expect(pdf.length).toBeGreaterThan(5000);
  await page
    .getByRole("button", { name: "Turn off link", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create share link", exact: true }),
  ).toBeVisible();
  await shared.reload();
  await expect(shared.getByRole("heading", { level: 1 })).toHaveText(
    "This plan is no longer shared.",
  );
  expect(errors).toEqual([]);
  await guest.close();
});
