import { QuoteCard } from "./QuoteCard.jsx";
import { exchangeName } from "../../lib/utils";

export function MarketGrid({
  symbols, quotes, alerts, onRemove, onOpen, onAddAlert,
  history, dragHandlers, tickersCount, input, runSearch, suggestions, addTicker,
  groupByExchange
}) {
  return (
    <section className="marketSection">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">YOUR MARKET VIEW</div>
          <h2>Watchlist</h2>
        </div>
        <div className="marketViewActions">
          <span>{symbols.length} of {tickersCount} symbols</span>
          <div className="marketSearch">
            <div className="autocomplete">
              <input value={input}
                onChange={e => runSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTicker()}
                placeholder="Add stock — NVDA, M&M, MSFT…"
                aria-label="Add stock to watchlist" />
              {suggestions.length > 0 && (
                <div className="suggestions">
                  {suggestions.map(s => (
                    <button key={`${s.symbol}-${s.exchange}`} onClick={() => addTicker(s.symbol, true)}>
                      <b>{s.symbol}</b><span>{s.name}</span><small>{s.exchange}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="primaryBtn" onClick={() => addTicker()}>＋ Add</button>
          </div>
        </div>
      </div>

      {symbols.length ? (
        groupByExchange ? (
          <div className="exchangeGroups">
            {[...new Set(symbols.map(symbol => exchangeName(quotes[symbol] || { symbol })))].map(exchange => {
              const groupSymbols = symbols.filter(symbol => exchangeName(quotes[symbol] || { symbol }) === exchange);
              return (
                <section className="exchangeGroup" key={exchange}>
                  <div className="exchangeGroupHeader"><span>{exchange}</span><small>{groupSymbols.length} {groupSymbols.length === 1 ? "stock" : "stocks"}</small></div>
                  <div className="grid">
                    {groupSymbols.map(symbol => quotes[symbol]
                      ? <QuoteCard key={symbol} q={quotes[symbol]} alerts={alerts.filter(a => a.symbol === symbol)}
                          onRemove={onRemove} onOpen={onOpen} onAddAlert={onAddAlert}

                          history={history[symbol]} dragHandlers={dragHandlers} />
                      : <div className="card loadingCard" key={symbol}><b>{symbol}</b><span>Loading market data…</span></div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="grid">
            {symbols.map(symbol => quotes[symbol]
              ? <QuoteCard key={symbol} q={quotes[symbol]} alerts={alerts.filter(a => a.symbol === symbol)}
                  onRemove={onRemove} onOpen={onOpen} onAddAlert={onAddAlert}
                  history={history[symbol]} dragHandlers={dragHandlers} />
              : <div className="card loadingCard" key={symbol}><b>{symbol}</b><span>Loading market data…</span></div>
            )}
          </div>
        )
      ) : (
        <div className="emptyState"><div>🔎</div><h2>No symbols match this filter</h2><p>Change the market filter or add another stock.</p></div>
      )}
    </section>
  );
}
