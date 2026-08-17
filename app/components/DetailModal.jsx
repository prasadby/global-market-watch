import { changeText, currencySymbol, exchangeLabel, fmt, pctClass, sessionLabel, sessionTone } from "../../lib/utils";
import { useEffect, useState } from "react";
import { DetailChart } from "./";
import { fetchHistory } from "../../services/marketService";
export function DetailModal({ q, onClose }) {
  const [range, setRange] = useState("1d");
  const [points, setPoints] = useState([]);
  const [timestamps, setTimestamps] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHistory(q.symbol, range)
      .then(d => {
        if (!cancelled) {
          setPoints(d.points || []);
          setTimestamps(d.timestamps || []);
        }
      })
      .catch(() => { if (!cancelled) setPoints([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q.symbol, range]);

  const price = q.marketState === "PRE" ? q.preMarketPrice : q.marketState === "POST" ? q.postMarketPrice : q.currentPrice;
  const change = q.marketState === "PRE"
    ? { value: q.preMarketChange, percent: q.preMarketChangePercent }
    : q.marketState === "POST"
      ? { value: q.postMarketChange, percent: q.postMarketChangePercent }
      : { value: q.change, percent: q.changePercent };

  return (
    <div className="modalBackdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modalHeader">
          <div>
            <div className="symbolLine"><span className="symbol">{q.symbol.replace(".NS","").replace(".BO","")}</span><span className="exchange">{exchangeLabel(q)}</span></div>
            <div className="companyName">{q.longName || q.shortName || q.symbol}</div>
          </div>
          <button className="closeModal" onClick={onClose}>×</button>
        </div>
        <div className="detailTop">
          <div><div className="detailPrice">{currencySymbol(q.currency)}{fmt(price)}</div><div className={`bigChange ${pctClass(change.percent)}`}>{changeText(change.value, change.percent, q.currency)}</div></div>
          <span className={`sessionPill ${sessionTone(q.marketState)}`}><span className="statusDot" />{sessionLabel(q.marketState, q.symbol)}</span>
        </div>
        <div className="rangeTabs">
          {["1d","5d","1m","6m","1y"].map(r => <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{r.toUpperCase()}</button>)}
        </div>
        <div className="detailChartWrap">{loading ? <div className="chartEmpty">Loading chart…</div> : <DetailChart points={points} timestamps={timestamps} range={range} positive={(change.percent ?? 0) >= 0} />}</div>
        <div className="detailStats">
          <div><span>Open</span><b>{currencySymbol(q.currency)}{fmt(q.open)}</b></div>
          <div><span>High</span><b>{currencySymbol(q.currency)}{fmt(q.dayHigh)}</b></div>
          <div><span>Low</span><b>{currencySymbol(q.currency)}{fmt(q.dayLow)}</b></div>
          <div><span>Prev close</span><b>{currencySymbol(q.currency)}{fmt(q.previousClose)}</b></div>
          <div><span>Volume</span><b>{q.volume ? fmt(q.volume, 0) : "—"}</b></div>
          <div><span>Market cap</span><b>{q.marketCap ? fmt(q.marketCap, 0) : "—"}</b></div>
        </div>
        <div className="modalFooter">Chart and quote data are indicative. This page is for personal monitoring, not trading execution.</div>
      </div>
    </div>
  );
}
