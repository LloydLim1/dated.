import { db, rows, row, type Row } from "./db";
import { canSee, publicUser } from "./auth";
import { catalogStatus } from "@/lib/place-catalog.mjs";
import { reviewSummary, criterionSummary } from "@/lib/review-credibility.mjs";
import {
  type User,
  type Review,
  type Place,
  type Outing,
  type Collection,
  type Visibility,
  type PhotoPost,
} from "@/lib/types";
export const userById = (id: string) => {
  const r = row("SELECT * FROM users WHERE id=?", id);
  return r ? publicUser(r) : null;
};
export const placeById = (id: string): Place | null => {
  const r = row("SELECT * FROM places WHERE id=?", id);
  if(!r)return null;
  const place:Place=JSON.parse(String(r.data));
  const details=row("SELECT d.* FROM business_place_details d JOIN business_branches b ON b.place_id=d.place_id AND b.org_id=d.org_id WHERE d.place_id=?",id);
  return details?{...place,hours:String(details.hours||place.hours),description:String(details.description||place.description),...(details.budget===null?{}:{budget:Number(details.budget),budgetKnown:true,budgetSource:"owner" as const}),tags:JSON.parse(String(details.tags)),ownerUpdatedAt:Number(details.updated_at)}:place;
};
const summarizeReviews = (all: Row[]) => {
  const reviews = all.map((r) => ({
    id: String(r.id),
    authorId: String(r.author_id),
    visitDate: String(r.visit_date),
    createdAt: Number(r.created_at),
    ratings: JSON.parse(String(r.ratings)),
    visibility: String(r.visibility),
    hidden: !!r.hidden,
    demo: !!r.demo,
    incentive: !!r.incentive || !!r.business_relationship,
    supported: !!r.supported,
    outingId: r.outing_id ? String(r.outing_id) : undefined,
  }));
  return { ...reviewSummary(reviews), criteria: criterionSummary(reviews) };
};
export const ratedPlaceById = (id: string): Place | null => {
  const place = placeById(id);
  return place
    ? {
        ...place,
        ...summarizeReviews(
          rows(
            "SELECT * FROM reviews WHERE place_id=? AND visibility='public' AND hidden=0 AND demo=0",
            id,
          ),
        ),
      }
    : null;
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
    criteriaVersion: Number(r.criteria_version || 1),
    notApplicable: JSON.parse(String(r.not_applicable || "[]")),
    rewardOptIn: !!r.reward_opt_in,
    rewardStatus: row(
      "SELECT status FROM reward_claims WHERE review_id=?",
      String(r.id),
    )?.status as string | undefined,
    spending: r.spending_known === 0 ? null : Number(r.spending),
    visibility: r.visibility as Review["visibility"],
    incentive: !!r.incentive,
    businessRelationship: !!r.business_relationship,
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
export function visiblePost(r: Row, me: User | null) {
  return canSee(String(r.author_id), String(r.visibility), me);
}
export function getPosts(me: User | null): PhotoPost[] {
  return rows("SELECT * FROM posts ORDER BY created_at DESC LIMIT 200")
    .filter((p) => visiblePost(p, me))
    .map((p) => ({
      id: String(p.id),
      author: userById(String(p.author_id))!,
      placeId: String(p.place_id),
      caption: String(p.caption),
      visitDate: String(p.visit_date),
      visibility: p.visibility as Visibility,
      createdAt: Number(p.created_at),
      media: rows(
        "SELECT id FROM media WHERE post_id=? ORDER BY position,created_at,id",
        String(p.id),
      ).map((m) => String(m.id)),
      likes: Number(
        row(
          "SELECT count(*) n FROM post_reactions WHERE post_id=?",
          String(p.id),
        )?.n || 0,
      ),
      liked:
        !!me &&
        !!row(
          "SELECT 1 FROM post_reactions WHERE post_id=? AND user_id=?",
          String(p.id),
          me.id,
        ),
      comments: rows(
        "SELECT * FROM post_comments WHERE post_id=? ORDER BY created_at LIMIT 100",
        String(p.id),
      ).map((c) => ({
        id: String(c.id),
        author: userById(String(c.author_id))!,
        body: String(c.body),
        createdAt: Number(c.created_at),
      })),
    }));
}
export function getPlaces(): Place[] {
  const details=new Map(rows("SELECT d.* FROM business_place_details d JOIN business_branches b ON b.place_id=d.place_id AND b.org_id=d.org_id").map(d=>[String(d.place_id),d]));
  const grouped = new Map<string, Row[]>();
  for (const review of rows(
    "SELECT * FROM reviews WHERE visibility='public' AND hidden=0 AND demo=0 ORDER BY created_at ASC",
  )) {
    const key = String(review.place_id);
    const list = grouped.get(key) || [];
    list.push(review);
    grouped.set(key, list);
  }
  return rows("SELECT data FROM places").map((r) => {
    const p: Place = JSON.parse(String(r.data));
    const detail=details.get(p.id);
    const all = grouped.get(p.id) || [];
    return {
      ...p,
      ...(detail?{hours:String(detail.hours||p.hours),description:String(detail.description||p.description),...(detail.budget===null?{}:{budget:Number(detail.budget),budgetKnown:true,budgetSource:"owner" as const}),tags:JSON.parse(String(detail.tags)),ownerUpdatedAt:Number(detail.updated_at)}:{}),
      ...summarizeReviews(all),
    };
  });
}
export function getCollections(me: User | null): Collection[] {
  return me
    ? rows("SELECT * FROM collections WHERE owner_id=?", me.id).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        shareToken: row("SELECT token FROM collection_shares WHERE collection_id=?", String(r.id))?.token as string | undefined,
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
        "SELECT i.*,o.title,o.date,o.notes,u.name FROM invitations i JOIN outings o ON o.id=i.outing_id JOIN users u ON u.id=o.owner_id WHERE i.user_id=? AND i.status!='declined'",
        me.id,
      ).map((r) => ({
        id: String(r.id),
        outingId: String(r.outing_id),
        title: String(r.title),
        from: String(r.name),
        status: String(r.status),
        visibility: r.visibility as Visibility,
        date: String(r.date),
        notes: String(r.notes),
        stops: rows(
          "SELECT place_id FROM outing_stops WHERE outing_id=? ORDER BY position",
          String(r.outing_id),
        ).map((s) => String(s.place_id)),
      }))
    : [];
  return {
    me,
    places: getPlaces(),
    feed: getFeed(me),
    posts: getPosts(me),
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
    catalog: catalogStatus(db),
  };
}
