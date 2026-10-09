"use client";
import { CalendarDays, MapPin, Clock, Printer, Download } from "lucide-react";
import {
  itineraryCalendar,
  itineraryDate,
  type ItineraryDocument,
} from "@/lib/itinerary";
import { money } from "@/lib/types";
export function ItinerarySheet({
  document: doc,
  standalone = false,
}: {
  document: ItineraryDocument;
  standalone?: boolean;
}) {
  const budget = doc.stops.reduce((total, s) => total + (s.budget || 0), 0);
  const plannedStops = doc.stops.filter((s) => s.budget !== null).length;
  const budgetLabel = plannedStops
    ? money(budget) +
      " planned" +
      (plannedStops < doc.stops.length
        ? ` · ${doc.stops.length - plannedStops} undecided`
        : "")
    : "Budget to be decided";
  const Heading = standalone ? "h1" : "h2";
  return (
    <article
      className={`itinerary-sheet itinerary-${doc.format} itinerary-${doc.theme}`}
      aria-label="Itinerary preview"
    >
      <header>
        <span className="itinerary-wordmark">
          dated<span>.</span>
        </span>
        <span>A DAY TO KEEP</span>
      </header>
      <div className="itinerary-sheet-heading">
        <p>YOUR LITTLE ESCAPE</p>
        <Heading>{doc.title}</Heading>
        {doc.showDate && doc.date && (
          <p className="itinerary-date">
            <CalendarDays size={16} />
            {itineraryDate(doc.date)}
          </p>
        )}
        {doc.intro && <p className="itinerary-intro">{doc.intro}</p>}
      </div>
      <div className="itinerary-overview">
        <span>{doc.stops.length} stops</span>
        <span>Times in Philippine time</span>
        {doc.showBudget && <span>{budgetLabel}</span>}
      </div>
      <ol className="itinerary-sheet-stops">
        {doc.stops.map((s, i) => (
          <li key={s.placeId}>
            <span className="itinerary-sequence">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="itinerary-stop-meta">
                <span>{s.time || "Flexible time"}</span>
                <span>
                  <Clock size={12} />
                  {s.minutes} min
                </span>
              </div>
              <h3>{s.name}</h3>
              <p className="itinerary-location">
                {s.category} · {s.city}
              </p>
              {doc.showAddress && s.address && (
                <p className="itinerary-location">
                  <MapPin size={13} />
                  {s.address}
                </p>
              )}
              {s.note && <p className="itinerary-note">{s.note}</p>}
              {doc.showBudget && (
                <p className="itinerary-budget">
                  {s.budget !== null
                    ? "Planned budget: " + money(s.budget)
                    : "Budget to be decided"}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <footer>
        <span>A little room to wander. A lot to look forward to.</span>
        <span>Made with Dated</span>
      </footer>
    </article>
  );
}
export function ItineraryExports({
  document: doc,
}: {
  document: ItineraryDocument;
}) {
  const calendarReady = !!doc.date && doc.stops.some((s) => s.time);
  return (
    <div className="itinerary-export-actions no-print">
      <button className="button secondary" onClick={() => window.print()}>
        <Printer size={17} />
        Print / save PDF
      </button>
      <button
        className="button secondary"
        disabled={!calendarReady}
        title={
          calendarReady
            ? "Download scheduled stops"
            : "Show the date and set a stop time first"
        }
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([itineraryCalendar(doc)], {
              type: "text/calendar;charset=utf-8",
            }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "dated-itinerary.ics";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        <Download size={17} />
        Add to calendar
      </button>
    </div>
  );
}
