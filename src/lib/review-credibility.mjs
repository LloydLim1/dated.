/** Latest non-incentivized public visit per account, with equal weight for each person.
 * Support reflects assessed visit evidence, never the truth of an opinion.
 * @param {{id:string,authorId:string,visitDate:string,createdAt:number,ratings:Record<string,number>,visibility:string,hidden:boolean,demo:boolean,incentive:boolean,supported:boolean,outingId?:string}[]} reviews
 */
export function reviewSummary(reviews, now = Date.now()) {
  const publicReviews = reviews.filter(
    (r) => r.visibility === "public" && !r.hidden && !r.demo,
  );
  const latest = new Map();
  for (const review of publicReviews
    .filter((r) => !r.incentive)
    .sort(
      (a, b) =>
        b.visitDate.localeCompare(a.visitDate) ||
        b.createdAt - a.createdAt ||
        a.id.localeCompare(b.id),
    )) {
    const ratings = Object.values(review.ratings);
    if (
      !latest.has(review.authorId) &&
      ratings.length &&
      ratings.every((v) => Number.isFinite(v) && v >= 1 && v <= 5)
    )
      latest.set(review.authorId, review);
  }
  const counted = [...latest.values()];
  const rating = counted.length
    ? counted.reduce(
        (sum, r) =>
          sum +
          Object.values(r.ratings).reduce((a, b) => a + b, 0) /
            Object.keys(r.ratings).length,
        0,
      ) / counted.length
    : null;
  const cutoff = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  return {
    rating,
    reviewCount: publicReviews.length,
    ratedReviewerCount: counted.length,
    supportedReviewerCount: counted.filter((r) => r.supported).length,
    independentVisits: new Set(
      counted
        .filter((r) => r.visitDate >= cutoff && r.visitDate <= today)
        .map((r) => r.outingId || r.authorId),
    ).size,
  };
}
