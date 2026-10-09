import type { Metadata } from "next";
import Link from "next/link";
import { publicItinerary } from "@/server/itineraries";
import {
  ItinerarySheet,
  ItineraryExports,
} from "@/components/itinerary-document";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "A day with Dated",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function SharedItinerary({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = publicItinerary(token);
  return (
    <main className="shared-itinerary">
      <nav className="no-print">
        <Link href="/">dated.</Link>
        <span>A plan shared with you</span>
      </nav>
      {doc ? (
        <>
          <ItinerarySheet document={doc} standalone />
          <ItineraryExports document={doc} />
        </>
      ) : (
        <div className="premium-empty">
          <h1>This plan is no longer shared.</h1>
          <p>
            The host may have turned off this link. Ask them for an updated
            copy.
          </p>
          <Link className="button" href="/explore">
            Explore Dated
          </Link>
        </div>
      )}
    </main>
  );
}
