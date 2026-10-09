import "server-only";
import { db, dataDir } from "./db";
import {
  catalogStatus,
  refreshMetroEnrichment,
  syncMetro,
} from "@/lib/place-catalog.mjs";
import { syncMuseums } from "@/lib/museum-catalog.mjs";
import { syncCinemas } from "@/lib/cinema-catalog.mjs";

let active: Promise<unknown> | undefined;
export function refreshCatalog(force = false) {
  if (!active) {
    active = syncMetro(db, dataDir, { force })
      .catch(async (error) => {
        try {
          const enrichment = await refreshMetroEnrichment(db, dataDir, {
            force,
          });
          console.info(
            "Saved restaurant listings received an enrichment refresh:",
            JSON.stringify(enrichment),
          );
        } catch (fallbackError) {
          console.error(
            "Saved restaurant enrichment refresh failed:",
            (fallbackError as Error).message,
          );
        }
        throw error;
      })
      .finally(() => {
        active = undefined;
      });
  }
  return active;
}
export function startWeeklyRefresh() {
  if (process.env.DATED_AUTO_REFRESH === "false") return;
  const globalRunner = globalThis as unknown as {
    datedCatalogTimer?: NodeJS.Timeout;
  };
  if (globalRunner.datedCatalogTimer) return;
  const tick = () => {
    const state = catalogStatus(db);
    // The first full import is explicit; after that, catch up automatically after downtime.
    if (
      state.lastSuccess &&
      (!state.nextDue || state.nextDue <= Date.now()) &&
      (!state.retryAfter || state.retryAfter <= Date.now())
    ) {
      void refreshCatalog().catch((error: Error) =>
        console.error("Restaurant refresh failed:", error.message),
      );
    } else if (
      state.lastSuccess &&
      (!state.museums?.nextDue || state.museums.nextDue <= Date.now()) &&
      (!state.museums?.retryAfter || state.museums.retryAfter <= Date.now()) &&
      !active
    ) {
      active = syncMuseums(db, dataDir)
        .catch((error: Error) =>
          console.error("Museum refresh failed:", error.message),
        )
        .finally(() => {
          active = undefined;
        });
    } else if (
      state.lastSuccess &&
      (!state.cinemas?.nextDue || state.cinemas.nextDue <= Date.now()) &&
      (!state.cinemas?.retryAfter || state.cinemas.retryAfter <= Date.now()) &&
      !active
    ) {
      active = syncCinemas(db, dataDir)
        .catch((error: Error) =>
          console.error("Cinema refresh failed:", error.message),
        )
        .finally(() => {
          active = undefined;
        });
    }
  };
  globalRunner.datedCatalogTimer = setInterval(tick, 3600000);
  globalRunner.datedCatalogTimer.unref();
  tick();
}
