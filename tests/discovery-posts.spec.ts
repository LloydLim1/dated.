import { test, expect, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";

test.beforeAll(async ({ request }) => {
  await request.get("/api/bootstrap");
  const db = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  db.prepare("DELETE FROM limits").run();
  db.close();
});
const stamp = Date.now().toString(36);
async function signup(request: APIRequestContext, name: string) {
  const response = await request.post("/api/auth/signup", {
    data: {
      email: name + stamp + "@test.example",
      username: name + stamp,
      name: name + " Explorer",
      password: "test-long-password-123",
      adult: true,
      terms: true,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).me;
}
async function upload(request: APIRequestContext, color = "#b7cba0") {
  const buffer = await sharp({
    create: { width: 800, height: 700, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  const response = await request.post("/api/uploads", {
    multipart: {
      file: { name: "visit.png", mimeType: "image/png", buffer },
      kind: "photo",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id;
}
test("nearby search imports node and way places, preserves IDs, and rejects invalid searches", async ({
  request,
}) => {
  const response = await request.get(
    "/api/places/nearby?lat=14.557&lng=121.024&radius=1500",
  );
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.places).toHaveLength(3);
  expect(result.places[0]).toMatchObject({
    id: "osm-node-990001",
    sample: false,
    budgetKnown: false,
    name: "Fixture Garden Kitchen",
  });
  expect(result.places[1]).toMatchObject({
    id: "osm-way-990002",
    category: "Café",
    lat: 14.558,
  });
  expect(result.places[2]).toMatchObject({
    id: "osm-node-990005",
    category: "Museum",
    sample: false,
  });
  expect((await request.get("/api/places/osm-node-990001")).status()).toBe(200);
  const repeated = await (
    await request.get("/api/places/nearby?lat=14.557&lng=121.024&radius=1500")
  ).json();
  expect(repeated.fetchedAt).toBe(result.fetchedAt);
  for (const query of [
    "lat=91&lng=0",
    "lat=0&lng=abc",
    "lat=0&lng=0&radius=100000",
    "lng=0",
  ])
    expect((await request.get("/api/places/nearby?" + query)).status()).toBe(
      400,
    );
});
test("photo posts enforce ownership, privacy, attachment order, interactions, editing and deletion", async ({
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
  const me = await signup(owner, "photoowner");
  await signup(other, "photofriend");
  const photos = [await upload(owner), await upload(owner, "#d7ba90")];
  const body = {
    placeId: "osm-node-990001",
    caption: "A little afternoon worth keeping.",
    visitDate: "2026-10-01",
    visibility: "private",
    media: photos,
  };
  expect((await guest.post("/api/posts", { data: body })).status()).toBe(401);
  expect((await other.post("/api/posts", { data: body })).status()).toBe(400);
  expect(
    (await owner.post("/api/posts", { data: { ...body, media: [] } })).status(),
  ).toBe(400);
  expect(
    (
      await owner.post("/api/posts", {
        data: { ...body, media: [photos[0], photos[0]] },
      })
    ).status(),
  ).toBe(400);
  const created = await owner.post("/api/posts", { data: body });
  expect(created.status()).toBe(201);
  const postId = (await created.json()).id;
  const store = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  store
    .prepare("UPDATE media SET created_at=? WHERE post_id=?")
    .run(Date.now() - 2 * 86400000, postId);
  store.close();
  execFileSync(process.execPath, ["scripts/maintenance.mjs"], {
    env: { ...process.env, DATED_DATA_DIR: ".data-test" },
  });
  expect((await owner.get("/api/media/" + photos[0])).status()).toBe(200);
  expect((await owner.post("/api/posts", { data: body })).status()).toBe(400);
  expect(
    (await other.patch("/api/posts/" + postId, { data: body })).status(),
  ).toBe(404);
  expect((await guest.get("/api/media/" + photos[0])).status()).toBe(404);
  expect((await other.get("/api/media/" + photos[0])).status()).toBe(404);
  expect((await owner.get("/api/media/" + photos[0])).status()).toBe(200);
  expect(
    (await (await guest.get("/api/bootstrap")).json()).posts.some(
      (p: { id: string }) => p.id === postId,
    ),
  ).toBe(false);
  expect(
    (
      await owner.patch("/api/posts/" + postId, {
        data: {
          ...body,
          visibility: "followers",
          media: [...photos].reverse(),
        },
      })
    ).ok(),
  ).toBe(true);
  expect((await other.get("/api/media/" + photos[0])).status()).toBe(404);
  expect(
    (await other.post("/api/follows", { data: { userId: me.id } })).ok(),
  ).toBe(true);
  expect((await other.get("/api/media/" + photos[0])).status()).toBe(200);
  await other.post("/api/follows", { data: { userId: me.id } });
  expect((await other.get("/api/media/" + photos[0])).status()).toBe(404);
  await other.post("/api/follows", { data: { userId: me.id } });
  expect(
    (await other.post(`/api/posts/${postId}/reactions`, { data: {} })).ok(),
  ).toBe(true);
  expect(
    (
      await other.post(`/api/posts/${postId}/comments`, {
        data: { body: "Lovely pictures!" },
      })
    ).status(),
  ).toBe(201);
  let post = (await (await owner.get("/api/bootstrap")).json()).posts.find(
    (p: { id: string }) => p.id === postId,
  );
  expect(post.media).toEqual([...photos].reverse());
  expect(post.likes).toBe(1);
  expect(post.comments[0].body).toBe("Lovely pictures!");
  expect((await other.delete("/api/posts/" + postId)).status()).toBe(404);
  expect(
    (
      await owner.patch("/api/posts/" + postId, {
        data: { ...body, visibility: "public", media: [photos[0]] },
      })
    ).ok(),
  ).toBe(true);
  expect((await guest.get("/api/media/" + photos[0])).status()).toBe(200);
  expect((await owner.get("/api/media/" + photos[1])).status()).toBe(404);
  const exported = await (await owner.get("/api/account/export")).json();
  expect(exported.posts.some((p: { id: string }) => p.id === postId)).toBe(
    true,
  );
  post = (
    await (await guest.get("/api/places/osm-node-990001")).json()
  ).posts.find((p: { id: string }) => p.id === postId);
  expect(post.caption).toBe(body.caption);
  expect((await owner.delete("/api/posts/" + postId)).ok()).toBe(true);
  expect((await guest.get("/api/media/" + photos[0])).status()).toBe(404);
  for (const context of [owner, other, guest]) await context.dispose();
});
test("map to photo journal works on mobile with an accessible gallery", async ({
  page,
}) => {
  await signup(page.request, "photobrowser");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/map");
  await page.getByRole("button", { name: "Restaurants", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Open Fixture Garden Kitchen",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Explore Fixture Garden Kitchen",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Post photos here" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Where was this?")).toHaveValue(
    "osm-node-990001",
  );
  const buffer = await sharp("public/images/cafe.jpg")
    .resize(800)
    .png()
    .toBuffer();
  const meal = await sharp("public/images/restaurant.jpg")
    .resize(800)
    .png()
    .toBuffer();
  await dialog.getByLabel("Choose journal photos").setInputFiles([
    { name: "garden.png", mimeType: "image/png", buffer },
    { name: "meal.png", mimeType: "image/png", buffer: meal },
  ]);
  await dialog.getByLabel(/Caption/).fill("Lunch in the garden.");
  await dialog.getByLabel("Who can see this?").selectOption("public");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Post photos", exact: true })
    .click();
  await expect(dialog).toContainText("Moments at Fixture Garden Kitchen");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page
    .getByRole("button", { name: "View photo post at Fixture Garden Kitchen" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Lunch in the garden.");
  await page.getByRole("button", { name: "Next photo" }).click();
  await expect(page.getByRole("dialog")).toContainText("2 / 2");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({ path: "test-results/journal-mobile.png" });
});
test("unavailable upstream returns a useful retry state", async ({
  request,
  page,
}) => {
  await page.route("**/api/places/nearby?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Restaurant discovery could not connect. Check your connection and try again.",
      }),
    }),
  );
  await page.goto("/map");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Restaurant discovery could not connect" }),
  ).toContainText("Restaurant discovery could not connect");
  await expect(
    page.getByRole("button", { name: "Retry this area" }),
  ).toBeEnabled();
  expect(
    (await request.get("/api/places/nearby?lat=0&lng=0&radius=300")).status(),
  ).toBe(503);
  const fallback = await request.get(
    "/api/places/nearby?lat=14.558&lng=121.024&radius=300",
  );
  expect(fallback.status()).toBe(200);
  expect(await fallback.json()).toMatchObject({
    stale: true,
    places: expect.arrayContaining([
      expect.objectContaining({ id: "osm-node-990001" }),
    ]),
  });
});

test("users can rate a real restaurant without published menus or spending", async ({
  page,
}) => {
  const request = page.request;
  const me = await signup(request, "norprice");
  await request.get("/api/places/nearby?lat=14.557&lng=121.024&radius=1500");
  await page.goto("/map");
  await page
    .getByRole("button", {
      name: "Explore Fixture Garden Kitchen",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "You can still rate your visit",
  );
  await page
    .getByRole("button", { name: "Write a review", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await expect(form.getByLabel("Spent per person (₱, optional)")).toHaveValue(
    "",
  );
  expect(
    await form
      .getByLabel("Spent per person (₱, optional)")
      .getAttribute("required"),
  ).toBeNull();
  await form.getByRole("button", { name: "Close dialog" }).click();
  const data = {
    placeId: "osm-node-990001",
    title: "Lunch worth sharing",
    body: "A pleasant lunch with attentive service and a welcoming dining room.",
    visitDate: "2026-10-02",
    ratings: { Food: 4, Atmosphere: 5, Service: 4, Value: 4 },
    visibility: "public",
    incentive: false,
    media: [],
  };
  const response = await request.post("/api/reviews", { data });
  expect(response.status()).toBe(201);
  const id = (await response.json()).id;
  let state = await (await request.get("/api/bootstrap")).json();
  expect(state.feed.find((r: { id: string }) => r.id === id)).toMatchObject({
    spending: null,
    author: { id: me.id },
  });
  expect(
    state.places.find((p: { id: string }) => p.id === data.placeId).rating,
  ).toBe(4.25);
  expect(
    (
      await request.patch("/api/reviews/" + id, {
        data: { ...data, spending: 0 },
      })
    ).status(),
  ).toBe(200);
  state = await (await request.get("/api/bootstrap")).json();
  expect(state.feed.find((r: { id: string }) => r.id === id).spending).toBe(0);
  expect((await request.post("/api/catalog/refresh")).status()).toBe(403);
  expect((await request.get("/api/logos/invalid")).status()).toBe(404);
});

test("mapped museums support admission, category ratings and place-linked photo journals", async ({
  page,
}) => {
  const request = page.request;
  await signup(request, "museumvisitor");
  await page.goto("/explore?place=osm-node-990005");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Admission & visiting");
  await expect(dialog).toContainText("Admission hasn’t been confirmed yet.");
  await expect(
    dialog.getByRole("link", { name: "View menu", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Write a review", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Exhibits");
  await expect(page.getByRole("dialog")).toContainText("Accessibility");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const review = await request.post("/api/reviews", {
    data: {
      placeId: "osm-node-990005",
      title: "An afternoon of history",
      body: "The exhibits gave us plenty to talk about after our afternoon visit.",
      visitDate: "2026-10-02",
      ratings: { Exhibits: 5, Accessibility: 4, Experience: 5, Value: 4 },
      visibility: "public",
      incentive: false,
      media: [],
    },
  });
  expect(review.status()).toBe(201);
  const media = await upload(request);
  const post = await request.post("/api/posts", {
    data: {
      placeId: "osm-node-990005",
      caption: "A museum memory.",
      visitDate: "2026-10-02",
      visibility: "public",
      media: [media],
    },
  });
  expect(post.status()).toBe(201);
  await page.goto("/explore?place=osm-node-990005");
  await page
    .getByRole("button", { name: "View photo post at Fixture Heritage Museum" })
    .last()
    .click();
  await expect(page.getByRole("dialog").last()).toContainText(
    "A museum memory.",
  );
});
