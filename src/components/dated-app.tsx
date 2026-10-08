"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Home,
  Compass,
  Bookmark,
  CalendarDays,
  Users,
  MapPin,
  Search,
  Bell,
  Plus,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Coffee,
  Utensils,
  Landmark,
  Clapperboard,
  Star,
  Heart,
  MessageCircle,
  ShieldCheck,
  Check,
  Navigation,
  Leaf,
  LogOut,
  Settings,
  Grid2X2,
  Map as MapIcon,
  X,
  Globe,
  Lock,
  Camera,
  Upload,
  Flag,
  Trash2,
  Download,
  MoveUp,
  MoveDown,
  BookOpen,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import Modal from "./modal";
import {
  CRITERIA,
  average,
  money,
  type Bootstrap,
  type Place,
  type Review,
  type User,
  type Visibility,
} from "@/lib/types";
const PlaceMap = dynamic(() => import("./place-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <LoaderCircle className="spin" /> Opening the map…
    </div>
  ),
});
const empty: Bootstrap = {
  me: null,
  places: [],
  feed: [],
  users: [],
  following: [],
  collections: [],
  outings: [],
  invitations: [],
  unread: 0,
  mode: "local-pilot",
};
const categories = [
  { name: "All places", icon: Compass },
  { name: "Café", label: "Cafés", icon: Coffee },
  { name: "Restaurant", label: "Restaurants", icon: Utensils },
  { name: "Museum", label: "Museums", icon: Landmark },
  { name: "Cinema", label: "Cinemas", icon: Clapperboard },
];
const nav = [
  { id: "home", name: "For you", icon: Home },
  { id: "explore", name: "Explore", icon: Compass },
  { id: "saved", name: "Saved places", icon: Bookmark },
  { id: "outings", name: "My outings", icon: CalendarDays },
  { id: "community", name: "Community", icon: Users },
];
type ModalState = {
  type:
    | "auth"
    | "review"
    | "outing"
    | "filters"
    | "location"
    | "notifications"
    | "collection"
    | "save"
    | "profile"
    | "privacy"
    | "terms"
    | "report"
    | "delete"
    | "moderation"
    | "person";
  place?: Place;
  review?: Review;
  person?: User;
  outingId?: string;
  visitDate?: string;
};
async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const r = await fetch("/api/" + path, {
    method,
    headers:
      body instanceof FormData
        ? {}
        : body !== undefined
          ? { "Content-Type": "application/json" }
          : {},
    body:
      body instanceof FormData
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Please try again.");
  return data;
}
function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(a.lat * rad) *
            Math.cos(b.lat * rad) *
            Math.sin(dlng / 2) ** 2,
      ),
      Math.sqrt(
        1 -
          (Math.sin(dlat / 2) ** 2 +
            Math.cos(a.lat * rad) *
              Math.cos(b.lat * rad) *
              Math.sin(dlng / 2) ** 2),
      ),
    )
  );
}
const Avatar = ({ user, small = false }: { user: User; small?: boolean }) => (
  <span
    className={
      "avatar " + (small ? "small" : "") + " tone-" + (user.name.length % 3)
    }
  >
    {user.avatar}
  </span>
);
export default function DatedApp({
  initialView = "home",
}: {
  initialView?: string;
}) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All places");
  const [city, setCity] = useState("Metro Manila");
  const [budget, setBudget] = useState(0);
  const [occasion, setOccasion] = useState("Any occasion");
  const [sort, setSort] = useState("For you");
  const [modal, setModalState] = useState<ModalState | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);
  const [feedTab, setFeedTab] = useState("Discover");
  const [collection, setCollection] = useState("all");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [visibleCount, setVisibleCount] = useState(6);
  const [modalError, setModalError] = useState("");
  const setModal = (value: ModalState | null) => {
    setModalError("");
    setModalState(value);
  };
  const refresh = useCallback(async () => {
    try {
      const d = await api<Bootstrap>("bootstrap");
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Bootstrap>("bootstrap")
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPop = () => setView(location.pathname.slice(1) || "home");
    window.addEventListener("popstate", onPop);
    return () => {
      active = false;
      window.removeEventListener("popstate", onPop);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  const go = (next: string) => {
    setView(next);
    setPlace(null);
    setVisibleCount(6);
    history.pushState(null, "", next === "home" ? "/" : "/" + next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const requireAccount = () => {
    if (data.me) return true;
    setModal({ type: "auth" });
    return false;
  };
  async function action(
    path: string,
    body?: unknown,
    message = "Done.",
    method?: string,
  ) {
    if (pending) return false;
    setPending(true);
    setModalError("");
    try {
      await api(path, body, method);
      await refresh();
      setToast(message);
      return true;
    } catch (e) {
      const message = (e as Error).message;
      if (modal) setModalError(message);
      else setToast(message);
      return false;
    } finally {
      setPending(false);
    }
  }
  const openPlace = useCallback((p: Place) => setPlace(p), []);
  const savedIds = new Set(data.collections.flatMap((c) => c.placeIds));
  const places = useMemo(() => {
    let list = data.places.filter(
      (p) =>
        (category === "All places" || p.category === category) &&
        (city === "Metro Manila" || city === "Near me" || p.city === city) &&
        (!budget || p.budget <= budget) &&
        (occasion === "Any occasion" || p.tags.includes(occasion)) &&
        `${p.name} ${p.city} ${p.neighborhood} ${p.category} ${p.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    if (city === "Near me" && coords)
      list = list
        .filter((p) => distance(coords, p) < 20)
        .sort((a, b) => distance(coords, a) - distance(coords, b));
    else if (sort === "Budget friendly")
      list = list.sort((a, b) => a.budget - b.budget);
    else if (sort === "Trending")
      list = list.sort(
        (a, b) =>
          b.independentVisits - a.independentVisits ||
          ((b.rating || 0) * b.independentVisits) / (b.independentVisits + 5) -
            ((a.rating || 0) * a.independentVisits) / (a.independentVisits + 5),
      );
    else if (data.me?.city && data.me.city !== "Metro Manila")
      list = list.sort(
        (a, b) =>
          Number(b.city === data.me?.city) - Number(a.city === data.me?.city),
      );
    return list;
  }, [
    data.places,
    data.me,
    category,
    city,
    budget,
    occasion,
    query,
    sort,
    coords,
  ]);
  const visiblePlaces =
    view === "saved"
      ? places.filter((p) =>
          collection === "all"
            ? savedIds.has(p.id)
            : data.collections
                .find((c) => c.id === collection)
                ?.placeIds.includes(p.id),
        )
      : places;
  const feed = data.feed.filter((r) =>
    view === "profile"
      ? r.author.id === data.me?.id
      : feedTab === "Following"
        ? data.following.includes(r.author.id)
        : true,
  );
  const startReview = (p?: Place, r?: Review) => {
    if (requireAccount()) setModal({ type: "review", place: p, review: r });
  };
  const save = (p: Place) => {
    if (requireAccount()) setModal({ type: "save", place: p });
  };
  const writeOuting = (p?: Place) => {
    if (requireAccount()) setModal({ type: "outing", place: p });
  };
  const pageTitles: Record<string, [string, string]> = {
    explore: [
      "Your next favorite is out there.",
      "Find a place for whatever the day brings.",
    ],
    saved: [
      "A little something for later.",
      "Your favorite discoveries, all in one place.",
    ],
    outings: [
      "Good days start with a little plan.",
      "Make time for places, people, and new memories.",
    ],
    community: [
      "Find your people. Find your places.",
      "Thoughtful stories from around the city.",
    ],
    profile: [
      "Your moments, collected.",
      "The places you’ve been and the stories you keep.",
    ],
    map: [
      "A different way to see the city.",
      "Explore sample places around Metro Manila.",
    ],
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brand-mark">
            <Leaf size={21} />
          </span>
          dated<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={"nav-item " + (view === n.id ? "active" : "")}
              onClick={() => go(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={20} />
              {n.name}
              {n.id === "saved" && savedIds.size > 0 && (
                <span className="nav-count">{savedIds.size}</span>
              )}
            </button>
          ))}
          <button
            className={"nav-item " + (view === "map" ? "active" : "")}
            onClick={() => go("map")}
          >
            <MapIcon size={20} />
            Map discovery
          </button>
        </nav>
        <div className="sidebar-label">A LITTLE MORE YOU</div>
        <button
          className={"nav-item " + (view === "profile" ? "active" : "")}
          onClick={() => (data.me ? go("profile") : setModal({ type: "auth" }))}
        >
          <BookOpen size={20} />
          My journal
        </button>
        <button
          className="nav-item"
          onClick={() => setModal({ type: "privacy" })}
        >
          <ShieldCheck size={20} />
          Dated trust
        </button>
        <div className="sidebar-bottom">
          <div className="outing-nudge">
            <div className="nudge-art">
              <CalendarDays size={25} />
              <Leaf size={26} />
            </div>
            <h3>Make a day of it.</h3>
            <p>A coffee, a little culture, and your favorite company.</p>
            <button onClick={() => writeOuting()}>
              Plan an outing <Plus size={15} />
            </button>
          </div>
          <button
            className="profile-shortcut"
            onClick={() =>
              data.me ? go("profile") : setModal({ type: "auth" })
            }
          >
            {data.me ? (
              <Avatar user={data.me} />
            ) : (
              <span className="avatar guest">
                <Users size={19} />
              </span>
            )}
            <span>
              <strong>{data.me?.name || "Your story starts here"}</strong>
              <small>
                {data.me ? "@" + data.me.username : "Join the Dated community"}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Link
            className="brand mobile-brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              go("home");
            }}
          >
            dated<span className="brand-dot">.</span>
          </Link>
          <div className="global-search">
            <Search size={19} />
            <input
              aria-label="Search places"
              placeholder="A place, a neighborhood, a little inspiration…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(6);
                if (!["explore", "map", "saved"].includes(view)) go("explore");
              }}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            className="location-control"
            onClick={() => setModal({ type: "location" })}
          >
            <MapPin size={17} />
            <span>{city}</span>
            <ChevronDown size={14} />
          </button>
          <span className="top-divider" />
          <button
            className="icon-button notifications-button"
            onClick={() =>
              data.me
                ? setModal({ type: "notifications" })
                : setModal({ type: "auth" })
            }
            aria-label={
              "Notifications" +
              (data.unread ? ", " + data.unread + " pending" : "")
            }
          >
            <Bell size={20} />
            {data.unread > 0 && <span className="notification-dot" />}
          </button>
          {data.me ? (
            <button
              className="avatar-button"
              onClick={() => go("profile")}
              aria-label="Open your profile"
            >
              <Avatar user={data.me} />
            </button>
          ) : (
            <button
              className="button join-button"
              onClick={() => setModal({ type: "auth" })}
            >
              Join Dated
            </button>
          )}
        </header>
        <main id="main" className="main-content">
          {error ? (
            <div className="error-state">
              <h2>Let’s try that again.</h2>
              <p>{error}</p>
              <button className="button" onClick={refresh}>
                Reload places
              </button>
            </div>
          ) : (
            <>
              {view === "home" ? (
                <>
                  <div className="welcome-line">
                    <span>
                      {data.me
                        ? "A little inspiration for you, " +
                          data.me.name.split(" ")[0] +
                          "."
                        : "Good places. Better company."}
                    </span>
                    <span className="welcome-right">
                      <Leaf size={15} /> Take the scenic route.
                    </span>
                  </div>
                  <section className="discovery-hero">
                    <div className="hero-copy">
                      <h1>
                        Go somewhere.
                        <br />
                        Feel something.
                      </h1>
                      <p>
                        Find places worth your time.
                        <br />
                        Make memories worth keeping.
                      </p>
                      <button
                        className="button hero-button"
                        onClick={() => go("explore")}
                      >
                        <Compass size={18} />
                        Find your next place
                      </button>
                      <div className="hero-footnote">
                        <span className="tiny-stars">✦</span>A little discovery
                        goes a long way.
                      </div>
                    </div>
                    <div className="hero-photo">
                      <img
                        src="/images/hero.jpg"
                        alt="Two iced coffees and a croissant at a sunlit garden café"
                        fetchPriority="high"
                      />
                      <div className="photo-note">
                        <p>
                          Small plans.
                          <br />
                          <em>Lovely possibilities.</em>
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <div className="page-heading">
                  <div>
                    <h1>{pageTitles[view]?.[0]}</h1>
                    <p>{pageTitles[view]?.[1]}</p>
                  </div>
                  {view === "outings" && (
                    <button className="button" onClick={() => writeOuting()}>
                      <Plus size={18} />
                      Plan an outing
                    </button>
                  )}
                  {view === "profile" && data.me && (
                    <button
                      className="button secondary"
                      onClick={() => setModal({ type: "profile" })}
                    >
                      <Settings size={16} />
                      Edit profile
                    </button>
                  )}
                </div>
              )}
              {loading ? (
                <div className="loading-content" aria-busy="true">
                  <div className="skeleton-line" />
                  <div className="skeleton-grid">
                    {[1, 2, 3].map((i) => (
                      <div className="skeleton" key={i} />
                    ))}
                  </div>
                  <p>Finding a little inspiration…</p>
                </div>
              ) : (
                <>
                  {["home", "explore", "map", "saved"].includes(view) && (
                    <>
                      <div className="section-heading">
                        <h2>
                          {view === "home"
                            ? "Find your kind of place"
                            : view === "saved"
                              ? "Your saved places"
                              : "Where are we going?"}
                        </h2>
                        {view === "home" ? (
                          <button
                            className="text-button"
                            onClick={() => go("explore")}
                          >
                            Explore all places <ChevronRight size={16} />
                          </button>
                        ) : (
                          <div className="view-toggle">
                            <button
                              className={view === "map" ? "" : "selected"}
                              aria-label="Grid view"
                              onClick={() => go("explore")}
                            >
                              <Grid2X2 size={18} />
                            </button>
                            <button
                              className={view === "map" ? "selected" : ""}
                              aria-label="Map view"
                              onClick={() => go("map")}
                            >
                              <MapIcon size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="discovery-controls">
                        <div
                          className="category-tabs"
                          role="group"
                          aria-label="Place categories"
                        >
                          {categories.map((c) => (
                            <button
                              key={c.name}
                              className={
                                "category-chip " +
                                (category === c.name ? "selected" : "")
                              }
                              onClick={() => {
                                setCategory(c.name);
                                setVisibleCount(6);
                              }}
                            >
                              <c.icon size={16} />
                              {c.label || c.name}
                            </button>
                          ))}
                        </div>
                        <button
                          className={
                            "filter-button " +
                            (budget || occasion !== "Any occasion"
                              ? "has-filters"
                              : "")
                          }
                          onClick={() => setModal({ type: "filters" })}
                        >
                          <SlidersHorizontal size={16} />
                          Filters
                          {(budget || occasion !== "Any occasion") && (
                            <span className="filter-count">
                              {Number(!!budget) +
                                Number(occasion !== "Any occasion")}
                            </span>
                          )}
                        </button>
                      </div>
                      {view === "saved" && (
                        <div className="collection-tabs">
                          <button
                            className={collection === "all" ? "selected" : ""}
                            onClick={() => setCollection("all")}
                          >
                            All saved <span>{savedIds.size}</span>
                          </button>
                          {data.collections.map((c) => (
                            <button
                              className={collection === c.id ? "selected" : ""}
                              key={c.id}
                              onClick={() => setCollection(c.id)}
                            >
                              {c.name} <span>{c.placeIds.length}</span>
                            </button>
                          ))}
                          <button
                            onClick={() =>
                              requireAccount() &&
                              setModal({ type: "collection" })
                            }
                          >
                            <Plus size={15} />
                            New collection
                          </button>
                        </div>
                      )}
                      {view === "map" && (
                        <PlaceMap places={places} onSelect={openPlace} />
                      )}
                      <div
                        className={
                          view === "home" ? "home-columns" : "browse-columns"
                        }
                      >
                        <div className="primary-column">
                          <div className="result-bar">
                            <div className="sort-tabs">
                              {["For you", "Trending", "Budget friendly"].map(
                                (s) => (
                                  <button
                                    className={sort === s ? "active" : ""}
                                    onClick={() => setSort(s)}
                                    key={s}
                                  >
                                    {s}
                                  </button>
                                ),
                              )}
                            </div>
                            <span>{visiblePlaces.length} places</span>
                          </div>
                          {visiblePlaces.length ? (
                            <>
                              <div className="place-grid">
                                {visiblePlaces
                                  .slice(0, view === "home" ? 3 : visibleCount)
                                  .map((p) => (
                                    <PlaceCard
                                      key={p.id}
                                      place={p}
                                      saved={savedIds.has(p.id)}
                                      onOpen={() => setPlace(p)}
                                      onSave={() => save(p)}
                                      km={
                                        city === "Near me" && coords
                                          ? distance(coords, p)
                                          : undefined
                                      }
                                    />
                                  ))}
                              </div>
                              {view !== "home" &&
                                visiblePlaces.length > visibleCount && (
                                  <button
                                    className="button secondary load-more"
                                    onClick={() =>
                                      setVisibleCount((c) => c + 6)
                                    }
                                  >
                                    Show more places
                                  </button>
                                )}
                            </>
                          ) : (
                            <Empty
                              icon={<Compass />}
                              title={
                                view === "saved"
                                  ? "Good finds belong here."
                                  : "No places just yet."
                              }
                              text={
                                view === "saved"
                                  ? "Save a place you love and find it here whenever you’re ready."
                                  : "Try another neighborhood, category, or budget."
                              }
                              action={
                                view === "saved"
                                  ? () => go("explore")
                                  : () => {
                                      setQuery("");
                                      setCategory("All places");
                                      setCity("Metro Manila");
                                      setBudget(0);
                                      setOccasion("Any occasion");
                                    }
                              }
                              label={
                                view === "saved"
                                  ? "Explore places"
                                  : "Clear filters"
                              }
                            />
                          )}
                          {view === "home" && (
                            <>
                              <div className="section-heading feed-heading">
                                <div>
                                  <h2>Little stories. Real inspiration.</h2>
                                  <p>
                                    A good recommendation starts with an
                                    experience.
                                  </p>
                                </div>
                                <button
                                  className="text-button"
                                  onClick={() => go("community")}
                                >
                                  See community <ChevronRight size={16} />
                                </button>
                              </div>
                              {data.feed.slice(0, 2).map((r) => (
                                <ReviewCard
                                  key={r.id}
                                  review={r}
                                  place={data.places.find(
                                    (p) => p.id === r.placeId,
                                  )!}
                                  me={data.me}
                                  onPlace={() =>
                                    setPlace(
                                      data.places.find(
                                        (p) => p.id === r.placeId,
                                      )!,
                                    )
                                  }
                                  onPerson={() =>
                                    setModal({
                                      type: "person",
                                      person: r.author,
                                    })
                                  }
                                  onReact={() =>
                                    requireAccount() &&
                                    action(
                                      "reviews/" + r.id + "/reactions",
                                      {},
                                      r.liked
                                        ? "Removed helpful vote."
                                        : "Marked as helpful.",
                                    )
                                  }
                                  onComment={(body) =>
                                    action(
                                      "reviews/" + r.id + "/comments",
                                      { body },
                                      "Comment added.",
                                    )
                                  }
                                  onReport={() =>
                                    requireAccount() &&
                                    setModal({ type: "report", review: r })
                                  }
                                  onEdit={() =>
                                    startReview(
                                      data.places.find(
                                        (p) => p.id === r.placeId,
                                      ),
                                      r,
                                    )
                                  }
                                  onDelete={() =>
                                    action(
                                      "reviews/" + r.id,
                                      undefined,
                                      "Review deleted.",
                                      "DELETE",
                                    )
                                  }
                                  requireAccount={requireAccount}
                                />
                              ))}
                            </>
                          )}
                        </div>
                        {view === "home" && (
                          <aside className="inspiration-rail">
                            <div className="rail-heading">
                              <h3>A day, well spent</h3>
                              <span>
                                <Leaf size={16} />
                              </span>
                            </div>
                            <p className="rail-description">
                              Three little stops.
                              <br />
                              One lovely afternoon.
                            </p>
                            <div className="mini-itinerary">
                              {["fern-and-fable", "the-gallery", "casa-luna"]
                                .map((id) =>
                                  data.places.find((p) => p.id === id)!,
                                )
                                .map((p, i) => (
                                  <button
                                    className="itinerary-stop"
                                    key={p.id}
                                    onClick={() => setPlace(p)}
                                  >
                                    <span className="stop-line">
                                      <span>{i + 1}</span>
                                    </span>
                                    <img src={p.image} alt="" />
                                    <span>
                                      <small>
                                        {
                                          [
                                            "Start slow",
                                            "A little wonder",
                                            "Stay for dinner",
                                          ][i]
                                        }
                                      </small>
                                      <strong>{p.name}</strong>
                                      <em>{p.neighborhood}</em>
                                    </span>
                                  </button>
                                ))}
                            </div>
                            <button
                              className="button secondary full-width"
                              onClick={() => writeOuting(data.places[0])}
                            >
                              <Plus size={16} />
                              Make it your own
                            </button>
                            <div className="rail-separator" />
                            <div className="rail-heading">
                              <h3>People to discover</h3>
                              <Users size={17} />
                            </div>
                            <div className="people-list">
                              {data.users
                                .filter((u) => u.id !== data.me?.id)
                                .slice(0, 3)
                                .map((u) => (
                                  <div className="person-row" key={u.id}>
                                    <button
                                      className="person-info"
                                      onClick={() =>
                                        setModal({ type: "person", person: u })
                                      }
                                    >
                                      <Avatar user={u} />
                                      <span>
                                        <strong>{u.name}</strong>
                                        <small>
                                          {u.demo
                                            ? "Sample contributor"
                                            : u.city}
                                        </small>
                                      </span>
                                    </button>
                                    <button
                                      className={
                                        "follow-button " +
                                        (data.following.includes(u.id)
                                          ? "following"
                                          : "")
                                      }
                                      aria-label={
                                        (data.following.includes(u.id)
                                          ? "Unfollow "
                                          : "Follow ") + u.name
                                      }
                                      onClick={() =>
                                        requireAccount() &&
                                        action(
                                          "follows",
                                          { userId: u.id },
                                          data.following.includes(u.id)
                                            ? "Unfollowed."
                                            : "Following " + u.name + ".",
                                        )
                                      }
                                      disabled={pending}
                                    >
                                      {data.following.includes(u.id) ? (
                                        <Check size={16} />
                                      ) : (
                                        <Plus size={16} />
                                      )}
                                    </button>
                                  </div>
                                ))}
                            </div>
                            <div className="trust-note">
                              <ShieldCheck size={24} />
                              <h3>
                                Good experiences.
                                <br />
                                Honest opinions.
                              </h3>
                              <p>
                                Thoughtful reviews, private visit evidence, and
                                a community built on trust.
                              </p>
                              <button
                                className="text-button"
                                onClick={() => setModal({ type: "privacy" })}
                              >
                                Get to know Dated trust{" "}
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </aside>
                        )}
                      </div>
                    </>
                  )}
                  {view === "community" && (
                    <div className="community-layout">
                      <section>
                        <div className="sort-tabs large-tabs">
                          {["Discover", "Following"].map((t) => (
                            <button
                              className={feedTab === t ? "active" : ""}
                              key={t}
                              onClick={() => setFeedTab(t)}
                            >
                              {t}
                            </button>
                          ))}
                          <button
                            className="write-link"
                            onClick={() => startReview()}
                          >
                            <Plus size={16} />
                            Share an experience
                          </button>
                        </div>
                        {feed.length ? (
                          feed.map((r) => (
                            <ReviewCard
                              key={r.id}
                              review={r}
                              place={data.places.find(
                                (p) => p.id === r.placeId,
                              )!}
                              me={data.me}
                              onPlace={() =>
                                setPlace(
                                  data.places.find((p) => p.id === r.placeId)!,
                                )
                              }
                              onPerson={() =>
                                setModal({ type: "person", person: r.author })
                              }
                              onReact={() =>
                                requireAccount() &&
                                action(
                                  "reviews/" + r.id + "/reactions",
                                  {},
                                  "Helpful vote updated.",
                                )
                              }
                              onComment={(body) =>
                                action(
                                  "reviews/" + r.id + "/comments",
                                  { body },
                                  "Comment added.",
                                )
                              }
                              onReport={() =>
                                requireAccount() &&
                                setModal({ type: "report", review: r })
                              }
                              onEdit={() =>
                                startReview(
                                  data.places.find((p) => p.id === r.placeId),
                                  r,
                                )
                              }
                              onDelete={() =>
                                action(
                                  "reviews/" + r.id,
                                  undefined,
                                  "Review deleted.",
                                  "DELETE",
                                )
                              }
                              requireAccount={requireAccount}
                            />
                          ))
                        ) : (
                          <Empty
                            icon={<Users />}
                            title="A fresh start for your feed."
                            text="Follow someone whose discoveries you enjoy to see their latest stories here."
                          />
                        )}
                      </section>
                      <aside className="community-people">
                        <h2>Meet the community</h2>
                        <input
                          className="input"
                          aria-label="Search people"
                          placeholder="Find a name or username"
                          onChange={(e) =>
                            e.currentTarget.parentElement
                              ?.querySelectorAll<HTMLElement>("[data-person]")
                              .forEach((el) => {
                                el.hidden = !el.dataset.person?.includes(
                                  e.target.value.toLowerCase(),
                                );
                              })
                          }
                        />
                        {data.users
                          .filter((u) => u.id !== data.me?.id)
                          .map((u) => (
                            <div
                              data-person={(
                                u.name +
                                " " +
                                u.username
                              ).toLowerCase()}
                              className="person-row"
                              key={u.id}
                            >
                              <button
                                className="person-info"
                                onClick={() =>
                                  setModal({ type: "person", person: u })
                                }
                              >
                                <Avatar user={u} />
                                <span>
                                  <strong>{u.name}</strong>
                                  <small>
                                    @{u.username}
                                    {u.demo ? " · Sample" : ""}
                                  </small>
                                </span>
                              </button>
                              <button
                                className="follow-button"
                                onClick={() =>
                                  requireAccount() &&
                                  action(
                                    "follows",
                                    { userId: u.id },
                                    "Following updated.",
                                  )
                                }
                                aria-label={"Follow " + u.name}
                              >
                                {data.following.includes(u.id) ? (
                                  <Check size={16} />
                                ) : (
                                  <Plus size={16} />
                                )}
                              </button>
                            </div>
                          ))}
                      </aside>
                    </div>
                  )}
                  {view === "outings" && (
                    <>
                      <div className="journal-banner">
                        <CalendarDays size={32} />
                        <p>
                          One outing. A few favorite stops.
                          <br />
                          <strong>Keep the whole day together.</strong>
                        </p>
                        <button
                          className="button"
                          onClick={() => writeOuting()}
                        >
                          Start a new outing
                        </button>
                      </div>
                      {data.outings.filter(
                        (o) =>
                          o.owner.id === data.me?.id ||
                          o.participants.some(
                            (p) =>
                              p.user.id === data.me?.id &&
                              p.status === "accepted",
                          ),
                      ).length ? (
                        <div className="outing-grid">
                          {data.outings
                            .filter(
                              (o) =>
                                o.owner.id === data.me?.id ||
                                o.participants.some(
                                  (p) =>
                                    p.user.id === data.me?.id &&
                                    p.status === "accepted",
                                ),
                            )
                            .map((o) => (
                              <article className="outing-card" key={o.id}>
                                <div className="outing-cover">
                                  <img
                                    src={
                                      data.places.find(
                                        (p) => p.id === o.stops[0],
                                      )?.image
                                    }
                                    alt="Illustrative outing cover"
                                  />
                                  <span className="outing-status">
                                    {o.completed
                                      ? "A memory, kept"
                                      : "A plan in the making"}
                                  </span>
                                </div>
                                <div className="outing-card-body">
                                  <div className="muted-line">
                                    <CalendarDays size={15} />
                                    {formatDate(o.date)}
                                    <span className="visibility-tag">
                                      {o.visibility}
                                    </span>
                                  </div>
                                  <h2>{o.title}</h2>
                                  <p>{o.notes}</p>
                                  <ol className="outing-stops">
                                    {o.stops.map((pid) => (
                                      <li key={pid}>
                                        <button
                                          onClick={() =>
                                            setPlace(
                                              data.places.find(
                                                (p) => p.id === pid,
                                              )!,
                                            )
                                          }
                                        >
                                          {
                                            data.places.find(
                                              (p) => p.id === pid,
                                            )?.name
                                          }
                                          <ChevronRight size={15} />
                                        </button>
                                        {o.completed && (
                                          <button
                                            className="text-button"
                                            onClick={() => {
                                              const existing = data.feed.find(
                                                (r) =>
                                                  r.outingId === o.id &&
                                                  r.placeId === pid &&
                                                  r.author.id === data.me?.id,
                                              );
                                              setModal({
                                                type: "review",
                                                place: data.places.find(
                                                  (p) => p.id === pid,
                                                ),
                                                review: existing,
                                                outingId: o.id,
                                                visitDate: o.date,
                                              });
                                            }}
                                          >
                                            {data.feed.some(
                                              (r) =>
                                                r.outingId === o.id &&
                                                r.placeId === pid &&
                                                r.author.id === data.me?.id,
                                            )
                                              ? "Edit my review"
                                              : "Review this stop"}
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ol>
                                  <div className="outing-companions">
                                    <Avatar user={o.owner} small />
                                    {o.participants.map((p) => (
                                      <span
                                        key={p.user.id}
                                        className="companion"
                                        title={p.status}
                                      >
                                        <Avatar user={p.user} small />
                                        {p.status === "pending" && (
                                          <small>Pending</small>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                  {o.owner.id === data.me?.id ? (
                                    <div className="outing-actions">
                                      <button
                                        className="text-button"
                                        onClick={() =>
                                          action(
                                            "outings/" + o.id,
                                            { completed: !o.completed },
                                            o.completed
                                              ? "Outing reopened."
                                              : "A memory, kept.",
                                            "PATCH",
                                          )
                                        }
                                      >
                                        <CheckCircle2 size={16} />
                                        {o.completed
                                          ? "Reopen plan"
                                          : "Mark as visited"}
                                      </button>
                                      <button
                                        className="icon-button"
                                        aria-label={"Delete outing " + o.title}
                                        onClick={() => {
                                          if (
                                            confirm(
                                              "Delete this outing and its invitations?",
                                            )
                                          )
                                            action(
                                              "outings/" + o.id,
                                              undefined,
                                              "Outing deleted.",
                                              "DELETE",
                                            );
                                        }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      className="text-button"
                                      onClick={() => {
                                        const invitation =
                                          data.invitations.find(
                                            (i) => i.outingId === o.id,
                                          );
                                        if (invitation)
                                          action(
                                            "invitations/" + invitation.id,
                                            {
                                              status: "declined",
                                              visibility: "private",
                                            },
                                            "You left the outing.",
                                          );
                                      }}
                                    >
                                      Leave outing
                                    </button>
                                  )}
                                </div>
                              </article>
                            ))}
                        </div>
                      ) : (
                        <Empty
                          icon={<CalendarDays />}
                          title="The next good day is yours to plan."
                          text="Pick your places, invite your people, and start a little story."
                          action={() => writeOuting()}
                          label="Plan an outing"
                        />
                      )}
                    </>
                  )}
                  {view === "profile" &&
                    (data.me ? (
                      <>
                        <div className="profile-panel">
                          <Avatar user={data.me} />
                          <div>
                            <h2>{data.me.name}</h2>
                            <p>
                              @{data.me.username} · {data.me.city}
                            </p>
                            <p>
                              {data.me.bio ||
                                "Every good day has a story. What’s yours?"}
                            </p>
                          </div>
                          <div className="profile-stats">
                            <div>
                              <strong>{feed.length}</strong>
                              <span>experiences</span>
                            </div>
                            <div>
                              <strong>{savedIds.size}</strong>
                              <span>saved places</span>
                            </div>
                            <div>
                              <strong>{data.following.length}</strong>
                              <span>following</span>
                            </div>
                          </div>
                        </div>
                        <div className="profile-toolbar">
                          <h2>My experience journal</h2>
                          <button
                            className="button"
                            onClick={() => startReview()}
                          >
                            <Plus size={16} />
                            Write a review
                          </button>
                        </div>
                        {feed.map((r) => (
                          <ReviewCard
                            key={r.id}
                            review={r}
                            place={data.places.find((p) => p.id === r.placeId)!}
                            me={data.me}
                            onPlace={() =>
                              setPlace(
                                data.places.find((p) => p.id === r.placeId)!,
                              )
                            }
                            onPerson={() => {}}
                            onReact={() =>
                              action(
                                "reviews/" + r.id + "/reactions",
                                {},
                                "Helpful vote updated.",
                              )
                            }
                            onComment={(body) =>
                              action(
                                "reviews/" + r.id + "/comments",
                                { body },
                                "Comment added.",
                              )
                            }
                            onReport={() =>
                              setModal({ type: "report", review: r })
                            }
                            onEdit={() =>
                              startReview(
                                data.places.find((p) => p.id === r.placeId),
                                r,
                              )
                            }
                            onDelete={() =>
                              action(
                                "reviews/" + r.id,
                                undefined,
                                "Review deleted.",
                                "DELETE",
                              )
                            }
                            requireAccount={requireAccount}
                          />
                        ))}
                        {!feed.length && (
                          <Empty
                            icon={<BookOpen />}
                            title="Every place has a story."
                            text="Your reviews will be collected here, with the visibility you choose."
                          />
                        )}
                        <div className="account-actions">
                          <button
                            className="text-button"
                            onClick={async () => {
                              try {
                                const d = await api("account/export");
                                const url = URL.createObjectURL(
                                  new Blob([JSON.stringify(d, null, 2)], {
                                    type: "application/json",
                                  }),
                                );
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "dated-my-data.json";
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (e) {
                                setToast((e as Error).message);
                              }
                            }}
                          >
                            <Download size={16} />
                            Export my data
                          </button>
                          {data.me.role === "admin" && (
                            <button
                              className="text-button"
                              onClick={() => setModal({ type: "moderation" })}
                            >
                              <ShieldCheck size={16} />
                              Moderation
                            </button>
                          )}
                          <button
                            className="text-button"
                            onClick={async () => {
                              if (
                                await action("auth/logout", {}, "Signed out.")
                              )
                                go("home");
                            }}
                          >
                            <LogOut size={16} />
                            Sign out
                          </button>
                          <button
                            className="text-button danger"
                            onClick={() => setModal({ type: "delete" })}
                          >
                            <Trash2 size={16} />
                            Delete account
                          </button>
                        </div>
                      </>
                    ) : (
                      <Empty
                        icon={<BookOpen />}
                        title="A journal that’s a little more you."
                        text="Sign in to collect your reviews, outings, and memories."
                        action={() => setModal({ type: "auth" })}
                        label="Join Dated"
                      />
                    ))}
                </>
              )}
              <footer className="footer">
                <span className="footer-wordmark">dated.</span>
                <p>
                  Preview uses fictional sample places and stories. Photos are
                  illustrative.
                </p>
                <div>
                  <button onClick={() => setModal({ type: "privacy" })}>
                    Privacy & trust
                  </button>
                  <button onClick={() => setModal({ type: "terms" })}>
                    Terms
                  </button>
                  <span>Made for little discoveries.</span>
                </div>
              </footer>
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 4).map((n) => (
          <button
            className={view === n.id ? "active" : ""}
            key={n.id}
            onClick={() => go(n.id)}
          >
            <n.icon size={21} />
            <span>
              {n.id === "saved"
                ? "Saved"
                : n.id === "outings"
                  ? "Outings"
                  : n.name}
            </span>
          </button>
        ))}
        <button
          className={view === "profile" ? "active" : ""}
          onClick={() => (data.me ? go("profile") : setModal({ type: "auth" }))}
        >
          <Users size={21} />
          <span>Me</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {place && !modal && (
        <Modal title={place.name} wide onClose={() => setPlace(null)}>
          <PlaceDetail
            place={data.places.find((p) => p.id === place.id) || place}
            reviews={data.feed.filter((r) => r.placeId === place.id)}
            onSave={() => save(place)}
            saved={savedIds.has(place.id)}
            onReview={() => startReview(place)}
            onOuting={() => writeOuting(place)}
            me={data.me}
            onEdit={(r) => startReview(place, r)}
            onReport={(r) =>
              requireAccount() && setModal({ type: "report", review: r })
            }
          />
        </Modal>
      )}
      {modal && (
        <Modal
          title={modalTitle(modal)}
          wide={["review", "outing", "moderation"].includes(modal.type)}
          onClose={() => setModal(null)}
        >
          {modalError && (
            <p className="form-error modal-error" role="alert">
              {modalError}
            </p>
          )}
          {modal.type === "auth" && (
            <AuthForm
              onSuccess={async () => {
                await refresh();
                setModal(null);
                setToast("Welcome to Dated. Make yourself at home.");
              }}
              onPrivacy={() => setModal({ type: "privacy" })}
              onTerms={() => setModal({ type: "terms" })}
            />
          )}
          {modal.type === "review" && (
            <ReviewForm
              places={data.places}
              initialPlace={modal.place}
              review={modal.review}
              outingId={modal.outingId}
              initialDate={modal.visitDate}
              onSubmit={async (body) => {
                if (
                  await action(
                    modal.review ? "reviews/" + modal.review.id : "reviews",
                    body,
                    "Your experience has been saved.",
                    modal.review ? "PATCH" : "POST",
                  )
                )
                  setModal(null);
              }}
              pending={pending}
            />
          )}
          {modal.type === "outing" && (
            <OutingForm
              places={data.places}
              initialPlace={modal.place}
              onSubmit={async (body) => {
                if (
                  await action("outings", body, "Your little plan is ready.")
                ) {
                  setModal(null);
                  setPlace(null);
                  go("outings");
                }
              }}
              pending={pending}
            />
          )}
          {modal.type === "filters" && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                setModal(null);
                setVisibleCount(6);
              }}
            >
              <p className="form-intro">Find a place that fits your day.</p>
              <label>
                Budget per person
                <select
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                >
                  <option value={0}>Any budget</option>
                  <option value={400}>Up to ₱400</option>
                  <option value={700}>Up to ₱700</option>
                  <option value={1000}>Up to ₱1,000</option>
                </select>
              </label>
              <label>
                What’s the occasion?
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                >
                  {[
                    "Any occasion",
                    "Coffee dates",
                    "Date night",
                    "Dinner with friends",
                    "Solo exploring",
                    "Art & culture",
                    "Brunch",
                    "Rainy days",
                    "Outdoor seating",
                  ].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setBudget(0);
                    setOccasion("Any occasion");
                  }}
                >
                  Reset filters
                </button>
                <button className="button">Show matching places</button>
              </div>
            </form>
          )}
          {modal.type === "location" && (
            <div className="form-stack">
              <p className="form-intro">
                Choose a city or find places near you. Your location stays on
                this device.
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  if (!navigator.geolocation) {
                    setModalError(
                      "Location is unavailable. Choose a city below.",
                    );
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (p) => {
                      setCoords({
                        lat: p.coords.latitude,
                        lng: p.coords.longitude,
                      });
                      setCity("Near me");
                      setModal(null);
                      setToast("Showing sample places within 20 km.");
                    },
                    () =>
                      setModalError(
                        "Location could not be shared. You can choose a city instead.",
                      ),
                    {
                      enableHighAccuracy: false,
                      timeout: 10000,
                      maximumAge: 300000,
                    },
                  );
                }}
              >
                <Navigation size={17} />
                Use my approximate location
              </button>
              {[
                "Metro Manila",
                "Makati",
                "Taguig",
                "Manila",
                "Quezon City",
              ].map((c) => (
                <button
                  className="city-option"
                  key={c}
                  onClick={() => {
                    setCity(c);
                    setCoords(null);
                    setModal(null);
                  }}
                >
                  <MapPin size={17} />
                  {c}
                  {city === c && <Check size={17} />}
                </button>
              ))}
            </div>
          )}
          {modal.type === "notifications" && (
            <Notifications
              data={data}
              onAction={async (id, status, visibility) => {
                await action(
                  "invitations/" + id,
                  { status, visibility },
                  status === "accepted"
                    ? "Invitation accepted."
                    : "Invitation declined.",
                );
              }}
            />
          )}
          {modal.type === "collection" && (
            <SimpleForm
              label="Collection name"
              placeholder="Slow Sundays, date nights, little escapes…"
              button="Create collection"
              pending={pending}
              onSubmit={async (name) => {
                if (
                  await action("collections", { name }, "Collection created.")
                )
                  setModal(null);
              }}
            />
          )}
          {modal.type === "save" && modal.place && (
            <div className="form-stack">
              <p className="form-intro">
                Keep {modal.place.name} in a collection. Your collections are
                private.
              </p>
              {data.collections.map((c) => (
                <button
                  className="collection-option"
                  key={c.id}
                  disabled={pending}
                  onClick={() =>
                    action(
                      "collections/items",
                      { collectionId: c.id, placeId: modal.place!.id },
                      c.placeIds.includes(modal.place!.id)
                        ? "Removed from " + c.name + "."
                        : "Saved to " + c.name + ".",
                    )
                  }
                >
                  <Bookmark size={19} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.placeIds.length} places</small>
                  </span>
                  {c.placeIds.includes(modal.place!.id) ? (
                    <CheckCircle2 size={21} />
                  ) : (
                    <Plus size={19} />
                  )}
                </button>
              ))}
              <button
                className="text-button"
                onClick={() => setModal({ type: "collection" })}
              >
                <Plus size={16} />
                Create a new collection
              </button>
            </div>
          )}
          {modal.type === "person" && modal.person && (
            <div className="person-detail">
              <Avatar user={modal.person} />
              <h2>{modal.person.name}</h2>
              <p>
                @{modal.person.username} · {modal.person.city}
              </p>
              <p>{modal.person.bio}</p>
              {modal.person.demo && (
                <p className="notice">
                  This is a sample contributor for the preview.
                </p>
              )}
              {modal.person.id !== data.me?.id && (
                <button
                  className="button"
                  onClick={() =>
                    requireAccount() &&
                    action(
                      "follows",
                      { userId: modal.person!.id },
                      "Following updated.",
                    )
                  }
                >
                  {data.following.includes(modal.person.id)
                    ? "Following · Unfollow"
                    : "Follow discoveries"}
                </button>
              )}
              <h3>Public experiences</h3>
              {data.feed
                .filter(
                  (r) =>
                    r.author.id === modal.person?.id &&
                    r.visibility === "public",
                )
                .map((r) => (
                  <button
                    className="person-review"
                    key={r.id}
                    onClick={() => {
                      setModal(null);
                      setPlace(data.places.find((p) => p.id === r.placeId)!);
                    }}
                  >
                    <strong>{r.title}</strong>
                    <small>
                      {data.places.find((p) => p.id === r.placeId)?.name}
                    </small>
                    <ChevronRight size={17} />
                  </button>
                ))}
            </div>
          )}
          {modal.type === "profile" && data.me && (
            <ProfileForm
              me={data.me}
              pending={pending}
              onSubmit={async (body) => {
                if (await action("profile", body, "Profile updated.", "PATCH"))
                  setModal(null);
              }}
            />
          )}
          {modal.type === "report" && modal.review && (
            <>
              <p className="form-intro">
                Reports go privately to moderators. A report does not
                automatically remove a review.
              </p>
              <SimpleForm
                multiline
                label={
                  modal.review.hidden && modal.review.author.id === data.me?.id
                    ? "Why should we reconsider?"
                    : "What should we look into?"
                }
                button={
                  modal.review.hidden && modal.review.author.id === data.me?.id
                    ? "Send appeal"
                    : "Send report"
                }
                pending={pending}
                onSubmit={async (reason) => {
                  if (
                    await action(
                      "reviews/" +
                        modal.review!.id +
                        "/" +
                        (modal.review!.hidden &&
                        modal.review!.author.id === data.me?.id
                          ? "appeals"
                          : "reports"),
                      { reason },
                      "Sent privately to the moderation queue.",
                    )
                  )
                    setModal(null);
                }}
              />
            </>
          )}
          {modal.type === "delete" && (
            <>
              <p className="form-intro">
                This permanently removes your profile, reviews, collections,
                outings, and uploaded images. Export your data first if you want
                a copy.
              </p>
              <SimpleForm
                label="Confirm your password"
                password
                button="Permanently delete my account"
                pending={pending}
                onSubmit={async (password) => {
                  if (
                    await action(
                      "account",
                      { password },
                      "Your account has been deleted.",
                      "DELETE",
                    )
                  ) {
                    setModal(null);
                    go("home");
                  }
                }}
              />
            </>
          )}
          {modal.type === "privacy" && <TrustContent />}
          {modal.type === "terms" && <TermsContent />}
          {modal.type === "moderation" && <Moderation onChanged={refresh} />}
        </Modal>
      )}
    </div>
  );
}
function modalTitle(m: ModalState) {
  return (
    {
      auth: "A little more discovery.",
      review: m.review ? "Edit your experience" : "How was your visit?",
      outing: "Make a day of it.",
      filters: "A place for your kind of day",
      location: "Where shall we explore?",
      notifications: "Your invitations",
      collection: "A collection of good places",
      save: "Save for a little later",
      profile: "Make it a little more you",
      privacy: "Good experiences. Honest opinions.",
      terms: "Dated pilot terms",
      report: m.review?.hidden
        ? "Ask us to take another look"
        : "Help keep Dated thoughtful",
      delete: "Say goodbye to your account",
      moderation: "Moderation workspace",
      person: "Meet a fellow explorer",
    } as Record<string, string>
  )[m.type];
}
function formatDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function Empty({
  icon,
  title,
  text,
  action,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="button" onClick={action}>
          {label}
        </button>
      )}
    </div>
  );
}
function PlaceCard({
  place: p,
  saved,
  onOpen,
  onSave,
  km,
}: {
  place: Place;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  km?: number;
}) {
  return (
    <article className="place-card">
      <div className="place-image">
        <button
          className="image-open"
          onClick={onOpen}
          aria-label={"Explore " + p.name}
        >
          <img
            src={p.image}
            alt={"Illustrative " + p.category.toLowerCase() + " photograph"}
            loading="lazy"
          />
        </button>
        <span className="place-category">{p.category}</span>
        <button
          className={"save-button " + (saved ? "saved" : "")}
          onClick={onSave}
          aria-label={(saved ? "Manage saved " : "Save ") + p.name}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="place-card-body">
        <div className="place-title-line">
          <button onClick={onOpen}>
            <h3>{p.name}</h3>
          </button>
          {p.rating && (
            <span className="rating">
              <Star size={13} fill="currentColor" />
              {p.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="place-location">
          <MapPin size={13} />
          {p.neighborhood}, {p.city}
        </p>
        <div className="place-meta">
          <span>{money(p.budget)} / person</span>
          <span>
            {km !== undefined
              ? km.toFixed(1) + " km away"
              : p.rating
                ? p.reviewCount + " reviews"
                : "Sample place"}
          </span>
        </div>
        <span className="occasion-tag">{p.tags[0]}</span>
      </div>
    </article>
  );
}
function ReviewCard({
  review: r,
  place,
  me,
  onPlace,
  onPerson,
  onReact,
  onComment,
  onReport,
  onEdit,
  onDelete,
  requireAccount,
}: {
  review: Review;
  place: Place;
  me: User | null;
  onPlace: () => void;
  onPerson: () => void;
  onReact: () => void;
  onComment: (body: string) => Promise<boolean>;
  onReport: () => void;
  onEdit: () => void;
  onDelete: () => void;
  requireAccount: () => boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <article className="review-card">
      <div className="review-author">
        <button className="person-info" onClick={onPerson}>
          <Avatar user={r.author} />
          <span>
            <strong>{r.author.name}</strong>
            <small>
              {r.demo ? "Sample story" : formatDate(r.visitDate)} <span>·</span>{" "}
              {r.visibility === "private" ? (
                <Lock size={11} />
              ) : r.visibility === "followers" ? (
                <Users size={11} />
              ) : (
                <Globe size={11} />
              )}{" "}
              {r.visibility}
            </small>
          </span>
        </button>
        <span className="review-score">
          <Star size={14} fill="currentColor" />
          {average(r.ratings).toFixed(1)}
        </span>
      </div>
      <button className="review-place" onClick={onPlace}>
        <MapPin size={14} />
        {place?.name}
        <ChevronRight size={14} />
      </button>
      <h3>{r.title}</h3>
      <p className="review-text">{r.body}</p>
      {r.media.length > 0 && (
        <div className="review-gallery">
          {r.media.map((mid) => (
            <a
              href={"/api/media/" + mid}
              key={mid}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={"/api/media/" + mid}
                alt="Review photo"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      <div className="review-badges">
        {r.supported && (
          <span title="Visit evidence was assessed. This does not verify the opinion.">
            <ShieldCheck size={14} />
            Visit supported
          </span>
        )}
        {r.incentive && <span>Complimentary / incentivized visit</span>}
        {r.hidden && (
          <span className="notice">Hidden by moderation · visible to you</span>
        )}
      </div>
      <div className="review-footer">
        <button className={r.liked ? "liked" : ""} onClick={onReact}>
          <Heart size={17} fill={r.liked ? "currentColor" : "none"} />
          {r.likes || ""} Helpful
        </button>
        <button onClick={() => setShowComments((v) => !v)}>
          <MessageCircle size={17} />
          {r.comments.length || ""} {showComments ? "Close" : "Comment"}
        </button>
        <div className="review-own-actions">
          {r.author.id === me?.id ? (
            <>
              <button onClick={onEdit}>Edit</button>
              <button
                onClick={() => {
                  if (confirm("Delete this review and its photos?")) onDelete();
                }}
                aria-label="Delete review"
              >
                <Trash2 size={15} />
              </button>
              {r.hidden && <button onClick={onReport}>Appeal</button>}
            </>
          ) : (
            <button onClick={onReport} aria-label="Report review">
              <Flag size={15} />
            </button>
          )}
        </div>
      </div>
      {showComments && (
        <div className="comments">
          {r.comments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar user={c.author} small />
              <p>
                <strong>{c.author.name}</strong>
                {c.body}
              </p>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!requireAccount() || sending) return;
              setSending(true);
              if (await onComment(comment)) setComment("");
              setSending(false);
            }}
          >
            <input
              aria-label="Write a comment"
              placeholder="Add a thoughtful comment…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              maxLength={500}
            />
            <button className="button" disabled={sending}>
              {sending ? "Sending…" : "Post"}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
function PlaceDetail({
  place: p,
  reviews,
  onSave,
  saved,
  onReview,
  onOuting,
  me,
  onEdit,
  onReport,
}: {
  place: Place;
  reviews: Review[];
  onSave: () => void;
  saved: boolean;
  onReview: () => void;
  onOuting: () => void;
  me: User | null;
  onEdit: (r: Review) => void;
  onReport: (r: Review) => void;
}) {
  return (
    <div className="place-detail">
      <img
        className="detail-image"
        src={p.image}
        alt={"Illustrative " + p.category.toLowerCase() + " photograph"}
      />
      <div className="detail-info">
        <span className="detail-category">
          {p.category} · {p.neighborhood}
        </span>
        <h2>{p.name}</h2>
        <p>{p.description}</p>
        <div className="detail-facts">
          <span>
            <MapPin size={17} />
            {p.address}
          </span>
          <span>
            <CalendarDays size={17} />
            {p.hours}
          </span>
          <span>
            <Utensils size={17} />
            {money(p.budget)} estimated per person
          </span>
        </div>
        <div className="detail-tags">
          {p.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="detail-actions">
          <button className="button" onClick={onReview}>
            <Plus size={17} />
            Write a review
          </button>
          <button className="button secondary" onClick={onSave}>
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save place"}
          </button>
          <button className="button secondary" onClick={onOuting}>
            <CalendarDays size={17} />
            Add to an outing
          </button>
        </div>
        <p className="notice">
          Fictional sample place. Location, hours, and spending are for preview
          only.
        </p>
      </div>
      <div className="detail-reviews">
        <h3>
          Experiences & impressions <span>{reviews.length}</span>
        </h3>
        {reviews.length ? (
          reviews.map((r) => (
            <div className="detail-review" key={r.id}>
              <div className="review-author">
                <div className="person-info">
                  <Avatar user={r.author} />
                  <span>
                    <strong>{r.author.name}</strong>
                    <small>
                      {r.demo ? "Sample story" : formatDate(r.visitDate)}
                    </small>
                  </span>
                </div>
                <span className="review-score">
                  <Star size={14} fill="currentColor" />
                  {average(r.ratings).toFixed(1)}
                </span>
              </div>
              <h4>{r.title}</h4>
              <p>{r.body}</p>
              <div className="criteria-summary">
                {Object.entries(r.ratings).map(([k, v]) => (
                  <span key={k}>
                    {k}
                    <strong>{v}/5</strong>
                  </span>
                ))}
              </div>
              {r.media.length > 0 && (
                <div className="review-gallery">
                  {r.media.map((m) => (
                    <img src={"/api/media/" + m} alt="Review photo" key={m} />
                  ))}
                </div>
              )}
              {r.supported && (
                <span className="supported">
                  <ShieldCheck size={14} />
                  Visit supported — opinion remains personal
                </span>
              )}
              {r.incentive && <p className="notice">Incentivized visit</p>}
              {r.author.id === me?.id ? (
                <button className="text-button" onClick={() => onEdit(r)}>
                  Edit my experience
                </button>
              ) : (
                <button className="text-button" onClick={() => onReport(r)}>
                  <Flag size={13} />
                  Report
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty
            icon={<MessageCircle />}
            title="Be the first to share a little story."
            text="A thoughtful review can make someone’s next outing better."
          />
        )}
      </div>
    </div>
  );
}
function AuthForm({
  onSuccess,
  onPrivacy,
  onTerms,
}: {
  onSuccess: () => Promise<void>;
  onPrivacy: () => void;
  onTerms: () => void;
}) {
  const [mode, setMode] = useState("signup");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="auth-welcome">
        <span className="auth-icon">
          <Leaf size={25} />
        </span>
        <h3>
          Find your places.
          <br />
          Keep your moments.
        </h3>
        <p>Start a free account for the local Dated pilot.</p>
      </div>
      <div className="auth-tabs">
        {["signup", "login"].map((m) => (
          <button
            className={mode === m ? "selected" : ""}
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {m === "signup" ? "Join Dated" : "Welcome back"}
          </button>
        ))}
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(e.currentTarget);
          try {
            await api("auth/" + mode, {
              email: form.get("email"),
              password: form.get("password"),
              ...(mode === "signup"
                ? {
                    name: form.get("name"),
                    username: form.get("username"),
                    adult: form.get("adult") === "on",
                    terms: form.get("terms") === "on",
                  }
                : {}),
            });
            await onSuccess();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "signup" && (
          <div className="form-grid">
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                placeholder="What should we call you?"
                required
                minLength={2}
                maxLength={60}
              />
            </label>
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                placeholder="your_little_corner"
                pattern="[a-z0-9_]{3,24}"
                title="3–24 lowercase letters, numbers, or underscores"
                required
              />
            </label>
          </div>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            minLength={mode === "signup" ? 10 : 1}
            maxLength={128}
            placeholder={
              mode === "signup" ? "At least 10 characters" : "Your password"
            }
          />
        </label>
        {mode === "signup" && (
          <>
            <label className="check-label">
              <input name="adult" type="checkbox" required />I confirm I am 18
              or older.
            </label>
            <label className="check-label">
              <input name="terms" type="checkbox" required />
              <span>
                I agree to the{" "}
                <button type="button" className="inline-link" onClick={onTerms}>
                  pilot terms
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className="inline-link"
                  onClick={onPrivacy}
                >
                  privacy notice
                </button>
                .
              </span>
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button full-width" disabled={busy}>
          {busy ? (
            <>
              <LoaderCircle size={17} className="spin" />
              One moment…
            </>
          ) : mode === "signup" ? (
            "Make yourself at home"
          ) : (
            "Sign in"
          )}
        </button>
        <p className="form-help">
          Accounts and experiences stay on this local pilot server. No email
          verification or password recovery is connected yet.
        </p>
      </form>
    </>
  );
}
function VisibilitySelect({
  value,
  onChange,
  label = "Who can see this?",
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  label?: string;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Visibility)}
      >
        <option value="public">Everyone · public</option>
        <option value="followers">People who follow me</option>
        <option value="private">Only me · private</option>
      </select>
    </label>
  );
}
function ReviewForm({
  places,
  initialPlace,
  review,
  outingId,
  initialDate,
  onSubmit,
  pending,
}: {
  places: Place[];
  initialPlace?: Place;
  review?: Review;
  outingId?: string;
  initialDate?: string;
  onSubmit: (body: unknown) => Promise<void>;
  pending: boolean;
}) {
  const [placeId, setPlaceId] = useState(
    initialPlace?.id || places[0]?.id || "",
  );
  const p = places.find((p) => p.id === placeId)!;
  const [ratings, setRatings] = useState<Record<string, number>>(
    review?.ratings || {},
  );
  const [visibility, setVisibility] = useState<Visibility>(
    review?.visibility || "public",
  );
  const [media, setMedia] = useState<string[]>(review?.media || []);
  const [evidence, setEvidence] = useState<string | undefined>(
    review?.evidence,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File, kind: "photo" | "evidence") {
    setError("");
    setUploading(true);
    try {
      if (kind === "photo" && media.length >= 4)
        throw new Error("Choose up to four photos.");
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const r = await api<{ id: string }>("uploads", form);
      if (kind === "evidence") setEvidence(r.id);
      else setMedia((s) => [...s, r.id]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (CRITERIA[p.category].some((k) => !ratings[k])) {
          setError("Rate every category before sharing.");
          return;
        }
        const f = new FormData(e.currentTarget);
        await onSubmit({
          placeId,
          outingId: outingId || review?.outingId,
          title: f.get("title"),
          body: f.get("body"),
          visitDate: f.get("date"),
          spending: Number(f.get("spending")),
          ratings,
          visibility,
          incentive: f.get("incentive") === "on",
          media,
          evidence,
        });
      }}
    >
      <p className="form-intro">
        A little detail goes a long way. Share what made your visit worthwhile —
        and what could be better.
      </p>
      <div className="form-grid">
        <label>
          Where did you go?
          <select
            value={placeId}
            disabled={!!review}
            onChange={(e) => {
              setPlaceId(e.target.value);
              setRatings({});
            }}
          >
            {places.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date of your visit
          <input
            name="date"
            type="date"
            defaultValue={
              review?.visitDate ||
              initialDate ||
              new Date().toISOString().slice(0, 10)
            }
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </label>
      </div>
      <fieldset className="ratings-fieldset">
        <legend>How did it feel?</legend>
        {CRITERIA[p.category].map((k) => (
          <div className="rating-row" key={k}>
            <span>{k}</span>
            <div className="rating-stars" role="group" aria-label={k}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={(ratings[k] || 0) >= n ? "rated" : ""}
                  onClick={() => setRatings((s) => ({ ...s, [k]: n }))}
                  aria-label={k + " " + n + " star" + (n > 1 ? "s" : "")}
                  aria-pressed={ratings[k] === n}
                >
                  <Star
                    size={24}
                    fill={(ratings[k] || 0) >= n ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <label>
        Give your experience a title
        <input
          name="title"
          placeholder="A slow afternoon worth keeping…"
          defaultValue={review?.title}
          minLength={3}
          maxLength={100}
          required
        />
      </label>
      <label>
        Your story
        <textarea
          name="body"
          defaultValue={review?.body}
          placeholder="What did you love? What should someone know before they go?"
          minLength={20}
          maxLength={3000}
          rows={4}
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Spent per person (₱)
          <input
            name="spending"
            type="number"
            min={0}
            max={100000}
            defaultValue={review?.spending || p.budget}
            required
          />
        </label>
        <VisibilitySelect value={visibility} onChange={setVisibility} />
      </div>
      <div className="upload-section">
        <div>
          <strong>A few moments from your visit</strong>
          <small>Up to 4 images · JPG, PNG, WebP · under 4 MB each</small>
        </div>
        <label className="upload-button">
          <Camera size={19} />
          {uploading ? "Uploading…" : "Add a photo"}
          <input
            type="file"
            aria-label="Upload review photo"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || media.length >= 4}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, "photo");
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {media.length > 0 && (
        <div className="upload-previews">
          {media.map((m) => (
            <div key={m}>
              <img src={"/api/media/" + m} alt="Your uploaded photo" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setMedia((s) => s.filter((id) => id !== m))}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <details className="evidence-details">
        <summary>
          <ShieldCheck size={17} />
          Add private visit evidence <span>Optional</span>
        </summary>
        <p>
          A receipt or ticket can support your visit. Cover personal information
          before uploading. Only you and moderators can access it; evidence
          expires after 30 days.
        </p>
        {evidence ? (
          <div className="evidence-attached">
            <Check size={16} />
            Evidence attached privately
            <button type="button" onClick={() => setEvidence(undefined)}>
              Remove
            </button>
          </div>
        ) : (
          <label className="upload-button">
            <Upload size={17} />
            Choose a receipt or ticket
            <input
              type="file"
              aria-label="Upload private evidence"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f, "evidence");
                e.target.value = "";
              }}
            />
          </label>
        )}
        <small>
          Uploading evidence doesn’t automatically earn a Visit Supported
          indicator. A moderator assesses it separately.
        </small>
      </details>
      <label className="check-label">
        <input
          name="incentive"
          type="checkbox"
          defaultChecked={review?.incentive}
        />
        This visit was complimentary or incentivized.
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button full-width" disabled={pending || uploading}>
        {pending
          ? "Saving your experience…"
          : review
            ? "Save changes"
            : visibility === "private"
              ? "Keep in my journal"
              : "Share my experience"}
      </button>
    </form>
  );
}
function OutingForm({
  places,
  initialPlace,
  onSubmit,
  pending,
}: {
  places: Place[];
  initialPlace?: Place;
  onSubmit: (body: unknown) => Promise<void>;
  pending: boolean;
}) {
  const [stops, setStops] = useState<string[]>(
    initialPlace ? [initialPlace.id] : [],
  );
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [selected, setSelected] = useState(places[0]?.id || "");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSubmit({
          title: f.get("title"),
          date: f.get("date"),
          notes: f.get("notes"),
          visibility,
          stops,
          invitees: String(f.get("invitees") || "")
            .split(",")
            .map((v) => v.trim().replace(/^@/, ""))
            .filter(Boolean),
        });
      }}
    >
      <p className="form-intro">
        A couple of stops, a little room to wander, and people you enjoy. Start
        with a simple plan.
      </p>
      <div className="form-grid">
        <label>
          Give your day a name
          <input
            name="title"
            placeholder="A slow Saturday in the city"
            minLength={3}
            maxLength={100}
            required
          />
        </label>
        <label>
          When are we going?
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </label>
      </div>
      <div className="stop-picker">
        <label>
          Add a place
          <select
            aria-label="Add a place"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {places.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          disabled={stops.includes(selected) || stops.length >= 10}
          onClick={() => setStops((s) => [...s, selected])}
        >
          <Plus size={17} />
          Add stop
        </button>
      </div>
      <ol className="editable-stops">
        {stops.map((pid, i) => (
          <li key={pid}>
            <span className="stop-number">{i + 1}</span>
            <img src={places.find((p) => p.id === pid)?.image} alt="" />
            <span>
              <strong>{places.find((p) => p.id === pid)?.name}</strong>
              <small>{places.find((p) => p.id === pid)?.neighborhood}</small>
            </span>
            <div>
              <button
                type="button"
                className="icon-button"
                disabled={i === 0}
                aria-label="Move stop up"
                onClick={() =>
                  setStops((s) => {
                    const a = [...s];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    return a;
                  })
                }
              >
                <MoveUp size={15} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={i === stops.length - 1}
                aria-label="Move stop down"
                onClick={() =>
                  setStops((s) => {
                    const a = [...s];
                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                    return a;
                  })
                }
              >
                <MoveDown size={15} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Remove stop"
                onClick={() => setStops((s) => s.filter((p) => p !== pid))}
              >
                <X size={15} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!stops.length && (
        <p className="form-help">
          Add at least one place to start your itinerary.
        </p>
      )}
      <label>
        Invite your people <span className="optional">Optional</span>
        <input name="invitees" placeholder="@username, @another_friend" />
        <small>
          Use registered pilot usernames, separated by commas. Invitations
          require acceptance before a companion is associated publicly.
        </small>
      </label>
      <label>
        A note for the day
        <textarea
          name="notes"
          placeholder="Meet after lunch. Leave room for dessert."
          maxLength={2000}
          rows={3}
        />
      </label>
      <VisibilitySelect value={visibility} onChange={setVisibility} />
      <p className="form-help">
        Private outings are shared only with the host and accepted companions.
        Each companion chooses who can see their own association.
      </p>
      <button className="button full-width" disabled={pending || !stops.length}>
        {pending ? "Putting your plan together…" : "Create my outing"}
      </button>
    </form>
  );
}
function SimpleForm({
  label,
  placeholder,
  button,
  onSubmit,
  pending,
  multiline = false,
  password = false,
}: {
  label: string;
  placeholder?: string;
  button: string;
  onSubmit: (value: string) => Promise<void>;
  pending: boolean;
  multiline?: boolean;
  password?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(value);
      }}
    >
      <label>
        {label}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            minLength={5}
            maxLength={1000}
            rows={4}
          />
        ) : (
          <input
            type={password ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            required
            maxLength={128}
          />
        )}
      </label>
      <button
        className={"button " + (password ? "danger-button" : "")}
        disabled={pending}
      >
        {pending ? "One moment…" : button}
      </button>
    </form>
  );
}
function ProfileForm({
  me,
  pending,
  onSubmit,
}: {
  me: User;
  pending: boolean;
  onSubmit: (value: unknown) => Promise<void>;
}) {
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSubmit({
          name: f.get("name"),
          bio: f.get("bio"),
          city: f.get("city"),
        });
      }}
    >
      <label>
        Your name
        <input
          name="name"
          defaultValue={me.name}
          minLength={2}
          maxLength={60}
          required
        />
      </label>
      <label>
        A little about you
        <textarea
          name="bio"
          defaultValue={me.bio}
          rows={3}
          maxLength={200}
          placeholder="Coffee, culture, and the scenic route."
        />
      </label>
      <label>
        Your city
        <select name="city" defaultValue={me.city}>
          {["Metro Manila", "Makati", "Taguig", "Manila", "Quezon City"].map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </select>
      </label>
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
function Notifications({
  data,
  onAction,
}: {
  data: Bootstrap;
  onAction: (
    id: string,
    status: string,
    visibility: Visibility,
  ) => Promise<void>;
}) {
  const [consent, setConsent] = useState<Visibility>("private");
  return (
    <div className="notifications-list">
      {!data.invitations.length ? (
        <Empty
          icon={<Bell />}
          title="A quiet little moment."
          text="New outing invitations will arrive here."
        />
      ) : (
        <>
          <p className="form-intro">
            Being invited never makes your identity public. Choose your
            visibility before accepting.
          </p>
          <VisibilitySelect
            value={consent}
            onChange={setConsent}
            label="Who can see my association with accepted outings?"
          />
          {data.invitations.map((i) => (
            <div className="invitation" key={i.id}>
              <CalendarDays size={24} />
              <div>
                <strong>{i.title}</strong>
                <p>{i.from} invited you to join.</p>
                {i.status === "pending" ? (
                  <div>
                    <button
                      className="button"
                      onClick={() => onAction(i.id, "accepted", consent)}
                    >
                      Accept
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => onAction(i.id, "declined", "private")}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="supported">
                      <Check size={15} />
                      Accepted
                    </span>
                    <button
                      className="text-button"
                      onClick={() => onAction(i.id, "accepted", consent)}
                    >
                      Update my visibility
                    </button>
                    <button
                      className="text-button"
                      onClick={() => onAction(i.id, "declined", "private")}
                    >
                      Leave outing
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
function TrustContent() {
  return (
    <div className="legal-content">
      <div className="legal-intro">
        <ShieldCheck size={34} />
        <p>
          Good recommendations begin with honesty. Here’s how your experiences
          and information are handled in the local Dated pilot.
        </p>
      </div>
      <h3>Your stories, your audience</h3>
      <p>
        Choose public, followers-only, or private for each review and outing.
        Saved collections are private. Your email, password, and device
        coordinates never appear in public content. Location permission is
        optional; city search always works.
      </p>
      <h3>Consent comes before company</h3>
      <p>
        Outing invitations remain pending until accepted. Each companion chooses
        who can see their association and can leave or change that choice at any
        time. Hosts cannot approve on someone else’s behalf.
      </p>
      <h3>A visit can be supported. An opinion stays personal.</h3>
      <p>
        Receipts and tickets are optional private evidence. Only the uploader
        and moderators can access them. Evidence expires after 30 days; a
        maintenance job removes expired files. Images are re-encoded to remove
        metadata. Cover names, card details, and other personal information
        before uploading.
      </p>
      <p>
        A Visit Supported indicator means a moderator assessed the evidence, not
        that Dated verified a subjective opinion. Complimentary or incentivized
        visits must be disclosed. Sample stories are excluded from venue scores.
      </p>
      <h3>A place for thoughtful disagreement</h3>
      <p>
        Report misleading or abusive reviews privately. Moderators record
        reasons for decisions, and authors can appeal hidden reviews. Critical
        feedback remains part of venue ratings unless a recorded moderation
        action hides it.
      </p>
      <h3>Your information, locally</h3>
      <p>
        This adult-only pilot stores accounts, sessions, posts, and images on
        this computer’s application server. Passwords are salted and hashed.
        Sessions expire after seven days. You can export your account data or
        permanently delete your account from your journal. Minimal moderation
        records may remain without your identity.
      </p>
      <h3>Before a public launch</h3>
      <p>
        This preview is not a public production service. A real operator must
        supply contact information, complete a privacy impact assessment,
        validate retention and age-assurance practices, and connect production
        infrastructure. Do not submit sensitive documents to this preview.
      </p>
    </div>
  );
}
function TermsContent() {
  return (
    <div className="legal-content">
      <p>
        These terms cover the local Dated pilot, for adults aged 18 and over.
        The directory contains fictional sample places, indicative spending, and
        illustrative photographs. Sample content is not advice about a real
        establishment.
      </p>
      <h3>Share your own experiences</h3>
      <p>
        Publish only content and photographs you have the right to share. Be
        specific and fair. Disclose complimentary visits, incentives, or
        conflicts of interest. Do not impersonate others, submit fabricated
        reviews, expose someone’s personal information, harass people, or use
        the platform for spam.
      </p>
      <h3>Respect your companions</h3>
      <p>
        Invite registered users by username and let them decide whether to
        accept. Never use a review or outing to expose someone’s location or
        identity without consent.
      </p>
      <h3>Moderation and account control</h3>
      <p>
        Reports are reviewed by a moderator. Content may be hidden with a
        recorded reason, and authors may appeal. You can edit or delete your own
        reviews, export account data, and remove your account.
      </p>
      <h3>Pilot limitations</h3>
      <p>
        The pilot is provided for evaluation. Venue information, map locations,
        and sample stories must be replaced with curated, verified content
        before launch. No payment service, reservations, or Premium subscription
        is active.
      </p>
    </div>
  );
}
type ModRow = Record<string, string | number | null>;
type ModData = {
  reports: ModRow[];
  appeals: ModRow[];
  evidence: ModRow[];
  actions: ModRow[];
};
function Moderation({ onChanged }: { onChanged: () => Promise<void> }) {
  const [data, setData] = useState<ModData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api<ModData>("moderation")
        .then(setData)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function decide(e: React.FormEvent<HTMLFormElement>, reviewId: string) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("moderation", {
        reviewId,
        action: f.get("action"),
        reason: f.get("reason"),
      });
      await load();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const decisionForm = (reviewId: string) => (
    <form className="moderation-form" onSubmit={(e) => decide(e, reviewId)}>
      <select name="action" aria-label="Moderation decision">
        <option value="dismiss">Dismiss report</option>
        <option value="hide">Hide review</option>
        <option value="restore">Restore review / resolve appeal</option>
        <option value="support">Approve visit evidence</option>
        <option value="reject-evidence">Reject visit evidence</option>
      </select>
      <input
        name="reason"
        placeholder="Record a reason (10+ characters)"
        aria-label="Decision reason"
        minLength={10}
        maxLength={1000}
        required
      />
      <button className="button" disabled={busy}>
        Record decision
      </button>
    </form>
  );
  return (
    <div className="moderation-content">
      {error && <p className="form-error">{error}</p>}
      {!data ? (
        <p>Opening the queue…</p>
      ) : (
        <>
          <h3>Community reports</h3>
          {data.reports.length ? (
            data.reports.map((r) => (
              <article key={String(r.id)}>
                <h4>{String(r.title)}</h4>
                <p>{String(r.reason)}</p>
                <small>
                  {String(r.status)} · {String(r.name || "Deleted account")}
                </small>
                {r.status === "open" && decisionForm(String(r.review_id))}
                {r.decision && <p>Decision: {String(r.decision)}</p>}
              </article>
            ))
          ) : (
            <p>No reports in the queue.</p>
          )}
          <h3>Author appeals</h3>
          {data.appeals.map((r) => (
            <article key={String(r.id)}>
              <h4>{String(r.title)}</h4>
              <p>{String(r.reason)}</p>
              <small>{String(r.status)}</small>
              {r.status === "open" && decisionForm(String(r.review_id))}
            </article>
          ))}
          {!data.appeals.length && <p>No appeals to review.</p>}
          <h3>Private visit evidence</h3>
          {data.evidence.map((r) => (
            <article key={String(r.id)}>
              <h4>{String(r.title)}</h4>
              <a href={"/api/media/" + r.id} target="_blank" rel="noreferrer">
                <img
                  className="moderation-evidence"
                  src={"/api/media/" + r.id}
                  alt="Private evidence for moderator assessment"
                />
              </a>
              <p>{r.supported ? "Visit supported" : "Awaiting assessment"}</p>
              {decisionForm(String(r.review_id))}
            </article>
          ))}
          {!data.evidence.length && <p>No unexpired evidence to assess.</p>}
          <h3>Decision audit</h3>
          {data.actions.map((r) => (
            <p key={String(r.id)}>
              <strong>{String(r.action)}</strong> · {String(r.reason)} ·{" "}
              {new Date(Number(r.created_at)).toLocaleString("en-PH")}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
