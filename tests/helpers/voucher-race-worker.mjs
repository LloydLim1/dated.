import { parentPort, workerData } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { createCommerce } from "../../src/lib/commerce-core.mjs";
const db = new DatabaseSync(workerData.file);
db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
const core = createCommerce(db, {
  now: () => Date.parse("2026-10-15T05:00:00Z"),
});
parentPort.once("message", () => {
  try {
    core.claimVoucher(workerData.user, workerData.offerId, randomUUID());
    parentPort.postMessage({ ok: true });
  } catch (error) {
    parentPort.postMessage({ ok: false, message: error.message });
  } finally {
    db.close();
  }
});
parentPort.postMessage("ready");
