import { useEffect, useState } from "react";
export function QuickAlert({ q, onAdd }) {
  const activePrice = q.marketState === "PRE" && q.preMarketPrice != null
    ? q.preMarketPrice
    : q.marketState === "POST" && q.postMarketPrice != null
      ? q.postMarketPrice
      : q.currentPrice;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("price");
  const [direction, setDirection] = useState("above");
  const [value, setValue] = useState(activePrice ?? "");

  useEffect(() => {
    if (!open && activePrice != null) setValue(activePrice);
  }, [activePrice, open]);

  const submit = () => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0 || activePrice == null) return;
    if (kind === "price") {
      onAdd({ symbol: q.symbol, kind, direction, price: numeric, armed: true });
    } else {
      onAdd({
        symbol: q.symbol,
        kind: "trailing",
        direction,
        percent: numeric,
        anchor: activePrice,
        peakPrice: activePrice,
        troughPrice: activePrice,
        armed: true
      });
    }
    setOpen(false);
  };

  if (!open) return <button className="quickAlertBtn" onClick={() => setOpen(true)}>＋ Alert</button>;

  return (
    <div className="quickAlertForm" onClick={e => e.stopPropagation()}>
      <select value={kind} onChange={e => {
        const next = e.target.value;
        setKind(next);
        setDirection(next === "trailing" ? "below" : "above");
      }} aria-label="Alert type">
        <option value="price">Price</option>
        <option value="trailing">Trailing %</option>
      </select>
      <select value={direction} onChange={e => setDirection(e.target.value)} aria-label="Alert direction">
        {kind === "trailing"
          ? <><option value="below">Drops by</option><option value="above">Rises by</option></>
          : <><option value="above">Above</option><option value="below">Below</option></>}
      </select>
      <input type="number" step="any" min="0.01" value={value}
        onChange={e => setValue(e.target.value)}
        aria-label={kind === "trailing" ? "Percentage" : "Alert price"} />
      {kind === "trailing" && <span className="percentSuffix">%</span>}
      <button className="primaryBtn compactBtn" onClick={submit}>Set</button>
      <button className="iconBtn compactIconBtn" onClick={() => setOpen(false)} title="Cancel">×</button>
    </div>
  );
}
