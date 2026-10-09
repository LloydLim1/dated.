"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MapPin,
  Pencil,
  Trash2,
  X,
  Upload,
} from "lucide-react";
import type { PhotoPost, Place, User, Visibility } from "@/lib/types";
import { philippineDate } from "@/lib/philippine-date.mjs";
import PlaceSelect from "./place-select";

type Selected = { url: string; id?: string; file?: File };
export function PhotoComposer({
  places,
  initialPlace,
  post,
  pending,
  onBusy,
  onSubmit,
}: {
  places: Place[];
  initialPlace?: Place;
  post?: PhotoPost;
  pending: boolean;
  onBusy: (value: boolean) => void;
  onSubmit: (body: unknown) => Promise<boolean>;
}) {
  const [placeId, setPlaceId] = useState(
    post?.placeId || initialPlace?.id || "",
  );
  const [caption, setCaption] = useState(post?.caption || "");
  const [visitDate, setVisitDate] = useState(
    post?.visitDate || philippineDate(),
  );
  const [visibility, setVisibility] = useState<Visibility>(
    post?.visibility || "private",
  );
  const [photos, setPhotos] = useState<Selected[]>(
    post?.media.map((id) => ({ id, url: "/api/media/" + id })) || [],
  );
  const [error, setError] = useState("");
  const objectUrls = useRef<string[]>([]);
  const submitting = useRef(false);
  useEffect(
    () => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  return (
    <form
      className="form-stack photo-composer"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        if (!placeId || !photos.length) {
          setError("Choose a place and add at least one photo.");
          return;
        }
        submitting.current = true;
        onBusy(true);
        setError("");
        try {
          const uploaded = [...photos];
          for (const photo of uploaded) {
            if (photo.id) continue;
            const form = new FormData();
            form.set("file", photo.file!);
            form.set("kind", "photo");
            const response = await fetch("/api/uploads", {
              method: "POST",
              body: form,
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "This photo could not upload.");
            photo.id = result.id;
            setPhotos([...uploaded]);
          }
          await onSubmit({
            placeId,
            caption,
            visitDate,
            visibility,
            media: uploaded.map((p) => p.id),
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          submitting.current = false;
          onBusy(false);
        }
      }}
    >
      <p className="form-intro">
        A good meal, a little moment, a place to remember. Share your pictures
        without writing a review.
      </p>
      <fieldset disabled={pending} className="photo-fields">
        <PlaceSelect
          places={places}
          value={placeId}
          onChange={setPlaceId}
          label="Where was this?"
        />
        <p className="muted-text">
          Search the directory, or open a place on the Map to tag it directly.
        </p>
        <label className="photo-upload">
          <Upload size={22} />
          <strong>Add your pictures</strong>
          <span>JPG, PNG or WebP · up to 10 photos · 4 MB each</span>
          <input
            aria-label="Choose journal photos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = "";
              if (files.length + photos.length > 10) {
                setError("Keep each post to ten photos.");
                return;
              }
              if (
                files.some(
                  (f) =>
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      f.type,
                    ) || f.size > 4 * 1024 * 1024,
                )
              ) {
                setError("Choose JPG, PNG or WebP photos under 4 MB each.");
                return;
              }
              setError("");
              setPhotos([
                ...photos,
                ...files.map((file) => {
                  const url = URL.createObjectURL(file);
                  objectUrls.current.push(url);
                  return { file, url };
                }),
              ]);
            }}
          />
        </label>
        {!!photos.length && (
          <div className="photo-preview-grid">
            {photos.map((photo, i) => (
              <div key={photo.url}>
                <img src={photo.url} alt={"Selected photo " + (i + 1)} />
                <span>{i + 1}</span>
                <button
                  type="button"
                  data-form-change
                  className="icon-button"
                  aria-label={"Remove photo " + (i + 1)}
                  onClick={() =>
                    setPhotos(photos.filter((_, index) => index !== i))
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label>
          Caption <span className="optional-label">(optional)</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={3}
            placeholder="What made this visit special?"
          />
        </label>
        <div className="form-row">
          <label>
            Visit date
            <input
              required
              type="date"
              value={visitDate}
              max={philippineDate()}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </label>
          <label>
            Who can see this?
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              <option value="private">Only me</option>
              <option value="followers">My followers</option>
              <option value="public">Everyone</option>
            </select>
          </label>
        </div>
        <p className="notice">
          {visibility === "public"
            ? "Your pictures, caption and tagged place will appear in the community and on the place page."
            : visibility === "followers"
              ? "Only you and people following you can see this post."
              : "This stays in your private journal."}{" "}
          Photo location metadata is removed on upload.
        </p>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={pending} type="submit">
        <Camera size={17} />
        {pending
          ? "Saving your pictures…"
          : post
            ? "Save photo post"
            : "Post photos"}
      </button>
    </form>
  );
}

export function PhotoGrid({
  posts,
  places,
  onOpen,
}: {
  posts: PhotoPost[];
  places: Place[];
  onOpen: (post: PhotoPost) => void;
}) {
  return posts.length ? (
    <div className="journal-photo-grid">
      {posts.map((post) => (
        <button
          className="journal-photo"
          key={post.id}
          onClick={() => onOpen(post)}
          aria-label={
            "View photo post at " +
            (places.find((p) => p.id === post.placeId)?.name || "this place")
          }
        >
          <img
            src={"/api/media/" + post.media[0]}
            alt={post.caption || "Visit photo"}
            loading="lazy"
          />
          {post.media.length > 1 && (
            <span className="photo-count">{post.media.length} photos</span>
          )}
          <span className="photo-place">
            <MapPin size={13} />
            {places.find((p) => p.id === post.placeId)?.name}
          </span>
        </button>
      ))}
    </div>
  ) : (
    <div className="photo-empty">
      <Camera size={30} />
      <h3>Your places, in pictures.</h3>
      <p>Post your first photo and start a journal of little discoveries.</p>
    </div>
  );
}

export function PhotoCard({
  post,
  place,
  me,
  onPlace,
  onPerson,
  onEdit,
  onDelete,
  onReact,
  onComment,
}: {
  post: PhotoPost;
  place?: Place;
  me: User | null;
  onPlace: () => void;
  onPerson: () => void;
  onEdit: () => void;
  onDelete: () => Promise<boolean>;
  onReact: () => void;
  onComment: (body: string) => Promise<boolean>;
}) {
  const [index, setIndex] = useState(0),
    [comments, setComments] = useState(false),
    [body, setBody] = useState(""),
    [deleting, setDeleting] = useState(false),
    [sending, setSending] = useState(false);
  const touch = useRef<number | null>(null);
  const current = Math.min(index, post.media.length - 1);
  return (
    <article className="photo-post-card">
      <header className="photo-post-header">
        <button className="person-info" onClick={onPerson}>
          <span className="avatar small">{post.author.avatar}</span>
          <span>
            <strong>{post.author.name}</strong>
            <small>@{post.author.username}</small>
          </span>
        </button>
        <span className="photo-audience">
          {post.visibility === "public"
            ? "Public"
            : post.visibility === "followers"
              ? "Followers"
              : "Only me"}
        </span>
      </header>
      <button className="photo-tag" onClick={onPlace}>
        <MapPin size={14} />
        {place?.name || "View place"}
      </button>
      <div
        className="post-carousel"
        tabIndex={post.media.length > 1 ? 0 : undefined}
        role="group"
        aria-label="Post photos. Use left and right arrows to browse."
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setIndex(Math.min(current + 1, post.media.length - 1));
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setIndex(Math.max(current - 1, 0));
          }
        }}
        onTouchStart={(e) => {
          touch.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const delta = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(delta) > 45)
            setIndex(
              Math.min(
                Math.max(current + (delta < 0 ? 1 : -1), 0),
                post.media.length - 1,
              ),
            );
          touch.current = null;
        }}
      >
        <img
          src={"/api/media/" + post.media[current]}
          alt={
            (post.caption || "Visit to " + place?.name) +
            ` · photo ${current + 1} of ${post.media.length}`
          }
        />
        {post.media.length > 1 && (
          <>
            <span className="photo-count" aria-live="polite">
              {current + 1} / {post.media.length}
            </span>
            <button
              type="button"
              className="carousel-prev"
              disabled={current === 0}
              aria-label="Previous photo"
              onClick={() => setIndex(current - 1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="carousel-next"
              disabled={current === post.media.length - 1}
              aria-label="Next photo"
              onClick={() => setIndex(current + 1)}
            >
              <ChevronRight size={22} />
            </button>
            <div className="carousel-dots">
              {post.media.map((m, i) => (
                <button
                  key={m}
                  className={i === current ? "active" : ""}
                  aria-label={"Show photo " + (i + 1)}
                  aria-pressed={i === current}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="photo-post-body">
        <div className="photo-post-actions">
          <button
            className={"text-button " + (post.liked ? "liked" : "")}
            aria-pressed={post.liked}
            onClick={onReact}
          >
            <Heart size={21} fill={post.liked ? "currentColor" : "none"} />
            {post.likes} {post.likes === 1 ? "like" : "likes"}
          </button>
          <button
            className="text-button"
            aria-expanded={comments}
            onClick={() => setComments(!comments)}
          >
            <MessageCircle size={20} />
            {post.comments.length} comments
          </button>
          {me?.id === post.author.id && (
            <>
              <button
                className="icon-button"
                aria-label="Edit photo post"
                onClick={onEdit}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Delete photo post"
                onClick={() => setDeleting(!deleting)}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
        {post.caption && (
          <p className="post-caption">
            <strong>{post.author.username}</strong> {post.caption}
          </p>
        )}
        <p className="post-date">
          {new Date(post.visitDate + "T12:00:00").toLocaleDateString("en-PH", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        {deleting && (
          <div className="inline-confirm">
            <p>Delete this post and its pictures permanently?</p>
            <button
              className="button danger"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                try {
                  await onDelete();
                } finally {
                  setSending(false);
                }
              }}
            >
              Delete post permanently
            </button>
            <button
              className="text-button"
              disabled={sending}
              onClick={() => setDeleting(false)}
            >
              Keep post
            </button>
          </div>
        )}
        {comments && (
          <div className="photo-comments">
            {post.comments.map((c) => (
              <p key={c.id}>
                <strong>{c.author.username}</strong> {c.body}
              </p>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!body.trim() || sending) return;
                setSending(true);
                try {
                  if (await onComment(body)) setBody("");
                } finally {
                  setSending(false);
                }
              }}
            >
              <label className="sr-only" htmlFor={"post-comment-" + post.id}>
                Add a comment
              </label>
              <input
                id={"post-comment-" + post.id}
                placeholder={
                  me ? "Add a thoughtful comment…" : "Sign in to comment…"
                }
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
              />
              <button
                className="text-button"
                disabled={!body.trim() || sending}
              >
                {sending ? "Posting…" : "Post"}
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
