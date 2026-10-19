import Link from "next/link";
import { Compass, Leaf } from "lucide-react";

export default function NotFound() {
  return (
    <main className="recovery-page">
      <Link href="/" className="brand">
        <Leaf size={26} />
        dated.
      </Link>
      <span className="recovery-code">404 · A little detour</span>
      <h1>This place isn’t on the map.</h1>
      <p>
        The page may have moved, or the link may be incomplete. There are still
        plenty of good places to discover.
      </p>
      <div className="form-actions">
        <Link href="/explore" className="button">
          <Compass size={18} />
          Explore places
        </Link>
        <Link href="/app" className="button secondary">
          Open the app
        </Link>
      </div>
    </main>
  );
}
