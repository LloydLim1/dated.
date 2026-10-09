import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catalogStatus, syncMetro } from "../src/lib/place-catalog.mjs";

const dataDir = resolve(process.env.DATED_DATA_DIR || ".data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, "dated.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,data TEXT NOT NULL)",
);
try {
  if (process.argv.includes("--audit"))
    console.log(JSON.stringify(catalogStatus(db), null, 2));
  else {
    const sourceAt = process.argv.indexOf("--source");
    const source =
      sourceAt >= 0
        ? JSON.parse(readFileSync(resolve(process.argv[sourceAt + 1]), "utf8"))
        : undefined;
    const result = await syncMetro(db, dataDir, {
      source,
      force: process.argv.includes("--force"),
      progress: (event) => {
        if (event.phase || event.warning || event.checked % 10 === 0)
          console.log(JSON.stringify(event));
      },
    });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
