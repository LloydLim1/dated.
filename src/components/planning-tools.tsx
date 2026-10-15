"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Coins,
  Download,
  MapPin,
  Plus,
  Route,
  Users,
  Vote,
  Wallet,
} from "lucide-react";
import {
  METRO_CITIES,
  money,
  type Outing,
  type Place,
  type User,
} from "@/lib/types";
import { workspaceApi } from "./commerce-workspaces";
import PlaceSelect from "./place-select";
import { philippineDate } from "@/lib/philippine-date.mjs";

type Suggestion = {
  stops: {
    place: Place;
    startMinutes: number;
    duration: number;
    travelMinutes: number;
    estimatedCost: number;
  }[];
  total: number;
  remaining: number;
  groupSize: number;
  notice: string;
  partial: boolean;
};
type Collaboration = {
  participants: { id: string; name: string; username: string }[];
  proposals: { id: string; place: Place; votes: number; voted: number }[];
  expenses: { id: string; title: string; amount: number; paidBy: string }[];
  settlement: { transfers: { from: string; to: string; amount: number }[] };
  budget: { total: number; allocations: string } | null;
  ownerId: string;
};
type Insights = {
  reviews: number;
  places: number;
  totalSpending: number;
  knownSpending: number;
  byCategory: Record<string, number>;
  byCity: Record<string, number>;
  byMonth: Record<string, number>;
  year: number;
  periodLabel: string;
  availableYears: number[];
  yearReviews: number;
  journal: {
    id: string;
    title: string;
    body: string;
    visitDate: string;
    spending: number | null;
    visibility: string;
    ratings: Record<string, number>;
    place: Place;
    media: string[];
  }[];
};
const time = (minute: number) =>
  `${Math.floor(minute / 60)
    .toString()
    .padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
const preciseMoney = (centavos: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
function download(
  name: string,
  body: string,
  type = "text/markdown;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export default function PlanningTools({
  outings,
  places,
  me,
  onCreated,
}: {
  outings: Outing[];
  places: Place[];
  me: User | null;
  onCreated: (id: string) => Promise<void>;
}) {
  const [tool, setTool] = useState("");
  return (
    <div className="free-planning-tools">
      <nav className="planning-tool-nav" aria-label="Free planning tools">
        {[
          { name: "Build a day", icon: Route },
          { name: "Plan together", icon: Users },
          { name: "Your journal", icon: CalendarDays },
        ].map((item) => (
          <button
            key={item.name}
            className={tool === item.name ? "selected" : ""}
            onClick={() => setTool(tool === item.name ? "" : item.name)}
            aria-expanded={tool === item.name}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
            <Plus size={15} />
          </button>
        ))}
      </nav>
      {tool && (
        <section className="planning-tool-body">
          {!me ? (
            <p>
              Sign in to save your plans, collaborate with companions, and view
              your private insights.
            </p>
          ) : tool === "Build a day" ? (
            <DayBuilder me={me} onCreated={onCreated} />
          ) : tool === "Plan together" ? (
            <GroupPlanner
              outings={outings}
              places={places}
              me={me}
              onChanged={onCreated}
            />
          ) : (
            <JournalInsights />
          )}
        </section>
      )}
    </div>
  );
}
function DayBuilder({
  me,
  onCreated,
}: {
  me: User;
  onCreated: (id: string) => Promise<void>;
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [title, setTitle] = useState("A good day in the city"),
    [date, setDate] = useState(philippineDate());
  const creating = useRef(false);
  return (
    <div className="day-builder">
      <div>
        <h3>Give your day a little direction.</h3>
        <p>
          Choose your time and total budget. We’ll connect nearby places using
          the prices we can support.
        </p>
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            setSuggestion(
              await workspaceApi<Suggestion>("planning/suggest", {
                city: f.get("city"),
                groupSize: Number(f.get("people")),
                budget: Number(f.get("budget")),
                hours: Number(f.get("hours")),
                maxStops: Number(f.get("stops")),
                startMinutes:
                  Number(String(f.get("start")).slice(0, 2)) * 60 +
                  Number(String(f.get("start")).slice(3)),
                categories: f.getAll("category"),
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            City
            <select
              name="city"
              defaultValue={METRO_CITIES.includes(me.city) ? me.city : "Makati"}
            >
              {METRO_CITIES.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label>
            People
            <input
              name="people"
              type="number"
              min={1}
              max={20}
              defaultValue={2}
              required
            />
          </label>
          <label>
            Total budget in pesos
            <input
              name="budget"
              type="number"
              min={1}
              max={100000}
              defaultValue={1500}
              required
            />
          </label>
          <label>
            Available hours
            <input
              name="hours"
              type="number"
              min={1}
              max={16}
              defaultValue={6}
              required
            />
          </label>
          <label>
            Start time
            <input name="start" type="time" defaultValue="10:00" required />
          </label>
          <label>
            Maximum stops
            <select name="stops" defaultValue={3}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="planner-category-list">
          <legend>Include these experiences</legend>
          {["Café", "Restaurant", "Museum", "Cinema"].map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                name="category"
                value={category}
                defaultChecked
              />
              {category}
            </label>
          ))}
        </fieldset>
        <button className="button" disabled={busy}>
          {busy ? "Finding a useful route…" : "Suggest my day"}
          <ArrowRight size={16} />
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {suggestion && (
        <section className="suggested-day">
          {suggestion.stops.length ? (
            <>
              <div className="workspace-toolbar">
                <h3>
                  {suggestion.stops.length} stops · {money(suggestion.total)}{" "}
                  total
                </h3>
                <span>{money(suggestion.remaining)} left in your budget</span>
              </div>
              {suggestion.stops.map((stop, index) => (
                <div className="suggested-stop" key={stop.place.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <small>
                      {time(stop.startMinutes)} · {stop.duration} minutes
                      {stop.travelMinutes
                        ? ` · approx. ${stop.travelMinutes} min walk from previous stop`
                        : ""}
                    </small>
                    <h4>{stop.place.name}</h4>
                    <p>
                      <MapPin size={13} />
                      {stop.place.address}
                    </p>
                  </div>
                  <strong>{money(stop.estimatedCost)}</strong>
                </div>
              ))}
              {suggestion.partial && (
                <p className="muted">
                  Fewer stops fit your constraints. You can change your budget,
                  time or location.
                </p>
              )}
              <p className="workspace-warning">{suggestion.notice}</p>
              <div className="form-grid">
                <label>
                  Name your outing
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    minLength={3}
                    maxLength={100}
                  />
                </label>
                <label>
                  Outing date
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={philippineDate()}
                  />
                </label>
              </div>
              <button
                className="button"
                disabled={busy || title.trim().length < 3}
                onClick={async () => {
                  if (creating.current) return;
                  creating.current = true;
                  setBusy(true);
                  setError("");
                  try {
                    const result = await workspaceApi<{ id: string }>(
                      "planning/create",
                      {
                        title,
                        date,
                        stops: suggestion.stops.map((stop) => ({
                          placeId: stop.place.id,
                          startMinutes: stop.startMinutes,
                          duration: stop.duration,
                          budget: stop.estimatedCost,
                        })),
                      },
                    );
                    await onCreated(result.id);
                    setSuggestion(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                    creating.current = false;
                  }
                }}
              >
                Save private outing <Check size={16} />
              </button>
            </>
          ) : (
            <div className="workspace-empty">
              <Route size={28} />
              <h3>No supported route fits just yet.</h3>
              <p>
                Try more time, a different city, or a larger budget. Places with
                unknown prices are excluded from a budgeted suggestion.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
function GroupPlanner({
  outings,
  places,
  me,
  onChanged,
}: {
  outings: Outing[];
  places: Place[];
  me: User;
  onChanged: (id: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(outings[0]?.id || ""),
    [data, setData] = useState<Collaboration | null>(null),
    [placeId, setPlaceId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const loadId = useRef(0);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    workspaceApi<Collaboration>("planning/" + selected)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  async function change(path: string, body: unknown) {
    if (busy) return false;
    setBusy(true);
    setError("");
    const request = ++loadId.current;
    try {
      await workspaceApi(path, body);
      const result = await workspaceApi<Collaboration>("planning/" + selected);
      if (request === loadId.current) setData(result);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!outings.length)
    return (
      <div className="workspace-empty">
        <Users size={30} />
        <h3>Start with an outing.</h3>
        <p>
          Create a plan, invite companions from My outings, and ask them to
          accept. Then propose places, vote and track shared expenses here.
        </p>
      </div>
    );
  const people = (id: string) =>
    data?.participants.find((p) => p.id === id)?.name || "Former participant";
  return (
    <section>
      <div className="workspace-toolbar">
        <div>
          <h3>A good plan includes everyone.</h3>
          <p>
            Only the host and accepted companions can access this workspace.
          </p>
        </div>
        <label>
          Outing
          <select
            value={selected}
            disabled={busy}
            onChange={(e) => {
              setSelected(e.target.value);
              setData(null);
              setError("");
            }}
          >
            {outings.map((outing) => (
              <option key={outing.id} value={outing.id}>
                {outing.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      )}
      {data && (
        <>
          <div className="group-participants">
            <Users size={17} />
            {data.participants.map((p) => p.name).join(" · ")}
          </div>
          <div className="workspace-split">
            <section>
              <h3>Make a shortlist</h3>
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await change("planning/" + selected + "/proposals", {
                      placeId,
                    })
                  )
                    setPlaceId("");
                }}
              >
                <PlaceSelect
                  places={places}
                  value={placeId}
                  onChange={setPlaceId}
                  label="Suggest a place"
                />
                <button
                  className="button secondary"
                  disabled={busy || !placeId}
                >
                  <Plus size={16} />
                  Add to shortlist
                </button>
              </form>
              {data.proposals.map((proposal) => (
                <div className="workspace-row" key={proposal.id}>
                  <span>
                    <strong>{proposal.place.name}</strong>
                    <small>
                      {proposal.place.city} · {proposal.place.category}
                    </small>
                  </span>
                  <button
                    className={"button " + (proposal.voted ? "" : "secondary")}
                    disabled={busy}
                    onClick={() =>
                      change("planning/" + selected + "/votes", {
                        proposalId: proposal.id,
                      })
                    }
                  >
                    <Vote size={16} />
                    {proposal.votes} {proposal.voted ? "Voted" : "Vote"}
                  </button>
                  {data.ownerId === me.id && (
                    <button
                      className="button secondary"
                      disabled={
                        busy ||
                        !!outings.find((o) => o.id === selected)?.completed
                      }
                      onClick={async () => {
                        if (
                          await change(`planning/${selected}/adopt`, {
                            proposalId: proposal.id,
                          })
                        ) {
                          await onChanged(selected);
                          setNotice(
                            "Place added to your outing. Existing stops are kept once.",
                          );
                        }
                      }}
                    >
                      <Plus size={16} /> Add stop
                    </button>
                  )}
                </div>
              ))}
              <p className="muted">
                Votes help you decide. The host can edit the outing stops from
                My outings.
              </p>
            </section>
            <section>
              <h3>Keep the budget clear</h3>
              <p className="muted">
                Amounts are recorded in pesos. This tool tracks shared costs; it
                does not transfer money.
              </p>
              {data.ownerId === me.id ? (
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const total = Math.round(Number(f.get("total")) * 100);
                    const allocations = Object.fromEntries(
                      ["Food & drinks", "Activities", "Transport"].map(
                        (key) => [
                          key,
                          Math.round(Number(f.get(key) || 0) * 100),
                        ],
                      ),
                    );
                    if (
                      await change("planning/" + selected + "/budget", {
                        total,
                        allocations,
                      })
                    )
                      setNotice("Group budget updated.");
                  }}
                >
                  <label>
                    Total group budget
                    <input
                      key={selected}
                      name="total"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={(data.budget?.total || 0) / 100}
                      required
                    />
                  </label>
                  {["Food & drinks", "Activities", "Transport"].map((key) => (
                    <label key={key}>
                      {key}
                      <input
                        name={key}
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={
                          Number(
                            data.budget
                              ? JSON.parse(data.budget.allocations)[key] || 0
                              : 0,
                          ) / 100
                        }
                      />
                    </label>
                  ))}
                  <button className="button secondary" disabled={busy}>
                    Save budget <Coins size={16} />
                  </button>
                </form>
              ) : (
                <p>
                  Total planned budget:{" "}
                  {data.budget ? money(data.budget.total / 100) : "Not set yet"}
                </p>
              )}
            </section>
          </div>
          <section className="workspace-section">
            <h3>Shared expenses</h3>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget,
                  values = new FormData(f);
                if (
                  await change("planning/" + selected + "/expenses", {
                    title: values.get("title"),
                    amount: Math.round(Number(values.get("amount")) * 100),
                    paidBy: values.get("paidBy"),
                    participants: values.getAll("share"),
                  })
                ) {
                  f.reset();
                  setNotice("Expense added with exact centavo splits.");
                }
              }}
            >
              <div className="form-grid">
                <label>
                  What was it for?
                  <input name="title" minLength={2} maxLength={100} required />
                </label>
                <label>
                  Amount in pesos
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={100000}
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Paid by
                  <select name="paidBy" defaultValue={me.id}>
                    {data.participants.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="planner-category-list">
                <legend>Split equally between</legend>
                {data.participants.map((person) => (
                  <label key={person.id}>
                    <input
                      name="share"
                      type="checkbox"
                      value={person.id}
                      defaultChecked
                    />
                    {person.name}
                  </label>
                ))}
              </fieldset>
              <button className="button secondary" disabled={busy}>
                <Plus size={16} />
                Record expense
              </button>
            </form>
            {data.expenses.map((expense) => (
              <div className="workspace-row" key={expense.id}>
                <Wallet size={18} />
                <span>
                  <strong>{expense.title}</strong>
                  <small>Paid by {people(expense.paidBy)}</small>
                </span>
                <strong>{preciseMoney(expense.amount)}</strong>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={async () => {
                    if (busy) return;
                    setBusy(true);
                    setError("");
                    try {
                      const response = await fetch(
                        "/api/planning/" + selected + "/expenses/" + expense.id,
                        { method: "DELETE" },
                      );
                      if (!response.ok)
                        throw new Error((await response.json()).error);
                      setData(
                        await workspaceApi<Collaboration>(
                          "planning/" + selected,
                        ),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            {data.settlement.transfers.length > 0 && (
              <div className="settlement-list">
                <h3>Suggested settlement</h3>
                {data.settlement.transfers.map((transfer, index) => (
                  <p key={index}>
                    {people(transfer.from)} <ArrowRight size={14} />{" "}
                    {people(transfer.to)}{" "}
                    <strong>{preciseMoney(transfer.amount)}</strong>
                  </p>
                ))}
                <small>
                  Settle outside DATED. Recorded expenses remain the source for
                  these suggestions.
                </small>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
function JournalInsights() {
  const [data, setData] = useState<Insights | null>(null),
    [error, setError] = useState(""),
    [format, setFormat] = useState("journal"),
    [year, setYear] = useState("all");
  useEffect(() => {
    let active = true;
    workspaceApi<Insights>("insights?year=" + year)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [year]);
  if (error)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p role="status">Opening your private journal…</p>;
  const max = Math.max(1, ...Object.values(data.byCategory));
  return (
    <section className="journal-insights">
      <div className="workspace-toolbar">
        <div>
          <h3>Your year, in places.</h3>
          <p>
            Private insights from your own reviews, including private journal
            entries.
          </p>
        </div>
        <label>
          Period
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setData(null);
              setError("");
            }}
          >
            <option value="all">All time</option>
            {data.availableYears.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          onClick={() => {
            const text = [
              "# My DATED journal",
              ...data.journal.map(
                (review) =>
                  `## ${review.place.name} — ${review.visitDate}\n\n${review.title}\n\n${review.body}\n\n${Object.entries(
                    review.ratings,
                  )
                    .map(([key, value]) => `${key}: ${value}/5`)
                    .join(
                      " · ",
                    )}\n\n${review.spending === null ? "Spending not recorded" : `Spending: PHP ${review.spending}`}\n\nVisibility: ${review.visibility}`,
              ),
            ].join("\n\n");
            download("my-dated-journal.md", text);
          }}
        >
          <Download size={16} />
          Export journal
        </button>
      </div>
      <div className="report-metrics">
        <div>
          <strong>{data.places}</strong>
          <span>places remembered</span>
        </div>
        <div>
          <strong>{data.reviews}</strong>
          <span>reviews · {data.periodLabel}</span>
        </div>
        <div>
          <strong>{money(data.totalSpending)}</strong>
          <span>reported spending across {data.knownSpending} reviews</span>
        </div>
        <div>
          <strong>{Object.keys(data.byCity).length}</strong>
          <span>cities explored</span>
        </div>
      </div>
      <div className="workspace-split">
        <section>
          <h3>Your kind of experiences</h3>
          {Object.entries(data.byCategory).map(([category, count]) => (
            <div className="criterion-chart" key={category}>
              <div>
                <span>{category}</span>
                <strong>{count}</strong>
              </div>
              <progress
                value={count}
                max={max}
                aria-label={`${category}: ${count} reviews`}
              />
            </div>
          ))}
          <p className="muted">
            Missing spending is excluded, not counted as zero. These totals
            describe what you chose to record.
          </p>
        </section>
        <section>
          <h3>Spending over time</h3>
          {Object.entries(data.byMonth)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([month, amount]) => (
              <div className="workspace-row" key={month}>
                <span>{month}</span>
                <strong>{money(amount)}</strong>
              </div>
            ))}
          {!data.knownSpending && (
            <p className="muted">
              Add optional spending to reviews to see your trends.
            </p>
          )}
        </section>
      </div>
      <div className="workspace-toolbar">
        <h3>Your memory collection</h3>
        <label>
          View
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="journal">Journal</option>
            <option value="scrapbook">Scrapbook</option>
          </select>
        </label>
        <button
          className="button secondary"
          onClick={() =>
            download(
              "my-dated-journal.json",
              JSON.stringify(data.journal, null, 2),
              "application/json",
            )
          }
        >
          <Download size={16} />
          Export JSON
        </button>
      </div>
      <div
        className={
          format === "scrapbook" ? "journal-scrapbook" : "journal-entry-list"
        }
      >
        {data.journal.map((review) => (
          <article className="memory-entry" key={review.id}>
            {format === "scrapbook" && (
              <img
                src={
                  review.media[0]
                    ? `/api/media/${review.media[0]}`
                    : review.place.image
                }
                alt={
                  review.media[0]
                    ? `Your memory at ${review.place.name}`
                    : "Illustrative " + review.place.category + " image"
                }
              />
            )}
            <div>
              <small>
                {review.visitDate} · {review.place.city}
              </small>
              <h3>{review.place.name}</h3>
              <h4>{review.title}</h4>
              <p>{review.body}</p>
              <small>
                {review.visibility} ·{" "}
                {review.spending === null
                  ? "Spending not recorded"
                  : money(review.spending)}
              </small>
            </div>
          </article>
        ))}
      </div>
      {!data.journal.length && (
        <p className="muted">
          Your first review starts your journal and personal insights.
        </p>
      )}
    </section>
  );
}
