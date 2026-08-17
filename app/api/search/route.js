/**
 * Public search API boundary.
 * Keep validation, provider calls and response normalization server-side.
 */
import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { apiError, createTtlCache, rateLimit } from "../../../lib/api-security.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();
const TTL = 10 * 60 * 1000;
const cache = globalThis.__marketWatchSearchCache ?? createTtlCache();
globalThis.__marketWatchSearchCache = cache;

export async function GET(request) {
  const retryAfter = rateLimit(request, "search", 30);
  if (retryAfter) return apiError(NextResponse, "Too many search requests. Please slow down.", 429, retryAfter);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const key = q.toUpperCase();
  const cached = cache.get(key, TTL);
  if (cached) return NextResponse.json(cached);

  try {
    const result = await yahooFinance.search(q);
    let rawQuotes = result?.quotes || [];

    // Yahoo search can occasionally miss punctuation-heavy Indian symbols. Keep this
    // provider-specific compatibility rule explicit and isolated to the search layer.
    if (key === "M&M" && !rawQuotes.some(x => x.symbol === "M&M.NS")) {
      rawQuotes = [{ symbol: "M&M.NS", longname: "Mahindra & Mahindra Limited", shortname: "Mahindra & Mahindra", exchange: "NSE", quoteType: "EQUITY" }, ...rawQuotes];
    }

    const results = rawQuotes
      .filter(x => x.symbol && ["EQUITY", "ETF", "MUTUALFUND", "INDEX"].includes(x.quoteType))
      .slice(0, 10)
      .map(x => ({ symbol: x.symbol, name: x.longname || x.shortname || x.symbol, exchange: x.exchange || x.exchDisp || "", type: x.quoteType || "" }));
    const data = { results };
    cache.set(key, data);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Search provider request failed", { name: error?.name, message: error?.message });
    return NextResponse.json({ results: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
