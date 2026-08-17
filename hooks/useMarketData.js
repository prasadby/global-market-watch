/** Polls normalized market APIs and evaluates local alert rules on each refresh. */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistory, fetchQuotes } from "../services/marketService";
import { currencySymbol, fmt } from "../lib/utils";

export function useMarketData({
  tickers,
  alerts,
  setAlerts,
  refreshSeconds,
  notificationsEnabled,
  soundEnabled,
  paused,
  storageReady
}) {
  const [quotes, setQuotes] = useState({});
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [triggered, setTriggered] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(refreshSeconds);

  const previousPrices = useRef({});
  const activeFetchRef = useRef(false);
  const queuedFetchRef = useRef(null);

  const fetchMarketData = useCallback(
    async (symbols = tickers) => {
      if (!storageReady || !symbols?.length) return;

      /*
       * If another refresh is already running, remember the latest
       * requested symbol set and run it after the current refresh.
       *
       * This is important during startup because persisted settings can
       * finish hydrating while an earlier refresh is still in progress.
       */
      if (activeFetchRef.current) {
        queuedFetchRef.current = [...symbols];
        return;
      }

      activeFetchRef.current = true;
      setLoading(true);
      setError("");

      try {
        /*
         * ---------------------------------------------------------------
         * 1. Fetch current quotes
         * ---------------------------------------------------------------
         */
        const data = await fetchQuotes(symbols);

        const next = Object.fromEntries(
          (data.quotes || []).map(q => [q.symbol, q])
        );

        /*
         * Never replace the entire quote state with a potentially partial
         * provider response.
         */
        setQuotes(prev => ({
          ...prev,
          ...next
        }));

        /*
         * Server-side API normally resolves missing symbols itself.
         * This is an additional client-side safety net.
         */
        const missingSymbols = Array.isArray(data.missingSymbols)
          ? data.missingSymbols.filter(symbol => !next[symbol])
          : [];

        if (missingSymbols.length) {
          try {
            const retryData = await fetchQuotes(missingSymbols);

            const retryQuotes = Object.fromEntries(
              (retryData.quotes || []).map(q => [q.symbol, q])
            );

            if (Object.keys(retryQuotes).length) {
              setQuotes(prev => ({
                ...prev,
                ...retryQuotes
              }));

              Object.assign(next, retryQuotes);
            }
          } catch {
            /*
             * Leave unresolved symbols alone.
             * The next scheduled refresh will retry them.
             */
          }
        }

        setLastUpdated(
          data.fetchedAt
            ? new Date(data.fetchedAt)
            : new Date()
        );

        /*
         * ---------------------------------------------------------------
         * 2. Fetch history
         * ---------------------------------------------------------------
         *
         * History is independent of quote loading. A history failure
         * must never prevent current prices from being displayed.
         */
        const results = await Promise.all(
          symbols.map(async symbol => {
            try {
              const d = await fetchHistory(symbol, "1d");

              return [
                symbol,
                {
                  points: d.points || [],
                  timestamps: d.timestamps || []
                }
              ];
            } catch {
              return [
                symbol,
                {
                  points: [],
                  timestamps: []
                }
              ];
            }
          })
        );

        setHistory(Object.fromEntries(results));

        /*
         * ---------------------------------------------------------------
         * 3. Evaluate alerts
         * ---------------------------------------------------------------
         */
        const newlyTriggered = [];

        const nextAlerts = alerts.map(a => {
          const q = next[a.symbol];

          if (!q || q.currentPrice == null) {
            return a;
          }

          const price = q.currentPrice;

          /*
           * Trailing alerts
           */
          if (a.kind === "trailing") {
            const pct = Math.max(
              0.01,
              Number(a.percent)
            );

            const peak = Math.max(
              a.peakPrice ?? a.anchor ?? price,
              price
            );

            const trough = Math.min(
              a.troughPrice ?? a.anchor ?? price,
              price
            );

            const triggerPrice =
              a.direction === "below"
                ? peak * (1 - pct / 100)
                : trough * (1 + pct / 100);

            const previous =
              previousPrices.current[a.symbol];

            const crossedNow =
              previous != null &&
              (
                a.direction === "below"
                  ? previous > triggerPrice &&
                    price <= triggerPrice
                  : previous < triggerPrice &&
                    price >= triggerPrice
              );

            const nextAlert = {
              ...a,
              peakPrice: peak,
              troughPrice: trough,
              triggerPrice
            };

            if (crossedNow && a.armed) {
              newlyTriggered.push({
                ...nextAlert,
                currentPrice: price
              });

              return {
                ...nextAlert,
                armed: false
              };
            }

            const rearm =
              a.direction === "below"
                ? price > triggerPrice
                : price < triggerPrice;

            return rearm
              ? {
                  ...nextAlert,
                  armed: true
                }
              : nextAlert;
          }

          /*
           * Standard price alerts
           */
          const previous =
            previousPrices.current[a.symbol];

          const crossedNow =
            previous != null &&
            (
              a.direction === "above"
                ? previous < a.price &&
                  price >= a.price
                : previous > a.price &&
                  price <= a.price
            );

          if (crossedNow && a.armed) {
            newlyTriggered.push({
              ...a,
              currentPrice: price
            });

            return {
              ...a,
              armed: false
            };
          }

          return {
            ...a,
            armed:
              a.direction === "above"
                ? price < a.price
                : price > a.price
          };
        });

        /*
         * Only update previous prices for quotes that actually have
         * a valid current price.
         */
        previousPrices.current = {
          ...previousPrices.current,
          ...Object.fromEntries(
            Object.values(next)
              .filter(
                q =>
                  q &&
                  q.symbol &&
                  q.currentPrice != null
              )
              .map(q => [
                q.symbol,
                q.currentPrice
              ])
          )
        };

        setAlerts(nextAlerts);

        /*
         * ---------------------------------------------------------------
         * 4. Triggered alerts
         * ---------------------------------------------------------------
         */
        if (newlyTriggered.length) {
          setTriggered(prev =>
            [
              ...newlyTriggered,
              ...prev
            ].slice(0, 8)
          );

          /*
           * Sound notification
           */
          if (
            soundEnabled &&
            typeof window !== "undefined"
          ) {
            try {
              const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

              if (AudioContextClass) {
                const ctx =
                  new AudioContextClass();

                const now = ctx.currentTime;

                [0, 0.16].forEach(
                  (offset, index) => {
                    const oscillator =
                      ctx.createOscillator();

                    const gain =
                      ctx.createGain();

                    oscillator.type = "sine";

                    oscillator.frequency.value =
                      index === 0
                        ? 880
                        : 1175;

                    gain.gain.setValueAtTime(
                      0.0001,
                      now + offset
                    );

                    gain.gain.exponentialRampToValueAtTime(
                      0.16,
                      now + offset + 0.015
                    );

                    gain.gain.exponentialRampToValueAtTime(
                      0.0001,
                      now + offset + 0.13
                    );

                    oscillator.connect(gain);
                    gain.connect(ctx.destination);

                    oscillator.start(
                      now + offset
                    );

                    oscillator.stop(
                      now + offset + 0.14
                    );
                  }
                );

                window.setTimeout(
                  () =>
                    ctx
                      .close()
                      .catch(() => {}),
                  500
                );
              }
            } catch {
              // Audio is best-effort; browser autoplay policy may block it.
            }
          }

          /*
           * Browser notifications
           */
          if (
            notificationsEnabled &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            newlyTriggered.forEach(a => {
              const q = next[a.symbol];

              const label =
                a.kind === "trailing"
                  ? `${a.symbol} ${
                      a.direction === "below"
                        ? "dropped"
                        : "rose"
                    } ${fmt(a.percent)}% from its trailing reference`
                  : `${a.symbol} crossed ${
                      a.direction === "above"
                        ? "above"
                        : "below"
                    } ${currencySymbol(
                      q?.currency
                    )}${fmt(a.price)}`;

              new Notification(
                "Market Watch alert",
                {
                  body: `${label}. Current: ${currencySymbol(
                    q?.currency
                  )}${fmt(a.currentPrice)}`
                }
              );
            });
          }
        }

        setSecondsLeft(refreshSeconds);
      } catch (e) {
        setError(
          e.message ||
            "Market data request failed."
        );
      } finally {
        activeFetchRef.current = false;
        setLoading(false);

        /*
         * If another refresh was requested while this one was running,
         * execute the latest queued request now.
         */
        const queuedSymbols =
          queuedFetchRef.current;

        queuedFetchRef.current = null;

        if (
          queuedSymbols?.length &&
          storageReady
        ) {
          /*
           * Do not await this call from finally. The current refresh has
           * already completed and the queued refresh should run normally.
           */
          fetchMarketData(queuedSymbols);
        }
      }
    },
    [
      tickers,
      alerts,
      setAlerts,
      refreshSeconds,
      notificationsEnabled,
      soundEnabled,
      storageReady
    ]
  );

  /*
   * Keep the latest callback available to timers and startup effects.
   */
  const fetchRef = useRef(fetchMarketData);

  useEffect(() => {
    fetchRef.current = fetchMarketData;
  }, [fetchMarketData]);

  /*
   * ---------------------------------------------------------------
   * Initial load
   * ---------------------------------------------------------------
   *
   * CRITICAL:
   *
   * Do not fetch while usePersistentSettings is still hydrating
   * localStorage. The initial DEFAULT_TICKERS are only temporary state.
   *
   * Once storageReady becomes true, marketSymbols represents the actual
   * persisted watchlist/portfolio symbols.
   */
  useEffect(() => {
    if (!storageReady) return;
    if (!tickers.length) return;

    fetchRef.current(tickers);

    // Deliberately depend on the resolved watchlist and storage readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storageReady,
    tickers.join("|")
  ]);

  /*
   * ---------------------------------------------------------------
   * Automatic refresh countdown
   * ---------------------------------------------------------------
   */
  useEffect(() => {
    /*
     * Don't start meaningful polling until persistent state has loaded.
     */
    if (!storageReady) {
      return undefined;
    }

    setSecondsLeft(refreshSeconds);

    const timer = setInterval(() => {
      setSecondsLeft(s => {
        if (paused) {
          return s;
        }

        if (s <= 1) {
          fetchRef.current(tickers);
          return refreshSeconds;
        }

        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    storageReady,
    fetchMarketData,
    tickers,
    refreshSeconds,
    paused
  ]);

  return {
    quotes,
    history,
    loading,
    error,
    setError,
    lastUpdated,
    triggered,
    setTriggered,
    secondsLeft,
    setSecondsLeft,
    fetchMarketData
  };
}
