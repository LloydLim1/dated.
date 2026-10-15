"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  Download,
  Gift,
  Landmark,
  LoaderCircle,
  Megaphone,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Store,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import type { Place, User } from "@/lib/types";
import { money } from "@/lib/types";
import type {
  BusinessData,
  BusinessOrg,
  OperationsData,
  Report,
  Voucher,
  WalletData,
} from "@/lib/commerce-types";
import Modal from "./modal";
import PlaceSelect from "./place-select";
import PlaceCover from "./place-cover";

export async function workspaceApi<T>(
  path: string,
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "Idempotency-Key": key || crypto.randomUUID(),
          },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error || "This action could not be completed.");
  return value;
}
function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const result = await workspaceApi<T>(path);
      if (request === sequence.current) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (request === sequence.current) setError((e as Error).message);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    let active = true;
    const request = ++sequence.current;
    workspaceApi<T>(path)
      .then((result) => {
        if (active && request === sequence.current) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return { data, error, loading, reload };
}
function useAction(after?: () => Promise<void>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    keys = useRef(new Map<string, string>());
  async function run<T>(path: string, body: unknown): Promise<T | null> {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const signature = path + JSON.stringify(body);
    const key = keys.current.get(signature) || crypto.randomUUID();
    keys.current.set(signature, key);
    try {
      const result = await workspaceApi<T>(path, body, key);
      keys.current.delete(signature);
      await after?.();
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, notice, setNotice, run };
}
const date = (value: number) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-PH").format(value);
const formValue = (form: HTMLFormElement, key: string) =>
  String(new FormData(form).get(key) || "").trim();
const stamp = (value: string, end = false) =>
  Date.parse(value + (end ? "T23:59:59+08:00" : "T00:00:00+08:00"));
const today = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const future = () =>
  new Date(Date.now() + 38 * 86400000).toISOString().slice(0, 10);

export function Status({ value }: { value: string }) {
  return (
    <span className={"workspace-status status-" + value}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Feedback({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="workspace-notice" role="status">
          <Check size={16} />
          {notice}
        </p>
      )}
    </>
  );
}
function Loading() {
  return (
    <div className="workspace-loading" role="status">
      <span className="workspace-skeleton" />
      <span className="workspace-skeleton" />
      <span className="workspace-skeleton" />
      <span className="sr-only">Loading your workspace</span>
    </div>
  );
}
function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="workspace-empty">
      {icon}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function ResourceError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="workspace-empty" role="alert">
      <h3>We couldn’t load this workspace.</h3>
      <p>{message}</p>
      <button className="button secondary" onClick={retry}>
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}
function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <nav className="workspace-tabs" aria-label="Workspace sections">
      {items.map((item) => (
        <button
          key={item}
          className={value === item ? "selected" : ""}
          onClick={() => onChange(item)}
          aria-current={value === item ? "page" : undefined}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
export function AccountGate({
  onSignIn,
  kind = "customer",
}: {
  onSignIn: () => void;
  kind?: string;
}) {
  return (
    <Empty
      icon={kind === "business" ? <Store size={36} /> : <Wallet size={36} />}
      title={
        kind === "business"
          ? "A closer look at your location."
          : "Your next discovery has its rewards."
      }
      action={
        <button className="button" onClick={onSignIn}>
          Sign in to continue <ArrowRight size={16} />
        </button>
      }
    >
      {kind === "business"
        ? "Claim your location, understand customer experiences, and reach people looking for a place like yours."
        : "Earn coins for eligible, thoughtful reviews. Choose vouchers from participating places. All customer features are free."}
    </Empty>
  );
}

export function WalletWorkspace({
  onDiscover,
  onReview,
}: {
  onDiscover: () => void;
  onReview: () => void;
}) {
  const resource = useResource<WalletData>("wallet");
  const action = useAction(resource.reload);
  const [tab, setTab] = useState("Discover vouchers"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [voucher, setVoucher] = useState<Voucher | null>(null),
    [appeal, setAppeal] = useState<string | null>(null);
  const data = resource.data;
  if (!data)
    return resource.loading ? (
      <Loading />
    ) : (
      <ResourceError message={resource.error} retry={resource.reload} />
    );
  const offer = data.offers.find((item) => item.id === selected);
  const available = data.offers.filter((item) =>
    `${item.title} ${item.place.name} ${item.place.category} ${item.place.city}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section
      className={
        "workspace wallet-workspace " +
        (tab !== "Discover vouchers" ? "wallet-compact" : "")
      }
    >
      <div className="wallet-overview">
        <div className="wallet-balance">
          <div className="wallet-balance-top">
            <Coins size={25} />
            <span>Your DATED coins</span>
          </div>
          <strong aria-live="polite">
            {number(Math.max(0, data.balance))}
            <small>available</small>
          </strong>
          <div className="wallet-balance-bottom">
            <span>{number(data.pending)} pending</span>
            <span>Earn. Explore. Repeat.</span>
          </div>
        </div>
        <div className="wallet-introduction">
          <h2>
            A thoughtful review.
            <br />
            <em>A little something back.</em>
          </h2>
          <p>
            Earn {data.rules.rewardCoins} coins for eligible independent
            reviews. Your honest experience matters, whether it was wonderful or
            could have been better.
          </p>
          <button className="text-button" onClick={onReview}>
            Share an experience <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <Feedback error={action.error || resource.error} notice={action.notice} />
      {data.restricted && (
        <p className="workspace-warning" role="status">
          {data.restricted}
        </p>
      )}
      {data.rules.spendingPaused && (
        <p className="workspace-warning">
          Voucher claims are paused while we make a service update. Your coins
          and existing vouchers remain in your account.
        </p>
      )}
      {data.invitations.length > 0 && (
        <section className="workspace-section">
          <h3>Business invitations</h3>
          {data.invitations.map((invite) => (
            <div className="workspace-row" key={invite.id}>
              <span>
                <strong>{invite.name}</strong>
                <small>Join as {invite.role}</small>
              </span>
              <button
                className="button secondary"
                disabled={action.busy}
                onClick={async () => {
                  if (
                    await action.run(
                      "business/invites/" + invite.id + "/accept",
                      {},
                    )
                  )
                    action.setNotice(
                      "Invitation accepted. Open your business workspace to continue.",
                    );
                }}
              >
                Accept invitation
              </button>
            </div>
          ))}
        </section>
      )}
      <Tabs
        items={["Discover vouchers", "My vouchers", "Coin activity"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Discover vouchers" && (
        <>
          <div className="workspace-toolbar">
            <div>
              <h3>Where will your coins take you?</h3>
              <p>Choose a voucher, read its terms, then make a plan.</p>
            </div>
            <label className="workspace-search">
              <Search size={17} />
              <input
                aria-label="Search vouchers"
                placeholder="A place, city, or offer"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {available.length ? (
            <div className="voucher-grid">
              {available.map((item) => (
                <article className="voucher-offer" key={item.id}>
                  <div className="voucher-photo">
                    <PlaceCover place={item.place} />
                    <span>
                      <Ticket size={15} />
                      {item.benefit}
                    </span>
                  </div>
                  <div className="voucher-copy">
                    <span className="muted">
                      {item.place.name} · {item.place.city}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="voucher-facts">
                      <span>{item.stock} available</span>
                      <span>Claim by {date(item.ends_at)}</span>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setSelected(item.id)}
                    >
                      <Coins size={17} />
                      {number(item.coin_cost)} coins <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Gift size={34} />}
              title={
                query
                  ? "No vouchers match that search."
                  : "Good things are on their way."
              }
              action={
                <button
                  className="button secondary"
                  onClick={query ? () => setQuery("") : onDiscover}
                >
                  {query ? "Clear search" : "Keep exploring"}
                </button>
              }
            >
              {query
                ? "Try another place or city."
                : "Partner offers appear here after their terms and funding have been reviewed. You can keep earning coins in the meantime."}
            </Empty>
          )}
        </>
      )}
      {tab === "My vouchers" &&
        (data.vouchers.length ? (
          <div className="owned-vouchers">
            {data.vouchers.map((item) => (
              <button
                className="owned-voucher"
                key={item.id}
                onClick={() => setVoucher(item)}
              >
                <Ticket size={25} />
                <span>
                  <strong>{item.snapshot.title}</strong>
                  <small>
                    {item.snapshot.place.name} · Valid until{" "}
                    {date(item.expires_at)}
                  </small>
                </span>
                <Status value={item.status} />
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Ticket size={34} />}
            title="Your next outing could start here."
            action={
              <button
                className="button secondary"
                onClick={() => setTab("Discover vouchers")}
              >
                Browse vouchers
              </button>
            }
          >
            Claim a voucher with your coins and keep its code here until your
            visit.
          </Empty>
        ))}
      {tab === "Coin activity" && (
        <div className="workspace-split">
          <section>
            <h3>Your coin history</h3>
            {data.entries.length ? (
              data.entries.map((entry) => (
                <div className="ledger-row" key={entry.id}>
                  <span className="ledger-icon">
                    {entry.amount > 0 ? (
                      <ArrowDownLeft size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{entry.note}</strong>
                    <small>{date(entry.created_at)}</small>
                  </span>
                  <b className={entry.amount > 0 ? "positive" : ""}>
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount}
                  </b>
                </div>
              ))
            ) : (
              <p className="muted">
                Your first eligible review starts your coin history.
              </p>
            )}
          </section>
          <section>
            <h3>Review contributions</h3>
            <p className="muted">
              Public independent reviews need three scored criteria and a
              specific observation of at least 40 characters. Up to{" "}
              {data.rules.dailyReviews} awards a day.
            </p>
            {data.claims.map((claim) => (
              <div className="reward-claim" key={claim.id}>
                <div>
                  <Status value={claim.status} />
                  <strong>{claim.amount} coins</strong>
                </div>
                <p>{claim.reason}</p>
                {["rejected", "reversed"].includes(claim.status) && (
                  <button
                    className="text-button"
                    onClick={() => setAppeal(claim.id)}
                  >
                    Ask for a review <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ))}
          </section>
        </div>
      )}
      {offer && (
        <Modal
          busy={action.busy}
          title="A little reward for your next visit"
          onClose={() => setSelected(null)}
        >
          <div className="form-stack">
            <h3>{offer.title}</h3>
            <p>
              <strong>{offer.benefit}</strong> at {offer.place.name}
            </p>
            <p>{offer.terms}</p>
            <dl className="voucher-terms">
              <div>
                <dt>Coin cost</dt>
                <dd>{offer.coin_cost}</dd>
              </div>
              <div>
                <dt>Minimum spend</dt>
                <dd>{money(offer.min_spend)}</dd>
              </div>
              <div>
                <dt>Valid after claim</dt>
                <dd>{offer.valid_days} days</dd>
              </div>
              <div>
                <dt>Remaining balance</dt>
                <dd>{Math.max(0, data.balance - offer.coin_cost)} coins</dd>
              </div>
            </dl>
            <p className="muted">
              Valid only at {offer.place.name}, {offer.place.address}. Present
              the code before payment. Unused vouchers expire without an
              automatic coin refund.
            </p>
            <Feedback error={action.error} />
            <button
              className="button"
              disabled={
                action.busy ||
                data.balance < offer.coin_cost ||
                data.rules.spendingPaused ||
                !!data.restricted
              }
              onClick={async () => {
                const result = await action.run<{ voucher: Voucher }>(
                  "vouchers/" + offer.id + "/claim",
                  {},
                );
                if (result) {
                  setSelected(null);
                  setVoucher(result.voucher);
                  setTab("My vouchers");
                }
              }}
            >
              {action.busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Coins size={17} />
              )}{" "}
              {data.balance < offer.coin_cost
                ? `Earn ${offer.coin_cost - data.balance} more coins`
                : `Use ${offer.coin_cost} coins`}
            </button>
            <p className="muted">
              Coins have no cash value and cannot be transferred.
            </p>
          </div>
        </Modal>
      )}
      {voucher && (
        <Modal
          busy={action.busy}
          title="Your voucher"
          onClose={() => setVoucher(null)}
        >
          <div className="voucher-ticket">
            <Ticket size={32} />
            <h2>{voucher.snapshot.benefit}</h2>
            <p>{voucher.snapshot.place.name}</p>
            <Status value={voucher.status} />
            {voucher.status === "issued" && (
              <>
                <label>
                  Show this code to the location staff
                  <input
                    readOnly
                    value={voucher.code}
                    aria-label="Your voucher code"
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(voucher.code || "");
                      action.setNotice("Voucher code copied.");
                    } catch {
                      action.setNotice("Select the code to copy it.");
                    }
                  }}
                >
                  Copy code
                </button>
              </>
            )}
            <p>
              Valid until {date(voucher.expires_at)} · Minimum spend{" "}
              {money(voucher.snapshot.minSpend)}
            </p>
            <p>{voucher.snapshot.terms}</p>
            <p className="muted">{voucher.snapshot.place.address}</p>
            <Feedback notice={action.notice} />
          </div>
        </Modal>
      )}
      {appeal && (
        <Modal
          busy={action.busy}
          title="Ask us to review your reward"
          onClose={() => setAppeal(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = formValue(e.currentTarget, "reason");
              if (
                await action.run("wallet/appeals", { claimId: appeal, reason })
              ) {
                setAppeal(null);
                action.setNotice("Your appeal is in the review queue.");
              }
            }}
          >
            <label>
              Tell us what we should know
              <textarea
                name="reason"
                minLength={10}
                maxLength={1000}
                required
              />
            </label>
            <Feedback error={action.error} />
            <button className="button" disabled={action.busy}>
              Submit appeal
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function BusinessWorkspace({
  places,
  me,
  onChange,
}: {
  places: Place[];
  me: User;
  onChange: () => Promise<void>;
}) {
  const resource = useResource<BusinessData>("business"),
    action = useAction(resource.reload);
  const [selected, setSelected] = useState(""),
    [tab, setTab] = useState("Overview"),
    [claiming, setClaiming] = useState(false),
    [placeId, setPlaceId] = useState(""),
    [offerForm, setOfferForm] = useState(false),
    [campaignForm, setCampaignForm] = useState(false),
    [preview, setPreview] = useState<Voucher | null>(null),
    [code, setCode] = useState("");
  const [businessDecision, setBusinessDecision] = useState<{
    kind: "transfer" | "close";
    userId?: string;
    name?: string;
  } | null>(null);
  const data = resource.data;
  if (!data)
    return resource.loading ? (
      <Loading />
    ) : (
      <ResourceError message={resource.error} retry={resource.reload} />
    );
  const org =
    data.organizations.find((item) => item.id === selected) ||
    data.organizations[0];
  if (!org)
    return (
      <section className="workspace business-onboarding">
        <div className="workspace-onboarding-copy">
          <Store size={35} />
          <h2>
            Know your place.
            <br />
            <em>Grow with your people.</em>
          </h2>
          <p>
            Understand what visitors value. Find the details you can improve.
            Reach customers already looking for an experience like yours.
          </p>
          <ul>
            <li>
              <Check size={17} />
              Performance reports from structured feedback
            </li>
            <li>
              <Check size={17} />
              Sponsored visibility that respects customer filters
            </li>
            <li>
              <Check size={17} />
              Partner vouchers and branch-level team access
            </li>
          </ul>
        </div>
        <form
          className="workspace-panel form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action.run("business/organizations", {
                name: formValue(e.currentTarget, "name"),
              })
            )
              action.setNotice("Workspace created. Claim your first location.");
          }}
        >
          <h3>Your business workspace</h3>
          <p className="muted">
            Start with your business name. Location ownership is verified before
            subscription access.
          </p>
          <label>
            Business or organization name
            <input
              name="name"
              minLength={2}
              maxLength={100}
              required
              placeholder="The name your customers know"
            />
          </label>
          <Feedback error={action.error} />
          <button className="button" disabled={action.busy}>
            Create workspace <ArrowRight size={17} />
          </button>
          <small>
            Creating a workspace does not start a paid subscription.
          </small>
        </form>
      </section>
    );
  const canManage = ["owner", "manager"].includes(org.role),
    canRedeem = ["owner", "manager", "staff"].includes(org.role);
  const tabs =
    org.role === "staff"
      ? ["Redeem vouchers"]
      : org.role === "analyst"
        ? ["Reports"]
        : [
            "Overview",
            "Reports",
            "Location details",
            "Exposure",
            "Vouchers",
            ...(canRedeem ? ["Redeem vouchers"] : []),
            ...(org.role === "owner" ? ["Team", "Billing"] : []),
          ];
  const currentTab = tabs.includes(tab) ? tab : tabs[0];
  async function submitOffer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const result = await action.run("business/offers", {
      orgId: org.id,
      placeId: formValue(f, "branch"),
      title: formValue(f, "title"),
      description: formValue(f, "description"),
      coinCost: Number(formValue(f, "cost")),
      benefit: formValue(f, "benefit"),
      minSpend: Number(formValue(f, "minimum")),
      stock: Number(formValue(f, "stock")),
      startsAt: stamp(formValue(f, "start")),
      endsAt: stamp(formValue(f, "end"), true),
      validDays: Number(formValue(f, "days")),
      terms: formValue(f, "terms"),
      funding: "Partner-funded discount",
    });
    if (result) {
      setOfferForm(false);
      action.setNotice("Offer submitted for partner and funding review.");
    }
  }
  return (
    <section className="workspace business-workspace">
      <div className="business-context">
        <label>
          Business workspace
          <select
            value={org.id}
            onChange={(e) => {
              setSelected(e.target.value);
              setTab("Overview");
            }}
          >
            {data.organizations.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Status value={org.active ? "active" : "inactive"} />
          <span>{org.role} access</span>
        </div>
      </div>
      <Feedback error={action.error || resource.error} notice={action.notice} />
      <Tabs items={tabs} value={currentTab} onChange={setTab} />
      {currentTab === "Overview" && (
        <>
          <div className="business-overview">
            <div>
              <h2>
                Your customers have a story.
                <br />
                <em>Here’s what you can learn.</em>
              </h2>
              <p>
                Use honest feedback to shape a better visit. Your subscription
                also helps relevant customers discover your location.
              </p>
              <button
                className="text-button"
                onClick={() => setTab(org.active ? "Reports" : "Billing")}
              >
                {org.active
                  ? "Open performance reports"
                  : "Explore your subscription"}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="business-facts">
              <div>
                <strong>{org.branches.length}</strong>
                <span>verified locations</span>
              </div>
              <div>
                <strong>
                  {org.claims.filter((c) => c.status === "pending").length}
                </strong>
                <span>claims in review</span>
              </div>
              <div>
                <strong>
                  {org.campaigns.filter((c) => c.status === "active").length}
                </strong>
                <span>approved campaigns</span>
              </div>
            </div>
          </div>
          <section className="workspace-section">
            <div className="workspace-toolbar">
              <div>
                <h3>Your locations</h3>
                <p>Each location is verified before management access.</p>
              </div>
              <button
                className="button secondary"
                onClick={() => setClaiming(true)}
              >
                <Plus size={16} />
                Claim a location
              </button>
            </div>
            {org.branches.map((place) => (
              <div className="workspace-row" key={place.id}>
                <Store size={21} />
                <span>
                  <strong>{place.name}</strong>
                  <small>
                    {place.address} · {place.city}
                  </small>
                </span>
                <Status value="verified" />
              </div>
            ))}
            {org.claims
              .filter((c) => c.status !== "approved")
              .map((claim) => (
                <div className="workspace-row" key={claim.id}>
                  <span>
                    <strong>
                      {places.find((p) => p.id === claim.place_id)?.name ||
                        claim.place_id}
                    </strong>
                    <small>
                      {claim.reason ||
                        "We’ll verify your authority to manage this location."}
                    </small>
                  </span>
                  <Status value={claim.status} />
                </div>
              ))}
            {!org.branches.length && !org.claims.length && (
              <Empty
                icon={<Landmark size={30} />}
                title="Start with your first location."
              >
                Find your branch in the directory and tell us how to verify your
                ownership.
              </Empty>
            )}
          </section>
        </>
      )}
      {currentTab === "Reports" && <ReportsWorkspace key={org.id} org={org} />}
      {currentTab === "Location details" && (
        <LocationDetailsEditor
          key={org.id}
          org={org}
          onSaved={async () => {
            await resource.reload();
            await onChange();
          }}
        />
      )}
      {currentTab === "Billing" && (
        <div className="workspace-split">
          <section className="subscription-plan">
            <Store size={30} />
            <h2>DATED for locations</h2>
            <p>
              Performance insights and relevant sponsored exposure, in one
              business subscription.
            </p>
            <strong>
              {money(data.rules.monthlyPrice)}
              <small> / 30-day pilot period</small>
            </strong>
            <ul>
              <li>Reports for your verified locations</li>
              <li>Approved ads matched to customer filters</li>
              <li>Branch team and partner voucher tools</li>
            </ul>
            <p className="muted">
              Pilot pricing is configurable. Billing is manually verified in
              this installation; online recurring payments are not connected. No
              automatic charge will occur.
            </p>
            <button
              className="button"
              disabled={
                action.busy || !org.branches.length || data.rules.checkoutPaused
              }
              onClick={async () => {
                if (
                  await action.run("business/billing/checkout", {
                    orgId: org.id,
                  })
                )
                  action.setNotice(
                    "Payment request created. An operator must confirm the actual payment reference before access activates.",
                  );
              }}
            >
              Request {org.active ? "renewal" : "subscription"}
              <ArrowRight size={16} />
            </button>
            {!org.branches.length && (
              <p className="muted">
                Verify your first location before requesting a subscription.
              </p>
            )}
          </section>
          <section>
            <h3>Subscription and payments</h3>
            {org.subscription && (
              <p>
                {org.active
                  ? `Access until ${date(org.subscription.period_end)}`
                  : "Your subscription is inactive."}
                {!!org.subscription.cancel_at_end && " Renewal is cancelled."}
              </p>
            )}
            {org.active && !org.subscription?.cancel_at_end && (
              <button
                className="text-button"
                disabled={action.busy}
                onClick={async () => {
                  if (
                    await action.run("business/billing/cancel", {
                      orgId: org.id,
                    })
                  )
                    action.setNotice(
                      "Renewal cancelled. Current access continues until the paid period ends.",
                    );
                }}
              >
                Cancel future renewal
              </button>
            )}
            {org.invoices.map((invoice) => (
              <div className="workspace-row" key={invoice.id}>
                <span>
                  <strong>{money(invoice.amount / 100)}</strong>
                  <small>
                    {date(invoice.created_at)} ·{" "}
                    {invoice.reference || "Awaiting payment verification"}
                  </small>
                </span>
                <Status value={invoice.status} />
              </div>
            ))}
            {!org.invoices.length && (
              <p className="muted">
                Your payment requests and confirmations will appear here.
              </p>
            )}
          </section>
        </div>
      )}
      {currentTab === "Exposure" && (
        <section className="workspace-section">
          <div className="workspace-toolbar">
            <div>
              <h3>Meet customers looking for a place like yours.</h3>
              <p>
                Approved ads only appear when your location matches the
                customer’s filters.
              </p>
            </div>
            <button
              className="button"
              disabled={!org.active || !canManage}
              onClick={() => setCampaignForm(true)}
            >
              <Plus size={16} />
              Create an ad
            </button>
          </div>
          {!org.active && (
            <p className="workspace-warning">
              An active subscription is required for new sponsored placements.
              Your organic listing remains available.
            </p>
          )}
          {org.campaigns.length ? (
            org.campaigns.map((campaign) => (
              <article className="workspace-record" key={campaign.id}>
                <div>
                  <h3>{campaign.title}</h3>
                  <Status value={campaign.status} />
                </div>
                <p>{campaign.body}</p>
                <small>
                  {date(campaign.starts_at)} to {date(campaign.ends_at)} ·{" "}
                  {places.find((p) => p.id === campaign.place_id)?.name}
                </small>
                {campaign.reason && <p className="muted">{campaign.reason}</p>}
                {["active", "pending"].includes(campaign.status) && (
                  <button
                    className="text-button"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(
                        "business/campaigns/" + campaign.id + "/pause",
                        {},
                      )
                    }
                  >
                    Pause campaign
                  </button>
                )}
              </article>
            ))
          ) : (
            <Empty
              icon={<Megaphone size={32} />}
              title="Relevant discovery starts here."
            >
              Create a location ad after your subscription is active. We review
              its details before it appears.
            </Empty>
          )}
          <p className="workspace-footnote">
            Sponsored exposure never changes customer scores or organic
            rankings. Filters, rotation and delivery limits affect availability;
            visits and sales are not guaranteed.
          </p>
        </section>
      )}
      {currentTab === "Vouchers" && (
        <section className="workspace-section">
          <div className="workspace-toolbar">
            <div>
              <h3>Give someone a reason to visit.</h3>
              <p>
                Partner-funded offers turn customer coins into a future
                experience.
              </p>
            </div>
            <button
              className="button"
              disabled={!org.branches.length}
              onClick={() => setOfferForm(true)}
            >
              <Plus size={16} />
              Create an offer
            </button>
          </div>
          {org.offers.map((offer) => (
            <article className="workspace-record" key={offer.id}>
              <div>
                <h3>{offer.title}</h3>
                <Status value={offer.status} />
              </div>
              <p>
                {offer.benefit} · {offer.coin_cost} coins · {offer.stock}{" "}
                remaining
              </p>
              <p className="muted">{offer.reason || offer.terms}</p>
              {offer.status === "active" && (
                <button
                  className="text-button"
                  disabled={action.busy}
                  onClick={() =>
                    action.run("business/offers/" + offer.id + "/pause", {})
                  }
                >
                  Pause new claims
                </button>
              )}
            </article>
          ))}
          {!org.offers.length && (
            <Empty icon={<Gift size={32} />} title="Your first partner offer.">
              Set the benefit, stock and clear terms. Our review confirms
              partner funding before customers can claim it.
            </Empty>
          )}
        </section>
      )}
      {currentTab === "Redeem vouchers" && (
        <section className="redemption-workspace">
          <ScanLine size={38} />
          <h2>A welcome at the counter.</h2>
          <p>
            Enter the customer’s code, check the location and conditions, then
            confirm the benefit has been applied.
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await action.run<Voucher>(
                "business/redemptions/preview",
                { orgId: org.id, code },
              );
              if (result) setPreview(result);
            }}
          >
            <label>
              Customer voucher code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DATED-…"
                minLength={12}
                maxLength={100}
                autoComplete="off"
                required
              />
            </label>
            <button className="button" disabled={action.busy}>
              Check voucher <ArrowRight size={17} />
            </button>
          </form>
          <p className="muted">
            A valid issued voucher can still be honored after a subscription
            ends. Internet access is required to prevent reuse.
          </p>
        </section>
      )}
      {currentTab === "Team" && (
        <div className="workspace-split">
          <section>
            <h3>The people behind your location.</h3>
            {org.members.map((person) => (
              <div className="workspace-row" key={person.user_id}>
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    @{person.username} · {person.role}
                    {person.branch_id
                      ? " · " +
                        org.branches.find((b) => b.id === person.branch_id)
                          ?.name
                      : ""}
                  </small>
                </span>
                {person.user_id !== me.id && (
                  <button
                    className="text-button"
                    disabled={action.busy}
                    onClick={() =>
                      setBusinessDecision({
                        kind: "transfer",
                        userId: person.user_id,
                        name: person.name,
                      })
                    }
                  >
                    Transfer ownership
                  </button>
                )}
                {person.user_id !== me.id && (
                  <button
                    className="text-button"
                    disabled={action.busy}
                    onClick={() =>
                      action.run("business/members/remove", {
                        orgId: org.id,
                        userId: person.user_id,
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {org.invites
              .filter((i) => i.status === "pending")
              .map((invite) => (
                <div className="workspace-row" key={invite.id}>
                  <span>
                    @{invite.username} · {invite.role}
                  </span>
                  <Status value="pending" />
                </div>
              ))}
          </section>
          <form
            className="form-stack workspace-panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const result = await action.run("business/invites", {
                orgId: org.id,
                username: formValue(f, "username"),
                role: formValue(f, "role"),
                ...(formValue(f, "branch")
                  ? { branchId: formValue(f, "branch") }
                  : {}),
              });
              if (result) {
                f.reset();
                action.setNotice("Invitation sent to their DATED wallet.");
              }
            }}
          >
            <h3>Invite a teammate</h3>
            <label>
              DATED username
              <input
                name="username"
                required
                minLength={3}
                placeholder="Their registered username"
              />
            </label>
            <label>
              Role
              <select name="role">
                <option value="manager">Manager</option>
                <option value="analyst">Report analyst</option>
                <option value="staff">Redemption staff</option>
              </select>
            </label>
            <label>
              Branch assignment
              <select name="branch">
                <option value="">All verified branches</option>
                {org.branches.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Redemption staff must be assigned to one branch. Invitations
              expire after seven days.
            </p>
            <button className="button" disabled={action.busy}>
              Send invitation <Users size={17} />
            </button>
          </form>
        </div>
      )}
      {currentTab === "Billing" && org.role === "owner" && (
        <section className="workspace-section">
          <h3>Close this business workspace</h3>
          <p>
            Resolve outstanding vouchers first. Closing ends paid access and new
            promotions. The venue and independent customer reviews remain in the
            directory.
          </p>
          <button
            className="text-button"
            onClick={() => setBusinessDecision({ kind: "close" })}
          >
            Close workspace
          </button>
        </section>
      )}
      {businessDecision && (
        <Modal
          busy={action.busy}
          title={
            businessDecision.kind === "close"
              ? "Close business workspace"
              : "Transfer business ownership"
          }
          onClose={() => setBusinessDecision(null)}
          protectChanges
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const body =
                businessDecision.kind === "close"
                  ? {
                      orgId: org.id,
                      confirmation: formValue(e.currentTarget, "confirmation"),
                    }
                  : { orgId: org.id, userId: businessDecision.userId };
              if (await action.run("business/" + businessDecision.kind, body)) {
                setBusinessDecision(null);
                action.setNotice("Business access updated.");
              }
            }}
          >
            <p>
              {businessDecision.kind === "close"
                ? "This ends the workspace’s active access and removes team access. Historical accounting remains available to platform administrators."
                : `${businessDecision.name} will become the owner with billing and team control. Your role becomes manager.`}
            </p>
            {businessDecision.kind === "close" && (
              <label>
                Type {org.name} to confirm
                <input name="confirmation" required />
              </label>
            )}
            <Feedback error={action.error} />
            <button className="button" disabled={action.busy}>
              Confirm{" "}
              {businessDecision.kind === "close" ? "closure" : "transfer"}
            </button>
          </form>
        </Modal>
      )}
      {claiming && (
        <Modal
          busy={action.busy}
          title="Claim your location"
          onClose={() => setClaiming(false)}
          protectChanges
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              if (
                await action.run("business/claims", {
                  orgId: org.id,
                  placeId,
                  contact: formValue(f, "contact"),
                  evidence: formValue(f, "evidence"),
                })
              ) {
                setClaiming(false);
                action.setNotice(
                  "Claim submitted. We’ll review ownership before granting access.",
                );
              }
            }}
          >
            <PlaceSelect
              places={places}
              value={placeId}
              onChange={setPlaceId}
              label="Find your branch"
            />
            <label>
              Business contact email
              <input name="contact" type="email" required />
            </label>
            <label>
              How can we verify your authority?
              <textarea
                name="evidence"
                minLength={20}
                maxLength={2000}
                required
                placeholder="Your role, official website/contact, and a way to verify your connection to this location. Do not include passwords or identity numbers."
              />
            </label>
            <Feedback error={action.error} />
            <button className="button" disabled={action.busy || !placeId}>
              Submit ownership claim
            </button>
            <p className="muted">
              This information is private to authorized business operators and
              platform administrators.
            </p>
          </form>
        </Modal>
      )}
      {offerForm && (
        <Modal
          busy={action.busy}
          title="Create a partner voucher"
          onClose={() => setOfferForm(false)}
          protectChanges
          wide
        >
          <form className="form-stack" onSubmit={submitOffer}>
            <BranchSelect org={org} />
            <div className="form-grid">
              <label>
                Offer title
                <input name="title" minLength={5} maxLength={100} required />
              </label>
              <label>
                Customer benefit
                <input
                  name="benefit"
                  minLength={5}
                  maxLength={200}
                  required
                  placeholder="PHP 50 off your next visit"
                />
              </label>
            </div>
            <label>
              Short description
              <textarea
                name="description"
                minLength={10}
                maxLength={800}
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Coin cost
                <input
                  name="cost"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={100}
                  required
                />
              </label>
              <label>
                Available vouchers
                <input
                  name="stock"
                  type="number"
                  min={1}
                  max={10000}
                  required
                />
              </label>
              <label>
                Minimum spend in pesos
                <input
                  name="minimum"
                  type="number"
                  min={0}
                  defaultValue={0}
                  required
                />
              </label>
              <label>
                Valid days after claim
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={30}
                  required
                />
              </label>
              <label>
                Claims open
                <input
                  name="start"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Claims close
                <input
                  name="end"
                  type="date"
                  min={today()}
                  defaultValue={future()}
                  required
                />
              </label>
            </div>
            <label>
              Terms and exclusions
              <textarea
                name="terms"
                minLength={20}
                maxLength={2000}
                required
                placeholder="Eligible items, minimum spend, excluded dates, and how the benefit is applied."
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" required />
              Our business funds this discount and will honor valid issued
              vouchers until their expiry.
            </label>
            <Feedback error={action.error} />
            <button className="button" disabled={action.busy}>
              Submit for review
            </button>
          </form>
        </Modal>
      )}
      {campaignForm && (
        <Modal
          busy={action.busy}
          title="Create a location ad"
          onClose={() => setCampaignForm(false)}
          protectChanges
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              if (
                await action.run("business/campaigns", {
                  orgId: org.id,
                  placeId: formValue(f, "branch"),
                  title: formValue(f, "title"),
                  body: formValue(f, "body"),
                  startsAt: stamp(formValue(f, "start")),
                  endsAt: stamp(formValue(f, "end"), true),
                })
              ) {
                setCampaignForm(false);
                action.setNotice("Ad submitted for review.");
              }
            }}
          >
            <BranchSelect org={org} />
            <label>
              Headline
              <input name="title" minLength={5} maxLength={100} required />
            </label>
            <label>
              What should visitors know?
              <textarea name="body" minLength={10} maxLength={300} required />
            </label>
            <div className="form-grid">
              <label>
                Starts
                <input
                  name="start"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Ends
                <input
                  name="end"
                  type="date"
                  min={today()}
                  defaultValue={future()}
                  required
                />
              </label>
            </div>
            <p className="muted">
              Your location’s actual category, price, ratings and tags determine
              eligibility. An ad cannot bypass a customer’s filters.
            </p>
            <Feedback error={action.error} />
            <button className="button" disabled={action.busy}>
              Submit location ad
            </button>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal
          busy={action.busy}
          title="Check before applying the benefit"
          onClose={() => setPreview(null)}
        >
          <div className="form-stack">
            <h3>{preview.snapshot.title}</h3>
            <p>
              {preview.snapshot.benefit} at {preview.snapshot.place.name}
            </p>
            <Status value={preview.status} />
            <p>
              Minimum spend {money(preview.snapshot.minSpend)} · Expires{" "}
              {date(preview.expires_at)}
            </p>
            <p>{preview.snapshot.terms}</p>
            <Feedback error={action.error} />
            <button
              className="button"
              disabled={action.busy || preview.status !== "issued"}
              onClick={async () => {
                if (
                  await action.run("business/redemptions/confirm", {
                    orgId: org.id,
                    code,
                  })
                ) {
                  setPreview(null);
                  setCode("");
                  action.setNotice(
                    "Voucher redeemed. The code cannot be used again.",
                  );
                }
              }}
            >
              Confirm benefit applied <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function BranchSelect({ org }: { org: BusinessOrg }) {
  return (
    <label>
      Location
      <select name="branch" required>
        {org.branches.map((place) => (
          <option value={place.id} key={place.id}>
            {place.name} · {place.city}
          </option>
        ))}
      </select>
    </label>
  );
}

function LocationDetailsEditor({
  org,
  onSaved,
}: {
  org: BusinessOrg;
  onSaved: () => Promise<void>;
}) {
  const [placeId, setPlaceId] = useState(org.branches[0]?.id || "");
  const action = useAction(onSaved),
    place = org.branches.find((p) => p.id === placeId);
  const tags = [
    "Coffee dates",
    "Date night",
    "Dinner with friends",
    "Solo exploring",
    "Art & culture",
    "Brunch",
    "Rainy days",
    "Outdoor seating",
  ];
  if (!place)
    return (
      <Empty icon={<Store size={30} />} title="Verify your first location.">
        Location details can be maintained after your branch claim is approved.
      </Empty>
    );
  return (
    <section>
      <div className="workspace-toolbar">
        <div>
          <h3>Help customers make a well-informed plan.</h3>
          <p>
            These details are marked as owner-provided. Keep estimates and
            facilities accurate.
          </p>
        </div>
        <label>
          Location
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            {org.branches.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form
        key={placeId + String(place.ownerUpdatedAt || 0)}
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const values = new FormData(form);
          const raw = String(values.get("budget") || "").trim();
          if (
            await action.run("business/details", {
              orgId: org.id,
              placeId,
              hours: values.get("hours"),
              description: values.get("description"),
              budget: raw ? Number(raw) : null,
              tags: values.getAll("tags"),
            })
          )
            action.setNotice("Location details updated.");
        }}
      >
        <label>
          Opening hours
          <input name="hours" defaultValue={place.hours} maxLength={200} />
        </label>
        <label>
          What should visitors know?
          <textarea
            name="description"
            defaultValue={place.description}
            maxLength={800}
          />
        </label>
        <label>
          Estimated spending per person in pesos
          <input
            name="budget"
            type="number"
            min={0}
            max={100000}
            defaultValue={place.budgetKnown === false ? "" : place.budget}
          />
        </label>
        <p className="muted">
          Use a typical visit estimate rather than the cheapest individual item.
          Leaving this blank falls back to directory information.
        </p>
        <fieldset className="planner-category-list">
          <legend>Experiences this branch supports</legend>
          {tags.map((tag) => (
            <label key={tag}>
              <input
                name="tags"
                type="checkbox"
                value={tag}
                defaultChecked={place.tags.includes(tag)}
              />
              {tag}
            </label>
          ))}
        </fieldset>
        <Feedback error={action.error} notice={action.notice} />
        <button className="button" disabled={action.busy}>
          Save location details
        </button>
      </form>
    </section>
  );
}
function ReportsWorkspace({ org }: { org: BusinessOrg }) {
  const [placeId, setPlaceId] = useState(org.branches[0]?.id || ""),
    [days, setDays] = useState(30),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!!org.active && !!org.branches.length);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!placeId || !org.active) return;
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const end = Date.now(),
        start = end - days * 86400000;
      const params = new URLSearchParams({
        orgId: org.id,
        placeId,
        start: String(start),
        end: String(end),
      });
      const data = await workspaceApi<Report>("business/reports?" + params);
      if (request === sequence.current) setReport(data);
    } catch (e) {
      if (request === sequence.current) setError((e as Error).message);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [org.id, org.active, placeId, days]);
  useEffect(() => {
    if (!placeId || !org.active) return;
    let active = true;
    const request = ++sequence.current;
    const end = Date.now(),
      start = end - days * 86400000;
    const params = new URLSearchParams({
      orgId: org.id,
      placeId,
      start: String(start),
      end: String(end),
    });
    workspaceApi<Report>("business/reports?" + params)
      .then((data) => {
        if (active && request === sequence.current) {
          setReport(data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [org.id, org.active, placeId, days]);
  if (!org.active)
    return (
      <Empty
        icon={<Landmark size={33} />}
        title="Turn customer feedback into a clearer picture."
      >
        Activate a business subscription after your location is verified to view
        its performance reports.
      </Empty>
    );
  function download() {
    if (!report) return;
    const rows = [
      ["Metric", "Value"],
      ["Independent reviewers", report.sampleSize],
      ...report.criteria.map((c) => [c.name, c.average.toFixed(2)]),
      ["Organic venue opens", report.discovery.views],
      ["Sponsored impressions", report.advertising.impressions],
      ["Sponsored clicks", report.advertising.clicks],
      ["Issued vouchers", report.vouchers.issued],
      ["Redeemed vouchers", report.vouchers.redeemed],
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => '"' + String(value).replaceAll('"', '""') + '"')
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "dated-performance-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="reports-workspace">
      <div className="workspace-toolbar">
        <label>
          Location
          <select
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value);
              setReport(null);
              setLoading(true);
            }}
          >
            {org.branches.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reporting period
          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setReport(null);
              setLoading(true);
            }}
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </label>
        <button
          className="button secondary"
          disabled={!report || loading}
          onClick={download}
        >
          <Download size={16} />
          Export CSV
        </button>
        <button
          className="icon-button"
          aria-label="Refresh report"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <Feedback error={error} />
      {loading && !report ? (
        <Loading />
      ) : report ? (
        <>
          <div className="report-heading">
            <h2>{report.place.name}</h2>
            <p>
              {date(report.start)} to {date(report.end)} · Updated{" "}
              {date(report.generatedAt)}
            </p>
          </div>
          <div className="report-metrics">
            <div>
              <strong>{report.sampleSize}</strong>
              <span>independent reviewers</span>
            </div>
            <div>
              <strong>{report.discovery.views}</strong>
              <span>organic venue opens</span>
            </div>
            <div>
              <strong>{report.advertising.impressions}</strong>
              <span>sponsored impressions</span>
            </div>
            <div>
              <strong>{report.vouchers.redeemed}</strong>
              <span>cohort voucher redemptions</span>
            </div>
          </div>
          <p className="muted">
            Previous equal period: {report.previous.sampleSize} independent
            reviewers ({date(report.previous.start)} to{" "}
            {date(report.previous.end)}).
            {report.previous.sampleSize
              ? ` Reviewer count changed by ${report.sampleSize - report.previous.sampleSize >= 0 ? "+" : ""}${report.sampleSize - report.previous.sampleSize}.`
              : " There is no previous review sample to compare yet."}
          </p>
          <div className="workspace-split">
            <section>
              <h3>What the experience feels like</h3>
              <p className="muted">
                Latest eligible review per person in this period. Category
                changes and sample sizes affect comparisons.
              </p>
              {report.criteria.length ? (
                report.criteria.map((criterion) => (
                  <div className="criterion-chart" key={criterion.name}>
                    <div>
                      <span>{criterion.name}</span>
                      <strong>
                        {criterion.average.toFixed(1)}
                        <small> / 5 · {criterion.count} reviews</small>
                      </strong>
                    </div>
                    <progress
                      max={5}
                      value={criterion.average}
                      aria-label={
                        criterion.name +
                        " " +
                        criterion.average.toFixed(1) +
                        " out of 5"
                      }
                    />
                  </div>
                ))
              ) : (
                <p className="muted">
                  Not enough eligible reviews to show criterion scores yet.
                </p>
              )}
              <p className="workspace-footnote">
                {report.contextSuppressed
                  ? "Spending context is hidden until at least five independent reviewers contribute."
                  : report.averageSpending === null
                    ? "Not enough spending reports to show an average."
                    : "Reported average spending: " +
                      money(report.averageSpending)}
              </p>
            </section>
            <section>
              <h3>Discovery and offers</h3>
              <div className="workspace-row">
                <span>Organic saves</span>
                <strong>{report.discovery.saves}</strong>
              </div>
              <div className="workspace-row">
                <span>Organic directions requests</span>
                <strong>{report.discovery.directions}</strong>
              </div>
              <div className="workspace-row">
                <span>Sponsored clicks</span>
                <strong>{report.advertising.clicks}</strong>
              </div>
              <div className="workspace-row">
                <span>Sponsored click-through rate</span>
                <strong>
                  {report.advertising.ctr === null
                    ? "—"
                    : (report.advertising.ctr * 100).toFixed(1) + "%"}
                </strong>
              </div>
              <div className="workspace-row">
                <span>Vouchers issued in this cohort</span>
                <strong>{report.vouchers.issued}</strong>
              </div>
              <div className="workspace-row">
                <span>Period redemptions across all cohorts</span>
                <strong>{report.vouchers.periodRedemptions}</strong>
              </div>
              <p className="workspace-footnote">
                Clicks, saves and directions describe DATED activity. They do
                not establish physical visits or sales.
              </p>
            </section>
          </div>
          <section className="workspace-section">
            <h3>Recurring feedback</h3>
            {report.themes.length ? (
              report.themes.map((theme) => (
                <div className="feedback-theme" key={theme.term}>
                  <strong>{theme.term}</strong>
                  <p>
                    {theme.reviews.length} independent reviews mention this
                    topic. Read their experiences before drawing a conclusion.
                  </p>
                  <details>
                    <summary>Read an example</summary>
                    <h4>{theme.reviews[0].title}</h4>
                    <p>{theme.reviews[0].body}</p>
                  </details>
                </div>
              ))
            ) : (
              <p className="muted">
                Recurring topics appear when at least two independent reviews
                mention them.
              </p>
            )}
            {report.reviews.map((review) => (
              <article
                className="report-review"
                key={review.id}
                id={`feedback-${review.id}`}
              >
                <h4>{review.title}</h4>
                <p>{review.body}</p>
                <small>Visit on {review.visitDate}</small>
              </article>
            ))}
          </section>
        </>
      ) : (
        <Empty
          icon={<Landmark size={30} />}
          title="Choose a verified location."
        >
          Your report will appear here when its data is available.
        </Empty>
      )}
    </section>
  );
}

export function OperationsWorkspace() {
  const resource = useResource<OperationsData>("operations"),
    action = useAction(resource.reload);
  const [tab, setTab] = useState("Ownership"),
    [query, setQuery] = useState(""),
    [decision, setDecision] = useState<{
      kind: string;
      entityId: string;
      action: string;
      title: string;
    } | null>(null);
  const data = resource.data;
  if (!data)
    return resource.loading ? (
      <Loading />
    ) : (
      <ResourceError message={resource.error} retry={resource.reload} />
    );
  const visible = (...values: unknown[]) =>
    values.join(" ").toLowerCase().includes(query.toLowerCase());
  const queueSizes: Record<string, number> = {
    Ownership: data.claims.filter((c) =>
      visible(c.organization, c.place?.name, c.contact, c.status),
    ).length,
    Payments: data.invoices.filter((i) => visible(i.organization, i.status))
      .length,
    Offers: data.offers.filter((o) => visible(o.title, o.place.name, o.status))
      .length,
    Ads: data.campaigns.filter((c) => visible(c.title, c.place?.name, c.status))
      .length,
    Rewards:
      data.rewards.filter((r) => visible(r.username, r.reason, r.status))
        .length + data.appeals.length,
    "Customer vouchers": data.vouchers.filter((v) =>
      visible(v.snapshot.title, v.snapshot.place.name, v.status, v.id),
    ).length,
    Audit: data.audit.filter((a) => visible(a.action, a.reason)).length,
    "Wallet support": data.restrictions.filter((r) =>
      visible(r.username, r.reason),
    ).length,
  };
  function controls(kind: string, id: string, title: string, status: string) {
    return (
      <div className="operations-actions">
        {["pending", "rejected", "paused"].includes(status) && (
          <>
            <button
              className="button secondary"
              onClick={() =>
                setDecision({ kind, entityId: id, action: "approve", title })
              }
            >
              Approve
            </button>
            <button
              className="text-button"
              onClick={() =>
                setDecision({ kind, entityId: id, action: "reject", title })
              }
            >
              Reject
            </button>
          </>
        )}
        {kind === "reward" && status === "approved" && (
          <button
            className="text-button"
            onClick={() =>
              setDecision({ kind, entityId: id, action: "reverse", title })
            }
          >
            Review reversal
          </button>
        )}
      </div>
    );
  }
  return (
    <section className="workspace operations-workspace">
      <div className="operations-heading">
        <ShieldCheck size={30} />
        <div>
          <h2>Decisions that keep DATED useful.</h2>
          <p>Verify claims, protect contributions, and keep a clear record.</p>
        </div>
        <button className="button secondary" onClick={resource.reload}>
          <RefreshCw size={16} />
          Refresh queues
        </button>
      </div>
      <Feedback error={action.error || resource.error} notice={action.notice} />
      <Tabs
        items={[
          "Ownership",
          "Payments",
          "Offers",
          "Ads",
          "Rewards",
          "Customer vouchers",
          "Wallet support",
          "Platform controls",
          "Audit",
        ]}
        value={tab}
        onChange={setTab}
      />
      <label className="workspace-search">
        <Search size={17} />
        <input
          aria-label="Search operations queue"
          placeholder="Search this queue"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {queueSizes[tab] === 0 && (
        <Empty
          icon={<ShieldCheck size={28} />}
          title={
            query ? "No records match this search." : "This queue is clear."
          }
          action={
            query ? (
              <button className="button secondary" onClick={() => setQuery("")}>
                Clear search
              </button>
            ) : undefined
          }
        >
          {query
            ? "Try another name, status or keyword."
            : "New submissions will appear here when they need your attention."}
        </Empty>
      )}
      {tab === "Ownership" &&
        data.claims
          .filter((c) =>
            visible(c.organization, c.place?.name, c.contact, c.status),
          )
          .map((claim) => (
            <article className="workspace-record" key={claim.id}>
              <div>
                <h3>{claim.place?.name || claim.place_id}</h3>
                <Status value={claim.status} />
              </div>
              <p>
                {claim.organization} · {claim.contact}
              </p>
              <p>{claim.evidence}</p>
              {claim.reason && <p className="muted">{claim.reason}</p>}
              {controls(
                "claim",
                claim.id,
                claim.place?.name || "Location claim",
                claim.status,
              )}
            </article>
          ))}
      {tab === "Payments" && (
        <>
          <p className="workspace-warning">
            Manual verification only. Confirm an actual received payment and
            record its reference. An approval grants access immediately; it does
            not charge a card.
          </p>
          {data.invoices
            .filter((i) => visible(i.organization, i.status))
            .map((invoice) => (
              <article className="workspace-record" key={invoice.id}>
                <div>
                  <h3>{invoice.organization}</h3>
                  <Status value={invoice.status} />
                </div>
                <p>
                  {money(invoice.amount / 100)} · {date(invoice.created_at)}
                </p>
                {invoice.reference && <p>{invoice.reference}</p>}
                {controls(
                  "invoice",
                  invoice.id,
                  "Payment for " + invoice.organization,
                  invoice.status,
                )}
              </article>
            ))}
        </>
      )}
      {tab === "Offers" &&
        data.offers
          .filter((o) => visible(o.title, o.place.name, o.status))
          .map((offer) => (
            <article className="workspace-record" key={offer.id}>
              <div>
                <h3>{offer.title}</h3>
                <Status value={offer.status} />
              </div>
              <p>
                {offer.place.name} · {offer.benefit} · {offer.coin_cost} coins ·{" "}
                {offer.stock} vouchers
              </p>
              <p>{offer.terms}</p>
              <p className="muted">
                {offer.funding} · Review partner authority and funding before
                approval.
              </p>
              {controls("offer", offer.id, offer.title, offer.status)}
            </article>
          ))}
      {tab === "Ads" &&
        data.campaigns
          .filter((c) => visible(c.title, c.place?.name, c.status))
          .map((campaign) => (
            <article className="workspace-record" key={campaign.id}>
              <div>
                <h3>{campaign.title}</h3>
                <Status value={campaign.status} />
              </div>
              <p>{campaign.place?.name}</p>
              <p>{campaign.body}</p>
              {controls(
                "campaign",
                campaign.id,
                campaign.title,
                campaign.status,
              )}
            </article>
          ))}
      {tab === "Rewards" && (
        <>
          {data.appeals.map((appeal) => (
            <article className="workspace-record" key={appeal.id}>
              <h3>Reward appeal</h3>
              <p>{appeal.reason}</p>
              <button
                className="button secondary"
                onClick={() =>
                  setDecision({
                    kind: "reward",
                    entityId: appeal.claim_id,
                    action: "approve",
                    title: "Reward appeal",
                  })
                }
              >
                Review reward approval
              </button>
            </article>
          ))}
          {data.rewards
            .filter((r) => visible(r.username, r.reason, r.status))
            .map((reward) => (
              <article className="workspace-record" key={reward.id}>
                <div>
                  <h3>
                    @{reward.username || "deleted account"} · {reward.amount}{" "}
                    coins
                  </h3>
                  <Status value={reward.status} />
                </div>
                <p>{reward.reason}</p>
                {controls(
                  "reward",
                  reward.id,
                  "Reward contribution",
                  reward.status,
                )}
              </article>
            ))}
        </>
      )}
      {tab === "Wallet support" &&
        data.restrictions
          .filter((r) => visible(r.username, r.reason))
          .map((restriction) => (
            <article className="workspace-record" key={restriction.user_id}>
              <h3>@{restriction.username}</h3>
              <p>{restriction.reason}</p>
              <p>Ledger balance: {restriction.balance} coins</p>
              <button
                className="button secondary"
                disabled={restriction.balance < 0}
                onClick={() =>
                  setDecision({
                    kind: "wallet",
                    entityId: restriction.user_id,
                    action: "approve",
                    title: "Release wallet restriction after recovery",
                  })
                }
              >
                Release spending restriction
              </button>
              {restriction.balance < 0 && (
                <small>
                  Resolve the negative balance through eligible earnings, a
                  valid refund or an approved reward appeal first.
                </small>
              )}
            </article>
          ))}
      {tab === "Platform controls" && (
        <section className="workspace-panel">
          <h3>Independent service controls</h3>
          <p>
            Pause new activity without removing reviews, customer history or
            valid issued vouchers.
          </p>
          {(
            [
              ["rewardsPaused", "Pause new coin awards"],
              ["spendingPaused", "Pause new voucher claims"],
              ["adsPaused", "Pause sponsored delivery"],
              ["checkoutPaused", "Pause new subscription requests"],
            ] as const
          ).map(([key, label]) => (
            <label className="control-toggle" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={data.rules[key]}
                disabled={action.busy}
                onChange={(e) =>
                  action.run("operations/config", { [key]: e.target.checked })
                }
              />
            </label>
          ))}
          <div className="workspace-row">
            <span>Outstanding valid vouchers</span>
            <strong>{data.totals.outstandingVouchers}</strong>
          </div>
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={async () => {
              if (await action.run("operations/maintenance", {}))
                action.setNotice("Maintenance and reward checks completed.");
            }}
          >
            Run maintenance checks
          </button>
        </section>
      )}
      {tab === "Audit" &&
        data.audit
          .filter((a) => visible(a.action, a.reason))
          .map((record) => (
            <article className="audit-row" key={record.id}>
              <strong>{record.action}</strong>
              <p>{record.reason}</p>
              <small>
                {date(record.created_at)} · {record.entity_id}
              </small>
            </article>
          ))}
      {tab === "Customer vouchers" &&
        data.vouchers
          .filter((v) =>
            visible(v.snapshot.title, v.snapshot.place.name, v.status, v.id),
          )
          .map((voucher) => (
            <article className="workspace-record" key={voucher.id}>
              <div>
                <h3>{voucher.snapshot.title}</h3>
                <Status value={voucher.status} />
              </div>
              <p>
                {voucher.snapshot.place.name} · {voucher.id}
              </p>
              {voucher.status === "issued" && (
                <button
                  className="button secondary"
                  onClick={() =>
                    setDecision({
                      kind: "voucher",
                      entityId: voucher.id,
                      action: "reject",
                      title: "Cancel unused voucher and refund coins",
                    })
                  }
                >
                  Cancel and refund coins
                </button>
              )}
            </article>
          ))}
      {decision && (
        <Modal
          busy={action.busy}
          title={
            decision.action === "approve"
              ? "Record your approval"
              : decision.action === "reverse"
                ? "Review a reward reversal"
                : "Record your decision"
          }
          onClose={() => setDecision(null)}
          protectChanges
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action.run("operations/decision", {
                  ...decision,
                  reason: formValue(e.currentTarget, "reason"),
                })
              ) {
                setDecision(null);
                action.setNotice("Decision recorded in the audit history.");
              }
            }}
          >
            <h3>{decision.title}</h3>
            <p>
              Check the supporting information before continuing. Every decision
              is recorded.
            </p>
            <label>
              {decision.kind === "invoice"
                ? "Verified payment reference and verification notes"
                : "Decision and supporting reason"}
              <textarea
                name="reason"
                minLength={10}
                maxLength={1000}
                required
              />
            </label>
            <Feedback error={action.error} />
            <button className="button" disabled={action.busy}>
              {decision.kind === "voucher"
                ? "Cancel voucher and refund coins"
                : "Confirm " + decision.action}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
