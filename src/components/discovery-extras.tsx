"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, GitCompareArrows, MapPin } from "lucide-react";
import { CRITERIA, money, type Place, type User } from "@/lib/types";
import type { Sponsored } from "@/lib/commerce-types";
import PlaceSelect from "./place-select";
import PlaceCover from "./place-cover";
export type ExtraFilters = {
  minRating: number;
  criterion: string;
  criterionMinimum: number;
  minReviews: number;
  groupSize: number;
  budgetBasis: "person" | "total";
};
export const defaultExtraFilters: ExtraFilters = {
  minRating: 0,
  criterion: "",
  criterionMinimum: 0,
  minReviews: 1,
  groupSize: 1,
  budgetBasis: "person",
};
export function AdvancedFilterFields({
  value,
  onChange,
  category,
}: {
  value: ExtraFilters;
  onChange: (value: ExtraFilters) => void;
  category: string;
}) {
  const criteria =
    category in CRITERIA
      ? CRITERIA[category as keyof typeof CRITERIA]
      : [...new Set(Object.values(CRITERIA).flat())];
  return (
    <fieldset className="advanced-filter-fields">
      <legend>Make the details matter.</legend>
      <div className="form-grid">
        <label>
          Budget applies to
          <select
            value={value.budgetBasis}
            onChange={(e) =>
              onChange({
                ...value,
                budgetBasis: e.target.value as "person" | "total",
              })
            }
          >
            <option value="person">One person</option>
            <option value="total">The whole group</option>
          </select>
        </label>
        <label>
          People
          <input
            type="number"
            min={1}
            max={20}
            value={value.groupSize}
            onChange={(e) =>
              onChange({ ...value, groupSize: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Minimum overall rating
          <select
            value={value.minRating}
            onChange={(e) =>
              onChange({ ...value, minRating: Number(e.target.value) })
            }
          >
            <option value={0}>Any rating</option>
            {[3, 3.5, 4, 4.5].map((score) => (
              <option value={score} key={score}>
                {score}+ / 5
              </option>
            ))}
          </select>
        </label>
        <label>
          Minimum independent reviewers
          <select
            value={value.minReviews}
            onChange={(e) =>
              onChange({ ...value, minReviews: Number(e.target.value) })
            }
          >
            {[1, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
        <label>
          Experience criterion
          <select
            value={value.criterion}
            onChange={(e) =>
              onChange({
                ...value,
                criterion: e.target.value,
                criterionMinimum: e.target.value ? 4 : 0,
              })
            }
          >
            <option value="">Any criterion</option>
            {criteria.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        {value.criterion && (
          <label>
            Minimum criterion score
            <select
              value={value.criterionMinimum}
              onChange={(e) =>
                onChange({ ...value, criterionMinimum: Number(e.target.value) })
              }
            >
              {[3, 3.5, 4, 4.5, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+ / 5
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="form-help">
        Places with unknown prices or insufficient rating evidence do not pass a
        selected threshold.
      </p>
    </fieldset>
  );
}
export function SponsoredPlaces({
  filters,
  onOpen,
  me,
}: {
  filters: Record<string, string | number>;
  onOpen: (place: Place) => void;
  me: User | null;
}) {
  const [data, setData] = useState<{
    ad: Sponsored;
    place: Place;
    context: string;
  } | null>(null);
  const ref = useRef<HTMLElement>(null),
    session = useRef("");
  const context = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    if (!session.current) session.current = crypto.randomUUID();
    const params = new URLSearchParams(
      Object.entries(JSON.parse(context)).map(([key, value]) => [
        key,
        String(value),
      ]),
    );
    params.set("adsOnly", "1");
    fetch("/api/discovery?" + params, {
      headers: { "x-dated-session": session.current },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((result) => {
        if (!active) return;
        const ad = result.sponsored?.[0];
        const place = ad
          ? result.places?.find((p: Place) => p.id === ad.placeId)
          : null;
        setData(ad && place ? { ad, place, context } : null);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [context, me?.id]);
  useEffect(() => {
    if (!data || data.context !== context || !ref.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined,
      recorded = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.intersectionRatio >= 0.5;
        if (!visible && timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (visible && !recorded && !timer)
          timer = setTimeout(() => {
            recorded = true;
            void fetch("/api/events", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-dated-session": session.current,
              },
              body: JSON.stringify({
                placeId: data.place.id,
                deliveryId: data.ad.deliveryId,
                kind: "ad_impression",
                session: session.current,
              }),
            }).catch(() => {});
          }, 1000);
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [data, context]);
  if (!data || data.context !== context) return null;
  return (
    <aside
      ref={ref}
      className="sponsored-place"
      aria-label="Sponsored location matching your filters"
    >
      <div className="sponsored-image">
        <PlaceCover place={data.place} />
      </div>
      <div>
        <span className="sponsored-disclosure">
          Sponsored · Matches your filters
        </span>
        <h3>{data.ad.title}</h3>
        <p>{data.ad.body}</p>
        <small>
          <MapPin size={12} />
          {data.place.name} · {data.place.city}
          {data.place.rating === null
            ? ""
            : ` · ${data.place.rating.toFixed(1)}/5`}
        </small>
      </div>
      <button
        className="button secondary"
        onClick={() => {
          void fetch("/api/events", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-dated-session": session.current,
            },
            body: JSON.stringify({
              placeId: data.place.id,
              deliveryId: data.ad.deliveryId,
              kind: "ad_click",
              session: session.current,
            }),
          }).catch(() => {});
          onOpen(data.place);
        }}
      >
        Explore location
        <ArrowRight size={16} />
      </button>
    </aside>
  );
}
export function VenueComparison({ places }: { places: Place[] }) {
  const [ids, setIds] = useState(["", ""]);
  const selected = ids.map((id) => places.find((p) => p.id === id));
  const criterionNames = [
    ...new Set(selected.flatMap((p) => Object.keys(p?.criteria || {}))),
  ];
  return (
    <details className="venue-comparison">
      <summary>
        <GitCompareArrows size={17} />
        Compare places before you choose
      </summary>
      <div className="comparison-selects">
        {ids.map((id, index) => (
          <PlaceSelect
            key={index}
            places={places}
            value={id}
            label={"Place " + (index + 1)}
            onChange={(value) =>
              setIds((current) =>
                current.map((previous, i) => (i === index ? value : previous)),
              )
            }
          />
        ))}
      </div>
      {selected.every(Boolean) && (
        <div className="comparison-table-wrap">
          <table>
            <caption>
              Experience comparison from public eligible reviews
            </caption>
            <thead>
              <tr>
                <th scope="col">What matters</th>
                {selected.map((place, index) => (
                  <th scope="col" key={index}>
                    {place!.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Overall experience</th>
                {selected.map((place, index) => (
                  <td key={index}>
                    {place!.rating === null
                      ? "Not enough data"
                      : place!.rating.toFixed(1) + " / 5"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Budget per person</th>
                {selected.map((place, index) => (
                  <td key={index}>
                    {place!.budgetKnown === false
                      ? "Unknown"
                      : money(place!.budget)}
                  </td>
                ))}
              </tr>
              {criterionNames.map((name) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  {selected.map((place, index) => (
                    <td key={index}>
                      {place!.criteria?.[name]
                        ? `${place!.criteria[name].average.toFixed(1)} / 5 · ${place!.criteria[name].count} reviews`
                        : "Not enough data"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
