/**
 * Public history API boundary.
 * Keep validation, provider calls and response normalization server-side.
 */
import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { apiError, createTtlCache, normalizeSymbol, rateLimit } from "../../../lib/api-security.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();
const TTL = 30_000;
const cache = globalThis.__marketWatchHistoryCache ?? createTtlCache();
globalThis.__marketWatchHistoryCache = cache;

const CONFIG = Object.freeze({
  "1d": { days: 1, interval: "5m", maxPoints: 160 },
  "5d": { days: 5, interval: "15m", maxPoints: 300 },
  "1m": { days: 31, interval: "1h", maxPoints: 300 },
  "6m": { days: 183, interval: "1d", maxPoints: 300 },
  "1y": { days: 366, interval: "1d", maxPoints: 300 }
});

export async function GET(request) {
  const retryAfter = rateLimit(request, "history", 120);
  if (retryAfter) return apiError(NextResponse, "Too many chart requests. Please slow down.", 429, retryAfter);

  const { searchParams } = new URL(request.url);
  const symbol = normalizeSymbol(searchParams.get("symbol"));
  const range = (searchParams.get("range") || "1d").toLowerCase();
  if (!symbol) return apiError(NextResponse, "Invalid symbol.", 400);
  if (!CONFIG[range]) return apiError(NextResponse, "Unsupported range.", 400);

  const key = `${symbol}:${range}`;
  const cached = cache.get(key, TTL);
  if (cached) return NextResponse.json(cached);

  try {
    const cfg = CONFIG[range];

    // Ask the provider for a wider window for 1D so the chart still has a
    // valid session to display when launched on a weekend or market holiday.
    const queryDays = range === "1d" ? 5 : cfg.days;
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - queryDays * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: cfg.interval,
      includePrePost: range === "1d"
    });

    let series = (result?.quotes || [])
      .map(x => ({
        time: x.date instanceof Date ? x.date.getTime() : new Date(x.date).getTime(),
        close: x.close
      }))
      .filter(x =>
        Number.isFinite(x.time) &&
        typeof x.close === "number" &&
        Number.isFinite(x.close)
      )
      .sort((a, b) => a.time - b.time);

    if (range === "1d" && series.length) {
      // "1D" means the latest available trading session, not the last
      // 24 clock hours. This makes Friday data available when opened on
      // Saturday/Sunday/holiday.
      const latest = series[series.length - 1].time;
      const sessionStart = latest - 24 * 60 * 60 * 1000;
      series = series.filter(x => x.time >= sessionStart);
    }

    let sampled = series;
    if (series.length > cfg.maxPoints) {
      const step = (series.length - 1) / (cfg.maxPoints - 1);
      const indexes = Array.from({ length: cfg.maxPoints }, (_, i) =>
        Math.round(i * step)
      );
      sampled = indexes.map(i => series[i]);
    }
    const data = {
      symbol,
      range,
      points: sampled.map(x => x.close),
      timestamps: sampled.map(x => x.time)
    };
    cache.set(key, data);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("History provider request failed", { name: error?.name, message: error?.message, symbol, range });
    // Chart failure is non-fatal for the rest of the dashboard, so preserve the original
    // graceful-degradation contract instead of turning a chart outage into a page failure.
    return NextResponse.json({ symbol, range, points: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
