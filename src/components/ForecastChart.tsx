import type { ForecastDay } from "../utils/cashForecast";
import { formatDate, formatINR } from "../utils/format";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 84 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

interface ForecastChartProps {
  days: ForecastDay[];
}

/** Rounds a raw axis step up to a 1, 2 or 5 multiple of a power of ten. */
function niceStep(rawStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const multiple = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= rawStep) ?? 10;
  return multiple * magnitude;
}

/** About four evenly spaced tick values between min and max. Zero is always a tick when it lies in range. */
function axisTicks(min: number, max: number): number[] {
  const step = niceStep((max - min) / 3);
  const first = Math.ceil(min / step);
  const last = Math.floor(max / step);
  const ticks: number[] = [];
  for (let index = first; index <= last; index++) {
    ticks.push(index * step);
  }
  return ticks;
}

export default function ForecastChart({ days }: ForecastChartProps) {
  if (days.length === 0) {
    return <p className="text-sm text-slate-500">No forecast data to chart.</p>;
  }

  const balances = days.map((day) => day.balanceINR);
  // Always include zero so the danger line and the below-zero region are on the scale.
  const minY = Math.min(0, ...balances);
  const maxY = Math.max(0, ...balances);
  const span = maxY > minY ? maxY - minY : 1;

  const yAt = (value: number): number => PAD.top + ((maxY - value) / span) * PLOT_H;
  const xAt = (index: number): number =>
    days.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (index / (days.length - 1)) * PLOT_W;

  const zeroY = yAt(0);
  const points = days.map((day, index) => ({ x: xAt(index), y: yAt(day.balanceINR) }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L${last.x.toFixed(1)} ${zeroY.toFixed(1)} L${first.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const ticks = axisTicks(minY, maxY);
  const labelIndices = Array.from(new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label="Projected daily cash balance"
      className="block"
    >
      {ticks.map((tick) => (
        <line
          key={`grid-${tick}`}
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={yAt(tick)}
          y2={yAt(tick)}
          className="stroke-slate-200"
          strokeWidth={1}
        />
      ))}

      {/* Region below zero */}
      <rect
        x={PAD.left}
        y={zeroY}
        width={PLOT_W}
        height={Math.max(0, yAt(minY) - zeroY)}
        className="fill-red-100"
      />

      <path d={areaPath} className="fill-sky-200/70" />
      <path d={linePath} fill="none" className="stroke-sky-700" strokeWidth={2} strokeLinejoin="round" />

      <line
        x1={PAD.left}
        x2={PAD.left + PLOT_W}
        y1={zeroY}
        y2={zeroY}
        className="stroke-red-600"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <text x={PAD.left + PLOT_W - 4} y={zeroY - 6} textAnchor="end" className="fill-red-700 text-[11px] font-medium">
        ₹0 danger line
      </text>

      {ticks.map((tick) => (
        <text
          key={`y-${tick}`}
          x={PAD.left - 8}
          y={yAt(tick) + 4}
          textAnchor="end"
          className="fill-slate-500 text-[11px]"
        >
          {formatINR(tick)}
        </text>
      ))}

      {labelIndices.map((index) => (
        <text
          key={`x-${index}`}
          x={xAt(index)}
          y={HEIGHT - 8}
          textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
          className="fill-slate-500 text-[11px]"
        >
          {formatDate(days[index].date)}
        </text>
      ))}
    </svg>
  );
}
