import { rows, row, type Row } from "./db";
import { canSee, publicUser } from "./auth";
import {
  average,
  type User,
  type Review,
  type Place,
  type Outing,
  type Collection,
} from "@/lib/types";
export const userById = (id: string) => {
  const r = row("SELECT * FROM users WHERE id=?", id);
  return r ? publicUser(r) : null;
};
export const placeById = (id: string): Place | null => {
  const r = row("SELECT * FROM places WHERE id=?", id);
  return r ? JSON.parse(String(r.data)) : null;
};
export function visibleReview(r: Row, me: User | null) {
  return (
    (!r.hidden || r.author_id === me?.id || me?.role === "admin") &&
    canSee(String(r.author_id), String(r.visibility), me)
  );
}
export function serializeReview(r: Row, me: User | null): Review {
  return {
    id: String(r.id),
    author: userById(String(r.author_id))!,
    placeId: String(r.place_id),
    title: String(r.title),
    body: String(r.body),
    visitDate: String(r.visit_date),
    ratings: JSON.parse(String(r.ratings)),
    spending: Number(r.spending),
    visibility: r.visibility as Review["visibility"],
    incentive: !!r.incentive,
    supported: !!r.supported,
    hidden: !!r.hidden,
    media: rows(
      "SELECT id FROM media WHERE review_id=? AND kind='photo'",
      String(r.id),
    ).map((m) => String(m.id)),
    createdAt: Number(r.created_at),
    likes: Number(
      row("SELECT count(*) n FROM reactions WHERE review_id=?", String(r.id))
        ?.n || 0,
    ),
    liked:
      !!me &&
      !!row(
        "SELECT 1 FROM reactions WHERE review_id=? AND user_id=?",
        String(r.id),
        me.id,
      ),
    comments: rows(
      "SELECT * FROM comments WHERE review_id=? ORDER BY created_at LIMIT 100",
      String(r.id),
    ).map((c) => ({
      id: String(c.id),
      author: userById(String(c.author_id))!,
      body: String(c.body),
      createdAt: Number(c.created_at),
    })),
    demo: !!r.demo,
  };
}
export function getFeed(me: User | null, placeId?: string) {
  return rows(
    "SELECT * FROM reviews" +
      (placeId ? " WHERE place_id=?" : "") +
      " ORDER BY created_at DESC LIMIT 200",
    ...(placeId ? [placeId] : []),
  )
    .filter((r) => visibleReview(r, me))
    .map((r) => ({
      ...serializeReview(r, me),
      outingId:
        r.outing_id &&
        me &&
        !!row(
          "SELECT 1 FROM outings o WHERE o.id=? AND (o.owner_id=? OR EXISTS(SELECT 1 FROM invitations i WHERE i.outing_id=o.id AND i.user_id=? AND i.status='accepted'))",
          String(r.outing_id),
          me.id,
          me.id,
        )
          ? String(r.outing_id)
          : undefined,
      ...(r.author_id === me?.id
        ? {
            evidence: row(
              "SELECT id FROM media WHERE review_id=? AND kind='evidence' AND expires>?",
              String(r.id),
              Date.now(),
            )?.id as string | undefined,
          }
        : {}),
    }));
}
export function getPlaces(): Place[] {
  return rows("SELECT data FROM places").map((r) => {
    const p: Place = JSON.parse(String(r.data));
    const all = rows(
      "SELECT * FROM reviews WHERE place_id=? AND visibility='public' AND hidden=0 AND demo=0 ORDER BY created_at ASC",
      p.id,
    );
    const authorRatings = new Map<string, number>();
    for (const review of all)
      authorRatings.set(
        String(review.author_id),
        average(JSON.parse(String(review.ratings))),
      );
    const values = [...authorRatings.values()];
    return {
      ...p,
      rating: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
      reviewCount: all.length,
      independentVisits: new Set(
        all
          .filter(
            (r) =>
              String(r.visit_date) >=
              new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
          )
          .map(
            (r) => r.outing_id || String(r.author_id) + String(r.visit_date),
          ),
      ).size,
    };
  });
}
export function getCollections(me: User | null): Collection[] {
  return me
    ? rows("SELECT * FROM collections WHERE owner_id=?", me.id).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        placeIds: rows(
          "SELECT place_id FROM collection_items WHERE collection_id=?",
          String(r.id),
        ).map((i) => String(i.place_id)),
      }))
    : [];
}
export function canSeeOuting(r: Row, me: User | null) {
  return (
    canSee(String(r.owner_id), String(r.visibility), me) ||
    (!!me &&
      !!row(
        "SELECT 1 FROM invitations WHERE outing_id=? AND user_id=? AND status='accepted'",
        String(r.id),
        me.id,
      ))
  );
}
export function getOutings(me: User | null): Outing[] {
  return rows("SELECT * FROM outings ORDER BY created_at DESC LIMIT 200")
    .filter((r) => canSeeOuting(r, me))
    .map((r) => ({
      id: String(r.id),
      owner: userById(String(r.owner_id))!,
      title: String(r.title),
      date: String(r.date),
      visibility: r.visibility as Outing["visibility"],
      notes: String(r.notes),
      completed: !!r.completed,
      stops: rows(
        "SELECT place_id FROM outing_stops WHERE outing_id=? ORDER BY position",
        String(r.id),
      ).map((s) => String(s.place_id)),
      participants: rows(
        "SELECT * FROM invitations WHERE outing_id=?",
        String(r.id),
      )
        .filter(
          (p) =>
            p.user_id === me?.id ||
            r.owner_id === me?.id ||
            (p.status === "accepted" &&
              canSee(String(p.user_id), String(p.visibility), me)),
        )
        .map((p) => ({
          user: userById(String(p.user_id))!,
          status: String(p.status),
          visibility: p.visibility as Outing["visibility"],
        })),
    }));
}
export function bootstrap(me: User | null) {
  const invitations = me
    ? rows(
        "SELECT i.*,o.title,u.name FROM invitations i JOIN outings o ON o.id=i.outing_id JOIN users u ON u.id=o.owner_id WHERE i.user_id=? AND i.status!='declined'",
        me.id,
      ).map((r) => ({
        id: String(r.id),
        outingId: String(r.outing_id),
        title: String(r.title),
        from: String(r.name),
        status: String(r.status),
      }))
    : [];
  return {
    me,
    places: getPlaces(),
    feed: getFeed(me),
    users: rows(
      "SELECT * FROM users ORDER BY demo DESC,created_at DESC LIMIT 100",
    ).map(publicUser),
    following: me
      ? rows("SELECT following FROM follows WHERE follower=?", me.id).map((r) =>
          String(r.following),
        )
      : [],
    collections: getCollections(me),
    outings: getOutings(me),
    invitations,
    unread: invitations.filter((i) => i.status === "pending").length,
    mode: "local-pilot",
  };
}
