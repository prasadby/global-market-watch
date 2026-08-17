import { currencySymbol, fmt, pctClass } from "../../lib/utils";

export function PortfolioPanel({ groups, totals, open, setOpen }) {
  const money = (value, currency) => `${currencySymbol(currency)}${fmt(value)}`;
  const exchanges = Object.keys(groups || {}).sort((a, b) => a.localeCompare(b));
  const all = exchanges.flatMap(exchange => groups[exchange] || []);
  const performers = [...all].sort((a, b) => b.pnlPct - a.pnlPct);
  const totalPositions = all.length;

  const group = (exchange, rows, total) => {
    const currency = total.currency || rows[0]?.currency || "USD";

    return (
      <div className="portfolioMarketGroup" key={exchange}>
        <div className="portfolioGroupHeader">
          <div>
            <b>{exchange}</b>
            <span>{rows.length} position{rows.length === 1 ? "" : "s"}</span>
          </div>
          <div className="portfolioGroupTotal">
            <b>{money(total.value, currency)}</b>
            <span className={pctClass(total.pnl)}>
              {total.pnl >= 0 ? "+" : ""}{money(total.pnl, currency)}
              {" · Today "}
              {total.todayPnl >= 0 ? "+" : ""}{money(total.todayPnl, currency)}
            </span>
          </div>
        </div>

        <div className="portfolioRows">
          {rows.map(h => {
            const groupValue = total.value || 0;
            const weight = groupValue ? (h.marketValue / groupValue) * 100 : 0;

            return (
              <div className="portfolioPosition" key={h.id}>
                <div className="positionIdentity">
                  <div>
                    <b>{h.symbol.replace(".NS", "").replace(".BO", "")}</b>
                    <span>{h.shares} × avg {money(h.buyPrice, currency)} · {fmt(weight)}% exchange</span>
                  </div>
                </div>
                <div>
                  <b>{money(h.marketValue, currency)}</b>
                  <span className={pctClass(h.pnl)}>
                    {h.pnl >= 0 ? "+" : ""}{money(h.pnl, currency)}
                    {" ("}{h.pnl >= 0 ? "+" : ""}{fmt(h.pnlPct)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className={`portfolioPanel ${open ? "open" : "collapsed"}`} aria-label="Portfolio">
      <div className="portfolioHeader">
        {open && (
          <div>
            <div className="eyebrow">OPTIONAL PORTFOLIO</div>
            <h2>Portfolio</h2>
          </div>
        )}

        <button
          className="portfolioCollapseBtn"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? "Collapse portfolio" : "Expand portfolio"}
          title={open ? "Collapse portfolio" : "Expand portfolio"}
        >
          {open ? "‹" : "›"}
        </button>
      </div>

      {open && (
        <>
          <div className="portfolioKpis">
            <div><span>Positions</span><b>{totalPositions}</b></div>
            <div><span>Exchanges</span><b>{exchanges.length}</b></div>
            <div>
              <span>Best performer</span>
              <b>{performers[0]?.symbol || "—"}</b>
              <small>{performers[0] ? `${performers[0].pnlPct >= 0 ? "+" : ""}${fmt(performers[0].pnlPct)}%` : "—"}</small>
            </div>
            <div>
              <span>Worst performer</span>
              <b>{performers[performers.length - 1]?.symbol || "—"}</b>
              <small>{performers.length ? `${performers[performers.length - 1].pnlPct >= 0 ? "+" : ""}${fmt(performers[performers.length - 1].pnlPct)}%` : "—"}</small>
            </div>
          </div>

          {exchanges.length
            ? exchanges.map(exchange => group(exchange, groups[exchange], totals[exchange]))
            : <div className="portfolioEmpty" style={{ padding: "18px" }}>No holdings configured.</div>
          }

          <div className="portfolioNote">
            Holdings are grouped by stock exchange. Portfolio values use the latest available quote from the market-data provider.
          </div>
        </>
      )}
    </aside>
  );
}
