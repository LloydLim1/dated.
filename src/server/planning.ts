import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, row, rows, transaction } from "./db";
import { requireUser, fail, id } from "./auth";
import { getPlaces, bootstrap } from "./read";
import {
  suggestItinerary,
  splitExpense,
  settleExpenses,
} from "@/lib/planning-core.mjs";
import { philippineDate } from "@/lib/philippine-date.mjs";
import { date as calendarDate } from "./validation";

db.exec(`CREATE TABLE IF NOT EXISTS outing_proposals(id TEXT PRIMARY KEY,outing_id TEXT REFERENCES outings(id) ON DELETE CASCADE,place_id TEXT REFERENCES places(id),author_id TEXT REFERENCES users(id) ON DELETE SET NULL,created_at INTEGER,UNIQUE(outing_id,place_id));
CREATE TABLE IF NOT EXISTS outing_votes(proposal_id TEXT REFERENCES outing_proposals(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(proposal_id,user_id));
CREATE TABLE IF NOT EXISTS outing_expenses(id TEXT PRIMARY KEY,outing_id TEXT REFERENCES outings(id) ON DELETE CASCADE,author_id TEXT REFERENCES users(id) ON DELETE SET NULL,paid_by TEXT REFERENCES users(id) ON DELETE SET NULL,title TEXT NOT NULL,amount INTEGER NOT NULL,shares TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS outing_budgets(outing_id TEXT PRIMARY KEY REFERENCES outings(id) ON DELETE CASCADE,total INTEGER NOT NULL,allocations TEXT NOT NULL,updated_at INTEGER NOT NULL);`);
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function participants(outingId: string) {
  const outing = row("SELECT owner_id FROM outings WHERE id=?", outingId);
  if (!outing) return [];
  return [
    ...new Set([
      String(outing.owner_id),
      ...rows(
        "SELECT user_id FROM invitations WHERE outing_id=? AND status='accepted'",
        outingId,
      ).map((r) => String(r.user_id)),
    ]),
  ];
}
function access(outingId: string, userId: string) {
  const outing = row("SELECT * FROM outings WHERE id=?", outingId);
  if (!outing || !participants(outingId).includes(userId))
    fail(
      403,
      "Only the host and accepted companions can collaborate on this outing.",
    );
  return outing;
}
export async function planningRequest(req: NextRequest, parts: string[]) {
  if (!["planning", "insights"].includes(parts[0])) return null;
  const user = requireUser(req),
    path = parts.join("/");
  if (path === "planning/suggest" && req.method === "POST") {
    const input = z
      .object({
        city: z.string().min(2).max(100),
        groupSize: z.number().int().min(1).max(20),
        budget: z.number().int().min(1).max(100000),
        hours: z.number().min(1).max(16),
        maxStops: z.number().int().min(1).max(6),
        startMinutes: z.number().int().min(0).max(1380),
        categories: z
          .array(z.enum(["Café", "Restaurant", "Museum", "Cinema"]))
          .max(4)
          .default([]),
      })
      .parse(await req.json());
    return json(suggestItinerary(getPlaces(), input));
  }
  if (path === "planning/create" && req.method === "POST") {
    const input = z
      .object({
        title: z.string().trim().min(3).max(100),
        date: calendarDate,
        stops: z
          .array(
            z.object({
              placeId: z.string().min(1),
              startMinutes: z.number().int().min(0).max(1439),
              duration: z.number().int().min(15).max(240),
              budget: z.number().min(0).max(100000),
            }),
          )
          .min(1)
          .max(6),
      })
      .parse(await req.json());
    if (
      input.date < philippineDate() ||
      Number.isNaN(Date.parse(input.date)) ||
      new Set(input.stops.map((s) => s.placeId)).size !== input.stops.length
    )
      fail(400, "Choose a valid upcoming date and distinct stops.");
    for (const stop of input.stops)
      if (!row("SELECT 1 FROM places WHERE id=?", stop.placeId))
        fail(400, "A planned location is no longer available.");
    const outingId = id();
    transaction(() => {
      db.prepare(
        "INSERT INTO outings(id,owner_id,title,date,visibility,notes,created_at) VALUES(?,?,?,?,'private','',?)",
      ).run(outingId, user.id, input.title, input.date, Date.now());
      input.stops.forEach((stop, index) =>
        db
          .prepare("INSERT INTO outing_stops VALUES(?,?,?)")
          .run(outingId, stop.placeId, index),
      );
      const settings = {
        title: input.title,
        intro: "",
        format: "timeline",
        theme: "forest",
        showDate: true,
        showAddress: true,
        showBudget: true,
        stops: input.stops.map((stop) => ({
          placeId: stop.placeId,
          time: `${Math.floor(stop.startMinutes / 60)
            .toString()
            .padStart(
              2,
              "0",
            )}:${(stop.startMinutes % 60).toString().padStart(2, "0")}`,
          minutes: stop.duration,
          note: "Confirm opening hours and prices before visiting.",
          budget: stop.budget,
        })),
      };
      db.prepare(
        "INSERT INTO itinerary_designs(outing_id,settings,updated_at) VALUES(?,?,?)",
      ).run(outingId, JSON.stringify(settings), Date.now());
    });
    return json({ id: outingId }, 201);
  }
  if (parts[0] === "insights" && req.method === "GET") {
    const allOwn = rows(
      "SELECT r.*,p.data FROM reviews r JOIN places p ON p.id=r.place_id WHERE r.author_id=? AND r.hidden=0 ORDER BY r.visit_date DESC",
      user.id,
    );
    const currentYear = Number(philippineDate().slice(0, 4));
    const period = z
      .union([
        z.literal("all"),
        z.coerce.number().int().min(1900).max(currentYear),
      ])
      .parse(req.nextUrl.searchParams.get("year") || "all");
    const own =
      period === "all"
        ? allOwn
        : allOwn.filter((r) => String(r.visit_date).startsWith(String(period)));
    const byCategory: Record<string, number> = {},
      byCity: Record<string, number> = {},
      byMonth: Record<string, number> = {};
    let total = 0,
      known = 0;
    for (const review of own) {
      const p = JSON.parse(String(review.data));
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      byCity[p.city] = (byCity[p.city] || 0) + 1;
      if (review.spending_known !== 0) {
        known++;
        total += Number(review.spending);
        const month = String(review.visit_date).slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + Number(review.spending);
      }
    }
    return json({
      reviews: own.length,
      places: new Set(own.map((r) => r.place_id)).size,
      totalSpending: total,
      knownSpending: known,
      byCategory,
      byCity,
      byMonth,
      year: currentYear,
      periodLabel: period === "all" ? "all time" : String(period),
      availableYears: [
        ...new Set([
          currentYear,
          ...allOwn.map((r) => Number(String(r.visit_date).slice(0, 4))),
        ]),
      ].sort((a, b) => b - a),
      yearReviews: own.filter((r) =>
        String(r.visit_date).startsWith(String(currentYear)),
      ).length,
      journal: own.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        visitDate: r.visit_date,
        ratings: JSON.parse(String(r.ratings)),
        spending: r.spending_known === 0 ? null : r.spending,
        visibility: r.visibility,
        place: JSON.parse(String(r.data)),
        media: rows(
          "SELECT id FROM media WHERE review_id=? AND kind='photo' ORDER BY created_at LIMIT 1",
          String(r.id),
        ).map((m) => String(m.id)),
      })),
      outings: bootstrap(user).outings.filter((o) => o.owner.id === user.id),
    });
  }
  const outingId = parts[1];
  if (!outingId) return json({ error: "Choose an outing." }, 404);
  const outing = access(outingId, user.id),
    people = participants(outingId);
  if (parts[2] === "adopt" && req.method === "POST") {
    if (outing.owner_id !== user.id || outing.completed)
      fail(403, "Only the host can add stops to an upcoming outing.");
    const input = z
      .object({ proposalId: z.string().uuid() })
      .parse(await req.json());
    const proposal = row(
      "SELECT place_id FROM outing_proposals WHERE id=? AND outing_id=?",
      input.proposalId,
      outingId,
    );
    if (!proposal) fail(404, "This suggestion is not available.");
    transaction(() => {
      if (
        row(
          "SELECT 1 FROM outing_stops WHERE outing_id=? AND place_id=?",
          outingId,
          String(proposal.place_id),
        )
      )
        return;
      const stops = rows(
        "SELECT position FROM outing_stops WHERE outing_id=?",
        outingId,
      );
      if (stops.length >= 6)
        fail(
          400,
          "This outing already has six stops. Edit it in My outings first.",
        );
      const next = Math.max(-1, ...stops.map((s) => Number(s.position))) + 1;
      db.prepare("INSERT INTO outing_stops VALUES(?,?,?)").run(
        outingId,
        proposal.place_id,
        next,
      );
    });
    return json({ ok: true });
  }
  if (parts.length === 2 && req.method === "GET") {
    const expenses = rows(
      "SELECT * FROM outing_expenses WHERE outing_id=? ORDER BY created_at DESC",
      outingId,
    ).map((e) => ({
      ...e,
      paidBy: String(e.paid_by),
      amount: Number(e.amount),
      shares: JSON.parse(String(e.shares)),
    }));
    return json({
      participants: people.map((person) =>
        row("SELECT id,name,username FROM users WHERE id=?", person),
      ),
      proposals: rows(
        "SELECT p.*,v.data,(SELECT count(*) FROM outing_votes WHERE proposal_id=p.id) votes,EXISTS(SELECT 1 FROM outing_votes WHERE proposal_id=p.id AND user_id=?) voted FROM outing_proposals p JOIN places v ON v.id=p.place_id WHERE p.outing_id=? ORDER BY votes DESC,p.created_at",
        user.id,
        outingId,
      ).map((p) => ({ ...p, place: JSON.parse(String(p.data)) })),
      expenses,
      settlement: settleExpenses(expenses),
      budget:
        row("SELECT * FROM outing_budgets WHERE outing_id=?", outingId) || null,
      ownerId: outing.owner_id,
    });
  }
  if (parts[2] === "proposals" && req.method === "POST") {
    const input = z
      .object({ placeId: z.string().min(1).max(200) })
      .parse(await req.json());
    if (!row("SELECT 1 FROM places WHERE id=?", input.placeId))
      fail(404, "Location not found.");
    db.prepare("INSERT OR IGNORE INTO outing_proposals VALUES(?,?,?,?,?)").run(
      id(),
      outingId,
      input.placeId,
      user.id,
      Date.now(),
    );
    return json({ ok: true });
  }
  if (parts[2] === "votes" && req.method === "POST") {
    const input = z
      .object({ proposalId: z.string().uuid() })
      .parse(await req.json());
    if (
      !row(
        "SELECT 1 FROM outing_proposals WHERE id=? AND outing_id=?",
        input.proposalId,
        outingId,
      )
    )
      fail(404, "Proposal not found.");
    if (
      row(
        "SELECT 1 FROM outing_votes WHERE proposal_id=? AND user_id=?",
        input.proposalId,
        user.id,
      )
    )
      db.prepare(
        "DELETE FROM outing_votes WHERE proposal_id=? AND user_id=?",
      ).run(input.proposalId, user.id);
    else
      db.prepare("INSERT INTO outing_votes VALUES(?,?)").run(
        input.proposalId,
        user.id,
      );
    return json({ ok: true });
  }
  if (parts[2] === "expenses" && req.method === "POST") {
    const input = z
      .object({
        title: z.string().trim().min(2).max(100),
        amount: z.number().int().min(1).max(10000000),
        paidBy: z.string().uuid(),
        participants: z.array(z.string().uuid()).min(1).max(20),
      })
      .parse(await req.json());
    if (
      !people.includes(input.paidBy) ||
      input.participants.some((person) => !people.includes(person))
    )
      fail(400, "Only the host and accepted companions can share an expense.");
    db.prepare("INSERT INTO outing_expenses VALUES(?,?,?,?,?,?,?,?)").run(
      id(),
      outingId,
      user.id,
      input.paidBy,
      input.title,
      input.amount,
      JSON.stringify(splitExpense(input.amount, input.participants)),
      Date.now(),
    );
    return json({ ok: true }, 201);
  }
  if (parts[2] === "expenses" && parts[3] && req.method === "DELETE") {
    const expense = row(
      "SELECT * FROM outing_expenses WHERE id=? AND outing_id=?",
      parts[3],
      outingId,
    );
    if (
      !expense ||
      (expense.author_id !== user.id && outing.owner_id !== user.id)
    )
      fail(
        403,
        "Only the expense author or outing host can remove this entry.",
      );
    db.prepare("DELETE FROM outing_expenses WHERE id=?").run(parts[3]);
    return json({ ok: true });
  }
  if (parts[2] === "budget" && req.method === "POST") {
    if (outing.owner_id !== user.id)
      fail(403, "Only the host can update the outing budget.");
    const input = z
      .object({
        total: z.number().int().min(0).max(10000000),
        allocations: z
          .record(z.string().max(100), z.number().int().min(0))
          .default({}),
      })
      .parse(await req.json());
    if (
      Object.values(input.allocations).reduce((a, b) => a + b, 0) > input.total
    )
      fail(400, "Category allocations cannot exceed the total budget.");
    db.prepare(
      "INSERT INTO outing_budgets VALUES(?,?,?,?) ON CONFLICT(outing_id) DO UPDATE SET total=excluded.total,allocations=excluded.allocations,updated_at=excluded.updated_at",
    ).run(outingId, input.total, JSON.stringify(input.allocations), Date.now());
    return json({ ok: true });
  }
  return json({ error: "This planning action is not available." }, 404);
}
