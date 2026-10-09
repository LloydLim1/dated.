"use client";
import { useState } from "react";
import type { Place } from "@/lib/types";
export default function PlaceLogo({ place }: { place: Place }) {
  const [failedSource, setFailedSource] = useState("");
  const hasLogo = !!place.logo && place.logo !== failedSource;
  if (!hasLogo) return null;
  return (
    <span className="business-logo" aria-hidden="true">
      <img
        src={place.logo}
        alt=""
        loading="lazy"
        onError={() => setFailedSource(place.logo || "")}
      />
    </span>
  );
}
