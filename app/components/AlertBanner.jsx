import { currencySymbol, fmt } from "../../lib/utils";

export function AlertBanner({ triggered, quotes, onDismiss }) {
  if (!triggered.length) return null;
  return (
    <section className="alertBanner">
      {triggered.map((a, i) => (
        <div className="alertNotice" key={`${a.id}-${i}`}>
          <span>🔔</span>
          <b>{a.symbol}</b>{" "}
          {a.kind === "trailing"
            ? `${a.direction === "below" ? "fell" : "rose"} ${fmt(a.percent)}% from its trailing reference`
            : `${a.direction === "above" ? "crossed above" : "crossed below"} ${currencySymbol(quotes[a.symbol]?.currency)}${fmt(a.price)}`}
          <span>· now {currencySymbol(quotes[a.symbol]?.currency)}{fmt(a.currentPrice)}</span>
          <button onClick={() => onDismiss(i)} aria-label="Dismiss alert">×</button>
        </div>
      ))}
    </section>
  );
}
