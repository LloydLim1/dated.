import { test, expect, type APIRequestContext } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const stamp = Date.now().toString(36);
async function signup(request: APIRequestContext, name: string) {
  const response = await request.post("/api/auth/signup", {
    data: {
      email: `${name}${stamp}@journey.test`,
      username: name + stamp,
      name: name + " Journey",
      password: "a-strong-testing-password-15",
      adult: true,
      terms: true,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).me;
}
const post = async (
  request: APIRequestContext,
  path: string,
  data: unknown,
) => {
  const response = await request.post("/api/" + path, {
    data,
    headers: { "Idempotency-Key": randomUUID() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
};

test("customer coins, partner vouchers, owner reports, filter-matched ads and mobile workspaces", async ({
  page,
  playwright,
  browser,
}) => {
  test.setTimeout(120000);
  await page.request.get("/api/bootstrap");
  const db = new DatabaseSync(resolve(".data-test/dated.sqlite"));
  db.prepare("DELETE FROM limits").run();
  const base = JSON.parse(
    String(db.prepare("SELECT data FROM places LIMIT 1").get()!.data),
  );
  const placeId = "journey-place-" + stamp;
  db.prepare("INSERT OR REPLACE INTO places VALUES(?,?)").run(
    placeId,
    JSON.stringify({
      ...base,
      id: placeId,
      name: "Atlas Journey Café " + stamp,
      category: "Café",
      city: "Makati",
      sample: false,
      lat: 14.55,
      lng: 121.02,
      budget: 350,
      budgetKnown: true,
      tags: ["Date night"],
      rating: null,
      reviewCount: 0,
    }),
  );
  const customer = await signup(page.request, "customer");
  const owner = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    operator = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
  await signup(owner, "owner");
  const admin = await signup(operator, "operator");
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.id);
  const organization = await post(owner, "business/organizations", {
    name: "Atlas Neighborhood Places",
  });
  const claim = await post(owner, "business/claims", {
    orgId: organization.id,
    placeId,
    contact: "business@example.test",
    evidence:
      "Test-only verification details for an isolated integration fixture.",
  });
  expect(
    (
      await owner.post("/api/operations/decision", {
        data: {
          kind: "claim",
          entityId: claim.id,
          action: "approve",
          reason: "Unauthorized ownership approval attempt",
        },
      })
    ).status(),
  ).toBe(403);
  await post(operator, "operations/decision", {
    kind: "claim",
    entityId: claim.id,
    action: "approve",
    reason: "Test operator verified isolated fixture ownership.",
  });
  const invoice = await post(owner, "business/billing/checkout", {
    orgId: organization.id,
  });
  expect(
    (await (await owner.get("/api/business")).json()).organizations[0].active,
  ).toBe(false);
  await post(operator, "operations/decision", {
    kind: "invoice",
    entityId: invoice.id,
    action: "approve",
    reason: "Verified test-only payment reference QA-PLATFORM-01",
  });
  const offer = await post(owner, "business/offers", {
    orgId: organization.id,
    placeId,
    title: "A little off your next coffee",
    description: "A reviewed partner voucher for a future visit.",
    coinCost: 20,
    benefit: "PHP 50 off",
    minSpend: 200,
    stock: 2,
    startsAt: Date.now() - 3600000,
    endsAt: Date.now() + 86400000 * 30,
    validDays: 30,
    terms: "Minimum spend PHP 200. This location only. Present before payment.",
    funding: "Partner-funded discount",
  });
  await post(operator, "operations/decision", {
    kind: "offer",
    entityId: offer.id,
    action: "approve",
    reason: "Partner funds and voucher terms verified in test.",
  });
  const review = await post(page.request, "reviews", {
    placeId,
    title: "Honest feedback from a visit",
    body: "The coffee tasted good, but the table was uncomfortable and the service was slow during our visit.",
    visitDate: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    ratings: {
      "Food & drinks": 4,
      Service: 2,
      "Ambiance & comfort": 2,
      Cleanliness: 4,
      "Value for money": 3,
    },
    spending: 350,
    visibility: "public",
    incentive: false,
    rewardOptIn: true,
    notApplicable: [],
    media: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/wallet");
  await expect(page.getByText("Your DATED coins")).toBeVisible();
  await expect(page.locator(".wallet-balance>strong")).toContainText("20");
  await page
    .getByRole("button", { name: /20 coins/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Use 20 coins" }).click();
  const codeInput = page.getByRole("textbox", { name: "Your voucher code" });
  await expect(codeInput).toBeVisible();
  const code = await codeInput.inputValue();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Your DATED workspaces" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Planning studio", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/planning/);
  await page.getByRole("button", { name: "Your journal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your year, in places." }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/places/" + placeId)).json()).place
      .rating,
  ).toBe(3);
  const preview = await post(owner, "business/redemptions/preview", {
    orgId: organization.id,
    code,
  });
  expect(preview.status).toBe("issued");
  await post(owner, "business/redemptions/confirm", {
    orgId: organization.id,
    code,
  });
  expect(
    (
      await owner.post("/api/business/redemptions/confirm", {
        data: { orgId: organization.id, code },
        headers: { "Idempotency-Key": randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const campaign = await post(owner, "business/campaigns", {
    orgId: organization.id,
    placeId,
    title: "Coffee for your next city afternoon",
    body: "See what visitors say about our Makati branch.",
    startsAt: Date.now() - 1000,
    endsAt: Date.now() + 86400000 * 30,
  });
  await post(operator, "operations/decision", {
    kind: "campaign",
    entityId: campaign.id,
    action: "approve",
    reason: "Ad content and branch identity reviewed for test.",
  });
  const matching = await page.request.get(
    "/api/discovery?category=Caf%C3%A9&city=Makati&budget=400&query=" +
      encodeURIComponent("Atlas Journey Café " + stamp),
  );
  expect((await matching.json()).sponsored).toHaveLength(1);
  const mismatch = await page.request.get(
    "/api/discovery?category=Cinema&city=Makati&query=" +
      encodeURIComponent("Atlas Journey Café " + stamp),
  );
  expect((await mismatch.json()).sponsored).toHaveLength(0);
  const ownerContext = await browser.newContext({
      storageState: await owner.storageState(),
      viewport: { width: 1440, height: 1000 },
    }),
    ownerPage = await ownerContext.newPage();
  await ownerPage.goto("/business");
  await ownerPage.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    ownerPage.getByRole("heading", { name: "What the experience feels like" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page: ownerPage })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  mkdirSync("docs/frontend/revised-platform", { recursive: true });
  await ownerPage.screenshot({
    path: "docs/frontend/revised-platform/business-reports-desktop.png",
    fullPage: true,
  });
  await page.goto("/wallet");
  await page.getByRole("button", { name: "My vouchers", exact: true }).click();
  await expect(page.getByText("redeemed", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "docs/frontend/revised-platform/wallet-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const walletScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(walletScan.violations).toEqual([]);
  expect(review.id).toBeTruthy();
  expect(customer.id).toBeTruthy();
  await ownerContext.close();
  await owner.dispose();
  await operator.dispose();
  db.close();
});

test("group planning keeps exact expense splits and rejects outsiders", async ({
  playwright,
  request,
}) => {
  await request.get("/api/bootstrap");
  const db = new DatabaseSync(resolve(".data-test/dated.sqlite"));
  db.prepare("DELETE FROM limits").run();
  db.close();
  const a = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    b = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
  const host = await signup(a, "grouphost"),
    guest = await signup(b, "groupguest");
  const outing = await post(a, "outings", {
    title: "A shared afternoon",
    date: "2026-10-15",
    visibility: "private",
    notes: "Private planning",
    stops: ["fern-and-fable"],
    invitees: [guest.username],
  });
  expect((await b.get("/api/planning/" + outing.id)).status()).toBe(403);
  const invitation = (
    await (await b.get("/api/bootstrap")).json()
  ).invitations.find((i: { outingId: string }) => i.outingId === outing.id);
  await post(b, "invitations/" + invitation.id, {
    status: "accepted",
    visibility: "private",
  });
  await post(a, "planning/" + outing.id + "/expenses", {
    title: "Coffee for two",
    amount: 10001,
    paidBy: host.id,
    participants: [host.id, guest.id],
  });
  const group = await (await b.get("/api/planning/" + outing.id)).json();
  expect(group.settlement.transfers[0].amount).toBeGreaterThanOrEqual(5000);
  expect(
    group.expenses[0].shares.reduce(
      (sum: number, s: { amount: number }) => sum + s.amount,
      0,
    ),
  ).toBe(10001);
  expect(
    (
      await b.post("/api/planning/" + outing.id + "/budget", {
        data: { total: 10000, allocations: {} },
      })
    ).status(),
  ).toBe(403);
  await post(b, "planning/" + outing.id + "/proposals", {
    placeId: "common-table",
  });
  const proposed = (await (await a.get("/api/planning/" + outing.id)).json())
    .proposals[0];
  expect(
    (
      await b.post("/api/planning/" + outing.id + "/adopt", {
        data: { proposalId: proposed.id },
      })
    ).status(),
  ).toBe(403);
  await post(a, "planning/" + outing.id + "/adopt", {
    proposalId: proposed.id,
  });
  await post(a, "planning/" + outing.id + "/adopt", {
    proposalId: proposed.id,
  });
  const updated = (await (await a.get("/api/bootstrap")).json()).outings.find(
    (o: { id: string }) => o.id === outing.id,
  );
  expect(updated.stops).toHaveLength(2);
  await a.dispose();
  await b.dispose();
});

test("collection snapshots can be revoked; search links restore filters; Street View uses confirmed pins", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await page.request.get("/api/bootstrap");
  const db = new DatabaseSync(resolve(".data-test/dated.sqlite"));
  db.prepare("DELETE FROM limits").run();
  const base = JSON.parse(
    String(db.prepare("SELECT data FROM places LIMIT 1").get()!.data),
  );
  const known = {
    ...base,
    id: "street-known-" + stamp,
    name: "A real pin for Street View " + stamp,
    category: "Café",
    city: "Makati",
    lat: 14.55,
    lng: 121.02,
    sample: false,
  };
  const unknown = {
    ...known,
    id: "street-unknown-" + stamp,
    name: "An address without a pin " + stamp,
    lat: null,
    lng: null,
  };
  for (const place of [known, unknown])
    db.prepare("INSERT INTO places VALUES(?,?)").run(
      place.id,
      JSON.stringify(place),
    );
  db.close();
  await signup(page.request, "collector");
  const collection = await post(page.request, "collections", {
    name: "Quiet afternoons " + stamp,
  });
  await post(page.request, "collections/items", {
    collectionId: collection.id,
    placeId: known.id,
  });
  await page.goto("/saved");
  await page
    .getByRole("button", { name: new RegExp("Quiet afternoons " + stamp) })
    .click();
  await page.getByRole("button", { name: "Sharing", exact: true }).click();
  await page
    .getByRole("button", { name: "Create shared link", exact: true })
    .click();
  const shareInput = page.getByRole("textbox", {
    name: "Shared collection link",
  });
  await expect(shareInput).toBeVisible();
  const link = await shareInput.inputValue();
  const guest = await browser.newContext(),
    publicPage = await guest.newPage();
  await publicPage.goto(link);
  await expect(
    publicPage.getByRole("heading", {
      name: collection.name || "Quiet afternoons " + stamp,
    }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("heading", { name: known.name }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Turn off sharing", exact: true })
    .click();
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", {
      name: "This collection is no longer shared.",
    }),
  ).toBeVisible();
  await page.goto(
    "/explore?search=1&category=Caf%C3%A9&city=Makati&budget=700&minRating=4&groupSize=2&budgetBasis=total",
  );
  await page
    .getByRole("button", { name: /Filters/ })
    .first()
    .click();
  await expect(page.getByLabel("People", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Budget applies to")).toHaveValue("total");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.goto("/explore?place=" + known.id);
  const street = page.getByRole("link", {
    name: new RegExp("Street View near " + known.name),
  });
  await expect(street).toHaveAttribute(
    "href",
    /map_action=pano.*viewpoint=14.55%2C121.02/,
  );
  await expect(street).toHaveAttribute("target", "_blank");
  await page.goto("/explore?place=" + unknown.id);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Street View near/ }),
  ).toHaveCount(0);
  await page.goto("/map");
  await expect(page.locator(".map-street-view-control a")).toHaveAttribute(
    "href",
    /map_action=pano/,
  );
  await page.screenshot({
    path: "docs/frontend/revised-platform/map-street-view-desktop.png",
  });
  await guest.close();
});
