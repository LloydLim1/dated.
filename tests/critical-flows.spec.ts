import { test, expect, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  await request.get("/api/bootstrap");
  await request.dispose();
  const db = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  db.prepare("DELETE FROM limits").run();
  db.close();
});
const stamp = Date.now().toString(36);
async function account(request: APIRequestContext, name: string) {
  const username = name + stamp;
  const r = await request.post("/api/auth/signup", {
    data: {
      email: username + "@test.example",
      username,
      name: name + " Explorer",
      password: "test-long-password-123",
      adult: true,
      terms: true,
    },
  });
  expect(r.status()).toBe(201);
  return { username, me: (await r.json()).me };
}
const review = (visibility = "private") => ({
  placeId: "fern-and-fable",
  title: "A thoughtful test experience",
  body: "A quiet afternoon with a good cup of coffee and a pleasant garden view.",
  visitDate: "2026-10-01",
  ratings: { "Coffee & drinks": 5, Atmosphere: 4, Service: 3, Value: 4 },
  spending: 400,
  visibility,
  incentive: false,
  media: [],
});
test("accounts, collections, reviews, privacy, consent, and authorization", async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    b = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    guest = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
  const alice = await account(a, "alice"),
    bob = await account(b, "bob");
  let state = await (await a.get("/api/bootstrap")).json();
  const collectionId = state.collections[0].id;
  expect(
    (
      await b.post("/api/collections/items", {
        data: { collectionId, placeId: "fern-and-fable" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await a.post("/api/collections/items", {
        data: { collectionId, placeId: "fern-and-fable" },
      })
    ).ok(),
  ).toBeTruthy();
  state = await (await a.get("/api/bootstrap")).json();
  expect(state.collections[0].placeIds).toContain("fern-and-fable");
  const created = await a.post("/api/reviews", { data: review() });
  expect(created.status()).toBe(201);
  const rid = (await created.json()).id;
  expect((await a.post("/api/reviews", { data: review() })).status()).toBe(409);
  expect(
    (await b.patch("/api/reviews/" + rid, { data: review() })).status(),
  ).toBe(404);
  expect(
    (await (await guest.get("/api/bootstrap")).json()).feed.some(
      (r: { id: string }) => r.id === rid,
    ),
  ).toBeFalsy();
  expect(
    (
      await b.post("/api/reviews/" + rid + "/comments", {
        data: { body: "Can I see this?" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await a.patch("/api/reviews/" + rid, { data: review("followers") })).ok(),
  ).toBeTruthy();
  expect(
    (await (await b.get("/api/bootstrap")).json()).feed.some(
      (r: { id: string }) => r.id === rid,
    ),
  ).toBeFalsy();
  await b.post("/api/follows", { data: { userId: alice.me.id } });
  expect(
    (await (await b.get("/api/bootstrap")).json()).feed.some(
      (r: { id: string }) => r.id === rid,
    ),
  ).toBeTruthy();
  await a.patch("/api/reviews/" + rid, { data: review("public") });
  expect(
    (await (await guest.get("/api/bootstrap")).json()).feed.some(
      (r: { id: string }) => r.id === rid,
    ),
  ).toBeTruthy();
  const out = await a.post("/api/outings", {
    data: {
      title: "Consent test outing",
      date: "2026-10-12",
      visibility: "public",
      notes: "A day together.",
      stops: ["fern-and-fable", "the-gallery"],
      invitees: [bob.username],
    },
  });
  expect(out.status()).toBe(201);
  const oid = (await out.json()).id;
  let publicOut = (
    await (await guest.get("/api/bootstrap")).json()
  ).outings.find((o: { id: string }) => o.id === oid);
  expect(publicOut.participants).toHaveLength(0);
  const invites = (await (await b.get("/api/bootstrap")).json()).invitations;
  const invite = invites.find((i: { outingId: string }) => i.outingId === oid);
  expect(
    (
      await a.post("/api/invitations/" + invite.id, {
        data: { status: "accepted", visibility: "public" },
      })
    ).status(),
  ).toBe(404);
  await b.post("/api/invitations/" + invite.id, {
    data: { status: "accepted", visibility: "private" },
  });
  publicOut = (await (await guest.get("/api/bootstrap")).json()).outings.find(
    (o: { id: string }) => o.id === oid,
  );
  expect(publicOut.participants).toHaveLength(0);
  await b.post("/api/invitations/" + invite.id, {
    data: { status: "accepted", visibility: "public" },
  });
  publicOut = (await (await guest.get("/api/bootstrap")).json()).outings.find(
    (o: { id: string }) => o.id === oid,
  );
  expect(publicOut.participants[0].user.id).toBe(bob.me.id);
  await b.post("/api/invitations/" + invite.id, {
    data: { status: "declined", visibility: "private" },
  });
  publicOut = (await (await guest.get("/api/bootstrap")).json()).outings.find(
    (o: { id: string }) => o.id === oid,
  );
  expect(publicOut.participants).toHaveLength(0);
  expect(
    (
      await b.patch("/api/outings/" + oid, { data: { completed: true } })
    ).status(),
  ).toBe(404);
  expect((await b.get("/api/moderation")).status()).toBe(403);
  expect(
    (
      await a.post("/api/follows", {
        headers: { origin: "https://other.example" },
        data: { userId: bob.me.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await a.delete("/api/account", { data: { password: "wrong" } })).status(),
  ).toBe(401);
  expect((await a.get("/api/account/export")).ok()).toBeTruthy();
  await a.delete("/api/account", {
    data: { password: "test-long-password-123" },
  });
  expect((await (await a.get("/api/bootstrap")).json()).me).toBeNull();
  await b.delete("/api/account", {
    data: { password: "test-long-password-123" },
  });
  await a.dispose();
  await b.dispose();
  await guest.dispose();
});
test("private evidence is separated from review photos", async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    guest = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
  await account(a, "media");
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const evidence = await a.post("/api/uploads", {
    multipart: {
      kind: "evidence",
      file: { name: "receipt.png", mimeType: "image/png", buffer: png },
    },
  });
  expect(evidence.status()).toBe(201);
  const eid = (await evidence.json()).id;
  const photo = await a.post("/api/uploads", {
    multipart: {
      kind: "photo",
      file: { name: "photo.png", mimeType: "image/png", buffer: png },
    },
  });
  expect(photo.status()).toBe(201);
  const mid = (await photo.json()).id;
  const r = await a.post("/api/reviews", {
    data: { ...review("public"), media: [mid], evidence: eid },
  });
  expect(r.status()).toBe(201);
  expect((await guest.get("/api/media/" + eid)).status()).toBe(404);
  expect((await a.get("/api/media/" + eid)).status()).toBe(200);
  expect((await guest.get("/api/media/" + mid)).status()).toBe(200);
  const feed = (await (await guest.get("/api/bootstrap")).json()).feed;
  // The public response never includes an evidence identifier or an automatic badge.
  const own = (await (await a.get("/api/bootstrap")).json()).feed.find(
    (r: { evidence?: string }) => r.evidence === eid,
  );
  const publicReview = feed.find((r: { id: string }) => r.id === own.id);
  expect(publicReview.evidence).toBeUndefined();
  expect(publicReview.supported).toBeFalsy();
  expect(
    (
      await a.post("/api/uploads", {
        multipart: {
          kind: "photo",
          file: {
            name: "not-an-image.png",
            mimeType: "image/png",
            buffer: Buffer.from("invalid"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  await a.delete("/api/account", {
    data: { password: "test-long-password-123" },
  });
  expect((await guest.get("/api/media/" + mid)).status()).toBe(404);
  await a.dispose();
  await guest.dispose();
});
test("discovery, registration, save, and responsive browser journeys", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Go somewhere. Feel something." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fern & Fable", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find your next place" }).click();
  await page.getByRole("button", { name: "Cafés", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Casa Luna", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Little Sunday", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Budget per person").selectOption("400");
  await page.getByRole("button", { name: "Show matching places" }).click();
  await expect(
    page.getByRole("heading", { name: "Paper Cup Studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Little Sunday", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save Paper Cup Studio", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Your name", { exact: true })
    .fill("Browser Explorer");
  await dialog.getByLabel("Username", { exact: true }).fill("browser" + stamp);
  await dialog
    .getByLabel("Email address")
    .fill("browser" + stamp + "@test.example");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-long-password-123");
  await dialog.getByLabel("I confirm I am 18 or older.").check();
  await dialog.locator("input[name=terms]").check();
  await dialog.getByRole("button", { name: "Make yourself at home" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save Paper Cup Studio", exact: true })
    .click();
  await page.getByRole("button", { name: /Want to go 0 places/ }).click();
  await expect(page.getByRole("status")).toContainText("Saved to Want to go");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /Saved places/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Paper Cup Studio", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Go somewhere. Feel something." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Explore", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore Fern & Fable", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.request.delete("/api/account", {
    data: { password: "test-long-password-123" },
  });
});
test("moderation records decisions, protects evidence, and supports appeals", async ({
  playwright,
}) => {
  const author = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    mod = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    guest = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
  await account(author, "author");
  const moderator = await account(mod, "moderator");
  const store = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  store
    .prepare("UPDATE users SET role='admin' WHERE id=?")
    .run(moderator.me.id);
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const upload = await author.post("/api/uploads", {
    multipart: {
      kind: "evidence",
      file: { name: "ticket.png", mimeType: "image/png", buffer: png },
    },
  });
  const evidence = (await upload.json()).id;
  const created = await author.post("/api/reviews", {
    data: { ...review("public"), evidence },
  });
  expect(created.status()).toBe(201);
  const rid = (await created.json()).id;
  expect((await mod.get("/api/media/" + evidence)).status()).toBe(200);
  expect((await author.get("/api/moderation")).status()).toBe(403);
  expect(
    (
      await mod.post("/api/moderation", {
        data: {
          reviewId: rid,
          action: "support",
          reason: "Ticket date and venue were assessed.",
        },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await (await guest.get("/api/bootstrap")).json()).feed.find(
      (r: { id: string }) => r.id === rid,
    ).supported,
  ).toBeTruthy();
  expect(
    (
      await mod.post("/api/reviews/" + rid + "/reports", {
        data: { reason: "Please investigate misleading content." },
      })
    ).status(),
  ).toBe(201);
  await mod.post("/api/moderation", {
    data: {
      reviewId: rid,
      action: "hide",
      reason: "Hidden pending clarification of a material claim.",
    },
  });
  expect(
    (await (await guest.get("/api/bootstrap")).json()).feed.some(
      (r: { id: string }) => r.id === rid,
    ),
  ).toBeFalsy();
  expect(
    (
      await author.post("/api/reviews/" + rid + "/appeals", {
        data: { reason: "I can clarify the information in my experience." },
      })
    ).status(),
  ).toBe(201);
  await mod.post("/api/moderation", {
    data: {
      reviewId: rid,
      action: "restore",
      reason: "Author clarification resolved the report.",
    },
  });
  const state = await (await mod.get("/api/moderation")).json();
  expect(
    state.actions.filter((r: { review_id: string }) => r.review_id === rid),
  ).toHaveLength(3);
  expect(
    state.appeals.find((r: { review_id: string }) => r.review_id === rid)
      .status,
  ).toBe("resolved");
  store
    .prepare("UPDATE media SET expires=? WHERE id=?")
    .run(Date.now() - 1000, evidence);
  expect((await author.get("/api/media/" + evidence)).status()).toBe(404);
  store.close();
  await author.delete("/api/account", {
    data: { password: "test-long-password-123" },
  });
  await mod.delete("/api/account", {
    data: { password: "test-long-password-123" },
  });
  await author.dispose();
  await mod.dispose();
  await guest.dispose();
});
test("browser review and multi-stop outing journal", async ({ page }) => {
  await account(page.request, "journal");
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Write a review", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Give your experience a title")
    .fill("A day worth remembering");
  await dialog
    .getByLabel("Your story", { exact: true })
    .fill(
      "The coffee was lovely and the garden made a quiet afternoon feel special.",
    );
  for (const criterion of ["Coffee & drinks", "Atmosphere", "Service", "Value"])
    await dialog
      .getByRole("button", { name: criterion + " 4 stars", exact: true })
      .click();
  await dialog.getByLabel("Who can see this?").selectOption("private");
  await dialog.getByRole("button", { name: "Keep in my journal" }).click();
  await expect(
    page.getByRole("heading", { name: "A day worth remembering" }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "My outings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Plan an outing", exact: true })
    .first()
    .click();
  const outing = page.getByRole("dialog");
  await outing
    .getByLabel("Give your day a name")
    .fill("Our little city afternoon");
  await outing.getByLabel("When are we going?").fill("2026-10-02");
  await outing.getByRole("button", { name: "Add stop", exact: true }).click();
  await outing
    .getByRole("combobox", { name: "Add a place", exact: true })
    .selectOption("the-gallery");
  await outing.getByRole("button", { name: "Add stop", exact: true }).click();
  await outing.getByRole("button", { name: "Create my outing" }).click();
  await expect(
    page.getByRole("heading", { name: "Our little city afternoon" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark as visited" }).click();
  await page
    .getByRole("button", { name: "Review this stop", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Date of your visit")).toHaveValue("2026-10-02");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.request.post("/api/auth/logout", { data: {} });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Our little city afternoon" }),
  ).toHaveCount(0);
  await page.request.post("/api/auth/login", {
    data: {
      email: "journal" + stamp + "@test.example",
      password: "test-long-password-123",
    },
  });
  await page.request.delete("/api/account", {
    data: { password: "test-long-password-123" },
  });
});
