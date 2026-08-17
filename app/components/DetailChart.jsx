function niceStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function buildYAxis(min, max) {
  const range = max - min;
  const step = niceStep((range || Math.max(Math.abs(max), 1)) / 4);
  let yMin = Math.floor(min / step) * step;
  let yMax = Math.ceil(max / step) * step;

  if (yMin === yMax) {
    yMin -= step * 2;
    yMax += step * 2;
  } else {
    // Add one tick of breathing room only when the raw data touches an edge.
    if (yMin === min) yMin -= step;
    if (yMax === max) yMax += step;
  }

  const ticks = [];
  for (let value = yMin; value <= yMax + step * 0.001; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }

  // Keep the axis readable while guaranteeing the true data range is covered.
  if (ticks.length > 6) {
    const reduced = [];
    for (let i = 0; i < ticks.length; i += Math.ceil(ticks.length / 5)) reduced.push(ticks[i]);
    if (reduced[reduced.length - 1] !== ticks[ticks.length - 1]) reduced.push(ticks[ticks.length - 1]);
    return { min: yMin, max: yMax, ticks: reduced };
  }

  return { min: yMin, max: yMax, ticks };
}

function formatPrice(value, step) {
  if (!Number.isFinite(value)) return "";
  const decimals =
    step >= 100 ? 0 :
    step >= 1 ? 2 :
    step >= 0.1 ? 2 :
    step >= 0.01 ? 3 : 4;

  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function rangeLabel(range, timestamp, index, total) {
  if (!Number.isFinite(timestamp)) return "—";
  const d = new Date(timestamp);

  if (range === "1d") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  if (range === "5d" || range === "1m") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  if (range === "6m") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

function getXIndexes(total) {
  if (total <= 1) return [0];
  const count = total < 20 ? 3 : 4;
  return [...new Set(
    Array.from({ length: count }, (_, i) =>
      Math.round(i * (total - 1) / (count - 1))
    )
  )];
}

export function DetailChart({ points, timestamps = [], positive, range = "1d" }) {
  const valid = (points || [])
    .map((value, index) => ({
      value,
      time: timestamps[index]
    }))
    .filter(x => Number.isFinite(x.value) && Number.isFinite(x.time));

  if (!valid.length) return <div className="chartEmpty">No chart data available for this period.</div>;

  const values = valid.map(x => x.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const axis = buildYAxis(min, max);
  const yRange = axis.max - axis.min || 1;

  const width = 860;
  const height = 320;
  const left = 68;
  const right = 14;
  const top = 16;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const xFor = i => left + (i / Math.max(1, valid.length - 1)) * plotWidth;
  const yFor = value => top + (1 - (value - axis.min) / yRange) * plotHeight;

  const coords = valid.map((point, i) =>
    `${xFor(i).toFixed(1)},${yFor(point.value).toFixed(1)}`
  ).join(" ");

  const area = `${left},${height-bottom} ${coords} ${width-right},${height-bottom}`;
  const xIndexes = getXIndexes(valid.length);

  return (
    <svg
      className="detailChart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Stock price history chart for ${range}`}
    >
      {axis.ticks.map((value, i) => {
        const y = yFor(value);
        return (
          <g key={`y-${i}`}>
            <line x1={left} y1={y} x2={width-right} y2={y} className="chartGridLine" />
            <text x={left - 8} y={y + 3} textAnchor="end" className="chartAxisLabel">
              {formatPrice(value, niceStep((axis.max - axis.min) / Math.max(1, axis.ticks.length - 1)))}
            </text>
          </g>
        );
      })}

      <line x1={left} y1={top} x2={left} y2={height-bottom} className="chartAxis" />
      <line x1={left} y1={height-bottom} x2={width-right} y2={height-bottom} className="chartAxis" />

      <polygon points={area} className={positive ? "chartAreaPositive" : "chartAreaNegative"} />
      <polyline points={coords} className={positive ? "chartLinePositive" : "chartLineNegative"} />

      {xIndexes.map(i => (
        <g key={`x-${i}`}>
          <line x1={xFor(i)} y1={height-bottom} x2={xFor(i)} y2={height-bottom + 4} className="chartAxis" />
          <text
            x={xFor(i)}
            y={height - 10}
            textAnchor={i === 0 ? "start" : i === valid.length - 1 ? "end" : "middle"}
            className="chartAxisLabel"
          >
            {rangeLabel(range, valid[i].time, i, valid.length)}
          </text>
        </g>
      ))}
    </svg>
  );
}
