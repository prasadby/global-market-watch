import { exchangeName, sessionLabel, sessionTone } from "../../lib/utils";

function exchangeState(quotes) {
  const values = Object.values(quotes || {});
  if (values.some(q => q.marketState === "REGULAR")) return "REGULAR";
  if (values.some(q => q.marketState === "PRE")) return "PRE";
  if (values.some(q => q.marketState === "POST")) return "POST";
  return "CLOSED";
}

export function GlobalMarketStatus({ quotes, lastUpdated }) {
  const groups = Object.values(quotes || {}).reduce((result, q) => {
    const exchange = exchangeName(q) || "Other";
    (result[exchange] ||= []).push(q);
    return result;
  }, {});

  const exchanges = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="globalMarketStatus" aria-label="Global market status">
      <div className="globalMarketStatusTitle">
        <span className="eyebrow">GLOBAL MARKET STATUS</span>
        {lastUpdated && <span className="updated">Updated {lastUpdated.toLocaleTimeString()}</span>}
      </div>

      <div className="globalMarketStatusList">
        {exchanges.length ? exchanges.map(([exchange, rows]) => {
          const state = exchangeState(rows);
          const representative = rows[0];

          return (
            <div className={`globalMarketStatusItem ${sessionTone(state)}`} key={exchange}>
              <span className="statusDot" />
              <b>{exchange}</b>
              <span>{sessionLabel(state, representative?.symbol)}</span>
            </div>
          );
        }) : (
          <div className="globalMarketStatusEmpty">Waiting for market data…</div>
        )}
      </div>
    </section>
  );
}
