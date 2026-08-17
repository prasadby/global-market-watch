/** Derives portfolio valuation from local holdings and normalized exchange quotes. */
import { useMemo } from "react";
import { exchangeName } from "../lib/utils";

export function usePortfolioAnalytics({ portfolio, quotes, alerts }) {
  const portfolioGroups = useMemo(() => {
    const groups = {};

    portfolio.forEach(h => {
      const q = quotes[h.symbol];
      if (!q) return;

      const shares = Number(h.shares) || 0;
      const buyPrice = Number(h.buyPrice) || 0;
      const current = Number(q.currentPrice) || 0;
      const marketValue = current * shares;
      const cost = buyPrice * shares;
      const pnl = marketValue - cost;
      const pnlPct = cost ? (pnl / cost) * 100 : 0;
      const todayPnl = (Number(q.change) || 0) * shares;
      const annualDividend = (Number(q.dividendRate) || 0) * shares;
      const exchange = exchangeName(q);

      if (!groups[exchange]) groups[exchange] = [];

      groups[exchange].push({
        ...h,
        q,
        exchange,
        currency: q.currency || "USD",
        shares,
        buyPrice,
        current,
        marketValue,
        cost,
        pnl,
        pnlPct,
        todayPnl,
        annualDividend
      });
    });

    return groups;
  }, [portfolio, quotes]);

  const portfolioTotals = useMemo(() => {
    const totals = {};

    Object.entries(portfolioGroups).forEach(([exchange, rows]) => {
      totals[exchange] = {
        currency: rows[0]?.currency || "USD",
        value: rows.reduce((sum, h) => sum + h.marketValue, 0),
        pnl: rows.reduce((sum, h) => sum + h.pnl, 0),
        todayPnl: rows.reduce((sum, h) => sum + h.todayPnl, 0),
        cost: rows.reduce((sum, h) => sum + h.cost, 0),
        annualDividend: rows.reduce((sum, h) => sum + h.annualDividend, 0)
      };
    });

    return totals;
  }, [portfolioGroups]);



  return { portfolioGroups, portfolioTotals };
}
