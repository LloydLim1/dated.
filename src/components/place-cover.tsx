"use client";
import { useState } from "react";
import type { Place } from "@/lib/types";

export default function PlaceCover({
  place,
  photo,
}: {
  place: Place;
  photo?: string;
}) {
  const [failed, setFailed] = useState("");
  const visitorPhoto = photo && photo !== failed;
  return (
    <div className="place-photo-cover">
      <img
        src={visitorPhoto ? photo : place.image}
        alt={
          visitorPhoto
            ? "Visitor photo at " + place.name
            : "Illustrative " + place.category.toLowerCase() + " photograph"
        }
        loading="lazy"
        onError={() => setFailed(photo || "")}
      />
      {!place.sample && (
        <>
          <span className="cover-credit">
            {visitorPhoto ? "Visitor photo" : "Illustrative photo"}
          </span>
        </>
      )}
    </div>
  );
}
