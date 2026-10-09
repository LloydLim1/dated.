import test from "node:test";
import assert from "node:assert/strict";
import { philippineDate } from "../src/lib/philippine-date.mjs";

test("uses the Philippine calendar date when UTC is still on the prior day", () => {
  assert.equal(philippineDate(new Date("2026-10-09T16:00:00.000Z")), "2026-10-10");
});

test("keeps the same calendar day while the Philippines is before midnight", () => {
  assert.equal(philippineDate(new Date("2026-10-10T03:00:00.000Z")), "2026-10-10");
});
