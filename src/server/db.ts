import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { seedPeople, seedPlaces } from "@/lib/seed";
import { initializeCommerce } from "@/lib/commerce-core.mjs";
export const dataDir = resolve(
  /* turbopackIgnore: true */ process.env.DATED_DATA_DIR || ".data",
);
mkdirSync(resolve(dataDir, "media"), { recursive: true });
const globalDb = globalThis as unknown as { datedDb?: DatabaseSync };
export const db =
  globalDb.datedDb ?? new DatabaseSync(resolve(dataDir, "dated.sqlite"));
globalDb.datedDb = db;
db.exec("PRAGMA busy_timeout=5000");
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT,bio TEXT DEFAULT '',city TEXT DEFAULT 'Metro Manila',avatar TEXT,role TEXT DEFAULT 'member',demo INTEGER DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS discovery_searches(key TEXT PRIMARY KEY,place_ids TEXT NOT NULL,created_at INTEGER NOT NULL,truncated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,place_id TEXT NOT NULL REFERENCES places(id),title TEXT NOT NULL,body TEXT NOT NULL,visit_date TEXT NOT NULL,ratings TEXT NOT NULL,spending INTEGER NOT NULL,visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')),incentive INTEGER DEFAULT 0,supported INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,demo INTEGER DEFAULT 0,created_at INTEGER NOT NULL,UNIQUE(author_id,place_id,visit_date));
 CREATE TABLE IF NOT EXISTS follows(follower TEXT REFERENCES users(id) ON DELETE CASCADE,following TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(follower,following),CHECK(follower != following));
 CREATE TABLE IF NOT EXISTS collections(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS collection_items(collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,place_id TEXT REFERENCES places(id),PRIMARY KEY(collection_id,place_id));
 CREATE TABLE IF NOT EXISTS collection_shares(collection_id TEXT PRIMARY KEY REFERENCES collections(id) ON DELETE CASCADE,token TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,snapshot TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS reactions(review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(review_id,user_id));
 CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE,author_id TEXT REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS outings(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,date TEXT NOT NULL,visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')),notes TEXT DEFAULT '',completed INTEGER DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS outing_stops(outing_id TEXT REFERENCES outings(id) ON DELETE CASCADE,place_id TEXT REFERENCES places(id),position INTEGER,PRIMARY KEY(outing_id,position),UNIQUE(outing_id,place_id));
 CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,outing_id TEXT REFERENCES outings(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,status TEXT DEFAULT 'pending',visibility TEXT DEFAULT 'private',seen INTEGER DEFAULT 0,UNIQUE(outing_id,user_id));
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE,kind TEXT NOT NULL,file TEXT NOT NULL,created_at INTEGER NOT NULL,expires INTEGER);
 CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE,reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,reason TEXT NOT NULL,status TEXT DEFAULT 'open',decision TEXT,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS moderation_actions(id TEXT PRIMARY KEY,review_id TEXT REFERENCES reviews(id) ON DELETE SET NULL,actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS appeals(id TEXT PRIMARY KEY,review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE,author_id TEXT REFERENCES users(id) ON DELETE CASCADE,reason TEXT NOT NULL,status TEXT DEFAULT 'open',created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS reviews_place ON reviews(place_id,visibility,hidden,created_at DESC);
 CREATE INDEX IF NOT EXISTS reviews_author ON reviews(author_id,created_at DESC);
 CREATE INDEX IF NOT EXISTS comments_review ON comments(review_id,created_at);
 CREATE INDEX IF NOT EXISTS follows_target ON follows(following,follower);
 CREATE INDEX IF NOT EXISTS invites_user ON invitations(user_id,status);
 CREATE INDEX IF NOT EXISTS outings_owner ON outings(owner_id,created_at DESC);
 CREATE INDEX IF NOT EXISTS media_review ON media(review_id,kind);
`);
if (!db.prepare("SELECT id FROM places LIMIT 1").get()) {
  const now = Date.now();
  db.exec("BEGIN");
  try {
    for (const p of seedPlaces)
      db.prepare("INSERT INTO places VALUES (?,?)").run(
        p.id,
        JSON.stringify({ ...p, sample: true }),
      );
    for (const p of seedPeople)
      db.prepare(
        "INSERT INTO users(id,username,name,bio,city,avatar,demo,created_at) VALUES(?,?,?,?,?,?,1,?)",
      ).run(p.id, p.username, p.name, p.bio, p.city, p.avatar, now);
    const reviews = [
      {
        id: "demo-review-1",
        author: "demo-mika",
        place: "fern-and-fable",
        title: "The kind of afternoon you want to keep",
        body: "We came for a quick coffee and stayed for two hours. The garden tables are lovely, and the drinks were thoughtfully made. A little busy after lunch, so come early if you want a quiet corner.",
        ratings: { "Coffee & drinks": 5, Atmosphere: 5, Service: 4, Value: 4 },
        spending: 420,
      },
      {
        id: "demo-review-2",
        author: "demo-jo",
        place: "casa-luna",
        title: "An easy yes for the next catch-up",
        body: "A relaxed dinner with friends. The sharing plates were the highlight; service slowed a little when it got busy. I would come back for dessert.",
        ratings: { Food: 5, Atmosphere: 4, Service: 3, Value: 4 },
        spending: 900,
      },
      {
        id: "demo-review-3",
        author: "demo-eli",
        place: "the-gallery",
        title: "Leave room for a little wonder",
        body: "A calm space to spend a rainy afternoon. The exhibits gave us plenty to talk about. A few more signs would have made the route easier to follow.",
        ratings: { Exhibits: 5, Accessibility: 3, Experience: 5, Value: 5 },
        spending: 200,
      },
    ];
    for (const [i, r] of reviews.entries())
      db.prepare(
        "INSERT INTO reviews(id,author_id,place_id,title,body,visit_date,ratings,spending,visibility,demo,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,?)",
      ).run(
        r.id,
        r.author,
        r.place,
        r.title,
        r.body,
        "2026-10-01",
        JSON.stringify(r.ratings),
        r.spending,
        "public",
        now - i * 3600000,
      );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
// Additive pilot migration; existing reviews and accounts remain intact.
db.exec(`
 CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,place_id TEXT NOT NULL REFERENCES places(id),caption TEXT NOT NULL,visit_date TEXT NOT NULL,visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')),created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS post_reactions(post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(post_id,user_id));
 CREATE TABLE IF NOT EXISTS post_comments(id TEXT PRIMARY KEY,post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,author_id TEXT REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS posts_author ON posts(author_id,created_at DESC);
 CREATE INDEX IF NOT EXISTS posts_place ON posts(place_id,created_at DESC);
`);
if (
  !(db.prepare("PRAGMA table_info(media)").all() as { name: string }[]).some(
    (c) => c.name === "post_id",
  )
)
  db.exec(
    "ALTER TABLE media ADD COLUMN post_id TEXT REFERENCES posts(id) ON DELETE CASCADE",
  );
db.exec("CREATE INDEX IF NOT EXISTS media_post ON media(post_id)");
if (
  !(db.prepare("PRAGMA table_info(media)").all() as { name: string }[]).some(
    (c) => c.name === "position",
  )
)
  db.exec("ALTER TABLE media ADD COLUMN position INTEGER DEFAULT 0");
if (
  !(db.prepare("PRAGMA table_info(reviews)").all() as { name: string }[]).some(
    (c) => c.name === "outing_id",
  )
)
  db.exec(
    "ALTER TABLE reviews ADD COLUMN outing_id TEXT REFERENCES outings(id) ON DELETE SET NULL",
  );
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS review_stop_unique ON reviews(author_id,outing_id,place_id) WHERE outing_id IS NOT NULL",
);
if (
  !db
    .prepare("PRAGMA table_info(reviews)")
    .all()
    .some((c) => c.name === "spending_known")
) {
  db.exec(
    "ALTER TABLE reviews ADD COLUMN spending_known INTEGER NOT NULL DEFAULT 1",
  );
}
export type Row = Record<string, string | number | null>;
db.exec(
  "CREATE TABLE IF NOT EXISTS itinerary_designs(outing_id TEXT PRIMARY KEY REFERENCES outings(id) ON DELETE CASCADE,settings TEXT NOT NULL,token TEXT UNIQUE,published TEXT,updated_at INTEGER NOT NULL)",
);
initializeCommerce(db);
export function rows(sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).all(...params) as Row[];
}
export function row(sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).get(...params) as Row | undefined;
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
