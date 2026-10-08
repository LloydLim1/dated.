import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { readdirSync, unlinkSync } from "node:fs";
const dir = resolve(process.env.DATED_DATA_DIR || ".data");
const db = new DatabaseSync(resolve(dir, "dated.sqlite"));
const now = Date.now();
const expired = db
  .prepare(
    "SELECT id,file FROM media WHERE expires<? OR (review_id IS NULL AND created_at<?)",
  )
  .all(now, now - 86400000);
for (const m of expired) {
  try {
    unlinkSync(resolve(dir, "media", m.file));
    db.prepare("DELETE FROM media WHERE id=?").run(m.id);
  } catch (e) {
    if (e.code === "ENOENT")
      db.prepare("DELETE FROM media WHERE id=?").run(m.id);
    else throw e;
  }
}
db.prepare("DELETE FROM sessions WHERE expires<?").run(now);
db.prepare("DELETE FROM limits WHERE reset<?").run(now);
// Remove orphan files left after an interrupted upload or account deletion.
const referenced = new Set(
  db
    .prepare("SELECT file FROM media")
    .all()
    .map((m) => m.file),
);
for (const file of readdirSync(resolve(dir, "media"))) {
  if (/^[a-f0-9-]+\.webp$/.test(file) && !referenced.has(file))
    unlinkSync(resolve(dir, "media", file));
}
console.log(
  `Removed ${expired.length} expired or abandoned uploads. Sessions and counters pruned.`,
);
db.close();
