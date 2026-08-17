import assert from "node:assert/strict";
import { createTtlCache, normalizeSymbol } from "../lib/api-security.mjs";
import { sanitizeBackup, sanitizeLocalState } from "../lib/utils.js";

assert.equal(normalizeSymbol(" nvda "), "NVDA");
assert.equal(normalizeSymbol("M&M.NS"), "M&M.NS");
assert.equal(normalizeSymbol(""), null);
assert.equal(normalizeSymbol("A".repeat(25)), null);
assert.equal(normalizeSymbol("NVDA;DROP"), null);

const cache = createTtlCache(2);
cache.set("a", 1); cache.set("b", 2); cache.set("c", 3);
assert.equal(cache.get("a", 60_000), null);
assert.equal(cache.get("b", 60_000), 2);
assert.equal(cache.get("c", 60_000), 3);
assert.equal(cache.get("expired", 1), null);

console.log("Security smoke tests passed.");


const hostile = {
  watchlist: ["NVDA", "BAD;SYMBOL", "A".repeat(200), "M&M.NS"],
  alerts: [
    { id: "x", symbol: "NVDA", direction: "above", price: 200, armed: true },
    { id: "bad", symbol: "NVDA", direction: "above", price: -1 },
    { id: "trail", symbol: "NVDA", direction: "below", kind: "trailing", percent: 5, armed: true }
  ],
  portfolio: [
    { id: "h", symbol: "NVDA", shares: 2, buyPrice: 100 },
    { id: "h2", symbol: "RELIANCE.NS", shares: 3, buyPrice: 2500 }
  ],
  screenName: "  Safe Workspace  ",
  refreshSeconds: 30,
  portfolioView: true,
  watchlists: { "My List": ["NVDA", "M&M.NS"] }
};
const safe = sanitizeBackup(hostile);
assert.deepEqual(safe.watchlist, ["NVDA", "M&M.NS"]);
assert.equal(safe.alerts.length, 2);
assert.equal(safe.portfolio.length, 2);
assert.equal(safe.portfolio.some(h => h.symbol === "RELIANCE.NS"), true);
assert.equal(safe.screenName, "Safe Workspace");

const recovered = sanitizeLocalState({
  tickers: "not-an-array", order: null, alerts: null, screenName: null,
  refreshSeconds: 999, portfolio: null, portfolioView: "yes", watchlists: null,
  activeWatchlist: "Unknown"
});
assert.equal(recovered.screenName, "Market Watch");
assert.equal(recovered.refreshSeconds, 30);
assert.equal(recovered.activeWatchlist, "All Stocks");

console.log("Extended input/persistence security tests passed.");
