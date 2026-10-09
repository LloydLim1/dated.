import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { museumStatus, syncMuseums } from "../src/lib/museum-catalog.mjs";
const dataDir = resolve(process.env.DATED_DATA_DIR || ".data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, "dated.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,data TEXT NOT NULL)",
);
const file = (flag) => {
  const i = process.argv.indexOf(flag);
  return i < 0
    ? undefined
    : JSON.parse(readFileSync(resolve(process.argv[i + 1]), "utf8"));
};
try {
  const result = process.argv.includes("--audit")
    ? museumStatus(db)
    : await syncMuseums(db, dataDir, {
        source: file("--source"),
        osmSource: file("--osm-source"),
        boundarySource: file("--boundary-source"),
        force: process.argv.includes("--force"),
        progress: (event) => console.log(JSON.stringify(event)),
      });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
