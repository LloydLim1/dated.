"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Pencil,
  Sparkles,
  Share2,
  Wallet,
  Store,
  MoreHorizontal,
} from "lucide-react";
import Modal from "./modal";
import PlaceCover from "./place-cover";
import PlaceLogo from "./place-logo";
import StreetViewAction from "./street-view-action";
import PlanningStudio from "./planning-studio";
import {
  WalletWorkspace,
  BusinessWorkspace,
  OperationsWorkspace,
  AccountGate,
} from "./commerce-workspaces";
import PlaceSelect from "./place-select";
import { PhotoCard, PhotoComposer, PhotoGrid } from "./photo-posts";
import { philippineDate } from "@/lib/philippine-date.mjs";
import { matchesDiscovery } from "@/lib/discovery-filters.mjs";
import {
  AdvancedFilterFields,
  SponsoredPlaces,
  VenueComparison,
  defaultExtraFilters,
  type ExtraFilters,
} from "./discovery-extras";
import {
  CRITERIA,
  LEGACY_CRITERIA,
  METRO_CITIES,
  average,
  money,
  type Bootstrap,
  type Place,
  type Review,
  type User,
  type Visibility,
  type Outing,
  type Collection,
  type PhotoPost,
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
  posts: [],
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
function trackDiscovery(placeId: string, kind: "place_open" | "directions") {
  try {
    let session = sessionStorage.getItem("dated-discovery-session");
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem("dated-discovery-session", session);
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, kind, session }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Discovery remains available when browser storage is disabled. */
  }
}
type ModalState = {
  type:
    | "auth"
    | "review"
    | "post"
    | "postview"
    | "outing"
    | "filters"
    | "location"
    | "notifications"
    | "collection"
    | "collection-share"
    | "save"
    | "profile"
    | "privacy"
    | "terms"
    | "report"
    | "delete"
    | "moderation"
    | "person"
    | "confirm"
    | "more";
  place?: Place;
  review?: Review;
  post?: PhotoPost;
  person?: User;
  outingId?: string;
  visitDate?: string;
  outing?: Outing;
  collection?: Collection;
  confirm?: { path: string; message: string; description: string };
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
  b: { lat: number | null; lng: number | null },
) {
  if (b.lat === null || b.lng === null) return Infinity;
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
  const [extraFilters, setExtraFilters] =
    useState<ExtraFilters>(defaultExtraFilters);
  const [sort, setSort] = useState("For you");
  const [modal, setModalState] = useState<ModalState | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);
  const [feedTab, setFeedTab] = useState("Discover");
  const [journalTab, setJournalTab] = useState("All");
  const [mapPlaceIds, setMapPlaceIds] = useState<string[]>([]);
  const [collection, setCollection] = useState("all");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [visibleCount, setVisibleCount] = useState(6);
  const [modalError, setModalError] = useState("");
  const [resume, setResume] = useState<{
    modal?: ModalState;
    view?: string;
  } | null>(null);
  const [outingTab, setOutingTab] = useState("Upcoming");
  const [premiumOuting, setPremiumOuting] = useState("");
  const placesRef = useRef<Place[]>([]);
  const restoreDiscovery = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("search") !== "1") return;
    const number = (
      key: string,
      fallback: number,
      min: number,
      max: number,
    ) => {
      const raw = params.get(key);
      const value = raw === null ? fallback : Number(raw);
      return Number.isFinite(value)
        ? Math.max(min, Math.min(max, value))
        : fallback;
    };
    setQuery((params.get("q") || "").slice(0, 200));
    setCategory(
      categories.some((c) => c.name === params.get("category"))
        ? params.get("category")!
        : "All places",
    );
    setCity(
      METRO_CITIES.includes(params.get("city") || "")
        ? params.get("city")!
        : "Metro Manila",
    );
    setBudget(number("budget", 0, 0, 100000));
    setOccasion(params.get("occasion") || "Any occasion");
    setExtraFilters({
      minRating: number("minRating", 0, 0, 5),
      criterion: (params.get("criterion") || "").slice(0, 100),
      criterionMinimum: number("criterionMinimum", 0, 0, 5),
      minReviews: number("minReviews", 1, 1, 1000),
      groupSize: number("groupSize", 1, 1, 20),
      budgetBasis: params.get("budgetBasis") === "total" ? "total" : "person",
    });
  }, []);
  const setModal = (value: ModalState | null) => {
    setModalError("");
    if (!value) setResume(null);
    setModalState(value);
  };
  const refresh = useCallback(async () => {
    try {
      const d = await api<Bootstrap>("bootstrap");
      setData(d);
      placesRef.current = d.places;
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
          restoreDiscovery();
          placesRef.current = d.places;
          const id = new URLSearchParams(location.search).get("place");
          setPlace(d.places.find((p) => p.id === id) || null);
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
    const onPop = () => {
      restoreDiscovery();
      setView(location.pathname.slice(1) || "home");
      setModalState(null);
      setModalError("");
      const id = new URLSearchParams(location.search).get("place");
      setPlace(placesRef.current.find((p) => p.id === id) || null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      active = false;
      window.removeEventListener("popstate", onPop);
    };
  }, [restoreDiscovery]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  const go = (next: string) => {
    setView(next);
    setPlace(null);
    setModal(null);
    setVisibleCount(6);
    history.pushState(null, "", next === "home" ? "/" : "/" + next);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() =>
      document.getElementById("main")?.focus({ preventScroll: true }),
    );
  };
  const requireAccount = (nextModal?: ModalState, nextView?: string) => {
    if (loading) {
      setToast("Your account is still loading. Please try again in a moment.");
      return false;
    }
    if (data.me) return true;
    setResume({
      modal:
        nextModal || (modal?.type !== "auth" ? modal || undefined : undefined),
      view: nextView,
    });
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
  const openPlace = useCallback((p: Place) => {
    setPlace(p);
    trackDiscovery(p.id, "place_open");
    const url = new URL(location.href);
    url.searchParams.set("place", p.id);
    history.pushState({ datedPlace: true }, "", url.pathname + url.search);
  }, []);
  const closePlace = () => {
    setPlace(null);
    if (history.state?.datedPlace) history.back();
    else {
      const url = new URL(location.href);
      url.searchParams.delete("place");
      history.replaceState(null, "", url.pathname + url.search);
    }
  };
  const clearFilters = () => {
    setQuery("");
    setCategory("All places");
    setCity("Metro Manila");
    setBudget(0);
    setOccasion("Any occasion");
    setExtraFilters(defaultExtraFilters);
    setVisibleCount(6);
  };
  const hasFilters =
    !!query ||
    category !== "All places" ||
    city !== "Metro Manila" ||
    !!budget ||
    extraFilters.minRating > 0 ||
    extraFilters.criterionMinimum > 0 ||
    extraFilters.groupSize > 1 ||
    extraFilters.budgetBasis === "total" ||
    occasion !== "Any occasion";
  const savedIds = new Set(data.collections.flatMap((c) => c.placeIds));
  const coverPhotos = useMemo(() => {
    const photos = new Map<string, string>();
    for (const post of [...data.posts].sort(
      (a, b) => b.createdAt - a.createdAt,
    ))
      if (
        post.visibility === "public" &&
        post.media[0] &&
        !photos.has(post.placeId)
      )
        photos.set(post.placeId, "/api/media/" + post.media[0]);
    return photos;
  }, [data.posts]);
  const places = useMemo(() => {
    let list = data.places.filter(
      (p) =>
        (category === "All places" || p.category === category) &&
        (city === "Metro Manila" || city === "Near me" || p.city === city) &&
        (!budget || (p.budgetKnown !== false && p.budget <= budget)) &&
        (occasion === "Any occasion" || p.tags.includes(occasion)) &&
        matchesDiscovery(p, {
          ...extraFilters,
          category,
          city,
          budget,
          occasion,
          query,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        }) &&
        `${p.name} ${p.city} ${p.neighborhood} ${p.category} ${p.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    if (city === "Near me" && coords)
      list = list
        .filter((p) => distance(coords, p) < 20)
        .sort((a, b) => distance(coords, a) - distance(coords, b));
    else if (sort === "Budget friendly")
      list = list.sort(
        (a, b) =>
          (a.budgetKnown === false ? Infinity : a.budget) -
          (b.budgetKnown === false ? Infinity : b.budget),
      );
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
    extraFilters,
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
      : view === "map"
        ? places.filter((p) => mapPlaceIds.includes(p.id))
        : places;
  const cityMapCenter = useMemo(() => {
    if (coords || city === "Metro Manila" || city === "Near me") return coords;
    const selected = data.places.filter(
      (p): p is Place & { lat: number; lng: number } =>
        p.city === city && !p.sample && p.lat !== null && p.lng !== null,
    );
    if (!selected.length) return null;
    return {
      lat: selected.reduce((s, p) => s + p.lat, 0) / selected.length,
      lng: selected.reduce((s, p) => s + p.lng, 0) / selected.length,
    };
  }, [city, coords, data.places]);
  const feed = data.feed.filter((r) =>
    view === "profile"
      ? r.author.id === data.me?.id
      : feedTab === "Following"
        ? data.following.includes(r.author.id)
        : true,
  );
  const posts = data.posts.filter((p) =>
    view === "profile"
      ? p.author.id === data.me?.id
      : feedTab === "Following"
        ? data.following.includes(p.author.id)
        : true,
  );
  const startPost = (p?: Place, post?: PhotoPost) => {
    const next: ModalState = { type: "post", place: p, post };
    if (requireAccount(next)) setModal(next);
  };
  const discovered = useCallback((found: Place[]) => {
    setMapPlaceIds(found.map((p) => p.id));
    setData((current) => {
      const map = new Map(current.places.map((p) => [p.id, p]));
      found.forEach((p) => {
        const prior = map.get(p.id);
        map.set(p.id, {
          ...p,
          rating: prior?.rating ?? null,
          reviewCount: prior?.reviewCount ?? 0,
          ratedReviewerCount: prior?.ratedReviewerCount ?? 0,
          supportedReviewerCount: prior?.supportedReviewerCount ?? 0,
          independentVisits: prior?.independentVisits ?? 0,
        });
      });
      const places = [...map.values()];
      placesRef.current = places;
      return { ...current, places };
    });
  }, []);
  const photoCard = (post: PhotoPost) => (
    <PhotoCard
      key={post.id}
      post={post}
      place={data.places.find((p) => p.id === post.placeId)}
      me={data.me}
      onPlace={() => {
        setModal(null);
        const p = data.places.find((p) => p.id === post.placeId);
        if (p) openPlace(p);
      }}
      onPerson={() => setModal({ type: "person", person: post.author })}
      onEdit={() => startPost(undefined, post)}
      onDelete={async () => {
        const deleted = await action(
          "posts/" + post.id,
          undefined,
          "Photo post deleted.",
          "DELETE",
        );
        if (deleted && modal?.type === "postview") setModal(null);
        return deleted;
      }}
      onReact={() => {
        if (requireAccount({ type: "postview", post }))
          void action("posts/" + post.id + "/reactions", {}, "Like updated.");
      }}
      onComment={async (body) =>
        requireAccount({ type: "postview", post })
          ? action("posts/" + post.id + "/comments", { body }, "Comment added.")
          : false
      }
    />
  );
  const startReview = (p?: Place, r?: Review) => {
    const next: ModalState = { type: "review", place: p, review: r };
    if (requireAccount(next)) setModal(next);
  };
  const myOutings = data.outings.filter(
    (o) =>
      o.owner.id === data.me?.id ||
      o.participants.some(
        (p) => p.user.id === data.me?.id && p.status === "accepted",
      ),
  );
  const shownOutings = myOutings.filter(
    (o) =>
      outingTab === "All outings" ||
      (outingTab === "Visited" ? o.completed : !o.completed),
  );
  const activeCollection = data.collections.find((c) => c.id === collection);
  const selected = data.collections.find((c) => c.id === modal?.collection?.id);
  const url =
    selected?.shareToken && typeof location !== "undefined"
      ? `${location.origin}/collection/${selected.shareToken}`
      : "";
  const save = (p: Place) => {
    const next: ModalState = { type: "save", place: p };
    if (requireAccount(next)) setModal(next);
  };
  const writeOuting = (p?: Place) => {
    const next: ModalState = { type: "outing", place: p };
    if (requireAccount(next)) setModal(next);
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
      "Find real restaurants, cafés and museums as you explore the map.",
    ],
    planning: [
      "Make a day worth keeping.",
      "Plan, collaborate, and share. Every planning tool is free.",
    ],
    wallet: [
      "A little discovery. A little reward.",
      "Your coins, your vouchers, your next good experience.",
    ],
    business: [
      "A better experience starts with understanding.",
      "Your location, your customers, and a clearer view of what matters.",
    ],
    operations: [
      "Keep the community in good hands.",
      "Thoughtful decisions. Clear records. Useful experiences.",
    ],
  };
  return (
    <div className={"app-shell" + (view === "map" ? " map-shell" : "")}>
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
          className={"nav-item " + (view === "planning" ? "active" : "")}
          onClick={() => go("planning")}
        >
          <Sparkles size={20} />
          Planning studio
        </button>
        <button
          className={"nav-item " + (view === "wallet" ? "active" : "")}
          onClick={() => go("wallet")}
        >
          <Wallet size={20} />
          Coins & vouchers
        </button>
        <button
          className={"nav-item " + (view === "business" ? "active" : "")}
          onClick={() => go("business")}
        >
          <Store size={20} />
          For locations
        </button>
        {data.me?.role === "admin" && (
          <button
            className={"nav-item " + (view === "operations" ? "active" : "")}
            onClick={() => go("operations")}
          >
            <ShieldCheck size={20} />
            Operations
          </button>
        )}
        <button
          className={"nav-item " + (view === "profile" ? "active" : "")}
          onClick={() =>
            data.me ? go("profile") : requireAccount(undefined, "profile")
          }
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
              data.me ? go("profile") : requireAccount(undefined, "profile")
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
            disabled={loading || pending}
            onClick={() =>
              data.me
                ? setModal({ type: "notifications" })
                : requireAccount({ type: "notifications" })
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
              disabled={loading}
              onClick={() => setModal({ type: "auth" })}
            >
              Join Dated
            </button>
          )}
        </header>
        <main
          id="main"
          className={"main-content " + (view === "map" ? "map-main" : "")}
          tabIndex={-1}
        >
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
                      {["home", "explore", "map"].includes(view) && (
                        <SponsoredPlaces
                          filters={{
                            ...extraFilters,
                            category,
                            city,
                            budget,
                            occasion,
                            query,
                            ...(coords
                              ? { lat: coords.lat, lng: coords.lng }
                              : {}),
                          }}
                          onOpen={openPlace}
                          me={data.me}
                        />
                      )}
                      {view === "explore" && (
                        <VenueComparison places={data.places} />
                      )}
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
                              aria-pressed={view !== "map"}
                              onClick={() => go("explore")}
                            >
                              <Grid2X2 size={18} />
                            </button>
                            <button
                              className={view === "map" ? "selected" : ""}
                              aria-label="Map view"
                              aria-pressed={view === "map"}
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
                              aria-pressed={category === c.name}
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
                      {(view === "explore" || view === "map") && (
                        <button
                          className="text-button"
                          onClick={async () => {
                            const params = new URLSearchParams({
                              search: "1",
                              q: query,
                              category,
                              city: city === "Near me" ? "Metro Manila" : city,
                              budget: String(budget),
                              occasion,
                              ...Object.fromEntries(
                                Object.entries(extraFilters).map(([k, v]) => [
                                  k,
                                  String(v),
                                ]),
                              ),
                            });
                            const url = `${location.origin}/${view}?${params}`;
                            history.replaceState(
                              null,
                              "",
                              `/${view}?${params}`,
                            );
                            try {
                              await navigator.clipboard.writeText(url);
                              setToast(
                                "Search link copied. Your device location is not included.",
                              );
                            } catch {
                              setToast(
                                "Your search is saved in the address bar. Copy its link to share.",
                              );
                            }
                          }}
                        >
                          <Share2 size={14} /> Copy search link
                        </button>
                      )}
                      {hasFilters && (
                        <div
                          className="active-filters"
                          aria-label="Active filters"
                        >
                          {query && (
                            <button onClick={() => setQuery("")}>
                              Search: {query}
                              <X size={14} />
                            </button>
                          )}
                          {city !== "Metro Manila" && (
                            <button
                              onClick={() => {
                                setCity("Metro Manila");
                                setCoords(null);
                              }}
                            >
                              {city}
                              <X size={14} />
                            </button>
                          )}
                          {!!budget && (
                            <button onClick={() => setBudget(0)}>
                              Up to {money(budget)}
                              <X size={14} />
                            </button>
                          )}
                          {occasion !== "Any occasion" && (
                            <button onClick={() => setOccasion("Any occasion")}>
                              {occasion}
                              <X size={14} />
                            </button>
                          )}
                          <button
                            className="inline-link"
                            onClick={clearFilters}
                          >
                            Clear all
                          </button>
                        </div>
                      )}
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
                              requireAccount({ type: "collection" }) &&
                              setModal({ type: "collection" })
                            }
                          >
                            <Plus size={15} />
                            New collection
                          </button>
                        </div>
                      )}
                      {view === "saved" && activeCollection && (
                        <div className="collection-toolbar">
                          <p>
                            <Lock size={14} />
                            {activeCollection.shareToken
                              ? "Link sharing on"
                              : "Private collection"}{" "}
                            · {activeCollection.placeIds.length} saved places
                          </p>
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({
                                type: "collection-share",
                                collection: activeCollection,
                              })
                            }
                          >
                            <Share2 size={15} /> Sharing
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({
                                type: "collection",
                                collection: activeCollection,
                              })
                            }
                          >
                            <Pencil size={15} />
                            Rename
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({
                                type: "confirm",
                                confirm: {
                                  path: "collections/" + activeCollection.id,
                                  message: "Collection deleted.",
                                  description: `Delete “${activeCollection.name}”? Places saved in other collections will still be there.`,
                                },
                              })
                            }
                          >
                            <Trash2 size={15} />
                            Delete collection
                          </button>
                        </div>
                      )}
                      {view === "map" && (
                        <PlaceMap
                          onSelect={openPlace}
                          onDiscover={discovered}
                          places={places}
                          center={cityMapCenter}
                          category={category}
                          onCategory={setCategory}
                          query={query}
                          onQuery={setQuery}
                          onFilters={() => setModal({ type: "filters" })}
                          onGrid={() => go("explore")}
                          onSave={save}
                          savedIds={savedIds}
                          catalogCount={data.catalog?.count}
                        />
                      )}
                      {(view === "explore" || view === "map") &&
                        !!data.catalog?.lastSuccess && (
                          <p className="catalog-summary">
                            <Globe size={16} aria-hidden="true" />
                            <span>
                              {data.catalog.count.toLocaleString()} mapped food
                              places across 17 Metro Manila cities and
                              municipalities.
                              {data.catalog.museums?.count
                                ? ` Plus ${data.catalog.museums.count.toLocaleString()} museums.`
                                : ""}{" "}
                              Updated{" "}
                              {new Date(
                                data.catalog.lastSuccess,
                              ).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                              })}
                              .{" "}
                              {data.catalog.status === "error"
                                ? "Refresh delayed; saved listings remain available."
                                : "Refreshed weekly."}
                            </span>
                          </p>
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
                            <span>
                              {visiblePlaces.length}{" "}
                              {visiblePlaces.length === 1 ? "place" : "places"}
                            </span>
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
                                      coverPhoto={coverPhotos.get(p.id)}
                                      onOpen={() => openPlace(p)}
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
                                view === "saved" && !hasFilters
                                  ? "Good finds belong here."
                                  : "No places just yet."
                              }
                              text={
                                view === "saved" && !hasFilters
                                  ? "Save a place you love and find it here whenever you’re ready."
                                  : "Try another neighborhood, category, or budget."
                              }
                              action={
                                view === "saved" && !hasFilters
                                  ? () => go("explore")
                                  : clearFilters
                              }
                              label={
                                view === "saved" && !hasFilters
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
                                    openPlace(
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
                                    onClick={() => openPlace(p)}
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
                            onClick={() => startPost()}
                          >
                            <Plus size={16} />
                            Post photos
                          </button>
                        </div>
                        {posts.map(photoCard)}
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
                                openPlace(
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
                  {view === "planning" && (
                    <PlanningStudio
                      outings={data.outings}
                      places={data.places}
                      me={data.me}
                      initialOuting={premiumOuting}
                      onPlan={() => writeOuting()}
                      onRefresh={refresh}
                    />
                  )}
                  {view === "wallet" &&
                    (data.me ? (
                      <WalletWorkspace
                        onDiscover={() => go("explore")}
                        onReview={() => startReview()}
                      />
                    ) : (
                      <AccountGate
                        onSignIn={() => requireAccount(undefined, "wallet")}
                      />
                    ))}
                  {view === "business" &&
                    (data.me ? (
                      <BusinessWorkspace
                        places={data.places}
                        me={data.me}
                        onChange={refresh}
                      />
                    ) : (
                      <AccountGate
                        kind="business"
                        onSignIn={() => requireAccount(undefined, "business")}
                      />
                    ))}
                  {view === "operations" &&
                    (data.me?.role === "admin" ? (
                      <>
                        <OperationsWorkspace />
                        <button
                          className="button secondary"
                          onClick={() => setModal({ type: "moderation" })}
                        >
                          Review moderation and private evidence
                        </button>
                      </>
                    ) : (
                      <p className="form-error">
                        This workspace is available to authorized
                        administrators.
                      </p>
                    ))}
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
                      <div
                        className="large-tabs"
                        role="group"
                        aria-label="Outing status"
                      >
                        {["Upcoming", "Visited", "All outings"].map((tab) => (
                          <button
                            key={tab}
                            className={outingTab === tab ? "active" : ""}
                            aria-pressed={outingTab === tab}
                            onClick={() => setOutingTab(tab)}
                          >
                            {tab}{" "}
                            <span className="tab-count">
                              {
                                myOutings.filter(
                                  (o) =>
                                    tab === "All outings" ||
                                    (tab === "Visited"
                                      ? o.completed
                                      : !o.completed),
                                ).length
                              }
                            </span>
                          </button>
                        ))}
                      </div>
                      {shownOutings.length ? (
                        <div className="outing-grid">
                          {shownOutings.map((o) => (
                            <article className="outing-card" key={o.id}>
                              <div className="outing-cover">
                                <img
                                  src={
                                    data.places.find((p) => p.id === o.stops[0])
                                      ?.image
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
                                    {o.owner.id === data.me?.id
                                      ? o.visibility
                                      : "Invited by " + o.owner.name}
                                  </span>
                                </div>
                                <h2>{o.title}</h2>
                                <p>{o.notes}</p>
                                <ol className="outing-stops">
                                  {o.stops.map((pid) => (
                                    <li key={pid}>
                                      <button
                                        onClick={() =>
                                          openPlace(
                                            data.places.find(
                                              (p) => p.id === pid,
                                            )!,
                                          )
                                        }
                                      >
                                        {
                                          data.places.find((p) => p.id === pid)
                                            ?.name
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
                                      onClick={() => {
                                        setPremiumOuting(o.id);
                                        go("planning");
                                      }}
                                    >
                                      <Share2 size={16} />
                                      Design & share
                                    </button>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        setModal({ type: "outing", outing: o })
                                      }
                                    >
                                      <Pencil size={16} />
                                      Edit plan
                                    </button>
                                    <button
                                      className="text-button"
                                      disabled={
                                        pending ||
                                        (!o.completed &&
                                          o.date > philippineDate())
                                      }
                                      title={
                                        !o.completed &&
                                        o.date > philippineDate()
                                          ? "Available on the date of your outing"
                                          : undefined
                                      }
                                      onClick={async () => {
                                        const previousTab = outingTab;
                                        setOutingTab(
                                          o.completed ? "Upcoming" : "Visited",
                                        );
                                        if (
                                          !(await action(
                                            "outings/" + o.id,
                                            { completed: !o.completed },
                                            o.completed
                                              ? "Outing reopened."
                                              : "A memory, kept.",
                                            "PATCH",
                                          ))
                                        )
                                          setOutingTab(previousTab);
                                      }}
                                    >
                                      <CheckCircle2 size={16} />
                                      {o.completed
                                        ? "Reopen plan"
                                        : "Mark as visited"}
                                    </button>
                                    <button
                                      className="icon-button"
                                      aria-label={"Delete outing " + o.title}
                                      onClick={() =>
                                        setModal({
                                          type: "confirm",
                                          confirm: {
                                            path: "outings/" + o.id,
                                            message: "Outing deleted.",
                                            description: `Delete “${o.title}” and its invitations? Your reviews will remain in your journal.`,
                                          },
                                        })
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      const invitation = data.invitations.find(
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
                          title={
                            outingTab === "Visited"
                              ? "Your memories will live here."
                              : "The next good day is yours to plan."
                          }
                          text={
                            outingTab === "Visited"
                              ? "After your outing, mark it as visited and write a review for each stop."
                              : "Pick your places, invite your people, and start a little story."
                          }
                          action={() =>
                            outingTab === "Visited"
                              ? setOutingTab("Upcoming")
                              : writeOuting()
                          }
                          label={
                            outingTab === "Visited"
                              ? "See upcoming plans"
                              : "Plan an outing"
                          }
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
                            className="button secondary"
                            onClick={() => go("planning")}
                          >
                            <Sparkles size={16} />
                            Planning studio
                          </button>
                          <button
                            className="button"
                            onClick={() => startPost()}
                          >
                            <Camera size={16} />
                            Post photos
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => startReview()}
                          >
                            <Plus size={16} />
                            Write a review
                          </button>
                        </div>
                        <div className="sort-tabs journal-tabs">
                          {["All", "Photos", "Reviews"].map((tab) => (
                            <button
                              key={tab}
                              className={journalTab === tab ? "active" : ""}
                              onClick={() => setJournalTab(tab)}
                            >
                              {tab}
                              {tab === "Photos"
                                ? ` (${posts.length})`
                                : tab === "Reviews"
                                  ? ` (${feed.length})`
                                  : ""}
                            </button>
                          ))}
                        </div>
                        {journalTab !== "Reviews" && (
                          <PhotoGrid
                            posts={posts}
                            places={data.places}
                            onOpen={(post) =>
                              setModal({ type: "postview", post })
                            }
                          />
                        )}
                        {journalTab !== "Photos" &&
                          feed.map((r) => (
                            <ReviewCard
                              key={r.id}
                              review={r}
                              place={data.places.find(
                                (p) => p.id === r.placeId,
                              )!}
                              me={data.me}
                              onPlace={() =>
                                openPlace(
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
                        {journalTab === "Reviews" && !feed.length && (
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
                              onClick={() =>
                                void action(
                                  "catalog/refresh",
                                  {},
                                  "Restaurant directory refresh started.",
                                )
                              }
                            >
                              <Globe size={16} />
                              Refresh places directory
                            </button>
                          )}
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
                  Places come from OpenStreetMap and Philippine Museums. Sample
                  places and stories are labeled. Journal photos are shared by
                  visitors.
                </p>
                <div>
                  <button onClick={() => go("planning")}>
                    Planning studio
                  </button>
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
        {nav.map((n) => (
          <button
            className={view === n.id ? "active" : ""}
            key={n.id}
            aria-current={view === n.id ? "page" : undefined}
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
          className={
            [
              "profile",
              "wallet",
              "planning",
              "business",
              "operations",
            ].includes(view)
              ? "active"
              : ""
          }
          onClick={() => setModal({ type: "more" })}
        >
          <MoreHorizontal size={21} />
          <span>More</span>
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
        <Modal title={place.name} wide onClose={closePlace}>
          <PlaceDetail
            place={data.places.find((p) => p.id === place.id) || place}
            reviews={data.feed.filter((r) => r.placeId === place.id)}
            coverPhoto={coverPhotos.get(place.id)}
            onSave={() => save(place)}
            saved={savedIds.has(place.id)}
            onReview={() => startReview(place)}
            onOuting={() => writeOuting(place)}
            onPost={() => startPost(place)}
            me={data.me}
            onEdit={(r) => startReview(place, r)}
            onReport={(r) =>
              requireAccount({ type: "report", review: r }) &&
              setModal({ type: "report", review: r })
            }
          />
          <section className="place-photo-section">
            <div className="profile-toolbar">
              <h3>Moments at {place.name}</h3>
              <button className="text-button" onClick={() => startPost(place)}>
                <Camera size={16} />
                Add your pictures
              </button>
            </div>
            <PhotoGrid
              posts={data.posts.filter((p) => p.placeId === place.id)}
              places={data.places}
              onOpen={(post) => setModal({ type: "postview", post })}
            />
          </section>
        </Modal>
      )}
      {modal && (
        <Modal
          key={
            modal.type +
            (modal.outing?.id ||
              modal.collection?.id ||
              modal.review?.id ||
              modal.post?.id ||
              "")
          }
          title={modalTitle(modal)}
          wide={["review", "post", "outing", "moderation"].includes(modal.type)}
          onClose={() => setModal(null)}
          protectChanges={[
            "review",
            "post",
            "outing",
            "collection",
            "profile",
          ].includes(modal.type)}
          busy={pending}
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
                const next = resume;
                setResume(null);
                if (next?.view) go(next.view);
                setModal(next?.modal || null);
                setToast("Welcome to Dated. Make yourself at home.");
              }}
            />
          )}
          {modal.type === "more" && (
            <nav className="workspace-menu" aria-label="Your DATED workspaces">
              {[
                { id: "profile", label: "My journal", icon: BookOpen },
                { id: "wallet", label: "Coins & vouchers", icon: Wallet },
                {
                  id: "planning",
                  label: "Planning studio",
                  icon: CalendarDays,
                },
                { id: "business", label: "For locations", icon: Store },
                { id: "map", label: "Map discovery", icon: MapIcon },
                ...(data.me?.role === "admin"
                  ? [
                      {
                        id: "operations",
                        label: "Operations",
                        icon: ShieldCheck,
                      },
                    ]
                  : []),
              ].map((item) => (
                <button key={item.id} onClick={() => go(item.id)}>
                  <item.icon size={21} />
                  <span>{item.label}</span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </nav>
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
          {modal.type === "post" && (
            <PhotoComposer
              places={data.places}
              initialPlace={modal.place}
              post={modal.post}
              pending={pending}
              onBusy={setPending}
              onSubmit={async (body) => {
                const saved = await action(
                  modal.post ? "posts/" + modal.post.id : "posts",
                  body,
                  "Your pictures are in your journal.",
                  modal.post ? "PATCH" : "POST",
                );
                if (saved) setModal(null);
                return saved;
              }}
            />
          )}
          {modal.type === "postview" &&
            modal.post &&
            (data.posts.find((p) => p.id === modal.post?.id) ? (
              photoCard(data.posts.find((p) => p.id === modal.post?.id)!)
            ) : (
              <p>This photo post is no longer available.</p>
            ))}
          {modal.type === "outing" && (
            <OutingForm
              places={data.places}
              initialPlace={modal.place}
              outing={modal.outing}
              existingOutings={myOutings.filter(
                (o) => o.owner.id === data.me?.id && !o.completed,
              )}
              onSelectExisting={(o) =>
                setModal({ type: "outing", outing: o, place: modal.place })
              }
              onSubmit={async (body) => {
                if (
                  await action(
                    modal.outing ? "outings/" + modal.outing.id : "outings",
                    body,
                    modal.outing
                      ? "Your plan has been updated."
                      : "Your little plan is ready.",
                    modal.outing ? "PATCH" : "POST",
                  )
                ) {
                  setModal(null);
                  setPlace(null);
                  go("outings");
                  setOutingTab(
                    modal.outing?.completed ? "Visited" : "Upcoming",
                  );
                }
              }}
              pending={pending}
            />
          )}
          {modal.type === "filters" && (
            <FilterForm
              budget={budget}
              occasion={occasion}
              extraFilters={extraFilters}
              category={category}
              onExtraChange={setExtraFilters}
              onApply={(nextBudget, nextOccasion) => {
                setBudget(nextBudget);
                setOccasion(nextOccasion);
                setVisibleCount(6);
                setModal(null);
              }}
            />
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
                      setToast(
                        "Showing places within 20 km. Open the map to discover more nearby.",
                      );
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
                ...Array.from(
                  new Set(
                    data.places
                      .map((p) => p.city)
                      .filter((c) => c !== "Nearby" && c !== "Metro Manila"),
                  ),
                ).sort(),
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
              pending={pending}
              onView={() => {
                go("outings");
                setOutingTab("All outings");
              }}
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
          {modal.type === "collection-share" && selected && (
            <div className="form-stack">
              <p>
                Share a snapshot of “{selected.name}” containing its name and
                saved places. Anyone with the link can open it. Your reviews,
                notes, and profile stay private.
              </p>
              {url && (
                <>
                  <label>
                    Shared collection link
                    <input
                      readOnly
                      value={url}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <button
                    className="button secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        setToast("Collection link copied.");
                      } catch {
                        setModalError("Select and copy the link above.");
                      }
                    }}
                  >
                    <Share2 size={16} /> Copy link
                  </button>
                  <button
                    className="text-button"
                    disabled={pending}
                    onClick={async () => {
                      if (
                        await action(
                          `collections/${selected.id}/share`,
                          {},
                          "Sharing turned off.",
                          "DELETE",
                        )
                      )
                        setModal(null);
                    }}
                  >
                    Turn off sharing
                  </button>
                </>
              )}
              <button
                className="button"
                disabled={pending}
                onClick={() =>
                  action(
                    `collections/${selected.id}/share`,
                    {},
                    "Collection snapshot shared. Copy its link above.",
                  )
                }
              >
                {pending
                  ? "Saving…"
                  : url
                    ? "Update snapshot & replace link"
                    : "Create shared link"}
              </button>
              {url && (
                <small>
                  Replacing the link disables the previous link. Edits to saved
                  places are shared only when you update this snapshot.
                </small>
              )}
            </div>
          )}
          {modal.type === "collection" && (
            <SimpleForm
              label="Collection name"
              placeholder="Slow Sundays, date nights, little escapes…"
              button={
                modal.collection ? "Save collection name" : "Create collection"
              }
              initialValue={modal.collection?.name}
              minLength={2}
              maxLength={60}
              pending={pending}
              onSubmit={async (name) => {
                if (modal.collection) {
                  if (
                    await action(
                      "collections/" + modal.collection.id,
                      { name },
                      "Collection renamed.",
                      "PATCH",
                    )
                  )
                    setModal(null);
                  return;
                }
                if (pending) return;
                setPending(true);
                try {
                  const created = await api<{ id: string }>("collections", {
                    name,
                  });
                  await refresh();
                  // Resume the original save chooser even if the subsequent save fails.
                  setModal(
                    modal.place ? { type: "save", place: modal.place } : null,
                  );
                  if (modal.place) {
                    await api("collections/items", {
                      collectionId: created.id,
                      placeId: modal.place.id,
                    });
                    await refresh();
                  } else setCollection(created.id);
                  setToast(
                    modal.place
                      ? "Saved to " + name + "."
                      : "Collection created.",
                  );
                } catch (e) {
                  setModalError((e as Error).message);
                } finally {
                  setPending(false);
                }
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
                onClick={() =>
                  setModal({ type: "collection", place: modal.place })
                }
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
              <PhotoGrid
                posts={data.posts.filter(
                  (p) =>
                    p.author.id === modal.person?.id &&
                    p.visibility === "public",
                )}
                places={data.places}
                onOpen={(post) => setModal({ type: "postview", post })}
              />
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
                      openPlace(data.places.find((p) => p.id === r.placeId)!);
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
          {modal.type === "confirm" && modal.confirm && (
            <div className="form-stack">
              <p className="form-intro">{modal.confirm.description}</p>
              <p className="form-help">This cannot be undone.</p>
              <div className="form-actions">
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() => setModal(null)}
                >
                  Keep it
                </button>
                <button
                  className="button danger-button"
                  disabled={pending}
                  onClick={async () => {
                    if (
                      await action(
                        modal.confirm!.path,
                        undefined,
                        modal.confirm!.message,
                        "DELETE",
                      )
                    ) {
                      if (modal.confirm!.path.startsWith("collections/"))
                        setCollection("all");
                      setModal(null);
                    }
                  }}
                >
                  {pending ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
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
      post: m.post ? "Edit your photo post" : "A moment worth keeping",
      postview: "A little moment, remembered",
      outing: m.outing ? "A little change of plans" : "Make a day of it.",
      filters: "A place for your kind of day",
      location: "Where shall we explore?",
      notifications: "Your invitations",
      collection: "A collection of good places",
      "collection-share": "Share your collection",
      confirm: "A moment before you delete",
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
      more: "Your DATED",
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
function FilterForm({
  budget,
  occasion,
  extraFilters,
  category,
  onExtraChange,
  onApply,
}: {
  budget: number;
  occasion: string;
  extraFilters: ExtraFilters;
  category: string;
  onExtraChange: (value: ExtraFilters) => void;
  onApply: (budget: number, occasion: string) => void;
}) {
  const [draftBudget, setDraftBudget] = useState(budget);
  const [draftOccasion, setDraftOccasion] = useState(occasion);
  const [draftExtra, setDraftExtra] = useState(extraFilters);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onExtraChange(draftExtra);
        onApply(draftBudget, draftOccasion);
      }}
    >
      <p className="form-intro">Find a place that fits your day.</p>
      <label>
        Maximum budget
        <select
          value={draftBudget}
          onChange={(e) => setDraftBudget(Number(e.target.value))}
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
          value={draftOccasion}
          onChange={(e) => setDraftOccasion(e.target.value)}
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
            setDraftBudget(0);
            setDraftOccasion("Any occasion");
            setDraftExtra(defaultExtraFilters);
          }}
        >
          Reset filters
        </button>
        <button className="button">Show matching places</button>
      </div>
      <AdvancedFilterFields
        value={draftExtra}
        onChange={setDraftExtra}
        category={category}
      />
    </form>
  );
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
  coverPhoto,
}: {
  place: Place;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  km?: number;
  coverPhoto?: string;
}) {
  return (
    <article className="place-card">
      <div className="place-image">
        <button
          className="image-open"
          onClick={onOpen}
          aria-label={"Explore " + p.name}
        >
          <PlaceCover place={p} photo={coverPhoto} />
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
            {p.logo && !p.sample && <PlaceLogo place={p} />}
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
          <span>
            {p.budgetKnown === false
              ? "Budget not listed"
              : money(p.budget) + " / person"}
          </span>
          <span>
            {km !== undefined && Number.isFinite(km)
              ? km.toFixed(1) + " km away"
              : p.rating
                ? (p.ratedReviewerCount ?? p.reviewCount) + " reviewers"
                : p.sample
                  ? "Sample place"
                  : "No reviews yet"}
          </span>
        </div>
        {p.locationStatus === "address_only" && (
          <small>Address listed · map pin pending</small>
        )}
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
  const [deletePrompt, setDeletePrompt] = useState(false);
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
        {r.businessRelationship && (
          <span>
            Author affiliated with this location · excluded from place score
          </span>
        )}
        {r.rewardStatus === "approved" && (
          <span>DATED coins awarded · rating remains independent</span>
        )}
        {r.supported && (
          <span title="Visit evidence was assessed. This does not verify the opinion.">
            <ShieldCheck size={14} />
            Visit supported
          </span>
        )}
        {r.incentive && (
          <span>Incentivized visit · excluded from place score</span>
        )}
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
                onClick={() => setDeletePrompt(true)}
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
      {deletePrompt && (
        <div className="review-delete-prompt" role="alert">
          <p>Delete this review and its photos? This cannot be undone.</p>
          <button
            className="button secondary"
            onClick={() => setDeletePrompt(false)}
          >
            Keep review
          </button>
          <button
            className="button danger-button"
            onClick={() => {
              onDelete();
              setDeletePrompt(false);
            }}
          >
            Delete review permanently
          </button>
        </div>
      )}
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
  onPost,
  me,
  onEdit,
  onReport,
  coverPhoto,
}: {
  place: Place;
  reviews: Review[];
  onSave: () => void;
  saved: boolean;
  onReview: () => void;
  onOuting: () => void;
  onPost: () => void;
  me: User | null;
  onEdit: (r: Review) => void;
  onReport: (r: Review) => void;
  coverPhoto?: string;
}) {
  const [reviewFilter, setReviewFilter] = useState("all");
  const visibleReviews = [...reviews]
    .filter(
      (r) =>
        reviewFilter === "all" ||
        (reviewFilter === "supported"
          ? r.supported
          : !r.incentive &&
            !r.businessRelationship &&
            !r.demo &&
            !r.hidden &&
            r.visibility === "public"),
    )
    .sort(
      (a, b) =>
        b.visitDate.localeCompare(a.visitDate) || b.createdAt - a.createdAt,
    );
  return (
    <div className="place-detail">
      <div className="detail-image detail-photo-cover">
        <PlaceCover place={p} photo={coverPhoto} />
      </div>
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
            {p.budgetKnown === false
              ? "Budget not listed"
              : money(p.budget) + " estimated per person"}
          </span>
        </div>
        <div className="detail-tags">
          {p.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {!p.sample && p.category === "Museum" && (
          <section
            className="place-menu"
            aria-label="Museum admission and visiting"
          >
            <div>
              <h3>Admission & visiting</h3>
              <p>{p.admissionText || "Admission hasn’t been confirmed yet."}</p>
              <small>
                {p.admissionText
                  ? p.admissionSource &&
                    p.admissionSource !== p.museumDirectoryUrl
                    ? "Reported on the museum website; confirm current admission, discounts and reservations."
                    : "Reported by the directory; confirm current admission, discounts and reservations with the museum."
                  : "Check visiting arrangements with the museum."}{" "}
                You can still rate your visit.
              </small>
              {p.locationStatus === "address_only" && (
                <p className="notice">
                  The address is listed, but an exact map pin hasn’t been
                  confirmed yet.
                </p>
              )}
              {p.visitingNotice && (
                <p className="notice" role="status">
                  {p.visitingNotice}
                </p>
              )}
            </div>
            <div className="place-menu-links">
              {p.website && p.websiteStatus !== "identity_unconfirmed" && (
                <a
                  className="button secondary"
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit museum website <ChevronRight size={14} />
                </a>
              )}
              {p.museumDirectoryUrl && (
                <a
                  className="text-button"
                  href={p.museumDirectoryUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Philippine Museums listing
                </a>
              )}
              {p.locationSource && (
                <a
                  className="text-button"
                  href={p.locationSource}
                  target="_blank"
                  rel="noreferrer"
                >
                  Current address source
                </a>
              )}
              {p.museumCheckedAt && (
                <small>
                  Directory checked{" "}
                  {new Date(p.museumCheckedAt).toLocaleDateString("en-PH")}
                </small>
              )}
              {p.admissionSource &&
                p.admissionSource !== p.museumDirectoryUrl && (
                  <a
                    className="text-button"
                    href={p.admissionSource}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official admission source
                  </a>
                )}
            </div>
          </section>
        )}
        {!p.sample && p.category === "Cinema" && (
          <section
            className="place-menu"
            aria-label="Cinema tickets and showtimes"
          >
            <div>
              <h3>Tickets & showtimes</h3>
              <p>
                Check current films, schedules and ticket prices with the
                cinema.
              </p>
              <small>
                You can still rate your visit when ticket prices aren’t listed.
              </small>
            </div>
            {p.website && p.websiteStatus !== "identity_unconfirmed" && (
              <a
                className="button secondary"
                href={p.website}
                target="_blank"
                rel="noreferrer"
              >
                Visit cinema website <ChevronRight size={14} />
              </a>
            )}
          </section>
        )}
        {!p.sample &&
          (p.category === "Restaurant" || p.category === "Café") && (
            <section className="place-menu" aria-label="Menu and prices">
              <div>
                <h3>Philippine menu & prices</h3>
                <p>
                  {p.priceText || "Prices aren’t published in our sources yet."}
                </p>
                {p.priceText && p.priceCheckedAt && (
                  <small>
                    Published price checked on{" "}
                    {new Date(p.priceCheckedAt).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    .
                  </small>
                )}
                <small>
                  {p.menuUrl
                    ? p.menuStatus === "unavailable"
                      ? "The published menu link couldn’t be reached."
                      : p.menuStatus === "restricted"
                        ? "The menu website limits automated checks. You can open it directly."
                        : "Availability and prices can vary by branch."
                    : p.menuUnavailableReason === "country_unconfirmed"
                      ? "A Philippine menu hasn’t been confirmed for this place yet."
                      : "No Philippine menu link is listed for this place yet."}{" "}
                  You can still rate your visit.
                </small>
              </div>
              <div className="place-menu-links">
                {p.menuUrl &&
                  p.menuCountry === "PH" &&
                  p.menuStatus !== "unavailable" &&
                  p.menuStatus !== "unverified" && (
                    <a
                      className="button secondary"
                      href={p.menuUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <BookOpen size={16} />
                      View menu
                    </a>
                  )}
                {p.website &&
                  p.websiteCountry === "PH" &&
                  p.websiteStatus !== "identity_unconfirmed" && (
                    <a
                      className="text-button"
                      href={p.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit website <ChevronRight size={14} />
                    </a>
                  )}
                {p.priceSource && (
                  <a
                    className="text-button"
                    href={p.priceSource}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Price source
                  </a>
                )}
                {p.menuSource && <small>Menu source: {p.menuSource}</small>}
              </div>
            </section>
          )}
        <div className="detail-actions">
          <button className="button" onClick={onPost}>
            <Camera size={17} />
            Post photos here
          </button>
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
          {p.lat != null && p.lng != null && (
            <a
              className="button secondary"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.openstreetmap.org/directions?to=${p.lat}%2C${p.lng}`}
              onClick={() => trackDiscovery(p.id, "directions")}
            >
              <Navigation size={17} /> Get directions
            </a>
          )}
          <StreetViewAction place={p} />
        </div>
        {p.mapStatus === "unconfirmed" && (
          <p className="notice" role="status">
            This place was not found in the latest map scan. Check with the
            business before visiting. Reviews and photo memories remain
            available.
          </p>
        )}
        <p className="notice">
          {p.sample ? (
            "Fictional sample place. Location, hours, and spending are for preview only."
          ) : (
            <>
              Place details from{" "}
              <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                {p.detailsSource === "Philippine Museums"
                  ? "Philippine Museums directory"
                  : "OpenStreetMap contributors"}
              </a>
              . Check opening hours before visiting.
              {p.checkedAt && (
                <>
                  {" "}
                  Last scanned{" "}
                  {new Date(p.checkedAt).toLocaleDateString("en-PH")}.
                </>
              )}
              {p.guideUrl && (
                <>
                  {" "}
                  ·{" "}
                  <a href={p.guideUrl} target="_blank" rel="noreferrer">
                    Café Guide PH listing
                  </a>{" "}
                  (matched {p.guideCheckedAt})
                </>
              )}
              {p.logoSource && (
                <>
                  {" "}
                  ·{" "}
                  <a href={p.logoSource} target="_blank" rel="noreferrer">
                    Logo source
                  </a>
                </>
              )}
            </>
          )}
        </p>
      </div>
      <div className="detail-reviews">
        <section
          className="rating-transparency"
          aria-label="How this place is rated"
        >
          <div>
            <strong>
              {p.rating !== null
                ? p.rating.toFixed(1) + " / 5"
                : "No public score yet"}
            </strong>
            <span>
              {p.ratedReviewerCount || 0} independent{" "}
              {(p.ratedReviewerCount || 0) === 1 ? "reviewer" : "reviewers"} ·{" "}
              {p.supportedReviewerCount || 0} with supported visits
            </span>
          </div>
          {(p.ratedReviewerCount || 0) > 0 &&
            (p.ratedReviewerCount || 0) < 5 && (
              <p>
                Early impressions · fewer than five people have rated this
                place.
              </p>
            )}
          <details>
            <summary>How the score works</summary>
            <p>
              Each person counts once, using their latest public,
              non-incentivized visit. Category scores are averaged equally.
              Private, hidden, sample and incentivized reviews don’t affect the
              score. Supported visits have evidence assessed by a moderator;
              every opinion has equal weight. Repeat visits and companions from
              the same outing don’t inflate trending activity.
            </p>
          </details>
        </section>
        <h3>
          Experiences & impressions <span>{reviews.length}</span>
        </h3>
        <label className="review-filter">
          Show experiences
          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
          >
            <option value="all">All visible experiences</option>
            <option value="supported">Supported visits</option>
            <option value="independent">
              Public, non-incentivized experiences
            </option>
          </select>
        </label>
        {visibleReviews.length ? (
          visibleReviews.map((r) => (
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
              {r.incentive && (
                <p className="notice">
                  Incentivized visit · excluded from place score
                </p>
              )}
              {r.rewardStatus === "approved" && (
                <p className="notice">
                  DATED coins awarded for this contribution. The reward does not
                  depend on the rating.
                </p>
              )}
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
            title={
              reviewFilter === "all"
                ? "Be the first to share a little story."
                : "No experiences match this filter yet."
            }
            text={
              reviewFilter === "all"
                ? "A thoughtful review can make someone’s next outing better."
                : "Choose all experiences to see the other stories."
            }
          />
        )}
      </div>
    </div>
  );
}
function AuthForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [mode, setMode] = useState("signup");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
            type={showPassword ? "text" : "password"}
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
        <button
          type="button"
          className="text-button password-toggle"
          aria-pressed={showPassword}
          onClick={() => setShowPassword((v) => !v)}
        >
          {showPassword ? "Hide password" : "Show password"}
        </button>
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
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setLegal("terms")}
                >
                  pilot terms
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setLegal("privacy")}
                >
                  privacy notice
                </button>
                .
              </span>
            </label>
          </>
        )}
        {legal && (
          <section className="inline-legal">
            <button
              type="button"
              className="text-button"
              onClick={() => setLegal(null)}
            >
              <X size={16} />
              Close {legal === "terms" ? "terms" : "privacy notice"}
            </button>
            {legal === "terms" ? <TermsContent /> : <TrustContent />}
          </section>
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
  const [notApplicable, setNotApplicable] = useState<string[]>(
    review?.notApplicable || [],
  );
  const criterionNames =
    review?.criteriaVersion === 1
      ? LEGACY_CRITERIA[p.category]
      : CRITERIA[p.category];
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
        if (
          criterionNames.some(
            (k) => !ratings[k] && !notApplicable.includes(k),
          ) ||
          !Object.keys(ratings).length
        ) {
          setError(
            "Score each criterion or select Not applicable. Add at least one score.",
          );
          return;
        }
        const f = new FormData(e.currentTarget);
        await onSubmit({
          placeId,
          outingId: outingId || review?.outingId,
          title: f.get("title"),
          body: f.get("body"),
          visitDate: f.get("date"),
          spending:
            String(f.get("spending") || "").trim() === ""
              ? null
              : Number(f.get("spending")),
          ratings,
          notApplicable,
          rewardOptIn: f.get("rewardOptIn") === "on",
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
        <PlaceSelect
          places={places}
          value={placeId}
          disabled={!!review}
          onChange={(id) => {
            setPlaceId(id);
            setRatings({});
            setNotApplicable([]);
          }}
          label="Where did you go?"
        />
        <label>
          Date of your visit
          <input
            name="date"
            type="date"
            defaultValue={review?.visitDate || initialDate || philippineDate()}
            max={philippineDate()}
            required
          />
        </label>
      </div>
      <fieldset className="ratings-fieldset">
        <legend>How did it feel?</legend>
        {criterionNames.map((k) => (
          <div className="rating-row" key={k}>
            <span>{k}</span>
            <div className="rating-stars" role="radiogroup" aria-label={k}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={(ratings[k] || 0) >= n ? "rated" : ""}
                  onClick={() => {
                    setRatings((s) => ({ ...s, [k]: n }));
                    setNotApplicable((values) =>
                      values.filter((value) => value !== k),
                    );
                  }}
                  aria-label={k + " " + n + " star" + (n > 1 ? "s" : "")}
                  role="radio"
                  aria-checked={ratings[k] === n}
                  tabIndex={
                    ratings[k] === n || (!ratings[k] && n === 1) ? 0 : -1
                  }
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowRight",
                        "ArrowLeft",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      const next = Math.max(
                        1,
                        Math.min(
                          5,
                          n +
                            (["ArrowRight", "ArrowUp"].includes(e.key)
                              ? 1
                              : -1),
                        ),
                      );
                      setRatings((values) => ({ ...values, [k]: next }));
                      setNotApplicable((values) =>
                        values.filter((value) => value !== k),
                      );
                      const buttons =
                        e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                          '[role="radio"]',
                        );
                      buttons?.[next - 1]?.focus();
                    }
                  }}
                  data-form-change
                >
                  <Star
                    size={24}
                    fill={(ratings[k] || 0) >= n ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              className={
                "rating-na " + (notApplicable.includes(k) ? "selected" : "")
              }
              aria-pressed={notApplicable.includes(k)}
              onClick={() => {
                setRatings((values) => {
                  const next = { ...values };
                  delete next[k];
                  return next;
                });
                setNotApplicable((values) =>
                  values.includes(k)
                    ? values.filter((value) => value !== k)
                    : [...values, k],
                );
              }}
            >
              Not applicable
            </button>
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
          Spent per person (₱, optional)
          <input
            key={placeId}
            name="spending"
            type="number"
            min={0}
            max={100000}
            defaultValue={
              review
                ? (review.spending ?? "")
                : p.budgetKnown === false
                  ? ""
                  : p.budget
            }
          />
          <small>You can rate your visit without a menu or price.</small>
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
        This visit included a merchant gift, complimentary visit, or other
        business incentive.
      </label>
      <label className="check-label reward-opt-in">
        <input
          name="rewardOptIn"
          type="checkbox"
          defaultChecked={!p.sample && (review?.rewardOptIn ?? true)}
          disabled={p.sample}
        />
        <span>
          {p.sample
            ? "Sample locations do not earn coins."
            : "Earn coins for an eligible contribution."}
          <small>
            Public independent reviews with three scored criteria and at least
            40 characters can earn coins. Positive and negative reviews follow
            the same rules. Photos and evidence are optional.
          </small>
        </span>
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
  outing,
  existingOutings,
  onSelectExisting,
  onSubmit,
  pending,
}: {
  places: Place[];
  initialPlace?: Place;
  outing?: Outing;
  existingOutings: Outing[];
  onSelectExisting: (outing: Outing) => void;
  onSubmit: (body: unknown) => Promise<void>;
  pending: boolean;
}) {
  const [stops, setStops] = useState<string[]>(
    outing
      ? [
          ...new Set([
            ...outing.stops,
            ...(initialPlace ? [initialPlace.id] : []),
          ]),
        ]
      : initialPlace
        ? [initialPlace.id]
        : [],
  );
  const [visibility, setVisibility] = useState<Visibility>(
    outing?.visibility || "private",
  );
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
      {!outing && initialPlace && existingOutings.length > 0 && (
        <div className="existing-outings">
          <h3>Add {initialPlace.name} to a plan</h3>
          {existingOutings
            .filter(
              (o) => !o.stops.includes(initialPlace.id) && o.stops.length < 10,
            )
            .map((o) => (
              <button
                type="button"
                className="collection-option"
                key={o.id}
                onClick={() => onSelectExisting(o)}
              >
                <CalendarDays size={18} />
                <span>
                  <strong>{o.title}</strong>
                  <small>
                    {formatDate(o.date)} · {o.stops.length} stops
                  </small>
                </span>
                <Plus size={18} />
              </button>
            ))}
          <p className="form-help">Or create a new outing below.</p>
        </div>
      )}
      {outing && (
        <p className="notice">
          Existing invitations and each companion’s consent stay in place. Add
          new invitees below.
        </p>
      )}
      <div className="form-grid">
        <label>
          Give your day a name
          <input
            name="title"
            defaultValue={outing?.title}
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
            defaultValue={outing?.date || philippineDate()}
            required
          />
        </label>
      </div>
      <div className="stop-picker">
        <PlaceSelect
          places={places}
          value={selected}
          onChange={setSelected}
          label="Add a place"
        />
        <button
          type="button"
          className="button secondary"
          disabled={!selected || stops.includes(selected) || stops.length >= 10}
          data-form-change
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
                data-form-change
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
                data-form-change
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
                data-form-change
                onClick={() => setStops((s) => s.filter((p) => p !== pid))}
              >
                <X size={15} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!!stops.length && (
        <p className="itinerary-total">
          <span>
            {stops.length} {stops.length === 1 ? "stop" : "stops"} · Estimated
            per person
            {stops.some(
              (id) => places.find((p) => p.id === id)?.budgetKnown === false,
            )
              ? " · Some prices unlisted"
              : ""}
          </span>
          <strong>
            {stops.every(
              (id) => places.find((p) => p.id === id)?.budgetKnown === false,
            )
              ? "Not listed"
              : money(
                  stops.reduce(
                    (total, id) =>
                      total + (places.find((p) => p.id === id)?.budget || 0),
                    0,
                  ),
                )}
          </strong>
        </p>
      )}
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
          defaultValue={outing?.notes}
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
        {pending
          ? "Saving your plan…"
          : outing
            ? "Save changes to outing"
            : "Create my outing"}
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
  initialValue = "",
  minLength = 1,
  maxLength = 128,
}: {
  label: string;
  placeholder?: string;
  button: string;
  onSubmit: (value: string) => Promise<void>;
  pending: boolean;
  multiline?: boolean;
  password?: boolean;
  initialValue?: string;
  minLength?: number;
  maxLength?: number;
}) {
  const [value, setValue] = useState(initialValue);
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
            minLength={minLength}
            maxLength={maxLength}
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
          {["Metro Manila", ...METRO_CITIES].map((c) => (
            <option key={c}>{c}</option>
          ))}
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
  pending,
  onView,
}: {
  data: Bootstrap;
  pending: boolean;
  onView: () => void;
  onAction: (
    id: string,
    status: string,
    visibility: Visibility,
  ) => Promise<void>;
}) {
  const [consents, setConsents] = useState<Record<string, Visibility>>({});
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
          {data.invitations.map((i) => (
            <div className="invitation" key={i.id}>
              <CalendarDays size={24} />
              <div>
                <strong>{i.title}</strong>
                <p>{i.from} invited you to join.</p>
                <p className="invitation-date">
                  <CalendarDays size={14} />
                  {formatDate(i.date)} · {i.stops.length}{" "}
                  {i.stops.length === 1 ? "stop" : "stops"}
                </p>
                {i.notes && <p>{i.notes}</p>}
                <ol className="invitation-stops">
                  {i.stops.map((id) => (
                    <li key={id}>
                      {data.places.find((p) => p.id === id)?.name}
                    </li>
                  ))}
                </ol>
                <div className="form-stack">
                  <VisibilitySelect
                    value={consents[i.id] || i.visibility || "private"}
                    onChange={(value) =>
                      setConsents((s) => ({ ...s, [i.id]: value }))
                    }
                    label={"Who can see my association with " + i.title + "?"}
                  />
                </div>
                {i.status === "pending" ? (
                  <div>
                    <button
                      className="button"
                      disabled={pending}
                      onClick={() =>
                        onAction(
                          i.id,
                          "accepted",
                          consents[i.id] || i.visibility || "private",
                        )
                      }
                    >
                      Accept
                    </button>
                    <button
                      className="button secondary"
                      disabled={pending}
                      onClick={() => onAction(i.id, "declined", "private")}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="supported">
                      <Check size={15} />
                      Accepted · {i.visibility}
                    </span>
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() =>
                        onAction(
                          i.id,
                          "accepted",
                          consents[i.id] || i.visibility || "private",
                        )
                      }
                    >
                      Update my visibility
                    </button>
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() => onAction(i.id, "declined", "private")}
                    >
                      Leave outing
                    </button>
                  </>
                )}
                {i.status === "accepted" && (
                  <button className="text-button" onClick={onView}>
                    View my outings
                    <ChevronRight size={16} />
                  </button>
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
        Choose public, followers-only, or private for each photo post, review
        and outing. Saved collections are private until you explicitly share a
        snapshot. Your email, password, and device coordinates never appear in
        public content. Location permission is optional; city search always
        works. Near me sends an approximate search area to the map provider.
        Uploaded photos have location metadata removed.
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
        visits must be disclosed and are excluded from venue scores. Each person
        counts once using their latest public, non-incentivized visit. Private,
        hidden and sample stories are also excluded. Evidence support does not
        give an opinion more weight.
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
        The directory includes labeled fictional sample places and real
        restaurant listings from OpenStreetMap contributors. Sample photographs
        are illustrative. Missing hours and prices are shown as unlisted;
        confirm details with the business before visiting.
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
        and community coverage can be incomplete. All customer features are
        free. Location subscriptions use invoices with payment confirmed by an
        administrator; online payment and email recovery are not connected.
        Coins reward eligible independent reviews regardless of sentiment and
        have no cash value. Voucher availability, expiry, and partner terms
        apply. Sponsored locations are labeled and must match your filters.
        Share links expose the chosen itinerary to anyone with the link until
        the host turns it off.
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
