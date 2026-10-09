"use client";
import { useMemo, useState } from "react";
import type { Place } from "@/lib/types";

export default function PlaceSelect({
  places,
  value,
  onChange,
  label,
  disabled = false,
}: {
  places: Place[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const matched = useMemo(() => {
    const key = query.trim().toLocaleLowerCase();
    return places.filter(
      (p) =>
        !key ||
        `${p.name} ${p.city} ${p.neighborhood}`
          .toLocaleLowerCase()
          .includes(key),
    );
  }, [places, query]);
  const selected = places.find((p) => p.id === value);
  const options = matched.slice(0, 80);
  if (selected && !options.some((p) => p.id === value))
    options.unshift(selected);
  return (
    <div className="place-select-fields">
      {!disabled && places.length > 80 && (
        <label>
          Find a place
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, city, or neighborhood"
          />
        </label>
      )}
      <label>
        {label}
        <select
          aria-label={label}
          required
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose a place</option>
          {options.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name} · {p.city}
              {p.sample ? " · Sample" : ""}
            </option>
          ))}
        </select>
      </label>
      {!disabled && places.length > 80 && (
        <small role="status">
          {matched.length
            ? `${matched.length.toLocaleString()} matching places${matched.length > 80 ? "; showing the first 80. Narrow your search to find a branch." : "."}`
            : "No matching places. Try a name or another city."}
        </small>
      )}
    </div>
  );
}
