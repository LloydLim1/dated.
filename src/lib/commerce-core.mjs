import { randomUUID, randomBytes, createHash } from "node:crypto";

const day = 86400000;
const uid = () => randomUUID();
const hash = (value) => createHash("sha256").update(value).digest("hex");
export class CommerceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const ensure = (condition, message, status = 400) => {
  if (!condition) throw new CommerceError(status, message);
};
const parse = (value, fallback = {}) => {
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};
const bounded = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export function initializeCommerce(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_orgs(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS business_members(org_id TEXT REFERENCES business_orgs(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('owner','manager','analyst','staff')),branch_id TEXT,PRIMARY KEY(org_id,user_id));
    CREATE TABLE IF NOT EXISTS business_claims(id TEXT PRIMARY KEY,org_id TEXT REFERENCES business_orgs(id),place_id TEXT REFERENCES places(id),contact TEXT NOT NULL,evidence TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS business_branches(place_id TEXT PRIMARY KEY REFERENCES places(id),org_id TEXT NOT NULL REFERENCES business_orgs(id),verified_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS business_place_details(place_id TEXT PRIMARY KEY REFERENCES places(id),org_id TEXT NOT NULL REFERENCES business_orgs(id),hours TEXT NOT NULL,description TEXT NOT NULL,budget INTEGER,tags TEXT NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS business_invoices(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES business_orgs(id),amount INTEGER NOT NULL,currency TEXT DEFAULT 'PHP',status TEXT NOT NULL DEFAULT 'pending',reference TEXT,created_at INTEGER NOT NULL,paid_at INTEGER);
    CREATE TABLE IF NOT EXISTS business_subscriptions(org_id TEXT PRIMARY KEY REFERENCES business_orgs(id),status TEXT NOT NULL DEFAULT 'inactive',period_end INTEGER NOT NULL DEFAULT 0,cancel_at_end INTEGER NOT NULL DEFAULT 0,source TEXT NOT NULL DEFAULT 'manual',updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS business_invites(id TEXT PRIMARY KEY,org_id TEXT REFERENCES business_orgs(id),username TEXT NOT NULL,role TEXT NOT NULL,branch_id TEXT,status TEXT DEFAULT 'pending',created_at INTEGER NOT NULL,UNIQUE(org_id,username));
    CREATE TABLE IF NOT EXISTS reward_claims(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,review_id TEXT REFERENCES reviews(id) ON DELETE SET NULL,visit_key TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,rule_version INTEGER DEFAULT 1,created_at INTEGER NOT NULL,decided_at INTEGER);
    CREATE TABLE IF NOT EXISTS coin_ledger(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,amount INTEGER NOT NULL,kind TEXT NOT NULL,source TEXT NOT NULL UNIQUE,note TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wallet_restrictions(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reward_appeals(id TEXT PRIMARY KEY,claim_id TEXT REFERENCES reward_claims(id),user_id TEXT REFERENCES users(id) ON DELETE SET NULL,reason TEXT NOT NULL,status TEXT DEFAULT 'open',created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS voucher_offers(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES business_orgs(id),place_id TEXT NOT NULL REFERENCES places(id),title TEXT NOT NULL,description TEXT NOT NULL,coin_cost INTEGER NOT NULL CHECK(coin_cost>0),benefit TEXT NOT NULL,min_spend INTEGER NOT NULL DEFAULT 0,stock INTEGER NOT NULL CHECK(stock>=0),starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,valid_days INTEGER NOT NULL DEFAULT 30,terms TEXT NOT NULL,funding TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS customer_vouchers(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,offer_id TEXT REFERENCES voucher_offers(id),org_id TEXT NOT NULL REFERENCES business_orgs(id),place_id TEXT NOT NULL REFERENCES places(id),snapshot TEXT NOT NULL,code TEXT NOT NULL UNIQUE,code_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'issued',expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,redeemed_at INTEGER,redeemed_by TEXT REFERENCES users(id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS commerce_requests(actor_id TEXT NOT NULL,key TEXT NOT NULL,operation TEXT NOT NULL,payload_hash TEXT NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(actor_id,key,operation));
    CREATE TABLE IF NOT EXISTS ad_campaigns(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES business_orgs(id),place_id TEXT NOT NULL REFERENCES places(id),title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT,starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ad_deliveries(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES ad_campaigns(id),place_id TEXT NOT NULL REFERENCES places(id),viewer_key TEXT NOT NULL,context TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS discovery_events(id TEXT PRIMARY KEY,place_id TEXT NOT NULL REFERENCES places(id),actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,kind TEXT NOT NULL,delivery_id TEXT REFERENCES ad_deliveries(id),dedupe TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS report_snapshots(id TEXT PRIMARY KEY,org_id TEXT REFERENCES business_orgs(id),place_id TEXT REFERENCES places(id),period_start INTEGER NOT NULL,period_end INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,data TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(place_id,period_start,period_end,version));
    CREATE TABLE IF NOT EXISTS commerce_jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL,lease_until INTEGER,payload TEXT NOT NULL,last_error TEXT,UNIQUE(kind,entity_id));
    CREATE INDEX IF NOT EXISTS reward_user ON reward_claims(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS ledger_user ON coin_ledger(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS offers_active ON voucher_offers(status,ends_at);
    CREATE INDEX IF NOT EXISTS vouchers_user ON customer_vouchers(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS events_place ON discovery_events(place_id,created_at,kind);
    CREATE INDEX IF NOT EXISTS campaigns_active ON ad_campaigns(status,ends_at);
    CREATE INDEX IF NOT EXISTS jobs_due ON commerce_jobs(status,available_at);
  `);
  const columns = db.prepare("PRAGMA table_info(reviews)").all();
  for (const [name, type] of [
    ["criteria_version", "INTEGER NOT NULL DEFAULT 1"],
    ["not_applicable", "TEXT NOT NULL DEFAULT '[]'"],
    ["reward_opt_in", "INTEGER NOT NULL DEFAULT 0"],
    ["business_relationship", "INTEGER NOT NULL DEFAULT 0"],
  ]) {
    if (!columns.some((c) => c.name === name))
      db.exec(`ALTER TABLE reviews ADD COLUMN ${name} ${type}`);
  }
}

/** Transactional domain service. Public methods authorize their own actor and tenant scope. */
export function createCommerce(db, options = {}) {
  const now = options.now || (() => Date.now());
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const tx = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const member = (
    actor,
    orgId,
    roles = ["owner", "manager", "analyst", "staff"],
  ) => {
    const record = get(
      "SELECT * FROM business_members WHERE org_id=? AND user_id=?",
      orgId,
      actor.id,
    );
    ensure(
      record && roles.includes(record.role),
      "You do not have permission for this business.",
      403,
    );
    return record;
  };
  const admin = (actor) =>
    ensure(
      actor?.role === "admin",
      "This action requires an administrator.",
      403,
    );
  const branch = (orgId, placeId) =>
    ensure(
      get(
        "SELECT 1 FROM business_branches WHERE org_id=? AND place_id=?",
        orgId,
        placeId,
      ),
      "Verify this branch before continuing.",
      403,
    );
  const active = (orgId) =>
    !!get(
      "SELECT 1 FROM business_subscriptions WHERE org_id=? AND status='active' AND period_end>?",
      orgId,
      now(),
    );
  const manageBranch = (actor, orgId, placeId) => {
    const membership = member(actor, orgId, ["owner", "manager"]);
    branch(orgId, placeId);
    ensure(
      !membership.branch_id || membership.branch_id === placeId,
      "This location is outside your assigned branch.",
      403,
    );
    return membership;
  };
  const audit = (actor, action, entityId, reason) =>
    run(
      "INSERT INTO commerce_audit VALUES(?,?,?,?,?,?)",
      uid(),
      actor.id,
      action,
      entityId,
      reason,
      now(),
    );
  const config = () => ({
    rewardCoins: bounded(
      get("SELECT value FROM commerce_config WHERE key='rewardCoins'")?.value,
      1,
      1000,
      20,
    ),
    dailyReviews: bounded(
      get("SELECT value FROM commerce_config WHERE key='dailyReviews'")?.value,
      1,
      20,
      5,
    ),
    rewardsPaused:
      get("SELECT value FROM commerce_config WHERE key='rewardsPaused'")
        ?.value === "true",
    spendingPaused:
      get("SELECT value FROM commerce_config WHERE key='spendingPaused'")
        ?.value === "true",
    adsPaused:
      get("SELECT value FROM commerce_config WHERE key='adsPaused'")?.value ===
      "true",
    checkoutPaused:
      get("SELECT value FROM commerce_config WHERE key='checkoutPaused'")
        ?.value === "true",
    monthlyPrice: bounded(options.monthlyPrice, 1, 100000, 499),
  });
  const balance = (userId) =>
    Number(
      get(
        "SELECT coalesce(sum(amount),0) balance FROM coin_ledger WHERE user_id=?",
        userId,
      )?.balance || 0,
    );
  const idempotent = (actor, key, operation, payload, fn) => {
    ensure(
      typeof key === "string" && key.length >= 8 && key.length <= 128,
      "A valid request key is required.",
    );
    const digest = hash(JSON.stringify(payload));
    const previous = get(
      "SELECT * FROM commerce_requests WHERE actor_id=? AND key=? AND operation=?",
      actor.id,
      key,
      operation,
    );
    if (previous) {
      ensure(
        previous.payload_hash === digest,
        "This request key has already been used for a different action.",
        409,
      );
      return parse(previous.result);
    }
    const result = fn();
    run(
      "INSERT INTO commerce_requests VALUES(?,?,?,?,?,?)",
      actor.id,
      key,
      operation,
      digest,
      JSON.stringify(result),
      now(),
    );
    return result;
  };
  const publicPlace = (placeId) => {
    const record = get("SELECT data FROM places WHERE id=?", placeId);
    if (!record) return null;
    const place = parse(record.data);
    const details = get(
      "SELECT d.* FROM business_place_details d JOIN business_branches b ON b.place_id=d.place_id AND b.org_id=d.org_id WHERE d.place_id=?",
      placeId,
    );
    return details
      ? {
          ...place,
          hours: details.hours || place.hours,
          description: details.description || place.description,
          tags: parse(details.tags, []),
          ...(details.budget === null
            ? {}
            : {
                budget: details.budget,
                budgetKnown: true,
                budgetSource: "owner",
              }),
          ownerUpdatedAt: details.updated_at,
        }
      : place;
  };
  const offerView = (record) => ({
    ...record,
    place: publicPlace(record.place_id),
    available:
      record.status === "active" &&
      record.starts_at <= now() &&
      record.ends_at > now() &&
      record.stock > 0,
  });
  const voucherView = (record, includeCode = false) => {
    const { code, code_hash, ...safe } = record;
    void code_hash;
    return {
      ...safe,
      snapshot: parse(record.snapshot),
      status:
        record.status === "issued" && record.expires_at <= now()
          ? "expired"
          : record.status,
      ...(includeCode ? { code } : {}),
    };
  };

  const service = {
    config,
    active,
    balance,
    member,
    publicPlace,
    isBusinessReviewer(userId, placeId) {
      return !!get(
        "SELECT 1 FROM business_members m JOIN business_branches b ON b.org_id=m.org_id WHERE m.user_id=? AND b.place_id=?",
        userId,
        placeId,
      );
    },
    wallet(actor) {
      return {
        balance: balance(actor.id),
        pending: Number(
          get(
            "SELECT coalesce(sum(amount),0) total FROM reward_claims WHERE user_id=? AND status='pending'",
            actor.id,
          )?.total || 0,
        ),
        restricted:
          get(
            "SELECT reason FROM wallet_restrictions WHERE user_id=?",
            actor.id,
          )?.reason || null,
        entries: all(
          "SELECT id,amount,kind,note,created_at FROM coin_ledger WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
          actor.id,
        ),
        claims: all(
          "SELECT id,review_id,amount,status,reason,created_at FROM reward_claims WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
          actor.id,
        ),
        vouchers: all(
          "SELECT * FROM customer_vouchers WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
          actor.id,
        ).map((v) => voucherView(v, true)),
        offers: service.offers(),
        invitations: all(
          "SELECT i.id,i.role,i.branch_id,o.name FROM business_invites i JOIN business_orgs o ON o.id=i.org_id WHERE i.username=? AND i.status='pending'",
          actor.username,
        ),
        rules: config(),
      };
    },
    offers() {
      return all(
        "SELECT * FROM voucher_offers WHERE status='active' AND starts_at<=? AND ends_at>? AND stock>0 ORDER BY created_at DESC LIMIT 100",
        now(),
        now(),
      ).map(offerView);
    },
    // Called inside the review transaction: award work and content cannot diverge.
    requestReward(actor, reviewId) {
      const review = get(
        "SELECT * FROM reviews WHERE id=? AND author_id=?",
        reviewId,
        actor.id,
      );
      if (!review || !review.reward_opt_in || actor.demo) return null;
      const visitKey = hash(
        `${actor.id}|${review.place_id}|${review.visit_date}`,
      );
      const existing = get(
        "SELECT * FROM reward_claims WHERE visit_key=? OR review_id=?",
        visitKey,
        reviewId,
      );
      if (existing) return existing;
      const values = Object.values(parse(review.ratings));
      const eligible =
        !publicPlace(review.place_id)?.sample &&
        !service.isBusinessReviewer(actor.id, review.place_id) &&
        review.visibility === "public" &&
        !review.incentive &&
        !review.hidden &&
        !review.demo &&
        values.filter((v) => Number(v) >= 1 && Number(v) <= 5).length >= 3 &&
        String(review.body).trim().length >= 40;
      const claimId = uid();
      const reason = eligible
        ? "Waiting for contribution checks."
        : "Rewards need a public independent review, at least three scored criteria, and 40 characters describing your visit.";
      run(
        "INSERT INTO reward_claims(id,user_id,review_id,visit_key,amount,status,reason,created_at) VALUES(?,?,?,?,?,?,?,?)",
        claimId,
        actor.id,
        reviewId,
        visitKey,
        config().rewardCoins,
        eligible ? "pending" : "rejected",
        reason,
        now(),
      );
      if (eligible)
        run(
          "INSERT OR IGNORE INTO commerce_jobs(id,kind,entity_id,available_at,payload) VALUES(?,?,?,?,?)",
          uid(),
          "review_reward",
          claimId,
          now(),
          "{}",
        );
      return get("SELECT * FROM reward_claims WHERE id=?", claimId);
    },
    processRewards() {
      if (config().rewardsPaused) return { processed: 0 };
      let processed = 0;
      for (const job of all(
        "SELECT * FROM commerce_jobs WHERE kind='review_reward' AND status IN ('pending','retry') AND available_at<=? LIMIT 50",
        now(),
      )) {
        tx(() => {
          const claim = get(
            "SELECT * FROM reward_claims WHERE id=?",
            job.entity_id,
          );
          if (!claim || claim.status !== "pending") {
            run("UPDATE commerce_jobs SET status='done' WHERE id=?", job.id);
            return;
          }
          const review = get(
            "SELECT * FROM reviews WHERE id=?",
            claim.review_id,
          );
          let reason =
            "Contribution checks completed. Your rating does not affect your reward.";
          let eligible =
            !publicPlace(review?.place_id || "")?.sample &&
            !service.isBusinessReviewer(
              claim.user_id,
              review?.place_id || "",
            ) &&
            review &&
            review.visibility === "public" &&
            !review.incentive &&
            !review.hidden &&
            !review.demo &&
            review.reward_opt_in &&
            String(review.body).trim().length >= 40 &&
            Object.values(parse(review.ratings)).filter(
              (v) => Number(v) >= 1 && Number(v) <= 5,
            ).length >= 3;
          if (!eligible)
            reason =
              "The review is no longer eligible. You can appeal this decision.";
          const start = new Date(now() + 8 * 3600000)
            .toISOString()
            .slice(0, 10);
          const awarded = all(
            "SELECT created_at FROM reward_claims WHERE user_id=? AND status='approved'",
            claim.user_id,
          ).filter(
            (r) =>
              new Date(r.created_at + 8 * 3600000)
                .toISOString()
                .slice(0, 10) === start,
          ).length;
          if (awarded >= config().dailyReviews) {
            eligible = false;
            reason = "The daily reward limit has been reached.";
          }
          const duplicate =
            review &&
            get(
              "SELECT id FROM reviews WHERE author_id=? AND id!=? AND body=? AND demo=0",
              claim.user_id,
              review.id,
              review.body,
            );
          if (duplicate) {
            eligible = false;
            reason =
              "This text duplicates another review. Share a specific account of this visit and appeal.";
          }
          if (eligible)
            run(
              "INSERT OR IGNORE INTO coin_ledger VALUES(?,?,?,?,?,?,?)",
              uid(),
              claim.user_id,
              claim.amount,
              "earn",
              "reward:" + claim.id,
              "Coins for an eligible experience review",
              now(),
            );
          run(
            "UPDATE reward_claims SET status=?,reason=?,decided_at=? WHERE id=?",
            eligible ? "approved" : "rejected",
            reason,
            now(),
            claim.id,
          );
          run(
            "UPDATE commerce_jobs SET status='done',attempts=attempts+1 WHERE id=?",
            job.id,
          );
          processed++;
        });
      }
      return { processed };
    },
    appeal(actor, claimId, reason) {
      ensure(
        get(
          "SELECT 1 FROM reward_claims WHERE id=? AND user_id=? AND status IN ('rejected','reversed')",
          claimId,
          actor.id,
        ),
        "This reward is not available for appeal.",
        404,
      );
      ensure(
        !get(
          "SELECT 1 FROM reward_appeals WHERE claim_id=? AND status='open'",
          claimId,
        ),
        "Your appeal is already waiting for review.",
        409,
      );
      run(
        "INSERT INTO reward_appeals VALUES(?,?,?,?,?,?)",
        uid(),
        claimId,
        actor.id,
        reason,
        "open",
        now(),
      );
      return { ok: true };
    },
    createOrganization(actor, name) {
      return tx(() => {
        ensure(
          !get(
            "SELECT 1 FROM business_members WHERE user_id=? AND role='owner'",
            actor.id,
          ),
          "You already own a business workspace. Add another branch there.",
          409,
        );
        const orgId = uid();
        run(
          "INSERT INTO business_orgs VALUES(?,?,?,?)",
          orgId,
          name,
          actor.id,
          now(),
        );
        run(
          "INSERT INTO business_members VALUES(?,?,?,NULL)",
          orgId,
          actor.id,
          "owner",
        );
        audit(actor, "organization.created", orgId, name);
        return { id: orgId };
      });
    },
    claimBranch(actor, input) {
      const membership = member(actor, input.orgId, ["owner", "manager"]);
      ensure(
        !membership.branch_id,
        "Only a workspace owner or manager with access to all branches can claim a new branch.",
        403,
      );
      ensure(publicPlace(input.placeId), "Choose an existing location.", 404);
      ensure(
        !publicPlace(input.placeId)?.sample,
        "Fictional sample locations cannot be claimed.",
      );
      ensure(
        !get("SELECT 1 FROM business_branches WHERE place_id=?", input.placeId),
        "This location is already claimed. Contact support to dispute ownership.",
        409,
      );
      ensure(
        !get(
          "SELECT 1 FROM business_claims WHERE org_id=? AND place_id=? AND status='pending'",
          input.orgId,
          input.placeId,
        ),
        "This claim is already waiting for review.",
        409,
      );
      const claimId = uid();
      run(
        "INSERT INTO business_claims(id,org_id,place_id,contact,evidence,created_at) VALUES(?,?,?,?,?,?)",
        claimId,
        input.orgId,
        input.placeId,
        input.contact,
        input.evidence,
        now(),
      );
      return { id: claimId };
    },
    business(actor) {
      const organizations = all(
        "SELECT o.*,m.role,m.branch_id FROM business_orgs o JOIN business_members m ON m.org_id=o.id WHERE m.user_id=? ORDER BY o.created_at",
        actor.id,
      ).map((org) => ({
        ...org,
        active: active(org.id),
        subscription:
          get("SELECT * FROM business_subscriptions WHERE org_id=?", org.id) ||
          null,
        branches: all(
          "SELECT place_id FROM business_branches WHERE org_id=?",
          org.id,
        )
          .filter((b) => !org.branch_id || org.branch_id === b.place_id)
          .map((b) => publicPlace(b.place_id)),
        claims: ["owner", "manager"].includes(org.role)
          ? all(
              "SELECT * FROM business_claims WHERE org_id=? ORDER BY created_at DESC",
              org.id,
            ).filter(
              (claim) => !org.branch_id || org.branch_id === claim.place_id,
            )
          : [],
        invoices:
          org.role === "owner"
            ? all(
                "SELECT * FROM business_invoices WHERE org_id=? ORDER BY created_at DESC LIMIT 30",
                org.id,
              )
            : [],
        campaigns: ["owner", "manager"].includes(org.role)
          ? all(
              "SELECT * FROM ad_campaigns WHERE org_id=? ORDER BY created_at DESC",
              org.id,
            ).filter(
              (campaign) =>
                !org.branch_id || org.branch_id === campaign.place_id,
            )
          : [],
        offers: ["owner", "manager"].includes(org.role)
          ? all(
              "SELECT * FROM voucher_offers WHERE org_id=? ORDER BY created_at DESC",
              org.id,
            )
              .filter(
                (offer) => !org.branch_id || org.branch_id === offer.place_id,
              )
              .map(offerView)
          : [],
        members:
          org.role === "owner"
            ? all(
                "SELECT m.user_id,m.role,m.branch_id,u.name,u.username FROM business_members m JOIN users u ON u.id=m.user_id WHERE m.org_id=?",
                org.id,
              )
            : [],
        invites:
          org.role === "owner"
            ? all(
                "SELECT id,username,role,branch_id,status FROM business_invites WHERE org_id=?",
                org.id,
              )
            : [],
      }));
      return {
        organizations,
        rules: config(),
        billingMode: options.billingMode || "manual",
      };
    },
    requestInvoice(actor, orgId, key) {
      member(actor, orgId, ["owner"]);
      ensure(
        !config().checkoutPaused,
        "Subscription checkout is temporarily paused.",
        503,
      );
      ensure(
        get("SELECT 1 FROM business_branches WHERE org_id=?", orgId),
        "Verify at least one location before subscribing.",
      );
      return tx(() =>
        idempotent(actor, key, "invoice", { orgId }, () => {
          const pending = get(
            "SELECT id FROM business_invoices WHERE org_id=? AND status='pending'",
            orgId,
          );
          if (pending) return { id: pending.id, mode: "manual" };
          const invoiceId = uid();
          run(
            "INSERT INTO business_invoices(id,org_id,amount,created_at) VALUES(?,?,?,?)",
            invoiceId,
            orgId,
            config().monthlyPrice * 100,
            now(),
          );
          return { id: invoiceId, mode: "manual" };
        }),
      );
    },
    cancelSubscription(actor, orgId) {
      member(actor, orgId, ["owner"]);
      run(
        "UPDATE business_subscriptions SET cancel_at_end=1,updated_at=? WHERE org_id=?",
        now(),
        orgId,
      );
      audit(
        actor,
        "subscription.cancel_at_end",
        orgId,
        "Owner cancelled future renewal.",
      );
      return { ok: true };
    },
    updateDetails(actor, input) {
      const membership = member(actor, input.orgId, ["owner", "manager"]);
      branch(input.orgId, input.placeId);
      ensure(
        !membership.branch_id || membership.branch_id === input.placeId,
        "This branch is outside your assigned access.",
        403,
      );
      run(
        "INSERT INTO business_place_details VALUES(?,?,?,?,?,?,?) ON CONFLICT(place_id) DO UPDATE SET hours=excluded.hours,description=excluded.description,budget=excluded.budget,tags=excluded.tags,updated_at=excluded.updated_at",
        input.placeId,
        input.orgId,
        input.hours,
        input.description,
        input.budget,
        JSON.stringify(input.tags),
        now(),
      );
      audit(
        actor,
        "location.details_updated",
        input.placeId,
        "Owner-provided hours, description and estimates updated.",
      );
      return { ok: true };
    },
    transferOwnership(actor, orgId, userId) {
      member(actor, orgId, ["owner"]);
      ensure(
        userId !== actor.id &&
          get(
            "SELECT 1 FROM business_members WHERE org_id=? AND user_id=?",
            orgId,
            userId,
          ),
        "Choose an existing teammate who has accepted their invitation.",
      );
      return tx(() => {
        run(
          "UPDATE business_members SET role='manager' WHERE org_id=? AND user_id=?",
          orgId,
          actor.id,
        );
        run(
          "UPDATE business_members SET role='owner',branch_id=NULL WHERE org_id=? AND user_id=?",
          orgId,
          userId,
        );
        run("UPDATE business_orgs SET owner_id=? WHERE id=?", userId, orgId);
        audit(actor, "organization.transferred", orgId, userId);
        return { ok: true };
      });
    },
    closeOrganization(actor, orgId, confirmation) {
      member(actor, orgId, ["owner"]);
      const organization = get(
        "SELECT name FROM business_orgs WHERE id=?",
        orgId,
      );
      ensure(
        confirmation === organization.name,
        "Type the exact business name to close the workspace.",
      );
      ensure(
        !get(
          "SELECT 1 FROM customer_vouchers WHERE org_id=? AND status='issued' AND expires_at>?",
          orgId,
          now(),
        ),
        "Honor or resolve outstanding valid vouchers before closing this workspace.",
        409,
      );
      return tx(() => {
        run("UPDATE ad_campaigns SET status='ended' WHERE org_id=?", orgId);
        run("UPDATE voucher_offers SET status='paused' WHERE org_id=?", orgId);
        run(
          "UPDATE business_subscriptions SET status='cancelled',cancel_at_end=1,period_end=?,updated_at=? WHERE org_id=?",
          now(),
          now(),
          orgId,
        );
        run("DELETE FROM business_place_details WHERE org_id=?", orgId);
        run("DELETE FROM business_branches WHERE org_id=?", orgId);
        run(
          "UPDATE business_claims SET status='revoked',reason='Workspace closed by owner' WHERE org_id=? AND status='approved'",
          orgId,
        );
        run(
          "UPDATE business_invites SET status='revoked' WHERE org_id=?",
          orgId,
        );
        run("DELETE FROM business_members WHERE org_id=?", orgId);
        run("UPDATE business_orgs SET owner_id=NULL WHERE id=?", orgId);
        audit(
          actor,
          "organization.closed",
          orgId,
          "Closed by owner after resolving valid vouchers.",
        );
        return { ok: true };
      });
    },
    invite(actor, input) {
      member(actor, input.orgId, ["owner"]);
      if (input.branchId) branch(input.orgId, input.branchId);
      ensure(
        input.role !== "staff" || input.branchId,
        "Assign redemption staff to a specific branch.",
      );
      const target = get(
        "SELECT id FROM users WHERE username=? AND demo=0",
        input.username,
      );
      ensure(
        target && target.id !== actor.id,
        "Choose another registered DATED username.",
        404,
      );
      run(
        "INSERT INTO business_invites VALUES(?,?,?,?,?, 'pending',?) ON CONFLICT(org_id,username) DO UPDATE SET role=excluded.role,branch_id=excluded.branch_id,status='pending',created_at=excluded.created_at",
        uid(),
        input.orgId,
        input.username,
        input.role,
        input.branchId || null,
        now(),
      );
      audit(actor, "team.invited", input.orgId, input.username);
      return { ok: true };
    },
    acceptInvite(actor, inviteId) {
      return tx(() => {
        const invite = get(
          "SELECT * FROM business_invites WHERE id=? AND username=? AND status='pending'",
          inviteId,
          actor.username,
        );
        ensure(
          invite && invite.created_at > now() - 7 * day,
          "This invitation has expired or is no longer available.",
          404,
        );
        run(
          "INSERT INTO business_members VALUES(?,?,?,?) ON CONFLICT(org_id,user_id) DO UPDATE SET role=excluded.role,branch_id=excluded.branch_id",
          invite.org_id,
          actor.id,
          invite.role,
          invite.branch_id,
        );
        run(
          "UPDATE business_invites SET status='accepted' WHERE id=?",
          inviteId,
        );
        return { ok: true };
      });
    },
    removeMember(actor, orgId, userId) {
      member(actor, orgId, ["owner"]);
      ensure(
        userId !== actor.id,
        "Transfer business ownership before removing yourself.",
      );
      run(
        "DELETE FROM business_members WHERE org_id=? AND user_id=? AND role!='owner'",
        orgId,
        userId,
      );
      audit(actor, "team.removed", orgId, userId);
      return { ok: true };
    },
    createOffer(actor, input) {
      manageBranch(actor, input.orgId, input.placeId);
      ensure(
        input.endsAt > input.startsAt && input.endsAt > now(),
        "Choose a future end date after the start date.",
      );
      const offerId = uid();
      run(
        "INSERT INTO voucher_offers(id,org_id,place_id,title,description,coin_cost,benefit,min_spend,stock,starts_at,ends_at,valid_days,terms,funding,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        offerId,
        input.orgId,
        input.placeId,
        input.title,
        input.description,
        input.coinCost,
        input.benefit,
        input.minSpend,
        input.stock,
        input.startsAt,
        input.endsAt,
        input.validDays,
        input.terms,
        input.funding,
        now(),
      );
      audit(
        actor,
        "offer.submitted",
        offerId,
        "Awaiting partner and funding review.",
      );
      return { id: offerId };
    },
    pauseOffer(actor, offerId) {
      const offer = get("SELECT * FROM voucher_offers WHERE id=?", offerId);
      ensure(offer, "Offer not found.", 404);
      manageBranch(actor, offer.org_id, offer.place_id);
      run("UPDATE voucher_offers SET status='paused' WHERE id=?", offerId);
      return { ok: true };
    },
    claimVoucher(actor, offerId, key) {
      return tx(() =>
        idempotent(actor, key, "claim_voucher", { offerId }, () => {
          ensure(
            !config().spendingPaused,
            "Voucher claims are temporarily paused. Your coins are safe.",
            503,
          );
          ensure(
            !get("SELECT 1 FROM wallet_restrictions WHERE user_id=?", actor.id),
            "Your wallet needs support review before spending.",
            403,
          );
          const offer = get("SELECT * FROM voucher_offers WHERE id=?", offerId);
          ensure(
            offer &&
              offer.status === "active" &&
              offer.starts_at <= now() &&
              offer.ends_at > now() &&
              offer.stock > 0,
            "This offer is no longer available.",
            409,
          );
          ensure(
            balance(actor.id) >= offer.coin_cost,
            "You do not have enough available coins.",
            409,
          );
          const voucherId = uid();
          const code = "DATED-" + randomBytes(12).toString("hex").toUpperCase();
          const snapshot = {
            title: offer.title,
            benefit: offer.benefit,
            terms: offer.terms,
            minSpend: offer.min_spend,
            coinCost: offer.coin_cost,
            place: publicPlace(offer.place_id),
            funding: offer.funding,
          };
          run(
            "UPDATE voucher_offers SET stock=stock-1 WHERE id=? AND stock>0",
            offerId,
          );
          run(
            "INSERT INTO customer_vouchers(id,user_id,offer_id,org_id,place_id,snapshot,code,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            voucherId,
            actor.id,
            offer.id,
            offer.org_id,
            offer.place_id,
            JSON.stringify(snapshot),
            code,
            hash(code),
            now() + offer.valid_days * day,
            now(),
          );
          run(
            "INSERT INTO coin_ledger VALUES(?,?,?,?,?,?,?)",
            uid(),
            actor.id,
            -offer.coin_cost,
            "spend",
            "voucher:" + voucherId,
            offer.title,
            now(),
          );
          return {
            voucher: voucherView(
              get("SELECT * FROM customer_vouchers WHERE id=?", voucherId),
              true,
            ),
            balance: balance(actor.id),
          };
        }),
      );
    },
    previewRedemption(actor, orgId, code) {
      const membership = member(actor, orgId, ["owner", "manager", "staff"]);
      const voucher = get(
        "SELECT * FROM customer_vouchers WHERE code_hash=? AND org_id=?",
        hash(code.trim().toUpperCase()),
        orgId,
      );
      ensure(
        voucher &&
          (!membership.branch_id || membership.branch_id === voucher.place_id),
        "This code is not valid for your assigned branch.",
        404,
      );
      return voucherView(voucher);
    },
    redeem(actor, orgId, code, key) {
      return tx(() =>
        idempotent(
          actor,
          key,
          "redeem",
          { orgId, code: hash(code.trim().toUpperCase()) },
          () => {
            const voucher = service.previewRedemption(actor, orgId, code);
            ensure(
              voucher.status === "issued",
              voucher.status === "redeemed"
                ? "This voucher has already been redeemed."
                : "This voucher has expired or was cancelled.",
              409,
            );
            run(
              "UPDATE customer_vouchers SET status='redeemed',redeemed_at=?,redeemed_by=? WHERE id=? AND status='issued'",
              now(),
              actor.id,
              voucher.id,
            );
            audit(
              actor,
              "voucher.redeemed",
              voucher.id,
              "Redeemed by authorized branch staff.",
            );
            return { ok: true, voucherId: voucher.id, redeemedAt: now() };
          },
        ),
      );
    },
    campaign(actor, input) {
      manageBranch(actor, input.orgId, input.placeId);
      ensure(
        active(input.orgId),
        "An active business subscription is required for location ads.",
        403,
      );
      ensure(
        input.endsAt > input.startsAt && input.endsAt > now(),
        "Choose a valid future campaign period.",
      );
      const campaignId = uid();
      run(
        "INSERT INTO ad_campaigns(id,org_id,place_id,title,body,starts_at,ends_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
        campaignId,
        input.orgId,
        input.placeId,
        input.title,
        input.body,
        input.startsAt,
        input.endsAt,
        now(),
        now(),
      );
      audit(
        actor,
        "campaign.submitted",
        campaignId,
        "Awaiting creative review.",
      );
      return { id: campaignId };
    },
    pauseCampaign(actor, campaignId) {
      const campaign = get("SELECT * FROM ad_campaigns WHERE id=?", campaignId);
      ensure(campaign, "Campaign not found.", 404);
      manageBranch(actor, campaign.org_id, campaign.place_id);
      run(
        "UPDATE ad_campaigns SET status='paused',updated_at=? WHERE id=?",
        now(),
        campaignId,
      );
      return { ok: true };
    },
    // Candidates have already passed the same filter predicate as organic places.
    sponsored(candidates, viewerKey, filterContext) {
      if (config().adsPaused) return [];
      const ids = new Set(candidates.map((p) => p.id));
      const eligible = all(
        "SELECT c.*,(SELECT count(*) FROM ad_deliveries d WHERE d.campaign_id=c.id AND d.created_at>?) delivered FROM ad_campaigns c JOIN business_subscriptions s ON s.org_id=c.org_id JOIN business_branches b ON b.place_id=c.place_id AND b.org_id=c.org_id WHERE c.status='active' AND c.starts_at<=? AND c.ends_at>? AND s.status='active' AND s.period_end>? ORDER BY delivered ASC,c.created_at ASC",
        now() - day,
        now(),
        now(),
        now(),
      ).filter((c) => ids.has(c.place_id));
      const seen = new Set();
      const result = [];
      for (const campaign of eligible) {
        if (
          seen.has(campaign.place_id) ||
          campaign.delivered >= 1000 ||
          result.length >= 1
        )
          continue;
        if (
          get(
            "SELECT 1 FROM ad_deliveries WHERE campaign_id=? AND viewer_key=? AND created_at>?",
            campaign.id,
            viewerKey,
            now() - 300000,
          )
        )
          continue;
        seen.add(campaign.place_id);
        const deliveryId = uid();
        run(
          "INSERT INTO ad_deliveries VALUES(?,?,?,?,?,?)",
          deliveryId,
          campaign.id,
          campaign.place_id,
          viewerKey,
          JSON.stringify(filterContext),
          now(),
        );
        result.push({
          deliveryId,
          campaignId: campaign.id,
          placeId: campaign.place_id,
          title: campaign.title,
          body: campaign.body,
          label: "Sponsored",
        });
      }
      return result;
    },
    event(actor, input) {
      ensure(publicPlace(input.placeId), "Location not found.", 404);
      if (input.deliveryId) {
        const delivery = get(
          "SELECT * FROM ad_deliveries WHERE id=? AND place_id=?",
          input.deliveryId,
          input.placeId,
        );
        ensure(
          delivery && delivery.created_at > now() - day,
          "This sponsored placement is no longer available.",
        );
      }
      if (input.deliveryId) {
        const delivery = get(
          "SELECT viewer_key FROM ad_deliveries WHERE id=?",
          input.deliveryId,
        );
        ensure(
          delivery?.viewer_key === hash(actor?.id || input.session),
          "This placement belongs to a different discovery session.",
          403,
        );
      }
      const dedupe = input.deliveryId
        ? `${input.kind}:${input.deliveryId}`
        : `${input.kind}:${input.placeId}:${actor?.id || input.session}:${Math.floor(now() / 300000)}`;
      run(
        "INSERT OR IGNORE INTO discovery_events VALUES(?,?,?,?,?,?,?)",
        uid(),
        input.placeId,
        actor?.id || null,
        input.kind,
        input.deliveryId || null,
        hash(dedupe),
        now(),
      );
      return { ok: true };
    },
    report(actor, orgId, placeId, start, end) {
      const membership = member(actor, orgId, ["owner", "manager", "analyst"]);
      branch(orgId, placeId);
      ensure(
        !membership.branch_id || membership.branch_id === placeId,
        "This report is outside your assigned branch.",
        403,
      );
      ensure(
        active(orgId),
        "Activate your business subscription to access performance reports.",
        403,
      );
      ensure(
        end > start && end - start <= 366 * day && end <= now() + day,
        "Choose a report period of at most one year.",
      );
      const recent = all(
        "SELECT id,author_id,title,body,ratings,spending,spending_known,visit_date,created_at,criteria_version FROM reviews WHERE place_id=? AND visibility='public' AND hidden=0 AND demo=0 AND incentive=0 AND business_relationship=0 AND created_at>=? AND created_at<? ORDER BY visit_date DESC,created_at DESC",
        placeId,
        start,
        end,
      );
      const seen = new Set();
      const reviews = recent.filter((r) => {
        if (seen.has(r.author_id)) return false;
        seen.add(r.author_id);
        return true;
      });
      const previousStart = start - (end - start);
      const previousSeen = new Set();
      const previousReviews = all(
        "SELECT author_id,ratings FROM reviews WHERE place_id=? AND visibility='public' AND hidden=0 AND demo=0 AND incentive=0 AND business_relationship=0 AND created_at>=? AND created_at<? ORDER BY visit_date DESC,created_at DESC",
        placeId,
        previousStart,
        start,
      ).filter((r) => {
        if (previousSeen.has(r.author_id)) return false;
        previousSeen.add(r.author_id);
        return true;
      });
      const previousCriteria = {};
      for (const review of previousReviews)
        for (const [name, value] of Object.entries(parse(review.ratings))) {
          if (!(Number(value) >= 1 && Number(value) <= 5)) continue;
          previousCriteria[name] ||= { sum: 0, count: 0 };
          previousCriteria[name].sum += Number(value);
          previousCriteria[name].count++;
        }
      const criteria = {};
      for (const review of reviews)
        for (const [key, score] of Object.entries(parse(review.ratings))) {
          if (!(Number(score) >= 1 && Number(score) <= 5)) continue;
          criteria[key] ||= { sum: 0, count: 0 };
          criteria[key].sum += Number(score);
          criteria[key].count++;
        }
      const events = all(
        "SELECT kind,delivery_id,count(*) count FROM discovery_events WHERE place_id=? AND created_at>=? AND created_at<? GROUP BY kind,delivery_id IS NOT NULL",
        placeId,
        start,
        end,
      );
      const count = (kind, paid) =>
        events
          .filter(
            (e) =>
              e.kind === kind &&
              (paid === undefined || !!e.delivery_id === paid),
          )
          .reduce((total, e) => total + Number(e.count), 0);
      const vouchers = all(
        "SELECT status,count(*) count FROM customer_vouchers WHERE place_id=? AND created_at>=? AND created_at<? GROUP BY status",
        placeId,
        start,
        end,
      );
      const issued = vouchers.reduce((total, v) => total + Number(v.count), 0);
      const redeemed = Number(
        vouchers.find((v) => v.status === "redeemed")?.count || 0,
      );
      const spending = reviews
        .filter((r) => r.spending_known !== 0)
        .map((r) => Number(r.spending));
      const terms = [
        "service",
        "wait",
        "clean",
        "comfort",
        "food",
        "sound",
        "exhibit",
        "price",
      ];
      const themes = terms
        .map((term) => ({
          term,
          reviews: reviews
            .filter((r) => `${r.title} ${r.body}`.toLowerCase().includes(term))
            .map((r) => ({ id: r.id, title: r.title, body: r.body })),
        }))
        .filter((t) => t.reviews.length >= 2);
      return {
        place: publicPlace(placeId),
        start,
        end,
        generatedAt: now(),
        version: 1,
        sampleSize: reviews.length,
        previous: {
          start: previousStart,
          end: start,
          sampleSize: previousReviews.length,
          criteria: Object.entries(previousCriteria).map(([name, value]) => ({
            name,
            average: value.sum / value.count,
            count: value.count,
          })),
        },
        criteria: Object.entries(criteria).map(([name, values]) => ({
          name,
          average: values.sum / values.count,
          count: values.count,
        })),
        reviews: reviews.slice(0, 50).map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          visitDate: r.visit_date,
        })),
        themes,
        averageSpending:
          reviews.length >= 5 && spending.length >= 5
            ? spending.reduce((a, b) => a + b, 0) / spending.length
            : null,
        contextSuppressed: reviews.length < 5,
        discovery: {
          views: count("place_open", false),
          saves: count("save", false),
          directions: count("directions", false),
        },
        advertising: {
          impressions: count("ad_impression", true),
          clicks: count("ad_click", true),
          ctr: count("ad_impression", true)
            ? count("ad_click", true) / count("ad_impression", true)
            : null,
        },
        vouchers: {
          issued,
          redeemed,
          redemptionRate: issued ? redeemed / issued : null,
          periodRedemptions: Number(
            get(
              "SELECT count(*) count FROM customer_vouchers WHERE place_id=? AND redeemed_at>=? AND redeemed_at<?",
              placeId,
              start,
              end,
            )?.count || 0,
          ),
        },
      };
    },
    snapshotReport(actor, orgId, placeId, start, end) {
      const report = service.report(actor, orgId, placeId, start, end);
      run(
        "INSERT INTO report_snapshots VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(place_id,period_start,period_end,version) DO UPDATE SET data=excluded.data,created_at=excluded.created_at",
        uid(),
        orgId,
        placeId,
        start,
        end,
        1,
        JSON.stringify(report),
        now(),
      );
      return report;
    },
    adminState(actor) {
      admin(actor);
      return {
        claims: all(
          "SELECT c.*,o.name organization FROM business_claims c JOIN business_orgs o ON o.id=c.org_id ORDER BY c.created_at DESC LIMIT 200",
        ).map((c) => ({ ...c, place: publicPlace(c.place_id) })),
        invoices: all(
          "SELECT i.*,o.name organization FROM business_invoices i JOIN business_orgs o ON o.id=i.org_id ORDER BY i.created_at DESC LIMIT 200",
        ),
        offers: all(
          "SELECT * FROM voucher_offers ORDER BY created_at DESC LIMIT 200",
        ).map(offerView),
        campaigns: all(
          "SELECT * FROM ad_campaigns ORDER BY created_at DESC LIMIT 200",
        ).map((c) => ({ ...c, place: publicPlace(c.place_id) })),
        rewards: all(
          "SELECT c.*,u.username FROM reward_claims c LEFT JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 200",
        ),
        appeals: all(
          "SELECT * FROM reward_appeals WHERE status='open' ORDER BY created_at DESC LIMIT 100",
        ),
        restrictions: all(
          "SELECT r.*,u.username FROM wallet_restrictions r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 100",
        ).map((r) => ({ ...r, balance: balance(r.user_id) })),
        vouchers: all(
          "SELECT * FROM customer_vouchers ORDER BY created_at DESC LIMIT 200",
        ).map((v) => voucherView(v)),
        audit: all(
          "SELECT * FROM commerce_audit ORDER BY created_at DESC LIMIT 100",
        ),
        rules: config(),
        totals: {
          coins: Number(
            get("SELECT coalesce(sum(amount),0) total FROM coin_ledger")
              ?.total || 0,
          ),
          outstandingVouchers: Number(
            get(
              "SELECT count(*) count FROM customer_vouchers WHERE status='issued' AND expires_at>?",
              now(),
            )?.count || 0,
          ),
        },
      };
    },
    decide(actor, input) {
      admin(actor);
      return tx(() => {
        const { kind, entityId, action, reason } = input;
        if (kind === "claim") {
          const claim = get(
            "SELECT * FROM business_claims WHERE id=? AND status='pending'",
            entityId,
          );
          ensure(claim, "This claim is no longer waiting for review.", 409);
          if (action === "approve") {
            ensure(
              !get(
                "SELECT 1 FROM business_branches WHERE place_id=?",
                claim.place_id,
              ),
              "This branch is already claimed.",
              409,
            );
            run(
              "INSERT INTO business_branches VALUES(?,?,?)",
              claim.place_id,
              claim.org_id,
              now(),
            );
          }
          run(
            "UPDATE business_claims SET status=?,reason=? WHERE id=?",
            action === "approve" ? "approved" : "rejected",
            reason,
            entityId,
          );
        } else if (kind === "invoice") {
          const invoice = get(
            "SELECT * FROM business_invoices WHERE id=? AND status='pending'",
            entityId,
          );
          ensure(invoice, "This invoice is no longer pending.", 409);
          if (action === "approve") {
            ensure(
              reason.length >= 10,
              "Record the verified payment reference.",
            );
            const old = get(
              "SELECT period_end FROM business_subscriptions WHERE org_id=?",
              invoice.org_id,
            );
            const periodEnd =
              Math.max(Number(old?.period_end || 0), now()) + 30 * day;
            run(
              "INSERT INTO business_subscriptions VALUES(?, 'active',?,0,'manual',?) ON CONFLICT(org_id) DO UPDATE SET status='active',period_end=excluded.period_end,cancel_at_end=0,updated_at=excluded.updated_at",
              invoice.org_id,
              periodEnd,
              now(),
            );
            run(
              "UPDATE business_invoices SET status='paid',reference=?,paid_at=? WHERE id=?",
              reason,
              now(),
              entityId,
            );
          } else
            run(
              "UPDATE business_invoices SET status='cancelled',reference=? WHERE id=?",
              reason,
              entityId,
            );
        } else if (kind === "offer" || kind === "campaign") {
          const table = kind === "offer" ? "voucher_offers" : "ad_campaigns";
          const entity = get(`SELECT * FROM ${table} WHERE id=?`, entityId);
          ensure(entity, "Submission not found.", 404);
          if (action === "approve" && kind === "campaign")
            ensure(
              active(entity.org_id),
              "The business subscription has expired.",
            );
          run(
            `UPDATE ${table} SET status=?,reason=? WHERE id=?`,
            action === "approve" ? "active" : "rejected",
            reason,
            entityId,
          );
        } else if (kind === "reward") {
          const claim = get("SELECT * FROM reward_claims WHERE id=?", entityId);
          ensure(claim?.user_id, "Reward account is unavailable.", 404);
          if (action === "approve") {
            ensure(
              claim.status !== "approved" &&
                (claim.status === "reversed" ||
                  !get(
                    "SELECT 1 FROM coin_ledger WHERE source=?",
                    "reward:" + claim.id,
                  )),
              "This visit has already earned coins.",
              409,
            );
            const review = get(
              "SELECT * FROM reviews WHERE id=?",
              claim.review_id,
            );
            ensure(
              review &&
                !publicPlace(review.place_id)?.sample &&
                !service.isBusinessReviewer(claim.user_id, review.place_id) &&
                !review.demo &&
                !review.hidden &&
                !review.incentive &&
                review.reward_opt_in &&
                String(review.body).trim().length >= 40 &&
                Object.values(parse(review.ratings)).filter(
                  (v) => Number(v) >= 1 && Number(v) <= 5,
                ).length >= 3 &&
                review.visibility === "public",
              "Only an independent public review may receive a reward.",
            );
            run(
              "INSERT INTO coin_ledger VALUES(?,?,?,?,?,?,?)",
              uid(),
              claim.user_id,
              claim.amount,
              "earn",
              claim.status === "reversed"
                ? "restore:" + claim.id + ":" + uid()
                : "reward:" + claim.id,
              reason,
              now(),
            );
            run(
              "UPDATE reward_claims SET status='approved',reason=?,decided_at=? WHERE id=?",
              reason,
              now(),
              entityId,
            );
          } else if (action === "reverse") {
            ensure(
              claim.status === "approved",
              "Only approved rewards can be reversed.",
            );
            run(
              "INSERT INTO coin_ledger VALUES(?,?,?,?,?,?,?)",
              uid(),
              claim.user_id,
              -claim.amount,
              "adjustment",
              "reverse:" + claim.id + ":" + uid(),
              reason,
              now(),
            );
            run(
              "UPDATE reward_claims SET status='reversed',reason=?,decided_at=? WHERE id=?",
              reason,
              now(),
              entityId,
            );
            if (balance(claim.user_id) < 0)
              run(
                "INSERT OR REPLACE INTO wallet_restrictions VALUES(?,?,?)",
                claim.user_id,
                "A reversed award needs support review before further spending.",
                now(),
              );
          } else
            run(
              "UPDATE reward_claims SET status='rejected',reason=?,decided_at=? WHERE id=? AND status!='approved'",
              reason,
              now(),
              entityId,
            );
          run(
            "UPDATE reward_appeals SET status='resolved' WHERE claim_id=?",
            entityId,
          );
        } else if (kind === "wallet") {
          ensure(
            action === "approve" &&
              get(
                "SELECT 1 FROM wallet_restrictions WHERE user_id=?",
                entityId,
              ),
            "This wallet is not waiting for restriction review.",
            409,
          );
          ensure(
            balance(entityId) >= 0,
            "Resolve the negative coin balance before releasing this wallet.",
            409,
          );
          run("DELETE FROM wallet_restrictions WHERE user_id=?", entityId);
        } else if (kind === "voucher") {
          ensure(
            action === "reject",
            "Choose cancel and refund for an unused voucher.",
          );
          const voucher = get(
            "SELECT * FROM customer_vouchers WHERE id=?",
            entityId,
          );
          ensure(
            voucher && voucher.status === "issued",
            "Only an unused voucher may be cancelled and refunded.",
            409,
          );
          run(
            "UPDATE customer_vouchers SET status='cancelled' WHERE id=?",
            entityId,
          );
          if (voucher.user_id)
            run(
              "INSERT INTO coin_ledger VALUES(?,?,?,?,?,?,?)",
              uid(),
              voucher.user_id,
              parse(voucher.snapshot).coinCost,
              "refund",
              "refund:" + voucher.id,
              reason,
              now(),
            );
        } else throw new CommerceError(400, "Choose a supported operation.");
        audit(actor, `${kind}.${action}`, entityId, reason);
        return { ok: true };
      });
    },
    setConfig(actor, changes) {
      admin(actor);
      for (const [key, value] of Object.entries(changes)) {
        ensure(
          [
            "rewardCoins",
            "dailyReviews",
            "rewardsPaused",
            "spendingPaused",
            "adsPaused",
            "checkoutPaused",
          ].includes(key),
          "Unknown configuration setting.",
        );
        run(
          "INSERT INTO commerce_config VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          key,
          String(value),
        );
      }
      audit(actor, "config.updated", "platform", JSON.stringify(changes));
      return config();
    },
    exportAccount(actor) {
      return {
        wallet: service.wallet(actor),
        memberships: all(
          "SELECT org_id,role,branch_id FROM business_members WHERE user_id=?",
          actor.id,
        ),
      };
    },
    canDelete(actor) {
      ensure(
        !get("SELECT 1 FROM business_orgs WHERE owner_id=?", actor.id),
        "Transfer or close your business workspace with support before deleting its owner account.",
        409,
      );
      ensure(
        !get(
          "SELECT 1 FROM customer_vouchers WHERE user_id=? AND status='issued' AND expires_at>?",
          actor.id,
          now(),
        ),
        "Use your valid vouchers or ask support to cancel them before deleting your account.",
        409,
      );
    },
    maintenance() {
      run(
        "UPDATE business_subscriptions SET status='expired',updated_at=? WHERE status='active' AND period_end<=?",
        now(),
        now(),
      );
      run(
        "UPDATE customer_vouchers SET status='expired' WHERE status='issued' AND expires_at<=?",
        now(),
      );
      run(
        "UPDATE voucher_offers SET status='ended' WHERE status='active' AND ends_at<=?",
        now(),
      );
      run(
        "UPDATE ad_campaigns SET status='ended' WHERE status='active' AND ends_at<=?",
        now(),
      );
      run(
        "UPDATE business_invites SET status='expired' WHERE status='pending' AND created_at<?",
        now() - 7 * day,
      );
      const rewards = service.processRewards();
      // Local worker snapshots use complete calendar months in Asia/Manila.
      const localNow = new Date(now() + 8 * 3600000);
      const end =
        Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1) -
        8 * 3600000;
      const start =
        Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth() - 1, 1) -
        8 * 3600000;
      let reports = 0;
      for (const target of all(
        "SELECT b.org_id,b.place_id,o.owner_id FROM business_branches b JOIN business_orgs o ON o.id=b.org_id JOIN business_subscriptions s ON s.org_id=b.org_id WHERE s.status='active' AND s.period_end>?",
        now(),
      )) {
        if (
          get(
            "SELECT 1 FROM report_snapshots WHERE place_id=? AND period_start=? AND period_end=? AND version=1",
            target.place_id,
            start,
            end,
          )
        )
          continue;
        service.snapshotReport(
          { id: target.owner_id },
          target.org_id,
          target.place_id,
          start,
          end,
        );
        reports++;
      }
      return { ...rewards, reports };
    },
  };
  return service;
}
