import { DatabaseSync, backup } from "node:sqlite";
import { resolve } from "node:path";
import { mkdirSync, cpSync, existsSync } from "node:fs";
const destination = process.argv[2];
if (!destination) {
  console.error("Usage: node scripts/backup.mjs <new-backup-directory>");
  process.exit(1);
}
const source = resolve(process.env.DATED_DATA_DIR || ".data");
const target = resolve(destination);
if (
  target === source ||
  target.startsWith(source + "\\") ||
  source.startsWith(target + "\\")
)
  throw new Error("Choose a separate backup directory.");
mkdirSync(target, { recursive: false });
const db = new DatabaseSync(resolve(source, "dated.sqlite"));
await backup(db, resolve(target, "dated.sqlite"));
cpSync(resolve(source, "media"), resolve(target, "media"), { recursive: true });
for (const item of [
  "logos",
  "nsi-source.json",
  "catalog-audit.json",
  "museum-cache.json",
  "museum-audit.json",
  "cinema-audit.json",
  "enrichment-audit.json",
]) {
  if (existsSync(resolve(source, item)))
    cpSync(resolve(source, item), resolve(target, item), { recursive: true });
}
db.close();
console.log(
  "Database and media backup saved. For a consistent snapshot, pause writes during backup.",
);
