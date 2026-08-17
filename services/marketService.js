/**
 * Market data service.
 *
 * Components/hooks call these functions instead of constructing provider URLs.
 * This keeps transport concerns centralized and makes it straightforward to
 * replace the current provider without changing UI code.
 */

async function getJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Market data request failed.");
  return data;
}

export async function fetchQuotes(symbols) {
  if (!symbols?.length) return { quotes: [], fetchedAt: null };
  return getJson(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
}

export async function fetchHistory(symbol, range = "1d") {
  return getJson(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`);
}

export async function searchSymbols(query) {
  return getJson(`/api/search?q=${encodeURIComponent(query)}`);
}
