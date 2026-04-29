/**
 * SVG sparkline. The polyline is reused for both shown lines and
 * an optional faint area fill underneath. Renders nothing when fewer
 * than two points are supplied so callers don't need a separate guard.
 */

export interface SparklineOptions {
  data: ReadonlyArray<number | null>;
  width?: number;
  height?: number;
  /** Stroke colour. Accepts CSS variables — passed through to `stroke=`. */
  color?: string;
  /** Render a soft area fill at 10% opacity below the line. */
  filled?: boolean;
  /** Optional ARIA label for accessibility. */
  label?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const PADDING = 2;

export function createSparkline(options: SparklineOptions): SVGSVGElement | null {
  const points = sanitize(options.data);
  if (points.length < 2) return null;

  const width = options.width ?? 80;
  const height = options.height ?? 28;
  const color = options.color ?? "var(--text-accent)";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((value, index) => {
    const x = PADDING + (index / (points.length - 1)) * (width - PADDING * 2);
    const y = height - PADDING - ((value - min) / range) * (height - PADDING * 2);
    return [x, y] as const;
  });

  const lineD = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords.at(-1) ?? coords[0];

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "sparkline");
  svg.style.overflow = "visible";
  svg.style.display = "block";
  svg.style.flexShrink = "0";
  if (options.label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", options.label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }

  if (options.filled) {
    const area = document.createElementNS(SVG_NS, "path");
    const first = coords[0];
    area.setAttribute("d", `${lineD} L${last[0].toFixed(1)},${height} L${first[0].toFixed(1)},${height} Z`);
    area.setAttribute("fill", color);
    area.setAttribute("opacity", "0.12");
    svg.append(area);
  }

  const line = document.createElementNS(SVG_NS, "path");
  line.setAttribute("d", lineD);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "1.5");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-linecap", "round");
  svg.append(line);

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", last[0].toFixed(1));
  dot.setAttribute("cy", last[1].toFixed(1));
  dot.setAttribute("r", "2.5");
  dot.setAttribute("fill", color);
  svg.append(dot);

  return svg;
}

/** Drops null/NaN and returns a finite-only number array. */
function sanitize(data: ReadonlyArray<number | null>): number[] {
  const out: number[] = [];
  for (const value of data) {
    if (value !== null && Number.isFinite(value)) out.push(value);
  }
  return out;
}
