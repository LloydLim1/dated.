import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initializeCommerce,
  createCommerce,
  CommerceError,
} from "../src/lib/commerce-core.mjs";
import { matchesDiscovery } from "../src/lib/discovery-filters.mjs";
import { criteriaVersion } from "../src/lib/review-criteria.mjs";

function setup(file = ":memory:") {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,username TEXT,demo INTEGER DEFAULT 0);
    CREATE TABLE places(id TEXT PRIMARY KEY,data TEXT);
    CREATE TABLE reviews(id TEXT PRIMARY KEY,author_id TEXT REFERENCES users(id),place_id TEXT REFERENCES places(id),title TEXT,body TEXT,visit_date TEXT,ratings TEXT,visibility TEXT,incentive INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,demo INTEGER DEFAULT 0,spending INTEGER DEFAULT 0,spending_known INTEGER DEFAULT 0,created_at INTEGER);
  `);
  initializeCommerce(db);
  let time = Date.parse("2026-10-15T05:00:00Z");
  const core = createCommerce(db, { now: () => time });
  const users = ["customer", "owner", "admin", "outsider", "staff"].map(
    (role) => ({
      id: randomUUID(),
      name: role,
      username: role,
      role: role === "admin" ? "admin" : "member",
    }),
  );
  for (const user of users)
    db.prepare("INSERT INTO users VALUES(?,?,?,0)").run(
      user.id,
      user.name,
      user.username,
    );
  const [customer, owner, admin, outsider, staff] = users;
  const place = {
    id: "restaurant-a",
    name: "Restaurant A",
    category: "Restaurant",
    city: "Makati",
    budget: 400,
    budgetKnown: true,
    tags: ["Date night"],
    lat: 14.55,
    lng: 121.02,
    sample: false,
    rating: 4.5,
    ratedReviewerCount: 5,
  };
  db.prepare("INSERT INTO places VALUES(?,?)").run(
    place.id,
    JSON.stringify(place),
  );
  const orgId = core.createOrganization(owner, "Neighborhood Dining").id;
  const claimId = core.claimBranch(owner, {
    orgId,
    placeId: place.id,
    contact: "owner@example.test",
    evidence: "Verified business phone and registration, reviewed by operator.",
  }).id;
  core.decide(admin, {
    kind: "claim",
    entityId: claimId,
    action: "approve",
    reason: "Business identity and authorized representative verified.",
  });
  function review(
    body = "Food arrived cold, and the service took a long time. This visit was disappointing.",
    ratings = { Food: 1, Service: 1, Value: 2 },
    date = "2026-10-15",
  ) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO reviews(id,author_id,place_id,title,body,visit_date,ratings,visibility,created_at,reward_opt_in) VALUES(?,?,?,?,?,?,?,?,?,1)",
    ).run(
      id,
      customer.id,
      place.id,
      "Experience",
      body,
      date,
      JSON.stringify(ratings),
      "public",
      time,
    );
    core.requestReward(customer, id);
    return id;
  }
  function activate() {
    const invoice = core.requestInvoice(owner, orgId, randomUUID());
    core.decide(admin, {
      kind: "invoice",
      entityId: invoice.id,
      action: "approve",
      reason: "Verified external payment reference PAY-TEST-001",
    });
    return invoice;
  }
  function offer(stock = 1, cost = 20) {
    const id = core.createOffer(owner, {
      orgId,
      placeId: place.id,
      title: "Coffee on your next visit",
      description: "A partner-funded discount for a future visit.",
      coinCost: cost,
      benefit: "PHP 50 discount",
      minSpend: 200,
      stock,
      startsAt: time - 1000,
      endsAt: time + 7 * 86400000,
      validDays: 30,
      terms:
        "Minimum spend PHP 200. One voucher per transaction. Valid at this branch only.",
      funding: "Partner-funded discount",
    }).id;
    core.decide(admin, {
      kind: "offer",
      entityId: id,
      action: "approve",
      reason: "Partner funding and redemption conditions confirmed.",
    });
    return id;
  }
  return {
    db,
    core,
    customer,
    owner,
    admin,
    outsider,
    staff,
    place,
    orgId,
    review,
    activate,
    offer,
    advance: (n) => {
      time += n;
    },
  };
}

test("negative experience earns coins once and deletion/reposting cannot earn again", () => {
  const t = setup();
  const id = t.review();
  t.core.processRewards();
  t.core.processRewards();
  assert.equal(t.core.balance(t.customer.id), 20);
  t.core.requestReward(t.customer, id);
  t.core.processRewards();
  assert.equal(t.core.balance(t.customer.id), 20);
  t.db
    .prepare("UPDATE reward_claims SET review_id=NULL WHERE review_id=?")
    .run(id);
  t.db.prepare("DELETE FROM reviews WHERE id=?").run(id);
  t.review();
  t.core.processRewards();
  assert.equal(t.core.balance(t.customer.id), 20);
  t.db.close();
});

test("private or merchant incentivized reviews cannot automatically earn", () => {
  const t = setup();
  const id = t.review();
  t.db.prepare("UPDATE reviews SET visibility='private' WHERE id=?").run(id);
  t.core.processRewards();
  assert.equal(t.core.balance(t.customer.id), 0);
  assert.equal(t.core.wallet(t.customer).claims[0].status, "rejected");
  t.db.close();
});

test("voucher issue is atomic and retry-safe, and another claim cannot overspend", () => {
  const t = setup();
  t.review();
  t.core.processRewards();
  const offerId = t.offer();
  const key = randomUUID();
  const first = t.core.claimVoucher(t.customer, offerId, key);
  const retry = t.core.claimVoucher(t.customer, offerId, key);
  assert.equal(first.voucher.id, retry.voucher.id);
  assert.equal(t.core.balance(t.customer.id), 0);
  assert.equal(
    t.db.prepare("SELECT stock FROM voucher_offers WHERE id=?").get(offerId)
      .stock,
    0,
  );
  assert.throws(
    () => t.core.claimVoucher(t.customer, offerId, randomUUID()),
    CommerceError,
  );
  assert.equal(
    t.db.prepare("SELECT count(*) count FROM customer_vouchers").get().count,
    1,
  );
  assert.throws(
    () => t.core.claimVoucher(t.customer, "another-offer", key),
    (e) => e.status === 409,
  );
  t.db.close();
});

test("unauthorized staff cannot redeem; owner can redeem once after subscription expires", () => {
  const t = setup();
  t.review();
  t.core.processRewards();
  t.activate();
  const offerId = t.offer();
  const voucher = t.core.claimVoucher(
    t.customer,
    offerId,
    randomUUID(),
  ).voucher;
  assert.throws(
    () => t.core.previewRedemption(t.outsider, t.orgId, voucher.code),
    (e) => e.status === 403,
  );
  t.advance(31 * 86400000);
  // Make only the subscription expire, not the voucher being honored.
  t.db
    .prepare("UPDATE customer_vouchers SET expires_at=? WHERE id=?")
    .run(Date.now() + 366 * 86400000, voucher.id);
  assert.equal(t.core.active(t.orgId), false);
  const key = randomUUID();
  t.core.redeem(t.owner, t.orgId, voucher.code, key);
  assert.equal(t.core.redeem(t.owner, t.orgId, voucher.code, key).ok, true);
  assert.throws(
    () => t.core.redeem(t.owner, t.orgId, voucher.code, randomUUID()),
    (e) => e.status === 409,
  );
  t.db.close();
});

test("a failed balance check preserves offer stock and does not issue a voucher", () => {
  const t = setup();
  const offerId = t.offer();
  assert.throws(
    () => t.core.claimVoucher(t.customer, offerId, randomUUID()),
    (e) => e.status === 409,
  );
  assert.equal(
    t.db.prepare("SELECT stock FROM voucher_offers WHERE id=?").get(offerId)
      .stock,
    1,
  );
  assert.equal(
    t.db.prepare("SELECT count(*) count FROM coin_ledger").get().count,
    0,
  );
  t.db.close();
});

test("billing state is operator-verified, scoped and cancellation preserves paid access", () => {
  const t = setup();
  const invoice = t.core.requestInvoice(t.owner, t.orgId, randomUUID());
  assert.equal(t.core.active(t.orgId), false);
  assert.throws(
    () =>
      t.core.decide(t.owner, {
        kind: "invoice",
        entityId: invoice.id,
        action: "approve",
        reason: "Fake payment confirmation",
      }),
    (e) => e.status === 403,
  );
  t.core.decide(t.admin, {
    kind: "invoice",
    entityId: invoice.id,
    action: "approve",
    reason: "Confirmed independent payment reference PAY-982",
  });
  t.core.cancelSubscription(t.owner, t.orgId);
  assert.equal(t.core.active(t.orgId), true);
  assert.throws(
    () => t.core.report(t.outsider, t.orgId, t.place.id, 1, Date.now()),
    (e) => e.status === 403,
  );
  t.advance(31 * 86400000);
  assert.equal(t.core.active(t.orgId), false);
  t.db.close();
});

test("ads require active billing and only use the supplied matching candidates", () => {
  const t = setup();
  t.activate();
  const campaign = t.core.campaign(t.owner, {
    orgId: t.orgId,
    placeId: t.place.id,
    title: "Dinner in your neighborhood",
    body: "Explore the menu before your next visit.",
    startsAt: Date.parse("2026-10-15"),
    endsAt: Date.parse("2026-11-15"),
  });
  t.core.decide(t.admin, {
    kind: "campaign",
    entityId: campaign.id,
    action: "approve",
    reason: "Creative and location details reviewed.",
  });
  assert.deepEqual(t.core.sponsored([], "viewer-key", {}), []);
  assert.equal(t.core.sponsored([t.place], "viewer-key", {}).length, 1);
  assert.equal(t.core.sponsored([t.place], "viewer-key", {}).length, 0);
  t.advance(31 * 86400000);
  assert.deepEqual(t.core.sponsored([t.place], "another-viewer", {}), []);
  t.db.close();
});

test("shared discovery filters reject unknown facts and preserve budget meaning", () => {
  const t = setup();
  assert.equal(matchesDiscovery(t.place, { category: "Cinema" }), false);
  assert.equal(
    matchesDiscovery(t.place, {
      budget: 500,
      groupSize: 2,
      budgetBasis: "total",
    }),
    false,
  );
  assert.equal(
    matchesDiscovery({ ...t.place, budgetKnown: false }, { budget: 500 }),
    false,
  );
  assert.equal(
    matchesDiscovery({ ...t.place, rating: null }, { minRating: 4 }),
    false,
  );
  assert.equal(
    matchesDiscovery(t.place, {
      criterion: "Cleanliness",
      criterionMinimum: 4,
    }),
    false,
  );
  assert.equal(
    matchesDiscovery(t.place, {
      city: "Makati",
      category: "Restaurant",
      budget: 500,
    }),
    true,
  );
  t.db.close();
});

test("category versions preserve legacy combined dimensions and support not applicable", () => {
  assert.equal(
    criteriaVersion("Cinema", {
      "Picture & sound": 4,
      Comfort: 4,
      Cleanliness: 4,
      Value: 4,
    }),
    1,
  );
  assert.equal(
    criteriaVersion(
      "Cinema",
      {
        "Screen quality": 4,
        "Sound quality": 3,
        "Seating comfort": 4,
        Cleanliness: 5,
      },
      ["Value for money"],
    ),
    2,
  );
  assert.equal(
    criteriaVersion("Cinema", { "Screen quality": 4 }, ["Unknown"]),
    0,
  );
});

test("branch managers cannot create or pause offers and ads for another assigned location", () => {
  const t = setup();
  t.activate();
  const second = { ...t.place, id: "restaurant-b" };
  t.db
    .prepare("INSERT INTO places VALUES(?,?)")
    .run(second.id, JSON.stringify(second));
  const claim = t.core.claimBranch(t.owner, {
    orgId: t.orgId,
    placeId: second.id,
    contact: "owner@example.test",
    evidence:
      "Independent branch verification evidence reviewed by operations.",
  });
  t.core.decide(t.admin, {
    kind: "claim",
    entityId: claim.id,
    action: "approve",
    reason: "This operating branch was verified independently.",
  });
  t.core.invite(t.owner, {
    orgId: t.orgId,
    username: t.staff.username,
    role: "manager",
    branchId: t.place.id,
  });
  const invitation = t.core.wallet(t.staff).invitations[0];
  t.core.acceptInvite(t.staff, invitation.id);
  assert.throws(
    () => t.core.createOffer(t.staff, { orgId: t.orgId, placeId: second.id }),
    (e) => e.status === 403,
  );
  assert.throws(
    () => t.core.campaign(t.staff, { orgId: t.orgId, placeId: second.id }),
    (e) => e.status === 403,
  );
  const campaign = t.core.campaign(t.owner, {
    orgId: t.orgId,
    placeId: second.id,
    title: "A new neighborhood experience",
    body: "Explore this verified location in Makati.",
    startsAt: Date.parse("2026-10-15T00:00:00Z"),
    endsAt: Date.parse("2026-11-01T00:00:00Z"),
  });
  assert.throws(
    () => t.core.pauseCampaign(t.staff, campaign.id),
    (e) => e.status === 403,
  );
  t.db.close();
});

test("business affiliation and sample venues cannot receive contribution coins", () => {
  const t = setup();
  t.core.invite(t.owner, {
    orgId: t.orgId,
    username: t.customer.username,
    role: "analyst",
    branchId: t.place.id,
  });
  t.core.acceptInvite(t.customer, t.core.wallet(t.customer).invitations[0].id);
  const review = t.review();
  t.core.processRewards();
  assert.equal(t.core.balance(t.customer.id), 0);
  assert.equal(t.core.wallet(t.customer).claims[0].status, "rejected");
  assert.throws(() =>
    t.core.decide(t.admin, {
      kind: "reward",
      entityId: t.core.wallet(t.customer).claims[0].id,
      action: "approve",
      reason:
        "An appeal cannot override independent contribution requirements.",
    }),
  );
  assert.ok(review);
  t.db.close();
});

test("maintenance archives a complete Manila month once and reports compare equal periods", () => {
  const t = setup();
  t.activate();
  t.review();
  t.core.event(t.customer, {
    placeId: t.place.id,
    kind: "place_open",
    session: t.customer.id,
  });
  t.core.event(t.customer, {
    placeId: t.place.id,
    kind: "place_open",
    session: t.customer.id,
  });
  t.core.maintenance();
  t.core.maintenance();
  assert.equal(
    t.db.prepare("SELECT count(*) n FROM report_snapshots").get().n,
    1,
  );
  const report = t.core.report(
    t.owner,
    t.orgId,
    t.place.id,
    Date.parse("2026-10-01T00:00:00Z"),
    Date.parse("2026-10-16T00:00:00Z"),
  );
  assert.equal(report.sampleSize, 1);
  assert.equal(report.previous.sampleSize, 0);
  assert.equal(report.discovery.views, 1);
  assert.equal(report.averageSpending, null);
  t.db.close();
});

test("two concurrent database connections cannot spend the final voucher twice", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dated-voucher-race-")),
    file = join(dir, "race.sqlite");
  const t = setup(file);
  t.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000");
  const offerId = t.offer(1, 20);
  for (const user of [t.customer, t.outsider])
    t.db
      .prepare("INSERT INTO coin_ledger VALUES(?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        user.id,
        20,
        "earn",
        randomUUID(),
        "Test race funding",
        Date.now(),
      );
  const workers = [t.customer, t.outsider].map(
    (user) =>
      new Worker(
        new URL("./helpers/voucher-race-worker.mjs", import.meta.url),
        { workerData: { file, user, offerId } },
      ),
  );
  try {
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise((resolve, reject) => {
            worker.once("message", resolve);
            worker.once("error", reject);
          }),
      ),
    );
    const results = workers.map(
      (worker) =>
        new Promise((resolve, reject) => {
          worker.once("message", resolve);
          worker.once("error", reject);
          worker.postMessage("go");
        }),
    );
    const outcomes = await Promise.all(results);
    assert.equal(outcomes.filter((r) => r.ok).length, 1);
    assert.equal(
      t.db.prepare("SELECT stock FROM voucher_offers WHERE id=?").get(offerId)
        .stock,
      0,
    );
    assert.equal(
      t.db.prepare("SELECT count(*) n FROM customer_vouchers").get().n,
      1,
    );
    assert.equal(
      t.core.balance(t.customer.id) + t.core.balance(t.outsider.id),
      20,
    );
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
    t.db.close();
    for (const name of readdirSync(dir)) unlinkSync(join(dir, name));
    rmdirSync(dir);
  }
});

test("reward appeal restoration and voucher refund recover a restricted wallet without duplicate credit", () => {
  const t = setup();
  t.review();
  t.core.processRewards();
  const claim = t.core.wallet(t.customer).claims[0];
  const voucher = t.core.claimVoucher(t.customer, t.offer(), randomUUID());
  const decision = (kind, entityId, action) =>
    t.core.decide(t.admin, {
      kind,
      entityId,
      action,
      reason: "Operator reviewed the contribution and documented its recovery.",
    });
  decision("reward", claim.id, "reverse");
  assert.equal(t.core.balance(t.customer.id), -20);
  assert.throws(
    () => decision("wallet", t.customer.id, "approve"),
    (e) => e.status === 409,
  );
  decision("reward", claim.id, "approve");
  assert.equal(t.core.balance(t.customer.id), 0);
  assert.throws(
    () => decision("reward", claim.id, "approve"),
    (e) => e.status === 409,
  );
  decision("wallet", t.customer.id, "approve");
  assert.equal(t.core.wallet(t.customer).restricted, null);
  decision("reward", claim.id, "reverse");
  decision("voucher", voucher.voucher.id, "reject");
  decision("wallet", t.customer.id, "approve");
  assert.equal(t.core.balance(t.customer.id), 0);
  t.db.close();
});
