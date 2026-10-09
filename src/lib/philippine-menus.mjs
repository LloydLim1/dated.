// Sources checked against their Philippine operator pages, not inferred from global brand metadata.
export const PH_MENU_SOURCES = [
  ["starbucks.ph", "/menu"],
  ["jollibee.com.ph", "/menu"],
  ["chowking.ph", "/menu"],
  ["bonchon.com.ph", "/menu"],
  ["potatocorner.com", "/menu"],
  ["boscoffee.com", "/pages/menu-1"],
  ["shakeyspizza.ph", "/"],
  ["coffeeproject.com.ph", "/pages/"],
  ["menu.cafeoasis.ph", "/"],
  ["foodpanda.ph", "/restaurant/"],
  ["pickup-coffee.com", "/menu"],
  ["armynavy.com.ph", "/menu"],
  ["menu.klikit.io", "/menu/RgjhghP61njsX01UKZELO4L9", "exact"],
  ["hapchan.com.ph", "/menu-chineseclassic.html", "exact"],
  ["tapaking.com.ph", "/our-food"],
  ["northpark.com.ph", "/menu"],
  ["angelspizza.com.ph", "/menu"],
  ["gerrysgrill.com", "/PH", "exact"],
  ["iloveserenitea.com", "/menu"],
  ["turks.ph", "/our-menu"],
  ["24chicken.com", "/our-menu"],
  ["zagushakes.com", "/menu"],
  ["manam.momentfood.com", "/", "exact"],
  ["shawarmashack.ph", "/our-menu.html", "exact"],
  ["banapple.ph", "/shop"],
  ["contis.ph", "/pages/restaurant-menu"],
  ["kuyaj.ph", "/menu-gma"],
];

export function philippineMenu(value) {
  try {
    const url = new URL(value),
      host = url.hostname.replace(/^www\./, "");
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return undefined;
    if (
      /(?:^|\/)(?:us|usa|united-states|en-us|ca|canada|au|australia|mx|mexico|en-mx|es-mx)(?:\/|$)/i.test(
        url.pathname,
      )
    )
      return undefined;
    if (
      [...url.searchParams].some(
        ([key, value]) =>
          /^(country|market|region|locale)$/i.test(key) &&
          !/^(ph|philippines|en-ph|fil-ph)$/i.test(value),
      )
    )
      return undefined;
    const source = PH_MENU_SOURCES.find(
      ([domain, path, mode]) =>
        host === domain &&
        (mode === "exact"
          ? url.pathname === path && !url.search
          : path === "/" ||
            url.pathname === path ||
            url.pathname.startsWith(path.endsWith("/") ? path : path + "/")),
    );
    return source ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function philippineWebsite(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return (
      (host === "gerrysgrill.com" && new URL(value).pathname === "/PH") ||
      host.endsWith(".ph") ||
      [
        "potatocorner.com",
        "boscoffee.com",
        "pickup-coffee.com",
        "angelsburger.com",
        "iloveserenitea.com",
        "24chicken.com",
        "henlin.com",
        "zagushakes.com",
        "mastersiomai.com",
        "manam.momentfood.com",
      ].includes(host)
    );
  } catch {
    return false;
  }
}
