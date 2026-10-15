import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { philippineDate } from "@/lib/philippine-date.mjs";
import { db, row, rows, transaction, dataDir } from "@/server/db";
import {
  id,
  currentUser,
  requireUser,
  fail,
  HttpError,
  hashPassword,
  validPassword,
  createSession,
  tokenHash,
  guardMutation,
  limit,
  publicUser,
} from "@/server/auth";
import {
  signup,
  login,
  reviewSchema,
  postSchema,
  outingSchema,
  visibility,
  validCriteria,
} from "@/server/validation";
import {
  bootstrap,
  placeById,
  ratedPlaceById,
  getFeed,
  visibleReview,
  userById,
  getPosts,
  visiblePost,
} from "@/server/read";
import { discover } from "@/server/discovery";
import { catalogStatus, initializeCatalog } from "@/lib/place-catalog.mjs";
import { refreshCatalog } from "@/server/catalog";
import { itineraryRequest } from "@/server/itineraries";
import { commerce, commerceRequest } from "@/server/commerce";
import { CommerceError } from "@/lib/commerce-core.mjs";
import { criteriaVersion } from "@/lib/review-criteria.mjs";
import { planningRequest } from "@/server/planning";
import { collectionSharingRequest } from "@/server/collection-sharing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: NextRequest, ctx: Context) {
  try {
    const parts = (await ctx.params).path;
    const path = parts.join("/");
    const method = req.method;
    const me = currentUser(req);
    if (method !== "GET") {
      guardMutation(req);
      limit(
        "mutation:" +
          tokenHash(req.cookies.get("dated_session")?.value || "guest"),
        120,
      );
    }
    if (
      method !== "GET" &&
      Number(req.headers.get("content-length") || 0) > 5 * 1024 * 1024
    )
      fail(413, "Keep each upload under 4 MB.");
    if (method === "GET" && path === "bootstrap") return json(bootstrap(me));
    const commercial = await commerceRequest(req, parts);
    if (commercial) return commercial;
    const planning = await planningRequest(req, parts);
    if (planning) return planning;
    const collectionShare = await collectionSharingRequest(req, parts);
    if (collectionShare) return collectionShare;
    const itinerary = await itineraryRequest(req, parts);
    if (itinerary) return itinerary;
    if (method === "GET" && path === "catalog") return json(catalogStatus(db));
    if (method === "GET" && parts[0] === "logos" && parts.length === 2) {
      initializeCatalog(db);
      if (!/^[a-f0-9]{64}$/.test(parts[1])) fail(404, "Logo unavailable.");
      const file = row("SELECT file FROM logo_files WHERE id=?", parts[1]);
      if (!file || String(file.file) !== parts[1] + ".webp")
        fail(404, "Logo unavailable.");
      return new NextResponse(
        readFileSync(resolve(dataDir, "logos", String(file.file))),
        {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    if (method === "GET" && path === "places/nearby")
      return json(await discover(req.nextUrl.searchParams));
    if (method === "GET" && parts[0] === "places" && parts[1]) {
      const p = ratedPlaceById(parts[1]);
      if (!p) fail(404, "That place is not here.");
      return json({
        place: p,
        reviews: getFeed(me, p.id),
        posts: getPosts(me).filter((post) => post.placeId === p.id),
      });
    }
    if (method === "POST" && path === "auth/signup") {
      limit("signup:global", 20, 3600000);
      const input = signup.parse(await req.json());
      if (
        row(
          "SELECT id FROM users WHERE email=? OR username=?",
          input.email,
          input.username,
        )
      )
        fail(409, "That email or username is already in use.");
      const userId = id();
      transaction(() => {
        db.prepare(
          "INSERT INTO users(id,email,username,name,password,avatar,created_at) VALUES(?,?,?,?,?,?,?)",
        ).run(
          userId,
          input.email,
          input.username,
          input.name,
          hashPassword(input.password),
          input.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
          Date.now(),
        );
        db.prepare("INSERT INTO collections VALUES(?,?,?)").run(
          id(),
          userId,
          "Want to go",
        );
      });
      const response = json({ me: userById(userId) }, 201);
      createSession(response, userId);
      return response;
    }
    if (method === "POST" && path === "auth/login") {
      const input = login.parse(await req.json());
      limit("login:" + tokenHash(input.email), 8, 900000);
      const r = row(
        "SELECT * FROM users WHERE email=? AND demo=0",
        input.email,
      );
      if (!r?.password || !validPassword(input.password, String(r.password)))
        fail(401, "The email or password does not match.");
      const response = json({ me: publicUser(r) });
      createSession(response, String(r.id));
      return response;
    }
    if (method === "POST" && path === "auth/logout") {
      const token = req.cookies.get("dated_session")?.value;
      if (token)
        db.prepare("DELETE FROM sessions WHERE token=?").run(tokenHash(token));
      const r = json({ ok: true });
      r.cookies.set("dated_session", "", { maxAge: 0, path: "/" });
      return r;
    }
    if (method === "GET" && parts[0] === "media" && parts[1]) {
      const m = row("SELECT * FROM media WHERE id=?", parts[1]);
      if (!m || (m.expires && Number(m.expires) < Date.now()))
        fail(404, "This file is no longer available.");
      const review = m.review_id
        ? row("SELECT * FROM reviews WHERE id=?", String(m.review_id))
        : null;
      const allowed =
        m.owner_id === me?.id ||
        (m.kind === "evidence"
          ? me?.role === "admin"
          : (review && visibleReview(review, me)) ||
            (m.post_id &&
              (() => {
                const post = row(
                  "SELECT * FROM posts WHERE id=?",
                  String(m.post_id),
                );
                return post && visiblePost(post, me);
              })()));
      if (!allowed) fail(404, "This file is not available.");
      return new NextResponse(
        readFileSync(resolve(dataDir, "media", String(m.file))),
        {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    const user = requireUser(req);
    if (method === "POST" && path === "catalog/refresh") {
      if (user.role !== "admin")
        fail(403, "Only an administrator can refresh the full directory.");
      limit("catalog:manual", 1, 3600000);
      void refreshCatalog(true).catch((error: Error) =>
        console.error("Restaurant refresh failed:", error.message),
      );
      return json(
        {
          message:
            "Metro Manila refresh started. Existing places remain available.",
        },
        202,
      );
    }
    if (
      (method === "POST" && path === "posts") ||
      (method === "PATCH" && parts[0] === "posts" && parts.length === 2)
    ) {
      const input = postSchema.parse(await req.json());
      if (!placeById(input.placeId))
        fail(404, "Choose a place from the map or explore list.");
      const previous =
        method === "PATCH"
          ? row(
              "SELECT * FROM posts WHERE id=? AND author_id=?",
              parts[1],
              user.id,
            )
          : null;
      if (method === "PATCH" && !previous)
        fail(404, "That photo post is not yours to edit.");
      const postId = previous ? String(previous.id) : id();
      for (const mediaId of input.media) {
        const media = row(
          "SELECT * FROM media WHERE id=? AND owner_id=?",
          mediaId,
          user.id,
        );
        if (
          !media ||
          media.kind !== "photo" ||
          media.review_id ||
          (media.post_id && media.post_id !== postId)
        )
          fail(400, "A selected photo is not available.");
      }
      const removed = rows(
        "SELECT id,file FROM media WHERE post_id=?",
        postId,
      ).filter((m) => !input.media.includes(String(m.id)));
      transaction(() => {
        if (previous)
          db.prepare(
            "UPDATE posts SET place_id=?,caption=?,visit_date=?,visibility=? WHERE id=?",
          ).run(
            input.placeId,
            input.caption,
            input.visitDate,
            input.visibility,
            postId,
          );
        else
          db.prepare(
            "INSERT INTO posts(id,author_id,place_id,caption,visit_date,visibility,created_at) VALUES(?,?,?,?,?,?,?)",
          ).run(
            postId,
            user.id,
            input.placeId,
            input.caption,
            input.visitDate,
            input.visibility,
            Date.now(),
          );
        for (const [position, mediaId] of input.media.entries())
          db.prepare("UPDATE media SET post_id=?,position=? WHERE id=?").run(
            postId,
            position,
            mediaId,
          );
        for (const media of removed)
          db.prepare("DELETE FROM media WHERE id=?").run(String(media.id));
      });
      for (const media of removed) {
        try {
          unlinkSync(resolve(dataDir, "media", String(media.file)));
        } catch {
          /* Maintenance removes orphaned files. */
        }
      }
      return json({ id: postId }, previous ? 200 : 201);
    }
    if (parts[0] === "posts" && parts[1]) {
      const post = row("SELECT * FROM posts WHERE id=?", parts[1]);
      if (!post || !visiblePost(post, user))
        fail(404, "That photo post is not available.");
      if (method === "DELETE" && parts.length === 2) {
        if (post.author_id !== user.id)
          fail(404, "That photo post is not yours to delete.");
        const files = rows("SELECT file FROM media WHERE post_id=?", parts[1]);
        db.prepare("DELETE FROM posts WHERE id=?").run(parts[1]);
        for (const file of files) {
          try {
            unlinkSync(resolve(dataDir, "media", String(file.file)));
          } catch {
            /* Maintenance removes orphaned files. */
          }
        }
        return json({ ok: true });
      }
      if (method === "POST" && parts[2] === "reactions" && parts.length === 3) {
        if (
          row(
            "SELECT 1 FROM post_reactions WHERE post_id=? AND user_id=?",
            parts[1],
            user.id,
          )
        )
          db.prepare(
            "DELETE FROM post_reactions WHERE post_id=? AND user_id=?",
          ).run(parts[1], user.id);
        else
          db.prepare("INSERT INTO post_reactions VALUES(?,?)").run(
            parts[1],
            user.id,
          );
        return json({ ok: true });
      }
      if (method === "POST" && parts[2] === "comments" && parts.length === 3) {
        const input = z
          .object({ body: z.string().trim().min(1).max(1000) })
          .parse(await req.json());
        limit("comment:" + user.id, 30, 3600000);
        db.prepare("INSERT INTO post_comments VALUES(?,?,?,?,?)").run(
          id(),
          parts[1],
          user.id,
          input.body,
          Date.now(),
        );
        return json({ ok: true }, 201);
      }
    }
    if (method === "PATCH" && path === "profile") {
      const input = z
        .object({
          name: z.string().trim().min(2).max(60),
          bio: z.string().trim().max(200),
          city: z.string().trim().min(2).max(60),
        })
        .parse(await req.json());
      db.prepare(
        "UPDATE users SET name=?,bio=?,city=?,avatar=? WHERE id=?",
      ).run(
        input.name,
        input.bio,
        input.city,
        input.name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
        user.id,
      );
      return json({ ok: true });
    }
    if (method === "GET" && path === "account/export")
      return json({
        profile: row(
          "SELECT email,username,name,bio,city,created_at FROM users WHERE id=?",
          user.id,
        ),
        collections: bootstrap(user).collections,
        reviews: rows("SELECT * FROM reviews WHERE author_id=?", user.id),
        posts: rows("SELECT * FROM posts WHERE author_id=?", user.id),
        postComments: rows(
          "SELECT * FROM post_comments WHERE author_id=?",
          user.id,
        ),
        postReactions: rows(
          "SELECT * FROM post_reactions WHERE user_id=?",
          user.id,
        ),
        media: rows(
          "SELECT id,kind,review_id,post_id,position,created_at,expires FROM media WHERE owner_id=?",
          user.id,
        ),
        outings: rows("SELECT * FROM outings WHERE owner_id=?", user.id),
        itineraryDesigns: rows(
          "SELECT d.* FROM itinerary_designs d JOIN outings o ON o.id=d.outing_id WHERE o.owner_id=?",
          user.id,
        ),
        invitations: rows("SELECT * FROM invitations WHERE user_id=?", user.id),
        comments: rows("SELECT * FROM comments WHERE author_id=?", user.id),
        follows: rows(
          "SELECT following FROM follows WHERE follower=?",
          user.id,
        ),
        reports: rows("SELECT * FROM reports WHERE reporter_id=?", user.id),
        appeals: rows("SELECT * FROM appeals WHERE author_id=?", user.id),
        commerce: commerce.exportAccount(user),
      });
    if (method === "DELETE" && path === "account") {
      const input = z
        .object({ password: z.string().min(1).max(128) })
        .parse(await req.json());
      const account = row("SELECT password FROM users WHERE id=?", user.id);
      if (
        !account?.password ||
        !validPassword(input.password, String(account.password))
      )
        fail(401, "Confirm your password to delete this account.");
      const media = rows("SELECT file FROM media WHERE owner_id=?", user.id);
      commerce.canDelete(user);
      db.prepare("DELETE FROM users WHERE id=?").run(user.id);
      for (const m of media) {
        try {
          unlinkSync(resolve(dataDir, "media", String(m.file)));
        } catch {
          /* Maintenance removes any orphaned file. */
        }
      }
      const response = json({ ok: true });
      response.cookies.set("dated_session", "", { maxAge: 0, path: "/" });
      return response;
    }
    if (method === "POST" && path === "follows") {
      const { userId } = z
        .object({ userId: z.string() })
        .parse(await req.json());
      if (userId === user.id || !userById(userId))
        fail(400, "Choose another person to follow.");
      const follows = row(
        "SELECT 1 FROM follows WHERE follower=? AND following=?",
        user.id,
        userId,
      );
      if (follows)
        db.prepare("DELETE FROM follows WHERE follower=? AND following=?").run(
          user.id,
          userId,
        );
      else db.prepare("INSERT INTO follows VALUES(?,?)").run(user.id, userId);
      return json({ following: !follows });
    }
    if (method === "POST" && path === "collections") {
      const { name } = z
        .object({ name: z.string().trim().min(2).max(60) })
        .parse(await req.json());
      if (
        Number(
          row("SELECT count(*) n FROM collections WHERE owner_id=?", user.id)
            ?.n,
        ) >= 30
      )
        fail(400, "You can create up to 30 collections.");
      const collectionId = id();
      db.prepare("INSERT INTO collections VALUES(?,?,?)").run(
        collectionId,
        user.id,
        name,
      );
      return json({ id: collectionId }, 201);
    }
    if (
      method === "PATCH" &&
      parts[0] === "collections" &&
      parts.length === 2
    ) {
      const { name } = z
        .object({ name: z.string().trim().min(2).max(60) })
        .parse(await req.json());
      if (
        !row(
          "SELECT 1 FROM collections WHERE id=? AND owner_id=?",
          parts[1],
          user.id,
        )
      )
        fail(404, "That collection is not available.");
      db.prepare("UPDATE collections SET name=? WHERE id=? AND owner_id=?").run(
        name,
        parts[1],
        user.id,
      );
      return json({ ok: true });
    }
    if (method === "POST" && path === "collections/items") {
      const { collectionId, placeId } = z
        .object({ collectionId: z.string(), placeId: z.string() })
        .parse(await req.json());
      if (
        !row(
          "SELECT 1 FROM collections WHERE id=? AND owner_id=?",
          collectionId,
          user.id,
        ) ||
        !placeById(placeId)
      )
        fail(404, "That collection or place is not available.");
      const existing = row(
        "SELECT 1 FROM collection_items WHERE collection_id=? AND place_id=?",
        collectionId,
        placeId,
      );
      if (existing)
        db.prepare(
          "DELETE FROM collection_items WHERE collection_id=? AND place_id=?",
        ).run(collectionId, placeId);
      else {
        db.prepare("INSERT INTO collection_items VALUES(?,?)").run(
          collectionId,
          placeId,
        );
        commerce.event(user, { placeId, kind: "save", session: user.id });
      }
      return json({ saved: !existing });
    }
    if (method === "DELETE" && parts[0] === "collections" && parts[1]) {
      db.prepare("DELETE FROM collections WHERE id=? AND owner_id=?").run(
        parts[1],
        user.id,
      );
      return json({ ok: true });
    }
    if (method === "POST" && path === "uploads") {
      limit("upload:" + user.id, 20, 3600000);
      const form = await req.formData();
      const file = form.get("file");
      const kind = form.get("kind");
      if (
        !(file instanceof File) ||
        !["photo", "evidence"].includes(String(kind))
      )
        fail(400, "Choose an image to upload.");
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 4 * 1024 * 1024 ||
        file.size === 0
      )
        fail(400, "Use a JPG, PNG, or WebP image under 4 MB.");
      const input = Buffer.from(await file.arrayBuffer());
      let output: Buffer;
      try {
        output = await sharp(input, { limitInputPixels: 40000000 })
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        fail(400, "This image could not be read. Try another photo.");
      }
      const mediaId = id();
      const filename = mediaId + ".webp";
      writeFileSync(resolve(dataDir, "media", filename), output!);
      db.prepare(
        "INSERT INTO media(id,owner_id,kind,file,created_at,expires) VALUES(?,?,?,?,?,?)",
      ).run(
        mediaId,
        user.id,
        String(kind),
        filename,
        Date.now(),
        kind === "evidence" ? Date.now() + 30 * 86400000 : null,
      );
      return json({ id: mediaId }, 201);
    }
    if (
      (method === "POST" && path === "reviews") ||
      (method === "PATCH" && parts[0] === "reviews" && parts.length === 2)
    ) {
      limit("reviews:" + user.id, 15, 3600000);
      const input = reviewSchema.parse(await req.json());
      const place = placeById(input.placeId);
      if (
        !place ||
        !validCriteria(place.category, input.ratings, input.notApplicable)
      )
        fail(
          400,
          "Score each criterion or choose Not applicable. At least one score is needed.",
        );
      const reviewId = method === "PATCH" ? parts[1] : id();
      const previous =
        method === "PATCH"
          ? row(
              "SELECT * FROM reviews WHERE id=? AND author_id=?",
              reviewId,
              user.id,
            )
          : null;
      if (method === "PATCH" && !previous)
        fail(404, "This review is not yours to edit.");
      if (previous && previous.place_id !== input.placeId)
        fail(400, "A review cannot be moved to another place.");
      if (
        row(
          "SELECT id FROM reviews WHERE author_id=? AND place_id=? AND visit_date=? AND id!=?",
          user.id,
          input.placeId,
          input.visitDate,
          reviewId,
        )
      )
        fail(
          409,
          "You already reviewed this place on that date. Edit your existing review instead.",
        );
      if (input.outingId) {
        if (
          !row(
            "SELECT 1 FROM outings o JOIN outing_stops s ON s.outing_id=o.id WHERE o.id=? AND s.place_id=? AND (o.owner_id=? OR EXISTS(SELECT 1 FROM invitations i WHERE i.outing_id=o.id AND i.user_id=? AND i.status='accepted'))",
            input.outingId,
            input.placeId,
            user.id,
            user.id,
          )
        )
          fail(
            403,
            "Only accepted companions can review a stop in this outing.",
          );
        if (
          row(
            "SELECT id FROM reviews WHERE author_id=? AND outing_id=? AND place_id=? AND id!=?",
            user.id,
            input.outingId,
            input.placeId,
            reviewId,
          )
        )
          fail(
            409,
            "You already reviewed this outing stop. Edit your existing review.",
          );
      }
      const selected = [
        ...input.media,
        ...(input.evidence ? [input.evidence] : []),
      ];
      for (const mediaId of selected) {
        const m = row(
          "SELECT * FROM media WHERE id=? AND owner_id=?",
          mediaId,
          user.id,
        );
        if (
          !m ||
          (m.review_id && m.review_id !== reviewId) ||
          m.post_id ||
          (m.expires && Number(m.expires) < Date.now())
        )
          fail(400, "A selected image is not available.");
        if (m.kind !== (mediaId === input.evidence ? "evidence" : "photo"))
          fail(400, "Please choose the right kind of image.");
      }
      transaction(() => {
        if (previous)
          db.prepare(
            "UPDATE reviews SET title=?,body=?,visit_date=?,ratings=?,spending=?,visibility=?,incentive=?,supported=0 WHERE id=?",
          ).run(
            input.title,
            input.body,
            input.visitDate,
            JSON.stringify(input.ratings),
            input.spending ?? 0,
            input.visibility,
            +input.incentive,
            reviewId,
          );
        else
          db.prepare(
            "INSERT INTO reviews(id,author_id,place_id,title,body,visit_date,ratings,spending,visibility,incentive,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            reviewId,
            user.id,
            input.placeId,
            input.title,
            input.body,
            input.visitDate,
            JSON.stringify(input.ratings),
            input.spending ?? 0,
            input.visibility,
            +input.incentive,
            Date.now(),
          );
        db.prepare("UPDATE media SET review_id=NULL WHERE review_id=?").run(
          reviewId,
        );
        for (const m of selected)
          db.prepare("UPDATE media SET review_id=? WHERE id=?").run(
            reviewId,
            m,
          );
        db.prepare(
          "UPDATE reviews SET outing_id=?,spending_known=? WHERE id=?",
        ).run(input.outingId || null, +(input.spending !== null), reviewId);
        db.prepare(
          "UPDATE reviews SET criteria_version=?,not_applicable=?,reward_opt_in=? WHERE id=?",
        ).run(
          criteriaVersion(place.category, input.ratings, input.notApplicable),
          JSON.stringify(input.notApplicable),
          +input.rewardOptIn,
          reviewId,
        );
        commerce.requestReward(user, reviewId);
        db.prepare("UPDATE reviews SET business_relationship=? WHERE id=?").run(+commerce.isBusinessReviewer(user.id,input.placeId),reviewId);
      });
      return json({ id: reviewId }, previous ? 200 : 201);
    }
    if (method === "DELETE" && parts[0] === "reviews" && parts.length === 2) {
      if (
        !row(
          "SELECT id FROM reviews WHERE id=? AND author_id=?",
          parts[1],
          user.id,
        )
      )
        fail(404, "This review is not yours to delete.");
      const files = rows("SELECT file FROM media WHERE review_id=?", parts[1]);
      db.prepare("DELETE FROM reviews WHERE id=?").run(parts[1]);
      for (const f of files) {
        try {
          unlinkSync(resolve(dataDir, "media", String(f.file)));
        } catch {
          /* Maintenance removes any orphaned file. */
        }
      }
      return json({ ok: true });
    }
    if (parts[0] === "reviews" && parts[1] && parts[2]) {
      const review = row("SELECT * FROM reviews WHERE id=?", parts[1]);
      if (!review || !visibleReview(review, user))
        fail(404, "This review is not available.");
      if (method === "POST" && parts[2] === "reactions") {
        const liked = row(
          "SELECT 1 FROM reactions WHERE review_id=? AND user_id=?",
          parts[1],
          user.id,
        );
        if (liked)
          db.prepare(
            "DELETE FROM reactions WHERE review_id=? AND user_id=?",
          ).run(parts[1], user.id);
        else
          db.prepare("INSERT INTO reactions VALUES(?,?)").run(
            parts[1],
            user.id,
          );
        return json({ liked: !liked });
      }
      if (method === "POST" && parts[2] === "comments") {
        const { body } = z
          .object({ body: z.string().trim().min(1).max(500) })
          .parse(await req.json());
        limit("comments:" + user.id, 20, 60000);
        db.prepare("INSERT INTO comments VALUES(?,?,?,?,?)").run(
          id(),
          parts[1],
          user.id,
          body,
          Date.now(),
        );
        return json({ ok: true }, 201);
      }
      if (method === "POST" && parts[2] === "reports") {
        const { reason } = z
          .object({ reason: z.string().trim().min(5).max(1000) })
          .parse(await req.json());
        if (
          row(
            "SELECT 1 FROM reports WHERE review_id=? AND reporter_id=? AND status='open'",
            parts[1],
            user.id,
          )
        )
          fail(409, "Your report is already in the queue.");
        db.prepare(
          "INSERT INTO reports(id,review_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)",
        ).run(id(), parts[1], user.id, reason, Date.now());
        return json({ ok: true }, 201);
      }
      if (method === "POST" && parts[2] === "appeals") {
        const { reason } = z
          .object({ reason: z.string().trim().min(10).max(1000) })
          .parse(await req.json());
        if (review.author_id !== user.id || !review.hidden)
          fail(403, "Only the author of a hidden review can appeal.");
        if (
          row(
            "SELECT 1 FROM appeals WHERE review_id=? AND status='open'",
            parts[1],
          )
        )
          fail(409, "An appeal is already being reviewed.");
        db.prepare(
          "INSERT INTO appeals(id,review_id,author_id,reason,created_at) VALUES(?,?,?,?,?)",
        ).run(id(), parts[1], user.id, reason, Date.now());
        return json({ ok: true }, 201);
      }
    }
    if (method === "POST" && path === "outings") {
      const input = outingSchema.parse(await req.json());
      for (const p of input.stops)
        if (!placeById(p)) fail(400, "One of these places is not available.");
      const invitees = [...new Set(input.invitees)].map((username) => {
        const r = row(
          "SELECT id FROM users WHERE username=? AND demo=0",
          username,
        );
        if (!r)
          fail(
            400,
            "The username @" + username + " is not a registered pilot account.",
          );
        if (r.id === user.id) fail(400, "You are already the outing host.");
        return String(r.id);
      });
      const outingId = id();
      transaction(() => {
        db.prepare(
          "INSERT INTO outings(id,owner_id,title,date,visibility,notes,created_at) VALUES(?,?,?,?,?,?,?)",
        ).run(
          outingId,
          user.id,
          input.title,
          input.date,
          input.visibility,
          input.notes,
          Date.now(),
        );
        for (const [i, p] of input.stops.entries())
          db.prepare("INSERT INTO outing_stops VALUES(?,?,?)").run(
            outingId,
            p,
            i,
          );
        for (const invitee of invitees)
          db.prepare(
            "INSERT INTO invitations(id,outing_id,user_id) VALUES(?,?,?)",
          ).run(id(), outingId, invitee);
      });
      return json({ id: outingId }, 201);
    }
    if (method === "PATCH" && parts[0] === "outings" && parts.length === 2) {
      const body = z.record(z.string(), z.unknown()).parse(await req.json());
      if (
        !row(
          "SELECT 1 FROM outings WHERE id=? AND owner_id=?",
          parts[1],
          user.id,
        )
      )
        fail(404, "Only the host can update this outing.");
      if (Object.keys(body).length === 1 && "completed" in body) {
        const input = z.object({ completed: z.boolean() }).parse(body);
        const outing = row("SELECT date FROM outings WHERE id=?", parts[1]);
        if (input.completed && String(outing?.date) > philippineDate())
          fail(
            400,
            "This outing is still in the future. Update its date before marking it visited.",
          );
        db.prepare("UPDATE outings SET completed=? WHERE id=?").run(
          +input.completed,
          parts[1],
        );
      } else {
        const input = outingSchema.parse(body);
        for (const p of input.stops)
          if (!placeById(p)) fail(400, "One of these places is not available.");
        if (
          input.date > philippineDate() &&
          row("SELECT 1 FROM outings WHERE id=? AND completed=1", parts[1])
        )
          fail(400, "Reopen the plan before moving it to a future date.");
        const invitees = [...new Set(input.invitees)].map((username) => {
          const invitee = row(
            "SELECT id FROM users WHERE username=? AND demo=0",
            username,
          );
          if (!invitee)
            fail(
              400,
              "The username @" +
                username +
                " is not a registered pilot account.",
            );
          if (invitee.id === user.id)
            fail(400, "You are already the outing host.");
          return String(invitee.id);
        });
        transaction(() => {
          db.prepare(
            "UPDATE outings SET title=?,date=?,visibility=?,notes=? WHERE id=?",
          ).run(
            input.title,
            input.date,
            input.visibility,
            input.notes,
            parts[1],
          );
          db.prepare("DELETE FROM outing_stops WHERE outing_id=?").run(
            parts[1],
          );
          for (const [i, p] of input.stops.entries())
            db.prepare("INSERT INTO outing_stops VALUES(?,?,?)").run(
              parts[1],
              p,
              i,
            );
          for (const invitee of invitees)
            if (
              !row(
                "SELECT 1 FROM invitations WHERE outing_id=? AND user_id=?",
                parts[1],
                invitee,
              )
            )
              db.prepare(
                "INSERT INTO invitations(id,outing_id,user_id) VALUES(?,?,?)",
              ).run(id(), parts[1], invitee);
        });
      }
      return json({ ok: true });
    }
    if (method === "DELETE" && parts[0] === "outings" && parts.length === 2) {
      if (
        !row(
          "SELECT 1 FROM outings WHERE id=? AND owner_id=?",
          parts[1],
          user.id,
        )
      )
        fail(404, "Only the host can remove this outing.");
      db.prepare("DELETE FROM outings WHERE id=?").run(parts[1]);
      return json({ ok: true });
    }
    if (method === "POST" && parts[0] === "invitations" && parts[1]) {
      const input = z
        .object({ status: z.enum(["accepted", "declined"]), visibility })
        .parse(await req.json());
      if (
        !row(
          "SELECT 1 FROM invitations WHERE id=? AND user_id=?",
          parts[1],
          user.id,
        )
      )
        fail(404, "This invitation is not yours.");
      db.prepare(
        "UPDATE invitations SET status=?,visibility=?,seen=1 WHERE id=? AND user_id=?",
      ).run(input.status, input.visibility, parts[1], user.id);
      return json({ ok: true });
    }
    if (parts[0] === "moderation") {
      if (user.role !== "admin") fail(403, "This area is for moderators.");
      if (method === "GET")
        return json({
          reports: rows(
            "SELECT r.*,v.title,u.name FROM reports r JOIN reviews v ON v.id=r.review_id LEFT JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT 200",
          ),
          appeals: rows(
            "SELECT a.*,r.title FROM appeals a JOIN reviews r ON r.id=a.review_id ORDER BY a.created_at DESC LIMIT 200",
          ),
          evidence: rows(
            "SELECT m.id,m.review_id,r.title,r.supported FROM media m JOIN reviews r ON r.id=m.review_id WHERE m.kind='evidence' AND m.expires>? ORDER BY m.created_at DESC LIMIT 100",
            Date.now(),
          ),
          actions: rows(
            "SELECT * FROM moderation_actions ORDER BY created_at DESC LIMIT 100",
          ),
        });
      if (method === "POST") {
        const input = z
          .object({
            reviewId: z.string(),
            action: z.enum([
              "hide",
              "restore",
              "dismiss",
              "support",
              "reject-evidence",
            ]),
            reason: z.string().trim().min(10).max(1000),
          })
          .parse(await req.json());
        if (!row("SELECT 1 FROM reviews WHERE id=?", input.reviewId))
          fail(404, "Review not found.");
        if (
          input.action === "support" &&
          !row(
            "SELECT 1 FROM media WHERE review_id=? AND kind='evidence' AND expires>?",
            input.reviewId,
            Date.now(),
          )
        )
          fail(400, "There is no unexpired evidence to assess.");
        transaction(() => {
          if (input.action === "hide" || input.action === "restore")
            db.prepare("UPDATE reviews SET hidden=? WHERE id=?").run(
              input.action === "hide" ? 1 : 0,
              input.reviewId,
            );
          if (input.action === "support" || input.action === "reject-evidence")
            db.prepare("UPDATE reviews SET supported=? WHERE id=?").run(
              input.action === "support" ? 1 : 0,
              input.reviewId,
            );
          db.prepare(
            "UPDATE reports SET status='resolved',decision=? WHERE review_id=? AND status='open'",
          ).run(input.reason, input.reviewId);
          if (input.action === "restore")
            db.prepare(
              "UPDATE appeals SET status='resolved' WHERE review_id=?",
            ).run(input.reviewId);
          db.prepare("INSERT INTO moderation_actions VALUES(?,?,?,?,?,?)").run(
            id(),
            input.reviewId,
            user.id,
            input.action,
            input.reason,
            Date.now(),
          );
        });
        return json({ ok: true });
      }
    }
    fail(404, "This action is not available.");
  } catch (e) {
    if (e instanceof CommerceError) return json({ error: e.message }, e.status);
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        { error: e.issues[0]?.message || "Please check your entries." },
        400,
      );
    if (e instanceof SyntaxError)
      return json({ error: "Please send a valid request." }, 400);
    console.error("Dated request failed:", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
