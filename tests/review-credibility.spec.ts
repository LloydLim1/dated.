import { test, expect, type APIRequestContext } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

test.beforeAll(async ({ request }) => {
  await request.get("/api/bootstrap");
  const db = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  db.prepare("DELETE FROM limits").run();
  db.close();
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
test("public ratings, detail explanations and cover photos respect their source and privacy", async ({
  browser,
  page,
}) => {
  await page.request.get(
    "/api/places/nearby?lat=14.557&lng=121.024&radius=1500",
  );
  const host = await browser.newContext({ baseURL: "http://127.0.0.1:3100" }),
    friend = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  await signup(host.request, "ratingone");
  await signup(friend.request, "ratingtwo");
  const placeId = "fixture-rating-" + stamp;
  const setupDb = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  const source = setupDb
    .prepare("SELECT data FROM places WHERE id=?")
    .get("osm-node-990001")!;
  const fixture = {
    ...JSON.parse(String(source.data)),
    id: placeId,
    name: "Fixture Review Kitchen",
  };
  setupDb
    .prepare("INSERT INTO places(id,data) VALUES(?,?)")
    .run(placeId, JSON.stringify(fixture));
  setupDb.close();
  const body = (visitDate: string, score: number, extra = {}) => ({
    placeId,
    title: "Our afternoon impression",
    body: "Good food and friendly service made this a pleasant afternoon visit.",
    visitDate,
    ratings: { Food: score, Atmosphere: score, Service: score, Value: score },
    visibility: "public",
    incentive: false,
    media: [],
    ...extra,
  });
  const older = await host.request.post("/api/reviews", {
    data: body("2026-09-01", 5),
  });
  expect(older.status()).toBe(201);
  const recent = await host.request.post("/api/reviews", {
    data: body("2026-10-02", 2),
  });
  expect(recent.status()).toBe(201);
  const promo = await host.request.post("/api/reviews", {
    data: body("2026-10-03", 5, { incentive: true }),
  });
  expect(promo.status()).toBe(201);
  const second = await friend.request.post("/api/reviews", {
    data: body("2026-10-02", 4),
  });
  expect(second.status()).toBe(201);
  const secondId = (await second.json()).id;
  const db = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  db.prepare("UPDATE reviews SET supported=1 WHERE id=?").run(secondId);
  let detail = await (await page.request.get(`/api/places/${placeId}`)).json();
  expect(detail.place).toMatchObject({
    rating: 3,
    ratedReviewerCount: 2,
    supportedReviewerCount: 1,
    independentVisits: 2,
  });
  const bootstrap = await (await page.request.get("/api/bootstrap")).json();
  expect(
    bootstrap.places.find((p: { id: string }) => p.id === placeId).rating,
  ).toBe(detail.place.rating);
  db.prepare("UPDATE reviews SET hidden=1 WHERE id=?").run(secondId);
  detail = await (await page.request.get(`/api/places/${placeId}`)).json();
  expect(detail.place).toMatchObject({
    rating: 2,
    ratedReviewerCount: 1,
    supportedReviewerCount: 0,
  });
  db.prepare("UPDATE reviews SET hidden=0 WHERE id=?").run(secondId);
  db.close();
  const media = await host.request.post("/api/uploads", {
    multipart: {
      kind: "photo",
      file: {
        name: "fixture-cafe.jpg",
        mimeType: "image/jpeg",
        buffer: readFileSync("public/images/cafe.jpg"),
      },
    },
  });
  expect(media.status()).toBe(201);
  const photoId = (await media.json()).id;
  const postBody = {
    placeId,
    caption: "A public cover fixture.",
    visitDate: "2026-10-02",
    visibility: "private",
    media: [photoId],
  };
  const post = await host.request.post("/api/posts", { data: postBody });
  expect(post.status()).toBe(201);
  const postId = (await post.json()).id;
  await page.goto(`/explore?place=${placeId}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".detail-photo-cover .cover-credit")).toHaveText(
    "Illustrative photo",
  );
  await expect(page.locator(".rating-transparency")).toContainText(
    "2 independent reviewers",
  );
  await expect(page.locator(".rating-transparency")).toContainText(
    "Early impressions",
  );
  await page.getByText("How the score works", { exact: true }).click();
  await expect(page.locator(".rating-transparency details")).toContainText(
    "latest public, non-incentivized visit",
  );
  await page
    .getByRole("combobox", { name: "Show experiences" })
    .selectOption("supported");
  await expect(page.locator(".detail-review")).toHaveCount(1);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/frontend/review-credibility-desktop.png",
  });
  await host.request.patch(`/api/posts/${postId}`, {
    data: { ...postBody, visibility: "public" },
  });
  await page.reload();
  await expect(page.locator(".detail-photo-cover .cover-credit")).toHaveText(
    "Visitor photo",
  );
  await expect(
    page.locator(".detail-photo-cover .place-photo-cover > img"),
  ).toHaveAttribute("src", `/api/media/${photoId}`);
  await host.request.patch(`/api/posts/${postId}`, { data: postBody });
  await page.reload();
  await expect(page.locator(".detail-photo-cover .cover-credit")).toHaveText(
    "Illustrative photo",
  );
  expect((await page.request.get(`/api/media/${photoId}`)).status()).toBe(404);
  for (const [context, response] of [
    [host, older],
    [host, recent],
    [host, promo],
    [friend, second],
  ] as const) {
    const id = response === second ? secondId : (await response.json()).id;
    await context.request.delete(`/api/reviews/${id}`);
  }
  await host.request.delete(`/api/posts/${postId}`);
  const cleanupDb = new DatabaseSync(resolve(".data-test", "dated.sqlite"));
  cleanupDb.prepare("DELETE FROM places WHERE id=?").run(placeId);
  cleanupDb.close();
  await host.close();
  await friend.close();
});
