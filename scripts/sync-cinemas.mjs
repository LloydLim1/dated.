import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { syncCinemas, cinemaStatus } from "../src/lib/cinema-catalog.mjs";
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
  console.log(
    JSON.stringify(
      process.argv.includes("--audit")
        ? cinemaStatus(db)
        : await syncCinemas(db, dataDir, {
            source: file("--source"),
            boundarySource: file("--boundary-source"),
            force: process.argv.includes("--force"),
            progress: (e) => console.log(JSON.stringify(e)),
          }),
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
