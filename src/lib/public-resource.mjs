import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
])
  blocked.addSubnet(address, prefix, "ipv6");
export const isPublicAddress = (address) =>
  !!isIP(address) &&
  !address.toLowerCase().includes("::ffff:") &&
  !blocked.check(address, isIP(address) === 4 ? "ipv4" : "ipv6");

// Pin requests to validated DNS addresses, and validate every redirect, preventing private-network access.
export async function publicResource(
  value,
  { timeout = 8000, maxBytes = 1024 * 1024, redirects = 3 } = {},
) {
  const url = new URL(value);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    url.hostname === "localhost"
  )
    throw new Error("Not a public web source");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Private web source rejected");
  const address = addresses.find((a) => a.family === 4) || addresses[0];
  const response = await new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(
      url,
      {
        headers: {
          "User-Agent": "Dated/1.0 (public restaurant menu and logo updates)",
          Accept: "text/html,application/json,image/*;q=0.8,*/*;q=0.5",
          "Accept-Encoding": "identity",
        },
        lookup: (_hostname, options, callback) =>
          options.all
            ? callback(null, [address])
            : callback(null, address.address, address.family),
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            reject(new Error("Public source exceeds size limit"));
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            bytes: Buffer.concat(chunks),
            url: url.href,
          }),
        );
        res.on("error", reject);
      },
    );
    request.setTimeout(timeout, () =>
      request.destroy(new Error("Public source timed out")),
    );
    request.on("error", reject);
  });
  if (
    [301, 302, 303, 307, 308].includes(response.status) &&
    response.headers.location
  ) {
    if (!redirects) throw new Error("Too many redirects");
    return publicResource(new URL(response.headers.location, url).href, {
      timeout,
      maxBytes,
      redirects: redirects - 1,
    });
  }
  return response;
}

export function structuredMenuPrices(html) {
  const values = [];
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    if (v.priceCurrency === "PHP" && /^\d+(\.\d{1,2})?$/.test(String(v.price)))
      values.push(Number(v.price));
    // Only explicit peso amounts qualify. Dollar signs and unrelated numbers aren't prices.
    if (
      typeof v.priceRange === "string" &&
      /(?:₱|PHP)\s*\d/i.test(v.priceRange)
    )
      values.push(v.priceRange.slice(0, 100));
    for (const child of Object.values(v))
      if (typeof child === "object") {
        if (Array.isArray(child)) child.forEach(walk);
        else walk(child);
      }
  };
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse(match[1]));
    } catch {
      /* Invalid markup isn't usable pricing. */
    }
  }
  const numbers = values.filter((v) => typeof v === "number" && v >= 0);
  if (numbers.length)
    return `Published items: ₱${Math.min(...numbers)}${Math.max(...numbers) !== Math.min(...numbers) ? "–₱" + Math.max(...numbers) : ""}`;
  return values.find((v) => typeof v === "string");
}

export function publishedMenuPrices(html, pageUrl) {
  const structured = structuredMenuPrices(html);
  if (structured) return structured;
  let url;
  try {
    url = new URL(pageUrl);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^www\./, "");
  const itemMarkup =
    !url.search &&
    (host === "hapchan.com.ph" && url.pathname === "/menu-chineseclassic.html"
      ? /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi
      : host === "gerrysgrill.com" && url.pathname === "/PH"
        ? /<li\b[^>]*>([\s\S]*?)<\/li>/gi
        : undefined);
  if (itemMarkup) {
    const prices = [];
    const menuMarkup =
      host === "gerrysgrill.com"
        ? html.match(
            /<section\b(?=[^>]*\bid=(["'])menu\1)[^>]*>([\s\S]*?)<\/section>/i,
          )?.[2] || ""
        : html;
    for (const item of menuMarkup.matchAll(itemMarkup)) {
      const text = item[1]
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&#(?:x20b1|8369);/gi, "₱")
        .replace(/&nbsp;/gi, " ");
      // Only a named menu item plus an explicit peso amount qualifies; cart totals do not.
      if (!/[a-z]/i.test(text)) continue;
      const amount = text.match(
        /₱\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d.,])/,
      );
      if (amount) {
        const number = Number(amount[1].replaceAll(",", ""));
        if (number > 0 && number <= 100000) prices.push(number);
      }
    }
    if (!prices.length) return undefined;
    const low = Math.min(...prices),
      high = Math.max(...prices);
    return `Published items: ₱${low}${high !== low ? "–₱" + high : ""}`;
  }
  // Pickup's verified Philippine menu renders PHP prices from its published RSC menuItems.
  // Scope this adapter to that exact menu; unrelated application numbers are not prices.
  if (
    url.hostname.replace(/^www\./, "") !== "pickup-coffee.com" ||
    url.pathname !== "/menu" ||
    url.search
  )
    return undefined;
  const amounts = [];
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.menuItems && !Array.isArray(value.menuItems)) {
      for (const items of Object.values(value.menuItems)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (
            typeof item.name === "string" &&
            item.name.trim() &&
            ["drink", "food"].includes(item.type) &&
            Number.isFinite(item.price) &&
            item.price >= 0 &&
            item.price <= 10000
          )
            amounts.push(item.price);
        }
      }
    }
    for (const child of Object.values(value))
      if (child && typeof child === "object") walk(child);
  };
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const payload = script[1].match(
      /self\.__next_f\.push\((\[[\s\S]*\])\)/,
    )?.[1];
    if (!payload) continue;
    try {
      const text = JSON.parse(payload)[1];
      if (typeof text !== "string") continue;
      for (const line of text.split("\n")) {
        const json = line.match(/^[\da-f]+:(\[[\s\S]*\])$/i)?.[1];
        if (json)
          try {
            walk(JSON.parse(json));
          } catch {
            /* Skip malformed records. */
          }
      }
    } catch {
      /* Never execute scripts to read menu data. */
    }
  }
  if (!amounts.length) return undefined;
  const low = Math.min(...amounts),
    high = Math.max(...amounts);
  return `Published items: ₱${low}${high !== low ? "–₱" + high : ""}`;
}

