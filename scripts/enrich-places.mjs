import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeCatalog,
  refreshMetroEnrichment,
} from "../src/lib/place-catalog.mjs";

const dataDir = resolve(process.env.DATED_DATA_DIR || ".data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, "dated.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,data TEXT NOT NULL)",
);
initializeCatalog(db);
try {
  const result = await refreshMetroEnrichment(db, dataDir, {
    force: process.argv.includes("--force"),
    progress: (event) => {
      if (event.phase || event.warning || event.checked % 10 === 0)
        console.log(JSON.stringify(event));
    },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
