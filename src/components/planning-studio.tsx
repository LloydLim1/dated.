"use client";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Share2,
  LayoutTemplate,
  Printer,
  Check,
  Link as LinkIcon,
  MoveUp,
  MoveDown,
  X,
} from "lucide-react";
import type { Outing, Place, User } from "@/lib/types";
import {
  defaultItinerary,
  itineraryDocument,
  itineraryText,
  type ItinerarySettings,
} from "@/lib/itinerary";
import { ItinerarySheet, ItineraryExports } from "./itinerary-document";
import PlanningTools from "./planning-tools";
export default function PlanningStudio({
  outings,
  places,
  me,
  initialOuting,
  onPlan,
  onRefresh,
}: {
  outings: Outing[];
  places: Place[];
  me: User | null;
  initialOuting?: string;
  onPlan: () => void;
  onRefresh: () => Promise<void>;
}) {
  const own = outings.filter((o) => o.owner.id === me?.id);
  const [selection, setSelection] = useState(initialOuting || own[0]?.id || "");
  const selected = own.find((o) => o.id === selection) || own[0];
  return (
    <section className="premium-page">
      <PlanningTools outings={outings} places={places} me={me} onCreated={async id=>{await onRefresh();setSelection(id);}}/>
      <div className="premium-intro">
        <div>
          <span className="premium-badge">
            <Sparkles size={14} />
            Planning tools · Included for everyone
          </span>
          <h2>
            A good day.
            <br />
            <em>A beautiful plan.</em>
          </h2>
          <p>
            Turn your outing into an itinerary your friends will want to keep.
            Make it yours, then send it their way.
          </p>
        </div>
        <ul>
          <li>
            <LayoutTemplate />
            <span>
              <strong>Your style, your schedule</strong>Two layouts, three
              palettes, editable stop times and notes.
            </span>
          </li>
          <li>
            <Share2 />
            <span>
              <strong>A link for your people</strong>Share a finished copy and
              turn access off whenever you choose.
            </span>
          </li>
          <li>
            <Printer />
            <span>
              <strong>Ready to take with you</strong>Print, save as PDF, copy
              the plan, or add timed stops to your calendar.
            </span>
          </li>
        </ul>
      </div>
      {selected ? (
        <>
          <div className="premium-plan-picker">
            <label>
              Choose an outing
              <select
                value={selected.id}
                onChange={(e) => setSelection(e.target.value)}
              >
                {own.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="text-button" onClick={onPlan}>
              Plan another day
            </button>
          </div>
          <ItineraryEditor
            key={selected.id}
            outing={selected}
            places={places}
          />
        </>
      ) : (
        <div className="premium-empty">
          <Sparkles size={30} />
          <h3>Your next good day starts here.</h3>
          <p>
            {me
              ? "Create an outing, then choose how you want to share it."
              : "Sign in and create an outing to use the free itinerary designer."}
          </p>
          <button className="button" onClick={onPlan}>
            {me ? "Plan an outing" : "Sign in to start planning"}
          </button>
        </div>
      )}
    </section>
  );
}
function ItineraryEditor({
  outing,
  places,
}: {
  outing: Outing;
  places: Place[];
}) {
  const [settings, setSettings] = useState<ItinerarySettings>(
    defaultItinerary(outing),
  );
  const [token, setToken] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(`/api/outings/${outing.id}/itinerary`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        return body;
      })
      .then((body) => {
        if (alive) {
          setSettings(body.settings);
          setToken(body.token);
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [outing.id]);
  const doc = itineraryDocument(settings, outing.date, places);
  const set = <K extends keyof ItinerarySettings>(
    key: K,
    value: ItinerarySettings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));
  const updateStop = (
    i: number,
    values: Partial<ItinerarySettings["stops"][number]>,
  ) =>
    set(
      "stops",
      settings.stops.map((s, j) => (j === i ? { ...s, ...values } : s)),
    );
  const shareUrl =
    token && typeof window !== "undefined"
      ? `${location.origin}/itinerary/${token}`
      : "";
  const persist = async (publish: boolean, revoke = false) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`/api/outings/${outing.id}/itinerary`, {
        method: revoke ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(revoke ? {} : { body: JSON.stringify({ settings, publish }) }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setToken(body.token);
      setMessage(
        revoke
          ? "Link turned off. Previous recipients can no longer open it."
          : publish
            ? "Your itinerary link is ready."
            : "Design saved. Your shared copy stays as it was until you update it.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied. Ready to send to your friends.");
    } catch {
      setError("Copy isn’t available here. Select and copy the link below.");
    }
  };
  return (
    <div className="itinerary-studio">
      <form
        className="itinerary-controls no-print"
        onSubmit={(e) => {
          e.preventDefault();
          void persist(false);
        }}
      >
        <h3>Make the plan yours</h3>
        {!ready && !error && <p role="status">Opening your design…</p>}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            <Check size={15} />
            {message}
          </p>
        )}
        <fieldset disabled={!ready || busy}>
          <label>
            Itinerary title
            <input
              value={settings.title}
              onChange={(e) => set("title", e.target.value)}
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <label>
            A little introduction
            <textarea
              value={settings.intro}
              onChange={(e) => set("intro", e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Coffee, a little culture, and time together."
            />
          </label>
          <div className="form-grid">
            <label>
              Layout
              <select
                value={settings.format}
                onChange={(e) =>
                  set("format", e.target.value as ItinerarySettings["format"])
                }
              >
                <option value="timeline">Day timeline</option>
                <option value="compact">Compact agenda</option>
              </select>
            </label>
            <label>
              Palette
              <select
                value={settings.theme}
                onChange={(e) =>
                  set("theme", e.target.value as ItinerarySettings["theme"])
                }
              >
                <option value="forest">Dated forest</option>
                <option value="rose">Warm rose</option>
                <option value="slate">Quiet slate</option>
              </select>
            </label>
          </div>
          <div className="itinerary-toggles">
            {(
              [
                ["showDate", "Show the outing date"],
                ["showAddress", "Show place addresses"],
                ["showBudget", "Show my planned budgets"],
              ] as const
            ).map(([key, label]) => (
              <label className="check-label" key={key}>
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => set(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          <h4>Your stops</h4>
          {settings.stops.map((stop, i) => (
            <div className="itinerary-stop-editor" key={stop.placeId}>
              <div className="itinerary-editor-heading">
                <strong>
                  {i + 1}. {places.find((p) => p.id === stop.placeId)?.name}
                </strong>
                <div>
                  {[-1, 1].map((direction) => (
                    <button
                      type="button"
                      key={direction}
                      className="icon-button"
                      aria-label={
                        direction < 0 ? "Move stop up" : "Move stop down"
                      }
                      disabled={
                        i + direction < 0 ||
                        i + direction >= settings.stops.length
                      }
                      onClick={() => {
                        const next = [...settings.stops];
                        [next[i], next[i + direction]] = [
                          next[i + direction],
                          next[i],
                        ];
                        set("stops", next);
                      }}
                    >
                      {direction < 0 ? (
                        <MoveUp size={15} />
                      ) : (
                        <MoveDown size={15} />
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Hide stop from itinerary"
                    disabled={settings.stops.length === 1}
                    onClick={() =>
                      set(
                        "stops",
                        settings.stops.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Start time
                  <input
                    type="time"
                    value={stop.time}
                    onChange={(e) => updateStop(i, { time: e.target.value })}
                  />
                </label>
                <label>
                  Minutes here
                  <input
                    type="number"
                    value={stop.minutes}
                    min={15}
                    max={720}
                    onChange={(e) =>
                      updateStop(i, { minutes: Number(e.target.value) })
                    }
                    required
                  />
                </label>
              </div>
              <label>
                A note for this stop
                <textarea
                  value={stop.note}
                  rows={2}
                  maxLength={400}
                  onChange={(e) => updateStop(i, { note: e.target.value })}
                />
              </label>
              {settings.showBudget && (
                <label>
                  My planned budget (₱)
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={stop.budget ?? ""}
                    placeholder="To be decided"
                    onChange={(e) =>
                      updateStop(i, {
                        budget: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <small>
                    Your estimate; prices aren’t supplied by the venue.
                  </small>
                </label>
              )}
            </div>
          ))}
          <button
            type="button"
            className="text-button"
            onClick={() => set("stops", defaultItinerary(outing).stops)}
          >
            Restore all outing stops
          </button>
          <button className="button full-width">
            {busy ? "Saving…" : "Save design"}
          </button>
        </fieldset>
        <section className="itinerary-sharing">
          <h3>Share with your friends</h3>
          <p>
            The link shows this itinerary to anyone who has it. Private outing
            notes and companion details stay private.
          </p>
          <button
            type="button"
            className="button"
            disabled={
              !ready ||
              busy ||
              settings.title.trim().length < 3 ||
              settings.stops.length === 0
            }
            onClick={() => {
              if (eValid()) void persist(true);
            }}
          >
            <Share2 size={16} />
            {token ? "Update shared copy" : "Create share link"}
          </button>
          {shareUrl && (
            <>
              <label>
                Shareable link
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void copy(shareUrl)}
                >
                  <LinkIcon size={16} />
                  Copy link
                </button>
                <a
                  className="text-button"
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open shared copy
                </a>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => void persist(false, true)}
                >
                  Turn off link
                </button>
              </div>
              {/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && (
                <small>
                  This preview link works on this device. Publish Dated to share
                  across devices.
                </small>
              )}
            </>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => void copy(itineraryText(doc))}
          >
            Copy itinerary as text
          </button>
        </section>
      </form>
      <div className="itinerary-preview">
        <p className="itinerary-preview-label no-print">
          Live preview · changes stay private until shared
        </p>
        <ItinerarySheet document={doc} />
        <ItineraryExports document={doc} />
      </div>
    </div>
  );
  function eValid() {
    const form = document.querySelector<HTMLFormElement>(".itinerary-controls");
    return form?.reportValidity();
  }
}
