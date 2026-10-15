"use client";
import { useState } from "react";
import { ExternalLink, PersonStanding } from "lucide-react";
import Modal from "./modal";

type Viewpoint = {
  lat: number | null;
  lng: number | null;
  name: string;
  sample?: boolean;
};
export default function StreetViewAction({
  place,
  compact = false,
}: {
  place: Viewpoint;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (
    place.sample ||
    place.lat === null ||
    place.lng === null ||
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lng) ||
    Math.abs(place.lat) > 90 ||
    Math.abs(place.lng) > 180
  )
    return null;
  const location = `${place.lat},${place.lng}`;
  const url =
    "https://www.google.com/maps/@?" +
    new URLSearchParams({ api: "1", map_action: "pano", viewpoint: location });
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const className = compact
    ? "street-view-link"
    : "button secondary street-view-button";
  const label = `Street View near ${place.name}${key ? "" : " (opens Google Maps in a new tab)"}`;
  const content = (
    <>
      <PersonStanding size={compact ? 15 : 17} />
      <span>Street View</span>
      {!key && <ExternalLink size={13} />}
    </>
  );
  if (!key)
    return (
      <a
        className={className}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title="Look around nearby streets in Google Maps; imagery may be unavailable."
      >
        {content}
      </a>
    );
  const embed =
    "https://www.google.com/maps/embed/v1/streetview?" +
    new URLSearchParams({ key, location, radius: "100", source: "outdoor" });
  return (
    <>
      <button
        className={className}
        onClick={() => setOpen(true)}
        aria-label={label}
      >
        {content}
      </button>
      {open && (
        <Modal
          title={`Look around ${place.name}`}
          onClose={() => setOpen(false)}
          wide
        >
          <div className="street-view-content">
            <iframe
              src={embed}
              title={`Google Street View near ${place.name}`}
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <p>
              Google Street View shows nearby available imagery. It may show a
              nearby road rather than the entrance, and capture dates vary.
            </p>
            <a
              className="button secondary"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps <ExternalLink size={15} />
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
