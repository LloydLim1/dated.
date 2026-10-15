import "server-only";
import { commerce } from "./commerce";

const state = globalThis as unknown as {
  datedCommerceTimer?: ReturnType<typeof setInterval>;
};
export function startCommerceWorker() {
  if (state.datedCommerceTimer || process.env.DATED_COMMERCE_WORKER === "false")
    return;
  const run = () => {
    try {
      commerce.maintenance();
    } catch (error) {
      console.error(
        "DATED commerce maintenance failed; retrying next minute.",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };
  run();
  state.datedCommerceTimer = setInterval(run, 60_000);
  state.datedCommerceTimer.unref();
}
