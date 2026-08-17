import { changeText, currencySymbol, fmt, isIndian, pctClass, sessionLabel, sessionTone } from "../../lib/utils";
import { MiniSparkline, QuickAlert } from "./";
export function QuoteCard({ q, alerts, onRemove, onOpen, onAddAlert, history, dragHandlers }) {
  const activePrice = q.marketState === "PRE" ? q.preMarketPrice : q.marketState === "POST" ? q.postMarketPrice : q.currentPrice;
  const displayChange = q.marketState === "PRE"
    ? { value: q.preMarketChange, percent: q.preMarketChangePercent }
    : q.marketState === "POST"
      ? { value: q.postMarketChange, percent: q.postMarketChangePercent }
      : { value: q.change, percent: q.changePercent };

  return (
    <article
      className="card"
      draggable
      onDragStart={() => dragHandlers.start(q.symbol)}
      onDragOver={(e) => { e.preventDefault(); dragHandlers.over(q.symbol); }}
      onDrop={(e) => { e.preventDefault(); dragHandlers.drop(q.symbol); }}
      onDragEnd={dragHandlers.end}
    >
      <div className="cardTop">
        <div>
          <div className="symbolLine">
            <span className="dragHandle" title="Drag to reorder">⋮⋮</span>
            <span className="symbol">{q.symbol.replace(".NS","").replace(".BO","")}</span>
          </div>
        </div>
        <div className="cardActions">
          <button className="iconBtn" title="View details" onClick={() => onOpen(q.symbol)}>↗</button>
          <button className="iconBtn" title="Remove" onClick={() => onRemove(q.symbol)}>×</button>
        </div>
      </div>

      <button className="cardMainButton" onClick={() => onOpen(q.symbol)}>
        <div className="priceRow">
          <div className="bigPrice">{currencySymbol(q.currency)}{fmt(activePrice)}</div>
          <span className={`sessionPill ${sessionTone(q.marketState)}`}><span className="statusDot" />{sessionLabel(q.marketState, q.symbol)}</span>
        </div>
        <div className={`bigChange ${pctClass(displayChange.percent)}`}>
          {displayChange.value > 0 ? "▲" : displayChange.value < 0 ? "▼" : "•"} {changeText(displayChange.value, displayChange.percent, q.currency)}
        </div>
      </button>

      <MiniSparkline
        points={history?.points || []}
        timestamps={history?.timestamps || []}
        positive={(displayChange.percent ?? 0) >= 0}
      />

      {!isIndian(q.symbol) ? (
        <div className={`sessionGrid ${q.preMarketPrice == null && q.postMarketPrice == null ? "one" : ""}`}>
          {q.preMarketPrice != null && (
            <div className={`sessionBox ${q.marketState === "PRE" ? "active" : ""}`}>
              <span>Pre-market</span><b>{currencySymbol(q.currency)}{fmt(q.preMarketPrice)}</b>
              <small className={pctClass(q.preMarketChangePercent)}>{changeText(q.preMarketChange, q.preMarketChangePercent, q.currency)}</small>
            </div>
          )}
          <div className={`sessionBox ${q.marketState === "REGULAR" ? "active" : ""}`}>
            <span>Regular</span><b>{currencySymbol(q.currency)}{fmt(q.currentPrice)}</b>
            <small className={pctClass(q.changePercent)}>{changeText(q.change, q.changePercent, q.currency)}</small>
          </div>
          {q.postMarketPrice != null && (
            <div className={`sessionBox ${q.marketState === "POST" ? "active" : ""}`}>
              <span>After-hours</span><b>{currencySymbol(q.currency)}{fmt(q.postMarketPrice)}</b>
              <small className={pctClass(q.postMarketChangePercent)}>{changeText(q.postMarketChange, q.postMarketChangePercent, q.currency)}</small>
            </div>
          )}
        </div>
      ) : (
        <div className="sessionGrid one">
          <div className="sessionBox active"><span>Previous close</span><b>{currencySymbol(q.currency)}{fmt(q.previousClose)}</b>
            <small className={pctClass(q.changePercent)}>{changeText(q.change, q.changePercent, q.currency)}</small>
          </div>
        </div>
      )}

      <div className="stats">
        <span>Open<b>{currencySymbol(q.currency)}{fmt(q.open)}</b></span>
        <span>High<b>{currencySymbol(q.currency)}{fmt(q.dayHigh)}</b></span>
        <span>Low<b>{currencySymbol(q.currency)}{fmt(q.dayLow)}</b></span>
        <span>Prev<b>{currencySymbol(q.currency)}{fmt(q.previousClose)}</b></span>
      </div>
      <div className="alertFooter">
        <div className="alerts">
          {alerts.length ? alerts.map(a => <span key={a.id} className={`alertTag ${a.direction}`}>{a.kind === "trailing" ? `${a.direction === "below" ? "↓" : "↑"} ${fmt(a.percent)}% trail` : `${a.direction === "above" ? "≥" : "≤"} ${currencySymbol(q.currency)}${fmt(a.price)}`}</span>) : <span className="noAlerts">No price alerts</span>}
        </div>
        <QuickAlert q={q} onAdd={onAddAlert} />
      </div>
    </article>
  );
}
