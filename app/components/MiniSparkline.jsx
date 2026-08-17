function niceStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatPrice(value, step) {
  const decimals = step >= 100 ? 0 : step >= 1 ? 2 : step >= 0.1 ? 2 : step >= 0.01 ? 3 : 4;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "—";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

export function MiniSparkline({ points, timestamps = [], positive }) {
  const valid = (points || [])
    .map((value, index) => ({
      value,
      time: Number(timestamps[index])
    }))
    .filter(point => Number.isFinite(point.value) && Number.isFinite(point.time));

  if (valid.length < 2) {
    return (
      <div className="spark sparkChartEmpty" aria-label="1-day chart unavailable">
        <span>1D chart unavailable</span>
      </div>
    );
  }

  const values = valid.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rawRange = max - min;
  const yStep = niceStep((rawRange || Math.max(Math.abs(max), 1)) / 2);
  let yMin = Math.floor(min / yStep) * yStep;
  let yMax = Math.ceil(max / yStep) * yStep;

  if (yMin === yMax) {
    yMin -= yStep;
    yMax += yStep;
  }

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const width = 320;
  const height = 86;
  const left = 43;
  const right = 5;
  const top = 5;
  const bottom = 20;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yRange = yMax - yMin || 1;

  const xFor = index => left + (index / Math.max(1, valid.length - 1)) * plotWidth;
  const yFor = value => top + (1 - (value - yMin) / yRange) * plotHeight;

  const coords = valid.map((point, index) =>
    `${xFor(index).toFixed(1)},${yFor(point.value).toFixed(1)}`
  ).join(" ");

  const xIndexes = [...new Set([
    0,
    Math.round((valid.length - 1) / 2),
    valid.length - 1
  ])];

  return (
    <div className="sparkChart" aria-label="1-day stock price chart">
      <svg
        className="spark"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="1-day stock price chart with price and time axes"
      >
        {yTicks.map((value, index) => {
          const y = yFor(value);
          return (
            <g key={`y-${index}`}>
              <line x1={left} y1={y} x2={width - right} y2={y} className="sparkGridLine" />
              <text x={left - 5} y={y + 3} textAnchor="end" className="sparkAxisLabel">
                {formatPrice(value, yStep)}
              </text>
            </g>
          );
        })}

        <line x1={left} y1={top} x2={left} y2={height - bottom} className="sparkAxisLine" />
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="sparkAxisLine" />

        <polyline
          points={coords}
          className={positive ? "sparkPositive" : "sparkNegative"}
        />

        {xIndexes.map(index => (
          <g key={`x-${index}`}>
            <line
              x1={xFor(index)}
              y1={height - bottom}
              x2={xFor(index)}
              y2={height - bottom + 3}
              className="sparkAxisLine"
            />
            <text
              x={xFor(index)}
              y={height - 5}
              textAnchor={index === 0 ? "start" : index === valid.length - 1 ? "end" : "middle"}
              className="sparkAxisLabel"
            >
              {formatTime(valid[index].time)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
