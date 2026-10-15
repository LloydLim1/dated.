import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryable(error) {
  if (error.retryable || RETRYABLE_STATUS.has(error.status)) return true;
  return /abort|timeout|timed out|fetch failed|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|socket hang up/i.test(
    `${error.name || ""} ${error.message || ""}`,
  );
}

const message = (error) =>
  error.status ? `HTTP ${error.status}` : error.message || "request failed";

export async function fetchOverpassData(
  query,
  {
    fetcher = fetch,
    timeout = 90000,
    userAgent = "Dated/1.0 (Metro Manila OpenStreetMap directory)",
    progress = () => {},
    validate = () => {},
  } = {},
) {
  const configured = process.env.DATED_OVERPASS_URL?.trim();
  const endpoints = configured ? [configured] : DEFAULT_ENDPOINTS;
  const failures = [];

  for (let index = 0; index < endpoints.length; index++) {
    const endpoint = endpoints[index];
    const url = new URL(endpoint);
    url.searchParams.set("data", query);

    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { "User-Agent": userAgent },
      });
      if (!response.ok) {
        const error = new Error(`Source returned HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      let data;
      try {
        data = await response.json();
      } catch (error) {
        error.retryable = true;
        throw error;
      }
      if (!data || !Array.isArray(data.elements) || data.remark) {
        const error = new Error("Overpass returned an incomplete data set");
        error.retryable = true;
        throw error;
      }
      try {
        validate(data);
      } catch (error) {
        error.retryable = true;
        throw error;
      }
      return { data, endpoint };
    } catch (error) {
      failures.push({ endpoint, error });
      if (!retryable(error) || index === endpoints.length - 1) {
        if (failures.length === 1) throw error;
        throw new Error(
          "Overpass sources failed: " +
            failures
              .map(({ endpoint: failed, error: cause }) =>
                `${new URL(failed).hostname} (${message(cause)})`,
              )
              .join("; "),
          { cause: error },
        );
      }

      const next = endpoints[index + 1];
      progress({
        warning: `Overpass source ${new URL(endpoint).hostname} failed (${message(error)}); retrying sequentially with ${new URL(next).hostname}.`,
      });
      if (error.status === 429) await delay(30000);
    }
  }

  throw new Error("No Overpass sources are configured.");
}
