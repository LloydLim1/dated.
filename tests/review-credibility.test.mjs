import test from "node:test";
import assert from "node:assert/strict";
import { reviewSummary } from "../src/lib/review-credibility.mjs";
import { mapPriority } from "../src/lib/map-hierarchy.mjs";
const now = Date.parse("2026-10-09T12:00:00Z");
const review = (id, authorId, score, patch = {}) => ({
  id,
  authorId,
  visitDate: "2026-10-01",
  createdAt: 1,
  ratings: { food: score, service: score },
  visibility: "public",
  hidden: false,
  demo: false,
  incentive: false,
  supported: false,
  ...patch,
});
test("latest visit wins, late submission of an older visit cannot inflate a score", () => {
  const rows = [
    review("a", "one", 5, { visitDate: "2026-09-01", createdAt: 100 }),
    review("b", "one", 2, { visitDate: "2026-10-01" }),
    review("c", "two", 4, { supported: true }),
  ];
  assert.deepEqual(reviewSummary(rows, now), {
    rating: 3,
    reviewCount: 3,
    ratedReviewerCount: 2,
    supportedReviewerCount: 1,
    independentVisits: 2,
  });
});
test("private, hidden, demo and incentivized opinions cannot inflate the score or trending", () => {
  const excluded = [
    { visibility: "private" },
    { visibility: "followers" },
    { hidden: true },
    { demo: true },
    { incentive: true },
  ].map((p, i) => review(String(i), String(i), 5, p));
  assert.equal(reviewSummary(excluded, now).rating, null);
  assert.equal(reviewSummary(excluded, now).ratedReviewerCount, 0);
  assert.equal(reviewSummary(excluded, now).independentVisits, 0);
  assert.equal(
    reviewSummary(
      [
        review("x", "person", 2),
        review("y", "person", 5, { incentive: true, visitDate: "2026-10-05" }),
      ],
      now,
    ).rating,
    2,
  );
});
test("companions from one outing count as one trending visit, with equal separate opinions", () => {
  const result = reviewSummary(
    [
      review("a", "one", 1, { outingId: "group", supported: true }),
      review("b", "two", 5, { outingId: "group" }),
    ],
    now,
  );
  assert.equal(result.rating, 3);
  assert.equal(result.independentVisits, 1);
  assert.equal(result.supportedReviewerCount, 1);
});
test("repeat accounts and old visits cannot inflate map priority", () => {
  const repeated = Array.from({ length: 30 }, (_, i) =>
    review(String(i), "one", 5),
  );
  const single = reviewSummary([repeated[0]], now);
  assert.equal(
    mapPriority({ ...reviewSummary(repeated, now), category: "Restaurant" }),
    mapPriority({ ...single, category: "Restaurant" }),
  );
  assert.equal(
    reviewSummary([review("old", "one", 5, { visitDate: "2026-01-01" })], now)
      .independentVisits,
    0,
  );
});
