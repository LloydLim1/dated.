import "server-only";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, row, rows } from "./db";
import { requireUser, fail, tokenHash } from "./auth";
import { placeById } from "./read";
import type { Place } from "@/lib/types";

export function publicCollection(
  token: string,
): { name: string; places: Place[]; sharedAt: number } | null {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const share = row(
    "SELECT snapshot,created_at FROM collection_shares WHERE token_hash=?",
    tokenHash(token),
  );
  if (!share) return null;
  const snapshot = JSON.parse(String(share.snapshot));
  return {
    name: snapshot.name,
    sharedAt: Number(share.created_at),
    places: snapshot.placeIds
      .map((id: string) => placeById(id))
      .filter(Boolean),
  };
}

export async function collectionSharingRequest(
  req: NextRequest,
  parts: string[],
) {
  if (parts[0] !== "collections" || parts[2] !== "share") return null;
  const user = requireUser(req);
  const collection = row(
    "SELECT * FROM collections WHERE id=? AND owner_id=?",
    parts[1],
    user.id,
  );
  if (!collection) fail(404, "This collection is not available.");
  if (req.method === "POST") {
    const token = randomBytes(24).toString("hex");
    const snapshot = {
      name: collection.name,
      placeIds: rows(
        "SELECT place_id FROM collection_items WHERE collection_id=?",
        parts[1],
      ).map((r) => r.place_id),
    };
    db.prepare(
      "INSERT INTO collection_shares VALUES(?,?,?,?,?) ON CONFLICT(collection_id) DO UPDATE SET token=excluded.token,token_hash=excluded.token_hash,snapshot=excluded.snapshot,created_at=excluded.created_at",
    ).run(
      parts[1],
      token,
      tokenHash(token),
      JSON.stringify(snapshot),
      Date.now(),
    );
    return NextResponse.json(
      { token },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (req.method === "DELETE") {
    db.prepare("DELETE FROM collection_shares WHERE collection_id=?").run(
      parts[1],
    );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  fail(405, "Choose a supported sharing action.");
}
