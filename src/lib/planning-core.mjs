export function splitExpense(amount, participants) {
  if (!Number.isInteger(amount) || amount < 1 || !participants.length)
    throw new Error("Choose a positive amount and at least one participant.");
  const ids = [...new Set(participants)].sort();
  const base = Math.floor(amount / ids.length),
    remainder = amount % ids.length;
  return ids.map((userId, index) => ({
    userId,
    amount: base + (index < remainder ? 1 : 0),
  }));
}
export function settleExpenses(expenses) {
  const balances = new Map();
  for (const expense of expenses) {
    balances.set(
      expense.paidBy,
      (balances.get(expense.paidBy) || 0) + expense.amount,
    );
    for (const share of expense.shares)
      balances.set(
        share.userId,
        (balances.get(share.userId) || 0) - share.amount,
      );
  }
  const creditors = [...balances]
    .filter(([, n]) => n > 0)
    .map(([userId, amount]) => ({ userId, amount }));
  const debtors = [...balances]
    .filter(([, n]) => n < 0)
    .map(([userId, amount]) => ({ userId, amount: -amount }));
  const transfers = [];
  for (const debtor of debtors)
    for (const creditor of creditors) {
      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount) {
        transfers.push({ from: debtor.userId, to: creditor.userId, amount });
        debtor.amount -= amount;
        creditor.amount -= amount;
      }
    }
  return { balances: Object.fromEntries(balances), transfers };
}
const distance = (a, b) => {
  const rad = (n) => (n * Math.PI) / 180,
    dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
export function suggestItinerary(places, input) {
  const group = input.groupSize || 1,
    max = input.maxStops || 3;
  const candidates = places.filter(
    (p) =>
      !p.sample &&
      p.city === input.city &&
      p.lat != null &&
      p.lng != null &&
      p.budgetKnown !== false &&
      Number.isFinite(p.budget) &&
      (!input.categories?.length || input.categories.includes(p.category)),
  );
  candidates.sort(
    (a, b) =>
      (b.rating || 0) - (a.rating || 0) ||
      a.budget - b.budget ||
      a.name.localeCompare(b.name),
  );
  const selected = [],
    used = new Set();
  let spent = 0,
    minute = input.startMinutes || 600;
  const end = minute + (input.hours || 6) * 60;
  while (selected.length < max) {
    const previous = selected.at(-1)?.place;
    const fits = candidates.filter(
      (p) =>
        !used.has(p.id) &&
        spent + p.budget * group <= input.budget &&
        (!previous || distance(previous, p) <= 8),
    );
    fits.sort(
      (a, b) =>
        Number(selected.some((s) => s.place.category === a.category)) -
          Number(selected.some((s) => s.place.category === b.category)) ||
        (previous ? distance(previous, a) - distance(previous, b) : 0),
    );
    const next = fits.find(
      (p) =>
        minute +
          (previous
            ? Math.max(15, Math.ceil((distance(previous, p) / 4) * 60))
            : 0) +
          (p.category === "Museum" || p.category === "Cinema" ? 120 : 60) <=
        end,
    );
    if (!next) break;
    const travel = previous
      ? Math.max(15, Math.ceil((distance(previous, next) / 4) * 60))
      : 0;
    minute += travel;
    const duration =
      next.category === "Museum" || next.category === "Cinema" ? 120 : 60;
    selected.push({
      place: next,
      startMinutes: minute,
      duration,
      travelMinutes: travel,
      estimatedCost: next.budget * group,
    });
    used.add(next.id);
    spent += next.budget * group;
    minute += duration;
  }
  return {
    stops: selected,
    total: spent,
    remaining: input.budget - spent,
    groupSize: group,
    notice:
      "Travel is a rough walking estimate, not live directions. Confirm opening hours, reservations, accessibility and prices before visiting.",
    partial: selected.length < max,
  };
}
