import { REFRESH_OPTIONS, REFRESH_SECONDS } from "./constants.js";

const MAX_LOCAL_STORAGE_VALUE_BYTES = 1_000_000;

export function load(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw.length > MAX_LOCAL_STORAGE_VALUE_BYTES) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_LOCAL_STORAGE_VALUE_BYTES) return false;
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export function createId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function currencySymbol(currency) {
  return currency === "INR" ? "₹" : currency === "USD" ? "$" : currency || "";
}

export function pctClass(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

export function isIndian(symbol = "") {
  return symbol.endsWith(".NS") || symbol.endsWith(".BO");
}



const EXCHANGE_NAMES = Object.freeze({
  NMS: "NASDAQ", NMQ: "NASDAQ", NASDAQ: "NASDAQ", NASDAQGS: "NASDAQ", NASDAQGM: "NASDAQ",
  NYQ: "NYSE", NYSE: "NYSE",
  NSI: "NSE", NSE: "NSE",
  BSE: "BSE",
  LSE: "LSE", LON: "LSE",
  TSE: "Tokyo", JPX: "Tokyo",
  HKG: "Hong Kong", HKEX: "Hong Kong",
  FRA: "Frankfurt", GER: "Frankfurt", ETR: "Frankfurt",
  AMS: "Euronext Amsterdam", PAR: "Euronext Paris",
  BME: "Madrid", MIL: "Milan", SIX: "SIX Swiss",
  ASX: "ASX", TOR: "TSX", TSX: "TSX",
  JSE: "Johannesburg", SAO: "São Paulo",
  SGX: "Singapore", KRX: "Korea", TPE: "Taiwan",
  KLS: "Malaysia", SET: "Thailand", IDX: "Indonesia",
  CPH: "Copenhagen", STO: "Stockholm", OSL: "Oslo", HEL: "Helsinki",
  IST: "Istanbul", WBO: "Vienna", VIE: "Vienna",
  BUX: "Budapest", WAR: "Warsaw"
});

export function exchangeName(q = {}) {
  const raw = String(q.fullExchangeName || q.exchange || "").trim();
  const key = raw.toUpperCase();
  if (EXCHANGE_NAMES[key]) return EXCHANGE_NAMES[key];
  if (raw) return raw;
  const symbol = String(q.symbol || "").toUpperCase();
  if (symbol.endsWith(".NS")) return "NSE";
  if (symbol.endsWith(".BO")) return "BSE";
  return "Other";
}

export function exchangeGroupKey(q = {}) {
  return exchangeName(q);
}

export function exchangeLabel(q) {
  return isIndian(q.symbol) ? (q.symbol.endsWith(".BO") ? "BSE" : "NSE") : q.exchange || "US";
}

export function sessionLabel(state, symbol) {
  if (isIndian(symbol)) return state === "REGULAR" ? "Market Open" : state === "PRE" ? "Pre-open" : "Closed";
  return state === "REGULAR" ? "Regular" : state === "PRE" ? "Pre-market" : state === "POST" ? "After-hours" : "Closed";
}

export function sessionTone(state) {
  return state === "REGULAR" ? "live" : state === "PRE" || state === "POST" ? "extended" : "closed";
}

export function changeText(value, percent, currency = "USD") {
  if (value == null || percent == null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${currencySymbol(currency)}${fmt(Math.abs(value))} (${sign}${fmt(Math.abs(percent))}%)`;
}

export function normalizeInput(value = "") {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function resolveUserSymbol(value) {
  const normalized = normalizeInput(value);
  // Yahoo Finance represents NSE Mahindra & Mahindra as M&M.NS.
  if (normalized.includes("&") && !normalized.endsWith(".NS") && !normalized.endsWith(".BO")) {
    return `${normalized}.NS`;
  }
  return normalized;
}

export function sanitizeBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid backup.");
  }

  // Accept the current export schema and the older "tickers" spelling so
  // users can safely edit/import backups across versions.
  const sourceWatchlist = Array.isArray(data.watchlist)
    ? data.watchlist
    : Array.isArray(data.tickers)
      ? data.tickers
      : null;

  if (!sourceWatchlist) {
    throw new Error("Invalid backup: watchlist is missing.");
  }

  const validSymbol = value => {
    const symbol = normalizeInput(String(value ?? ""));
    return /^[A-Z0-9^._=&-]{1,24}$/.test(symbol) ? symbol : null;
  };
  const safeId = value => {
    const id = String(value ?? "").trim().slice(0, 64);
    return id || createId();
  };
  const positiveFinite = (value, max = 1e12) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  };
  const nonNegativeFinite = (value, max = 1e12) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };

  const watchlist = [...new Set(sourceWatchlist.map(validSymbol).filter(Boolean))].slice(0, 200);
  const order = Array.isArray(data.order)
    ? [...new Set(data.order.map(validSymbol).filter(s => s && watchlist.includes(s)))]
    : watchlist;

  const alerts = Array.isArray(data.alerts)
    ? data.alerts.slice(0, 500).flatMap(a => {
        if (!a || typeof a !== "object" || Array.isArray(a) || !watchlist.includes(a.symbol)) return [];
        if (!["above", "below"].includes(a.direction)) return [];
        const kind = a.kind === "trailing" ? "trailing" : "price";
        if (kind === "trailing") {
          const percent = positiveFinite(a.percent, 10000);
          if (percent == null) return [];
          return [{
            id: safeId(a.id), symbol: a.symbol, kind, direction: a.direction, percent,
            anchor: nonNegativeFinite(a.anchor), peakPrice: nonNegativeFinite(a.peakPrice),
            troughPrice: nonNegativeFinite(a.troughPrice), triggerPrice: nonNegativeFinite(a.triggerPrice),
            armed: a.armed !== false
          }];
        }
        const price = positiveFinite(a.price);
        if (price == null) return [];
        return [{ id: safeId(a.id), symbol: a.symbol, kind, direction: a.direction, price, armed: a.armed !== false }];
      })
    : [];

  const portfolio = Array.isArray(data.portfolio)
    ? data.portfolio.slice(0, 500).flatMap(h => {
        if (!h || typeof h !== "object" || Array.isArray(h)) return [];
        const symbol = validSymbol(h.symbol);
        if (!symbol) return [];
        const shares = positiveFinite(h.shares, 1e9);
        const buyPrice = h.buyPrice === "" || h.buyPrice == null
          ? ""
          : nonNegativeFinite(h.buyPrice);
        if (shares == null || buyPrice === null) return [];
        return [{ id: safeId(h.id), symbol, shares, buyPrice }];
      })
    : [];

  const rawLists = data.watchlists && typeof data.watchlists === "object" && !Array.isArray(data.watchlists)
    ? data.watchlists : {};
  const watchlists = Object.fromEntries(
    Object.entries(rawLists).slice(0, 30).map(([name, symbols]) => [
      String(name).trim().slice(0, 32),
      Array.isArray(symbols)
        ? [...new Set(symbols.map(validSymbol).filter(s => s && watchlist.includes(s)))].slice(0, 200)
        : []
    ])
  );

  const safeScreenName = typeof data.screenName === "string" ? data.screenName.trim().slice(0, 48) : "Market Watch";
  return {
    watchlist,
    order: [...new Set(order.concat(watchlist))],
    alerts,
    portfolio,
    watchlists,
    screenName: safeScreenName || "Market Watch",
    refreshSeconds: REFRESH_OPTIONS.includes(Number(data.refreshSeconds)) ? Number(data.refreshSeconds) : REFRESH_SECONDS,
    portfolioView: typeof data.portfolioView === "boolean" ? data.portfolioView : false,
    notificationsEnabled: typeof data.notificationsEnabled === "boolean" ? data.notificationsEnabled : false,
    soundEnabled: typeof data.soundEnabled === "boolean" ? data.soundEnabled : false,
    activeWatchlist: typeof data.activeWatchlist === "string" ? data.activeWatchlist.trim().slice(0, 32) : "All Stocks"
  };
}

export function sanitizeLocalState({
  tickers,
  order,
  alerts,
  screenName,
  refreshSeconds,
  portfolio,
  portfolioView,
  watchlists,
  activeWatchlist
}) {
  let safe;
  try {
    safe = sanitizeBackup({
      watchlist: tickers,
      order,
      alerts,
      screenName,
      refreshSeconds,
      portfolio,
      portfolioView,
      watchlists,
      activeWatchlist
    });
  } catch {
    safe = sanitizeBackup({
      watchlist: [], order: [], alerts: [], screenName: "Market Watch",
      refreshSeconds: REFRESH_SECONDS, portfolio: [], portfolioView: false,
      watchlists: {}
    });
  }

  const listNames = new Set(Object.keys(safe.watchlists));
  const safeActiveWatchlist = typeof activeWatchlist === "string" &&
    (activeWatchlist === "All Stocks" || listNames.has(activeWatchlist))
    ? activeWatchlist
    : "All Stocks";

  return {
    ...safe,
    activeWatchlist: safeActiveWatchlist
  };
}

export function buildLocalBackup(
  tickers,
  order,
  alerts,
  screenName,
  refreshSeconds,
  portfolio,
  portfolioView,
  watchlists,
  notificationsEnabled = false,
  soundEnabled = false,
  activeWatchlist = "All Stocks"
) {
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    watchlist: tickers,
    order,
    alerts,
    screenName,
    refreshSeconds,
    portfolio,
    portfolioView,
    watchlists,
    notificationsEnabled,
    soundEnabled,
    activeWatchlist
  };
}
