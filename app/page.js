/**
 * Market Watch application shell.
 *
 * The page owns orchestration and UI state; persistent state, market transport,
 * analytics and reusable visual components live in dedicated modules.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveUserSymbol, createId, exchangeName } from "../lib/utils";
import { usePersistentSettings } from "../hooks/usePersistentSettings";
import { useStockSearch } from "../hooks/useStockSearch";
import { useMarketData } from "../hooks/useMarketData";
import { usePortfolioAnalytics } from "../hooks/usePortfolioAnalytics";
import { AlertBanner } from "./components/AlertBanner.jsx";
import { ConfigPanel } from "./components/ConfigPanel.jsx";
import { DetailModal } from "./components/DetailModal.jsx";
import { GlobalMarketStatus } from "./components/GlobalMarketStatus.jsx";
import { MarketGrid } from "./components/MarketGrid.jsx";
import { PortfolioPanel } from "./components/PortfolioPanel.jsx";
export default function Home() {
  const {
    tickers, setTickers, alerts, setAlerts, refreshSeconds, setRefreshSeconds,
    screenName, setScreenName, portfolioView, setPortfolioView, portfolio, setPortfolio,
    portfolioOpen, setPortfolioOpen, watchlists, setWatchlists,
    activeWatchlist, setActiveWatchlist, order, setOrder, storageReady
  } = usePersistentSettings();

  const [configOpen, setConfigOpen] = useState(false);
  const [configSnapshot, setConfigSnapshot] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [refreshPaused, setRefreshPaused] = useState(false);
  const [weekendResume, setWeekendResume] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [groupByExchange, setGroupByExchange] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("order");
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [alertTicker, setAlertTicker] = useState("");
  const [alertDirection, setAlertDirection] = useState("above");
  const [alertPrice, setAlertPrice] = useState("");
  const dragSymbol = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isWeekend = useMemo(() => {
    const utcDay = new Date(clock).getUTCDay();
    return utcDay === 0 || utcDay === 6;
  }, [clock]);

  useEffect(() => {
    if (!isWeekend) setWeekendResume(false);
  }, [isWeekend]);

  // Global major-market week starts at 00:00 UTC Monday (Tokyo session is
  // already opening shortly after this boundary). Users can manually resume
  // during the weekend if they want to refresh on demand.
  const autoWeekendPaused = isWeekend && !weekendResume;
  const effectiveRefreshPaused = refreshPaused || autoWeekendPaused;

  const { input, suggestions, runSearch, searchNow, clearSearch } = useStockSearch();
  const marketSymbols = useMemo(
    () => [...new Set([...tickers, ...portfolio.map(h => h.symbol).filter(Boolean)])],
    [tickers, portfolio]
  );

  const {
    quotes, history, loading, error, setError, lastUpdated, triggered, setTriggered,
    secondsLeft, setSecondsLeft, fetchMarketData
  } = useMarketData({
    tickers: marketSymbols,
    alerts,
    setAlerts,
    refreshSeconds,
    notificationsEnabled,
    soundEnabled,
    paused: effectiveRefreshPaused,
    storageReady
  });
  const fetchQuotes = fetchMarketData;

  const { portfolioGroups, portfolioTotals } = usePortfolioAnalytics({
    portfolio, quotes, alerts
  });

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);
  useEffect(() => {
    if (tickers.length && !tickers.includes(alertTicker)) setAlertTicker(tickers[0]);
  }, [tickers, alertTicker]);

  const openConfig = () => {
    setConfigSnapshot({
      tickers: [...tickers],
      order: [...order],
      alerts: structuredClone(alerts),
      screenName,
      refreshSeconds,
      portfolio: structuredClone(portfolio),
      portfolioView,
      watchlists: structuredClone(watchlists),
      notificationsEnabled,
      soundEnabled
    });
    setConfigOpen(true);
  };

  const cancelConfig = () => {
    if (configSnapshot) {
      setTickers(configSnapshot.tickers);
      setOrder(configSnapshot.order);
      setAlerts(configSnapshot.alerts);
      setScreenName(configSnapshot.screenName);
      setRefreshSeconds(configSnapshot.refreshSeconds);
      setPortfolio(configSnapshot.portfolio);
      setPortfolioView(configSnapshot.portfolioView);
      setWatchlists(configSnapshot.watchlists);
      setNotificationsEnabled(configSnapshot.notificationsEnabled);
      setSoundEnabled(configSnapshot.soundEnabled);
    }
    setConfigOpen(false);
    setConfigSnapshot(null);
  };

  const saveConfig = () => {
    setConfigOpen(false);
    setConfigSnapshot(null);
  };

  const addTicker = async (symbol, trusted = false) => {
    const normalized = resolveUserSymbol(symbol || input);
    if (!normalized) return false;
    if (!/^[A-Z0-9^._=&-]{1,24}$/.test(normalized)) {
      setError("Use a valid stock symbol or select a company from the search results.");
      return false;
    }

    if (!trusted && !tickers.includes(normalized)) {
      const results = await searchNow(symbol || input);
      const exact = results.some(r => String(r.symbol || "").toUpperCase() === normalized);
      if (!exact) {
        setError("That stock symbol could not be verified. Select a valid result from Search.");
        return false;
      }
    }

    if (!tickers.includes(normalized)) {
      setTickers(prev => [...prev, normalized]);
      setOrder(prev => [...prev, normalized]);
    }
    clearSearch();
    setError("");
    return true;
  };

  const removeTicker = symbol => {
    setTickers(prev => prev.filter(s => s !== symbol));
    setOrder(prev => prev.filter(s => s !== symbol));
    setAlerts(prev => prev.filter(a => a.symbol !== symbol));
    setTriggered(prev => prev.filter(a => a.symbol !== symbol));
    setWatchlists(prev => Object.fromEntries(Object.entries(prev).map(([name, symbols]) => [name, symbols.filter(s => s !== symbol)])));
  };

  const addAlert = () => {
    const price = Number(alertPrice);
    if (!alertTicker || !["above", "below"].includes(alertDirection) || !Number.isFinite(price) || price <= 0) {
      setError("Enter a valid positive alert price.");
      return;
    }
    setAlerts(prev => [...prev, { id: createId(), symbol: alertTicker, direction: alertDirection, price, armed: true }]);
    setAlertPrice("");
  };

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setError("Browser notifications are not supported by this browser.");
      return;
    }
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      setError("");
    } else {
      setError("Notifications were not enabled. You can change this in your browser site settings.");
    }
  };


  const removeFromWatchlist = symbol => {
    const name = activeWatchlist || "All Stocks";
    setWatchlists(prev => ({ ...prev, [name]: (prev[name] || []).filter(s => s !== symbol) }));
  };

  const createWatchlist = () => {
    const name = window.prompt("Name your watchlist", "My Watchlist");
    if (!name?.trim()) return;
    const clean = name.trim().slice(0, 32);
    setWatchlists(prev => ({ ...prev, [clean]: prev[clean] || [] }));
    setActiveWatchlist(clean);
  };

  const deleteWatchlist = name => {
    if (name === "All Stocks") return;
    setWatchlists(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setActiveWatchlist("All Stocks");
  };

  const addCardAlert = alert => {
    setAlerts(prev => [...prev, { id: createId(), ...alert, armed: alert.armed ?? true }]);
  };
  const removeAlert = id => setAlerts(prev => prev.filter(a => a.id !== id));

  const addHolding = async (symbolInput, trusted = false) => {
    const normalized = resolveUserSymbol(symbolInput || "");

    if (!normalized || !/^[A-Z0-9^._=&-]{1,24}$/.test(normalized)) {
      setError("Enter a valid stock symbol.");
      return false;
    }

    if (!trusted) {
      const results = await searchNow(normalized);
      const exact = results.some(
        r => String(r.symbol || "").toUpperCase() === normalized
      );
      if (!exact) {
        setError("That stock could not be verified. Select a valid search result.");
        return false;
      }
    }

    if (portfolio.some(h => h.symbol === normalized)) {
      setError("That stock is already in your holdings.");
      return false;
    }

    setPortfolio(prev => [...prev, {
      id: createId(),
      symbol: normalized,
      shares: 1,
      buyPrice: ""
    }]);
    setError("");
    return true;
  };

  const updateHolding = (id, field, value) => {
    if (!["shares", "buyPrice"].includes(field)) return;

    // Keep an empty string while the user edits the field. Converting ""
    // immediately to Number("") -> 0 prevents normal replacement of the
    // default value in a controlled numeric input.
    if (value === "") {
      setPortfolio(prev => prev.map(h => h.id === id ? { ...h, [field]: "" } : h));
      return;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return;

    setPortfolio(prev => prev.map(h => h.id === id ? { ...h, [field]: numeric } : h));
  };
  const removeHolding = id => setPortfolio(prev => prev.filter(h => h.id !== id));

  const dragHandlers = {
    start: symbol => { dragSymbol.current = symbol; },
    over: () => { },
    drop: target => {
      const source = dragSymbol.current;
      if (!source || source === target) return;
      setOrder(prev => {
        const next = [...prev];
        const from = next.indexOf(source), to = next.indexOf(target);
        if (from < 0 || to < 0) return prev;
        next.splice(from, 1); next.splice(to, 0, source); return next;
      });
      dragSymbol.current = null;
    },
    end: () => { dragSymbol.current = null; }
  };

  const visibleSymbols = useMemo(() => {
    const activeSymbols = activeWatchlist === "All Stocks" ? [] :
      (Array.isArray(watchlists?.[activeWatchlist]) ? watchlists[activeWatchlist] : []);
    const watchSymbols = activeWatchlist === "All Stocks" ? null : new Set(activeSymbols);
    let result = order.filter(s => tickers.includes(s) && (!watchSymbols || watchSymbols.has(s)));
    if (filter !== "ALL") result = result.filter(s => exchangeName(quotes[s] || { symbol: s }) === filter);
    if (sortBy === "symbol") result.sort();
    if (sortBy === "change") result.sort((a, b) => (quotes[b]?.changePercent ?? -Infinity) - (quotes[a]?.changePercent ?? -Infinity));
    if (sortBy === "price") result.sort((a, b) => (quotes[b]?.currentPrice ?? -Infinity) - (quotes[a]?.currentPrice ?? -Infinity));
    return result;
  }, [order, tickers, filter, sortBy, quotes, activeWatchlist, watchlists]);

  const selectedQuote = selectedSymbol ? quotes[selectedSymbol] : null;
  const marketSummary = useMemo(() => {
    const values = Object.values(quotes);
    if (values.some(q => q.marketState === "REGULAR")) return { label: "Markets active", tone: "live" };
    if (values.some(q => q.marketState === "PRE")) return { label: "Pre-market active", tone: "extended" };
    if (values.some(q => q.marketState === "POST")) return { label: "After-hours active", tone: "extended" };
    return { label: "Markets closed", tone: "closed" };
  }, [quotes]);

  return (
    <main>
      <header className="header">
        <div><div className="brand">📈 {screenName}</div><div className="subtitle">Global Exchanges</div></div>
        <div className="headerActions">
          <div className={`connection ${loading ? "loading" : "live"}`}><span className="statusDot" /> {loading ? "Updating" : "Live"}</div>
          <div className="countdown">{refreshPaused ? <b>Auto-refresh paused</b> : <>Refresh in <b>{secondsLeft}s</b></>}</div>
          <button className="primaryBtn" onClick={() => fetchQuotes(marketSymbols)}>↻ Refresh</button>
          <button className="secondaryBtn" onClick={openConfig}>⚙ Configure</button>
          <button className="secondaryBtn" onClick={() => {
            if (autoWeekendPaused) {
              setWeekendResume(true);
            } else {
              setRefreshPaused(v => !v);
            }
          }} title={effectiveRefreshPaused ? "Resume automatic refresh" : "Pause automatic refresh"}>
            {effectiveRefreshPaused ? "▶ Resume" : "Ⅱ Pause"}
          </button>
        </div>
      </header>

      <AlertBanner triggered={triggered} quotes={quotes}
        onDismiss={i => setTriggered(prev => prev.filter((_, idx) => idx !== i))} />



      <GlobalMarketStatus quotes={quotes} lastUpdated={lastUpdated} />

      <section className="summaryBar">
        <div><span className={`marketPill ${marketSummary.tone}`}><span className="statusDot" /> {marketSummary.label}</span>{lastUpdated && <span className="updated">Updated {lastUpdated.toLocaleTimeString()}</span>}</div>
        <div className="toolbar">
          <div className="filters">
            {["ALL", ...[...new Set(Object.values(quotes).map(exchangeName))].sort()].map(f => (
              <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
                {f === "ALL" ? "ALL" : f}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="order">My order</option><option value="symbol">Symbol</option>
            <option value="change">Change %</option><option value="price">Price</option>
          </select>
          <button className={`secondaryBtn ${groupByExchange ? "active" : ""}`} onClick={() => setGroupByExchange(v => !v)}>
            {groupByExchange ? "Grouped by Exchange" : "Group by Exchange"}
          </button>
        </div>
      </section>

      {error && <div className="errorBox">⚠ {error}</div>}

      <div className={`marketLayout ${portfolioView ? "withPortfolio" : ""} ${portfolioView && !portfolioOpen ? "portfolioCollapsed" : ""}`}>
        {portfolioView && <PortfolioPanel groups={portfolioGroups} totals={portfolioTotals} open={portfolioOpen} setOpen={setPortfolioOpen} />}
        <MarketGrid
          symbols={visibleSymbols} quotes={quotes} alerts={alerts}
          onRemove={removeTicker} onOpen={setSelectedSymbol} onAddAlert={addCardAlert}
          history={history} dragHandlers={dragHandlers}
          tickersCount={tickers.length}
          input={input} runSearch={runSearch} suggestions={suggestions} addTicker={addTicker}
          groupByExchange={groupByExchange}
        />
      </div>







      {configOpen && (
        <ConfigPanel
          open={configOpen}
          screenName={screenName} setScreenName={setScreenName}
          portfolioView={portfolioView} setPortfolioView={setPortfolioView}
          notificationsEnabled={notificationsEnabled} enableNotifications={enableNotifications}
          setNotificationsEnabled={setNotificationsEnabled}
          soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled}
          input={input} runSearch={runSearch} suggestions={suggestions} addTicker={addTicker}
          tickers={tickers} order={order} removeTicker={removeTicker}
          activeWatchlist={activeWatchlist} setActiveWatchlist={setActiveWatchlist}
          watchlists={watchlists} createWatchlist={createWatchlist} deleteWatchlist={deleteWatchlist}
          refreshSeconds={refreshSeconds} setRefreshSeconds={setRefreshSeconds} setSecondsLeft={setSecondsLeft}
          portfolio={portfolio} updateHolding={updateHolding} removeHolding={removeHolding} addHolding={addHolding}
          alerts={alerts} alertTicker={alertTicker} setAlertTicker={setAlertTicker}
          alertDirection={alertDirection} setAlertDirection={setAlertDirection}
          alertPrice={alertPrice} setAlertPrice={setAlertPrice} addAlert={addAlert} removeAlert={removeAlert}
          setTickers={setTickers} setOrder={setOrder} setAlerts={setAlerts} setError={setError}
          setPortfolio={setPortfolio}
          setWatchlists={setWatchlists}
          onSave={saveConfig} onCancel={cancelConfig} onClose={cancelConfig}
        />
      )}

      <footer><span>{screenName}</span><span>{effectiveRefreshPaused ? (autoWeekendPaused ? "Auto-refresh paused for weekend" : "Auto-refresh paused") : `${refreshSeconds}-second refresh`}</span><span>Indicative market data · Verify directly with Stock Exchange for accurate information</span><span>Created by Prasad Yoganarasimha</span></footer>

      {selectedQuote && <DetailModal q={selectedQuote} onClose={() => setSelectedSymbol(null)} />}
    </main>
  );
}
