import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, row, type Row } from "./db";
import type { User } from "@/lib/types";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
export const id = () => randomUUID();
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function validPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const tokenHash = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function publicUser(r: Row): User {
  return {
    id: String(r.id),
    name: String(r.name),
    username: String(r.username),
    bio: String(r.bio || ""),
    city: String(r.city),
    role: String(r.role),
    avatar: String(r.avatar || ""),
    demo: !!r.demo,
  };
}
export function currentUser(req: NextRequest): User | null {
  const token = req.cookies.get("dated_session")?.value;
  if (!token) return null;
  const r = row(
    "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
    tokenHash(token),
    Date.now(),
  );
  return r ? publicUser(r) : null;
}
export function requireUser(req: NextRequest) {
  const me = currentUser(req);
  return (
    me ?? fail(401, "Sign in to keep your places and experiences together.")
  );
}
export function createSession(response: NextResponse, userId: string) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    tokenHash(token),
    userId,
    Date.now() + 7 * 86400000,
  );
  response.cookies.set("dated_session", token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.DATED_SECURE_COOKIES !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export function guardMutation(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected =
    process.env.DATED_ORIGIN ||
    `${req.nextUrl.protocol}//${req.headers.get("host")}`;
  if (origin && origin !== expected)
    fail(403, "This request came from a different site.");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    fail(403, "This request came from a different site.");
}
export function limit(key: string, max = 100, windowMs = 60000) {
  const now = Date.now();
  const r = row("SELECT * FROM limits WHERE key=?", key);
  if (!r || Number(r.reset) < now) {
    db.prepare(
      "INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,reset=excluded.reset",
    ).run(key, now + windowMs);
  } else {
    if (Number(r.count) >= max)
      fail(429, "A little too fast. Please try again in a moment.");
    db.prepare("UPDATE limits SET count=count+1 WHERE key=?").run(key);
  }
  db.prepare("DELETE FROM limits WHERE reset<?").run(now - 86400000);
}
export function canSee(owner: string, visibility: string, viewer: User | null) {
  return (
    owner === viewer?.id ||
    visibility === "public" ||
    (visibility === "followers" &&
      !!viewer &&
      !!row(
        "SELECT 1 FROM follows WHERE follower=? AND following=?",
        viewer.id,
        owner,
      ))
  );
}
