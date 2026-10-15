import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "./db";
import { requireUser, currentUser, limit, tokenHash } from "./auth";
import { createCommerce } from "@/lib/commerce-core.mjs";
import { discoverMatchingPlaces } from "./discovery-filters";

export const commerce = createCommerce(db, {
  monthlyPrice: Number(process.env.DATED_BUSINESS_PRICE_PHP || 499),
  billingMode: "manual",
});
const text = (min = 1, max = 1000) => z.string().trim().min(min).max(max);
const org = z.string().uuid();
const epoch = z.number().int().positive();
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function commerceRequest(req: NextRequest, parts: string[]) {
  const path = parts.join("/");
  const method = req.method;
  if (
    !/^(wallet|vouchers|business|operations|discovery|events)(\/|$)/.test(path)
  )
    return null;
  if (path === "vouchers" && method === "GET")
    return json({ offers: commerce.offers() });
  if (path === "discovery" && method === "GET") {
    const filters = Object.fromEntries(req.nextUrl.searchParams);
    const places = discoverMatchingPlaces(filters);
    const viewer = tokenHash(
      currentUser(req)?.id || req.headers.get("x-dated-session") || "guest",
    );
    const sponsored = commerce.sponsored(places, viewer, filters);
    return json({
      places:
        req.nextUrl.searchParams.get("adsOnly") === "1"
          ? places.filter((place) =>
              sponsored.some(
                (ad: { placeId: string }) => ad.placeId === place.id,
              ),
            )
          : places,
      sponsored,
    });
  }
  if (path === "events" && method === "POST") {
    const actor = currentUser(req);
    const input = z
      .object({
        placeId: text(1, 200),
        kind: z.enum([
          "place_open",
          "save",
          "directions",
          "ad_impression",
          "ad_click",
        ]),
        deliveryId: org.optional(),
        session: text(8, 100),
      })
      .parse(await req.json());
    limit("events:" + tokenHash(actor?.id || input.session), 120);
    return json(commerce.event(actor, input));
  }
  const user = requireUser(req);
  if (path === "wallet" && method === "GET") {
    commerce.maintenance();
    return json(commerce.wallet(user));
  }
  if (path === "wallet/appeals" && method === "POST") {
    const input = z
      .object({ claimId: org, reason: text(10, 1000) })
      .parse(await req.json());
    return json(commerce.appeal(user, input.claimId, input.reason), 201);
  }
  if (parts[0] === "vouchers" && parts[2] === "claim" && method === "POST") {
    limit("voucher:" + user.id, 20);
    return json(
      commerce.claimVoucher(user, parts[1], req.headers.get("idempotency-key")),
      201,
    );
  }
  if (path === "business" && method === "GET")
    return json(commerce.business(user));
  if (path === "business/details" && method === "POST") {
    const input = z
      .object({
        orgId: org,
        placeId: text(1, 200),
        hours: text(0, 200),
        description: text(0, 800),
        budget: z.number().int().min(0).max(100000).nullable(),
        tags: z
          .array(
            z.enum([
              "Coffee dates",
              "Date night",
              "Dinner with friends",
              "Solo exploring",
              "Art & culture",
              "Brunch",
              "Rainy days",
              "Outdoor seating",
            ]),
          )
          .max(8),
      })
      .parse(await req.json());
    return json(commerce.updateDetails(user, input));
  }
  if (path === "business/transfer" && method === "POST") {
    const input = z.object({ orgId: org, userId: org }).parse(await req.json());
    return json(commerce.transferOwnership(user, input.orgId, input.userId));
  }
  if (path === "business/close" && method === "POST") {
    const input = z
      .object({ orgId: org, confirmation: text(2, 100) })
      .parse(await req.json());
    return json(
      commerce.closeOrganization(user, input.orgId, input.confirmation),
    );
  }
  if (path === "business/organizations" && method === "POST") {
    const input = z.object({ name: text(2, 100) }).parse(await req.json());
    return json(commerce.createOrganization(user, input.name), 201);
  }
  if (path === "business/claims" && method === "POST") {
    const input = z
      .object({
        orgId: org,
        placeId: text(1, 200),
        contact: z.email().max(254),
        evidence: text(20, 2000),
      })
      .parse(await req.json());
    return json(commerce.claimBranch(user, input), 201);
  }
  if (path === "business/billing/checkout" && method === "POST") {
    const input = z.object({ orgId: org }).parse(await req.json());
    return json(
      commerce.requestInvoice(
        user,
        input.orgId,
        req.headers.get("idempotency-key"),
      ),
      201,
    );
  }
  if (path === "business/billing/cancel" && method === "POST") {
    const input = z.object({ orgId: org }).parse(await req.json());
    return json(commerce.cancelSubscription(user, input.orgId));
  }
  if (path === "business/invites" && method === "POST") {
    const input = z
      .object({
        orgId: org,
        username: text(3, 24).regex(/^[a-z0-9_]+$/),
        role: z.enum(["manager", "analyst", "staff"]),
        branchId: text(1, 200).optional(),
      })
      .parse(await req.json());
    return json(commerce.invite(user, input), 201);
  }
  if (
    parts[0] === "business" &&
    parts[1] === "invites" &&
    parts[3] === "accept" &&
    method === "POST"
  )
    return json(commerce.acceptInvite(user, parts[2]));
  if (path === "business/members/remove" && method === "POST") {
    const input = z.object({ orgId: org, userId: org }).parse(await req.json());
    return json(commerce.removeMember(user, input.orgId, input.userId));
  }
  if (path === "business/offers" && method === "POST") {
    const input = z
      .object({
        orgId: org,
        placeId: text(1, 200),
        title: text(5, 100),
        description: text(10, 800),
        coinCost: z.number().int().min(1).max(100000),
        benefit: text(5, 200),
        minSpend: z.number().int().min(0).max(1000000),
        stock: z.number().int().min(1).max(10000),
        startsAt: epoch,
        endsAt: epoch,
        validDays: z.number().int().min(1).max(90),
        terms: text(20, 2000),
        funding: z.literal("Partner-funded discount"),
      })
      .parse(await req.json());
    return json(commerce.createOffer(user, input), 201);
  }
  if (
    parts[0] === "business" &&
    parts[1] === "offers" &&
    parts[3] === "pause" &&
    method === "POST"
  )
    return json(commerce.pauseOffer(user, parts[2]));
  if (path === "business/redemptions/preview" && method === "POST") {
    const input = z
      .object({ orgId: org, code: text(12, 100) })
      .parse(await req.json());
    limit("redeem-preview:" + user.id, 20);
    return json(commerce.previewRedemption(user, input.orgId, input.code));
  }
  if (path === "business/redemptions/confirm" && method === "POST") {
    const input = z
      .object({ orgId: org, code: text(12, 100) })
      .parse(await req.json());
    return json(
      commerce.redeem(
        user,
        input.orgId,
        input.code,
        req.headers.get("idempotency-key"),
      ),
    );
  }
  if (path === "business/campaigns" && method === "POST") {
    const input = z
      .object({
        orgId: org,
        placeId: text(1, 200),
        title: text(5, 100),
        body: text(10, 300),
        startsAt: epoch,
        endsAt: epoch,
      })
      .parse(await req.json());
    return json(commerce.campaign(user, input), 201);
  }
  if (
    parts[0] === "business" &&
    parts[1] === "campaigns" &&
    parts[3] === "pause" &&
    method === "POST"
  )
    return json(commerce.pauseCampaign(user, parts[2]));
  if (path === "business/reports" && method === "GET") {
    const input = z
      .object({
        orgId: org,
        placeId: text(1, 200),
        start: z.coerce.number().int().positive(),
        end: z.coerce.number().int().positive(),
      })
      .parse(Object.fromEntries(req.nextUrl.searchParams));
    return json(
      commerce.report(user, input.orgId, input.placeId, input.start, input.end),
    );
  }
  if (path === "operations" && method === "GET")
    return json(commerce.adminState(user));
  if (path === "operations/decision" && method === "POST") {
    const input = z
      .object({
        kind: z.enum([
          "claim",
          "invoice",
          "offer",
          "campaign",
          "reward",
          "voucher",
          "wallet",
        ]),
        entityId: org,
        action: z.enum(["approve", "reject", "reverse"]),
        reason: text(10, 1000),
      })
      .parse(await req.json());
    return json(commerce.decide(user, input));
  }
  if (path === "operations/config" && method === "POST") {
    const input = z
      .object({
        rewardCoins: z.number().int().min(1).max(1000).optional(),
        dailyReviews: z.number().int().min(1).max(20).optional(),
        rewardsPaused: z.boolean().optional(),
        spendingPaused: z.boolean().optional(),
        adsPaused: z.boolean().optional(),
        checkoutPaused: z.boolean().optional(),
      })
      .strict()
      .parse(await req.json());
    return json(commerce.setConfig(user, input));
  }
  if (path === "operations/maintenance" && method === "POST") {
    commerce.adminState(user);
    return json(commerce.maintenance());
  }
  return json({ error: "This action is not available." }, 404);
}
