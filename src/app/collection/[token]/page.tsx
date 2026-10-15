import type { Metadata } from "next";
import Link from "next/link";
import { publicCollection } from "@/server/collection-sharing";
import PlaceCover from "@/components/place-cover";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "A collection of good places · DATED",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function SharedCollection({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const collection = publicCollection(token);
  return (
    <main className="shared-collection">
      <nav>
        <Link href="/">dated.</Link>
        <span>A collection shared with you</span>
      </nav>
      <header>
        <h1>{collection?.name || "This collection is no longer shared."}</h1>
        <p>
          {collection
            ? "A snapshot of saved places. Open a place to see its current details."
            : "The owner may have turned off or replaced this link."}
        </p>
      </header>
      {collection && (
        <div className="shared-collection-grid">
          {collection.places.map((place) => (
            <Link
              className="shared-place"
              href={`/explore?place=${encodeURIComponent(place.id)}`}
              key={place.id}
            >
              <PlaceCover place={place} />
              <div>
                <small>
                  {place.category} · {place.city}
                </small>
                <h2>{place.name}</h2>
                <span>Discover this place →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {collection && !collection.places.length && (
        <p>This shared collection has no saved places yet.</p>
      )}
      <Link className="button secondary" href="/explore">
        Find your next experience
      </Link>
    </main>
  );
}
