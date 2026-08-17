/**
 * Public quotes API boundary.
 * Keep validation, provider calls and response normalization server-side.
 */
import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import {
  apiError,
  createTtlCache,
  normalizeSymbol,
  rateLimit
} from "../../../lib/api-security.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();

const CACHE_TTL_MS = 15_000;
const MAX_SYMBOLS = 40;
const MAX_FALLBACK_REQUESTS = 40;

const cache = globalThis.__marketWatchQuoteCache ?? createTtlCache();
globalThis.__marketWatchQuoteCache = cache;

function num(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

/** Convert provider data into the small, stable contract consumed by the browser. */
function normalize(q) {
  const previousClose = num(
    q.regularMarketPreviousClose ?? q.previousClose
  );

  const currentPrice = num(
    q.regularMarketPrice ?? q.price
  );

  const change =
    num(q.regularMarketChange) ??
    (currentPrice != null && previousClose != null
      ? currentPrice - previousClose
      : null);

  const changePercent =
    num(q.regularMarketChangePercent) ??
    (change != null && previousClose
      ? (change / previousClose) * 100
      : null);

  return {
    symbol: q.symbol,
    shortName: q.shortName ?? q.displayName ?? q.longName ?? q.symbol,
    longName: q.longName ?? q.displayName ?? q.shortName ?? q.symbol,
    exchange: q.exchange ?? q.fullExchangeName ?? "",
    fullExchangeName: q.fullExchangeName ?? q.exchange ?? "",
    currency: q.currency ?? "USD",
    marketState: q.marketState ?? "CLOSED",

    currentPrice,
    previousClose,

    change,
    changePercent,

    preMarketPrice: num(q.preMarketPrice),
    preMarketChange: num(q.preMarketChange),
    preMarketChangePercent: num(q.preMarketChangePercent),

    postMarketPrice: num(q.postMarketPrice),
    postMarketChange: num(q.postMarketChange),
    postMarketChangePercent: num(q.postMarketChangePercent),

    open: num(q.regularMarketOpen),
    dayHigh: num(q.regularMarketDayHigh),
    dayLow: num(q.regularMarketDayLow),

    volume: num(q.regularMarketVolume),
    averageVolume: num(q.averageDailyVolume3Month),
    marketCap: num(q.marketCap),

    dividendRate: num(q.dividendRate),
    dividendYield: num(q.dividendYield),

    quoteType: q.quoteType ?? "",
    timestamp: q.regularMarketTime ?? null
  };
}

/**
 * Fetch a single missing symbol as a fallback.
 *
 * Yahoo Finance can occasionally return partial results when multiple
 * symbols are requested together. Individual fallback requests make
 * the public API much more reliable without requiring the browser
 * to know anything about the provider.
 */
async function fetchFallbackQuote(symbol) {
  try {
    const result = await yahooFinance.quote(symbol);
    const array = Array.isArray(result) ? result : [result];

    const quote = array
      .map(normalize)
      .find(q => q.symbol === symbol);

    return quote ?? null;
  } catch (error) {
    console.warn("Fallback quote request failed", {
      symbol,
      name: error?.name,
      message: error?.message
    });

    return null;
  }
}

export async function GET(request) {
  const retryAfter = rateLimit(request, "quotes", 60);

  if (retryAfter) {
    return apiError(
      NextResponse,
      "Too many quote requests. Please slow down.",
      429,
      retryAfter
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("symbols") ?? "";

  if (raw.length > 1_000) {
    return apiError(
      NextResponse,
      "Symbol request is too large.",
      400
    );
  }

  const symbols = [
    ...new Set(
      raw
        .split(",")
        .map(normalizeSymbol)
        .filter(Boolean)
    )
  ]
    .slice(0, MAX_SYMBOLS)
    .sort();

  if (!symbols.length) {
    return apiError(
      NextResponse,
      "At least one valid symbol is required.",
      400
    );
  }

  const cacheKey = symbols.join(",");
  const cached = cache.get(cacheKey, CACHE_TTL_MS);

  if (cached) {
    return NextResponse.json(
      { ...cached, cached: true },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    /*
     * First attempt: request the complete watchlist in one provider call.
     */
    const result = await yahooFinance.quote(symbols);

    const array = Array.isArray(result)
      ? result
      : [result];

    const normalized = array
      .map(normalize)
      .filter(q => q.symbol);

    const quoteMap = new Map(
      normalized.map(q => [q.symbol, q])
    );

    /*
     * Identify symbols Yahoo did not return.
     */
    const missingSymbols = symbols.filter(
      symbol => !quoteMap.has(symbol)
    );

    /*
     * Fallback: individually request symbols missing from the
     * initial multi-symbol response.
     *
     * This is deliberately bounded by MAX_FALLBACK_REQUESTS.
     */
    if (missingSymbols.length) {
      const fallbackSymbols = missingSymbols.slice(
        0,
        MAX_FALLBACK_REQUESTS
      );

      const fallbackResults = await Promise.all(
        fallbackSymbols.map(fetchFallbackQuote)
      );

      fallbackResults.forEach(quote => {
        if (quote?.symbol) {
          quoteMap.set(quote.symbol, quote);
        }
      });
    }

    const quotes = symbols
      .map(symbol => quoteMap.get(symbol))
      .filter(Boolean);

    if (!quotes.length) {
      return apiError(
        NextResponse,
        "No quote data returned.",
        502
      );
    }

    const unresolvedSymbols = symbols.filter(
      symbol => !quoteMap.has(symbol)
    );

    const data = {
      quotes,
      fetchedAt: new Date().toISOString(),
      cached: false,

      /*
       * Useful for the client to know whether this was a complete
       * response. This is not an error by itself because a symbol
       * may genuinely be invalid/unavailable.
       */
      complete: unresolvedSymbols.length === 0,
      missingSymbols: unresolvedSymbols
    };

    /*
     * IMPORTANT:
     *
     * Only cache a complete response.
     *
     * A partial response must never be cached, otherwise a temporary
     * provider omission can persist for the entire cache TTL.
     */
    if (unresolvedSymbols.length === 0) {
      cache.set(cacheKey, data);
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Quote provider request failed", {
      name: error?.name,
      message: error?.message
    });

    return apiError(
      NextResponse,
      "Market-data provider temporarily unavailable. Please try again shortly.",
      502
    );
  }
}
