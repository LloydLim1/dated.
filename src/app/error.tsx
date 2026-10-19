"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="recovery-page">
      <Link href="/" className="brand">
        dated.
      </Link>
      <span className="recovery-code">A pause along the way</span>
      <h1>We couldn’t open this page.</h1>
      <p>
        Please try again. If the problem continues, return to discovery and pick
        up your plans from there.
      </p>
      <div className="form-actions">
        <button className="button" onClick={reset}>
          Try again
        </button>
        <Link href="/app" className="button secondary">
          Open the app
        </Link>
      </div>
    </main>
  );
}
