/** Polls normalized market APIs and evaluates local alert rules on each refresh. */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistory, fetchQuotes } from "../services/marketService";
import { currencySymbol, fmt } from "../lib/utils";

export function useMarketData({ tickers, alerts, setAlerts, refreshSeconds, notificationsEnabled, soundEnabled, paused }) {
  const [quotes, setQuotes] = useState({});
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [triggered, setTriggered] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(refreshSeconds);
  const previousPrices = useRef({});

  const fetchMarketData = useCallback(async (symbols = tickers) => {
    if (!symbols.length) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchQuotes(symbols);
      const next = Object.fromEntries((data.quotes || []).map(q => [q.symbol, q]));
      setQuotes(next);
      setLastUpdated(data.fetchedAt ? new Date(data.fetchedAt) : new Date());

      const results = await Promise.all(symbols.map(async symbol => {
        try {
          const d = await fetchHistory(symbol, "1d");
          return [symbol, { points: d.points || [], timestamps: d.timestamps || [] }];
        } catch {
          return [symbol, { points: [], timestamps: [] }];
        }
      }));
      setHistory(Object.fromEntries(results));

      const newlyTriggered = [];
      const nextAlerts = alerts.map(a => {
        const q = next[a.symbol];
        if (!q || q.currentPrice == null) return a;
        const price = q.currentPrice;

        if (a.kind === "trailing") {
          const pct = Math.max(0.01, Number(a.percent));
          const peak = Math.max(a.peakPrice ?? a.anchor ?? price, price);
          const trough = Math.min(a.troughPrice ?? a.anchor ?? price, price);
          const triggerPrice = a.direction === "below" ? peak * (1 - pct / 100) : trough * (1 + pct / 100);
          const previous = previousPrices.current[a.symbol];
          const crossedNow = previous != null && (
            a.direction === "below" ? previous > triggerPrice && price <= triggerPrice : previous < triggerPrice && price >= triggerPrice
          );
          const nextAlert = { ...a, peakPrice: peak, troughPrice: trough, triggerPrice };
          if (crossedNow && a.armed) {
            newlyTriggered.push({ ...nextAlert, currentPrice: price });
            return { ...nextAlert, armed: false };
          }
          const rearm = a.direction === "below" ? price > triggerPrice : price < triggerPrice;
          return rearm ? { ...nextAlert, armed: true } : nextAlert;
        }

        const crossedNow = previousPrices.current[a.symbol] != null && (
          a.direction === "above"
            ? previousPrices.current[a.symbol] < a.price && price >= a.price
            : previousPrices.current[a.symbol] > a.price && price <= a.price
        );
        if (crossedNow && a.armed) {
          newlyTriggered.push({ ...a, currentPrice: price });
          return { ...a, armed: false };
        }
        return { ...a, armed: a.direction === "above" ? price < a.price : price > a.price };
      });

      previousPrices.current = Object.fromEntries(Object.values(next).map(q => [q.symbol, q.currentPrice]));
      setAlerts(nextAlerts);

      if (newlyTriggered.length) {
        setTriggered(prev => [...newlyTriggered, ...prev].slice(0, 8));

        if (soundEnabled && typeof window !== "undefined") {
          try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
              const ctx = new AudioContextClass();
              const now = ctx.currentTime;
              [0, 0.16].forEach((offset, index) => {
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();
                oscillator.type = "sine";
                oscillator.frequency.value = index === 0 ? 880 : 1175;
                gain.gain.setValueAtTime(0.0001, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start(now + offset);
                oscillator.stop(now + offset + 0.14);
              });
              window.setTimeout(() => ctx.close().catch(() => {}), 500);
            }
          } catch {
            // Audio is a best-effort enhancement; browser autoplay policy may block it.
          }
        }

        if (notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
          newlyTriggered.forEach(a => {
            const q = next[a.symbol];
            const label = a.kind === "trailing"
              ? `${a.symbol} ${a.direction === "below" ? "dropped" : "rose"} ${fmt(a.percent)}% from its trailing reference`
              : `${a.symbol} crossed ${a.direction === "above" ? "above" : "below"} ${currencySymbol(q?.currency)}${fmt(a.price)}`;
            new Notification("Market Watch alert", {
              body: `${label}. Current: ${currencySymbol(q?.currency)}${fmt(a.currentPrice)}`
            });
          });
        }
      }
      setSecondsLeft(refreshSeconds);
    } catch (e) {
      setError(e.message || "Market data request failed.");
    } finally {
      setLoading(false);
    }
  }, [tickers, alerts, setAlerts, refreshSeconds, notificationsEnabled]);

  const fetchRef = useRef(fetchMarketData);
  useEffect(() => { fetchRef.current = fetchMarketData; }, [fetchMarketData]);

  useEffect(() => {
    // Always fetch once when the app/watchlist is loaded, even if automatic
    // polling is paused for a weekend or by the user. The pause controls
    // subsequent automatic refreshes; it must never prevent the dashboard
    // from hydrating with the latest available quote data.
    if (tickers.length) fetchRef.current(tickers);
    // The data callback depends on alerts by design; initial refresh should
    // follow the watchlist, not re-run after every alert state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join("|")]);

  useEffect(() => {
    setSecondsLeft(refreshSeconds);
    const timer = setInterval(() => setSecondsLeft(s => {
      if (paused) return s;
      if (s <= 1) {
        fetchRef.current(tickers);
        return refreshSeconds;
      }
      return s - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [fetchMarketData, tickers, refreshSeconds, paused]);

  return { quotes, history, loading, error, setError, lastUpdated, triggered, setTriggered,
    secondsLeft, setSecondsLeft, fetchMarketData };
}