export function websiteIdentityChanged(html, pageUrl) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return /hugedomains|sedoparking|afternic|domain.{0,20}(for sale|expired|parking)|togel|kimtoto|slot.{0,10}gacor/i.test(
    title + pageUrl,
  );
}

export function websiteLogo(html, pageUrl, expectedNames = []) {
  let candidate;
  const key = (s) =>
    String(s || "")
      .replace(/&#(?:39|x27);|&apos;/gi, "'")
      .replace(/&amp;/gi, "&")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const expected = expectedNames.map(key).filter((s) => s.length >= 4);
  const matches = (name) =>
    !expected.length ||
    expected.some(
      (s) =>
        key(name).includes(s) ||
        (key(name).length >= 4 && s.includes(key(name))),
    );
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const rootPage = /^\/(?:index\.(?:html?|php)|home\/?)?$/.test(
    new URL(pageUrl).pathname,
  );
  if (websiteIdentityChanged(html, pageUrl)) return undefined;
  const walk = (v) => {
    if (!v || typeof v !== "object" || candidate) return;
    const types = Array.isArray(v["@type"]) ? v["@type"] : [v["@type"]];
    if (
      types.some((t) =>
        [
          "Organization",
          "Restaurant",
          "CafeOrCoffeeShop",
          "FoodEstablishment",
          "LocalBusiness",
        ].includes(t),
      ) &&
      v.logo &&
      matches(v.name || title) &&
      (v.name || rootPage || !expected.length)
    ) {
      candidate =
        typeof v.logo === "string" ? v.logo : v.logo.url || v.logo.contentUrl;
    }
    for (const child of Object.values(v))
      if (typeof child === "object") {
        if (Array.isArray(child)) child.forEach(walk);
        else walk(child);
      }
  };
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse(match[1]));
    } catch {
      /* Ignore malformed metadata. */
    }
  }
  if (!candidate) {
    const markup = html.slice(0, 300000);
    const headers = [
      ...markup.matchAll(/<(?:header|nav)\b[^>]*>[\s\S]*?<\/(?:header|nav)>/gi),
    ].map((m) => m[0]);
    const homeLinks = [...markup.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)]
      .map((m) => m[0])
      .filter((tag) => {
        const href = tag.match(/\bhref=(["'])([\s\S]*?)\1/i)?.[2];
        if (!href) return false;
        try {
          const target = new URL(href, pageUrl),
            page = new URL(pageUrl);
          return (
            target.hostname === page.hostname &&
            /^\/(?:index\.(?:html?|php)|home\/?)?$/.test(target.pathname)
          );
        } catch {
          return false;
        }
      });
    const choices = [];
    // Generic logos need a header/home-link context; restaurant names alone do not authenticate partner badges.
    for (const match of markup.matchAll(/<img\b[^>]*>/gi)) {
      const tag = match[0];
      const alt = tag.match(/\balt=(["'])([\s\S]*?)\1/i)?.[2] || "";
      const src =
        tag.match(/\bdata-src=(["'])([\s\S]*?)\1/i)?.[2] ||
        tag.match(/\ssrc=(["'])([\s\S]*?)\1/i)?.[2];
      const className = tag.match(/\bclass=(["'])([\s\S]*?)\1/i)?.[2] || "";
      const explicitlyDesignated =
        /\blogo\b/i.test(alt + " " + className) ||
        /logo(?:[^a-z]|$)/i.test(src || "");
      const altName = alt.replace(/\blogo\b/gi, "");
      const branded =
        (key(altName).length >= 4 && matches(altName)) ||
        expected.some((name) => {
          try {
            return key(
              new URL(src, pageUrl).pathname.split("/").at(-1),
            ).includes(name);
          } catch {
            return false;
          }
        });
      // Some official sites concatenate the brand and "logoupdated" in lazy-loaded filenames.
      const designated =
        explicitlyDesignated ||
        (branded && /logo/i.test((src || "").split("?")[0].split("/").at(-1)));
      const home = homeLinks.some((link) => link.includes(tag));
      const header = headers.some((section) => section.includes(tag));
      let assetPath = "";
      try {
        assetPath = new URL(src, pageUrl).pathname;
      } catch {
        /* Invalid sources cannot identify a logo. */
      }
      if (
        designated &&
        (branded || (rootPage && matches(title) && (home || header))) &&
        !/payment|visa|mastercard|paypal|partner|sponsor|wordpress|wpcom|avatar|gravatar|shopify|storehub|grab|foodpanda|facebook|instagram|twitter|michelin|taste.?makers|when.?in.?manila|malaya|logo[-_]fb\b/i.test(
          alt + " " + className + " " + assetPath,
        )
      ) {
        if (src) choices.push({ src, score: branded ? 3 : home ? 2 : 1 });
      }
    }
    candidate = choices.sort((a, b) => b.score - a.score)[0]?.src;
  }
  if (!candidate || candidate.startsWith("data:")) return undefined;
  try {
    const asset = new URL(candidate.replaceAll("&amp;", "&"), pageUrl);
    if (
      /wpcom|(?:wordpress|shopify)[-_]logo|default[-_]avatar/i.test(
        asset.pathname,
      ) ||
      (/^(?:s-ssl\.wordpress\.com|s\d\.wp\.com)$/.test(asset.hostname) &&
        asset.pathname.startsWith("/i/"))
    )
      return undefined;
    return asset.href;
  } catch {
    return undefined;
  }
}
