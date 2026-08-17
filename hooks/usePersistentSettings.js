/** Owns browser-local application settings and keeps serialization out of UI components. */
import { useEffect, useState } from "react";
import { DEFAULT_TICKERS, REFRESH_OPTIONS, REFRESH_SECONDS, STORAGE_KEYS } from "../lib/constants";
import { load, save, sanitizeLocalState } from "../lib/utils";

export function usePersistentSettings() {
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [alerts, setAlerts] = useState([]);
  const [refreshSeconds, setRefreshSeconds] = useState(REFRESH_SECONDS);
  const [screenName, setScreenName] = useState("Market Watch");
  const [portfolioView, setPortfolioView] = useState(false);
  const [portfolio, setPortfolio] = useState([]);
  const [portfolioOpen, setPortfolioOpen] = useState(true);
  const [watchlists, setWatchlists] = useState({});
  const [activeWatchlist, setActiveWatchlist] = useState("All Stocks");
  const [order, setOrder] = useState(DEFAULT_TICKERS);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const safe = sanitizeLocalState({
      tickers: load(STORAGE_KEYS.tickers, DEFAULT_TICKERS),
      order: load(STORAGE_KEYS.order, DEFAULT_TICKERS),
      alerts: load(STORAGE_KEYS.alerts, []),
      refreshSeconds: load(STORAGE_KEYS.refresh, REFRESH_SECONDS),
      screenName: load(STORAGE_KEYS.screenName, "Market Watch"),
      portfolio: load(STORAGE_KEYS.portfolio, []),
      portfolioView: load(STORAGE_KEYS.portfolioView, false),
      watchlists: load(STORAGE_KEYS.watchlists, {}),
      activeWatchlist: load(STORAGE_KEYS.activeWatchlist, "All Stocks")
    });

    setTickers(safe.watchlist);
    setAlerts(safe.alerts);
    setOrder(safe.order);
    setRefreshSeconds(safe.refreshSeconds);
    setScreenName(safe.screenName);
    setPortfolio(safe.portfolio);
    setPortfolioView(safe.portfolioView);
    setWatchlists(safe.watchlists);
    setActiveWatchlist(safe.activeWatchlist);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    save(STORAGE_KEYS.tickers, tickers);
    save(STORAGE_KEYS.order, order);
    save(STORAGE_KEYS.alerts, alerts);
    save(STORAGE_KEYS.refresh, refreshSeconds);
    save(STORAGE_KEYS.screenName, screenName);
    save(STORAGE_KEYS.portfolio, portfolio);
    save(STORAGE_KEYS.portfolioView, portfolioView);
    save(STORAGE_KEYS.watchlists, watchlists);
    save(STORAGE_KEYS.activeWatchlist, activeWatchlist);
  }, [storageReady, tickers, order, alerts, refreshSeconds, screenName, portfolio, portfolioView, watchlists, activeWatchlist]);

  return {
    tickers, setTickers, alerts, setAlerts, refreshSeconds, setRefreshSeconds,
    screenName, setScreenName, portfolioView, setPortfolioView, portfolio, setPortfolio,
    portfolioOpen, setPortfolioOpen, watchlists, setWatchlists,
    activeWatchlist, setActiveWatchlist, order, setOrder, storageReady
  };
}
