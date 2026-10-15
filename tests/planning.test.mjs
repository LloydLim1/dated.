import test from "node:test";
import assert from "node:assert/strict";
import {
  splitExpense,
  settleExpenses,
  suggestItinerary,
} from "../src/lib/planning-core.mjs";
test("expense allocation conserves every centavo and settles without creating value", () => {
  const shares = splitExpense(10001, ["c", "a", "b"]);
  assert.equal(
    shares.reduce((sum, s) => sum + s.amount, 0),
    10001,
  );
  assert.deepEqual(
    shares.map((s) => s.amount),
    [3334, 3334, 3333],
  );
  const settlement = settleExpenses([
    { paidBy: "a", amount: 10001, shares },
    { paidBy: "c", amount: 1000, shares: splitExpense(1000, ["a", "c"]) },
  ]);
  assert.equal(
    Object.values(settlement.balances).reduce((a, b) => a + b, 0),
    0,
  );
  assert.equal(
    settlement.transfers.reduce((a, b) => a + b.amount, 0),
    Object.values(settlement.balances)
      .filter((n) => n > 0)
      .reduce((a, b) => a + b, 0),
  );
});
test("automatic outings respect total group budgets, available time and supported price data", () => {
  const places = [
    {
      id: "a",
      name: "A",
      city: "Makati",
      category: "Café",
      sample: false,
      lat: 14.55,
      lng: 121.02,
      budget: 200,
      budgetKnown: true,
      rating: 4,
    },
    {
      id: "b",
      name: "B",
      city: "Makati",
      category: "Museum",
      sample: false,
      lat: 14.551,
      lng: 121.02,
      budget: 100,
      budgetKnown: true,
      rating: 4.5,
    },
    {
      id: "c",
      name: "C",
      city: "Makati",
      category: "Restaurant",
      sample: false,
      lat: 14.551,
      lng: 121.02,
      budget: 0,
      budgetKnown: false,
      rating: 5,
    },
  ];
  const result = suggestItinerary(places, {
    city: "Makati",
    budget: 600,
    groupSize: 2,
    hours: 6,
    maxStops: 3,
    startMinutes: 600,
  });
  assert.equal(result.total, 600);
  assert.equal(result.stops.length, 2);
  assert.equal(result.partial, true);
  assert.ok(result.stops.every((s) => s.place.id !== "c"));
  assert.ok(
    result.stops.at(-1).startMinutes + result.stops.at(-1).duration <= 960,
  );
  assert.equal(
    suggestItinerary(places, {
      city: "Makati",
      budget: 100,
      groupSize: 2,
      hours: 6,
      maxStops: 3,
    }).stops.length,
    0,
  );
});
