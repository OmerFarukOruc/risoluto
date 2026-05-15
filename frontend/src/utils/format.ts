import type { RateLimits } from "../types/runtime.js";

function asDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatTokenUsage(value: number | null | undefined): string {
  if (!value) {
    return "—";
  }
  return `${formatCompactNumber(value).toLowerCase()} tokens`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "—";
  }
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  // For multi-day durations, fall back to a compact humanized form so the
  // Duration column does not break table layout with values like 2165:27:44.
  if (hours >= 100) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`;
  }
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatRunDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) {
    return "—";
  }
  if (!end) {
    return "ongoing";
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "—";
  }
  return formatDuration(Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 1000)));
}

/**
 * Compact `mm:ss` since `startedAt`. Returns `null` for missing/unparseable
 * input so callers can choose their own fallback ("—", "live", etc.).
 */
export function formatElapsedMmSs(startedAt: string | null | undefined): string | null {
  if (!startedAt) return null;
  const startMs = Date.parse(startedAt);
  if (Number.isNaN(startMs)) return null;
  const seconds = Math.max(0, Math.round((Date.now() - startMs) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Compact "Nm Ms" / "Hh Mm" duration matching the prototype's Session usage
 * row. Falls back to `0s` for genuinely zero durations and `—` for unknown.
 *
 * Mirrors `formatDurationCompact` in `outcome-badge` but takes seconds
 * (not ms) — they're separate because `outcome-badge` is the canonical
 * home for ms-based attempt durations.
 */
export function formatRuntimeShort(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const whole = Math.max(0, Math.round(seconds));
  if (whole === 0) return "0s";
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const remainingSeconds = whole % 60;
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatRelativeTime(value: string | null | undefined): string {
  const date = asDate(value);
  if (!date) {
    return "—";
  }
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(diffSeconds);
  if (absolute < 5) {
    return "just now";
  }
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, size] of units) {
    if (absolute >= size || unit === "second") {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(diffSeconds / size), unit);
    }
  }
  return "—";
}

export function formatCountdown(value: string | null | undefined, now = Date.now()): string {
  const date = asDate(value);
  if (!date) {
    return "—";
  }
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  if (Math.abs(diffSeconds) < 1) {
    return "now";
  }

  const totalSeconds = Math.abs(diffSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);
  const duration = parts.join(" ");
  return diffSeconds > 0 ? `in ${duration}` : `${duration} ago`;
}

export function formatTimestamp(value: string | null | undefined): string {
  const date = asDate(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatShortTime(value: string | null | undefined): string {
  const date = asDate(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatCompactTimestamp(value: string | null | undefined): string {
  const date = asDate(value);
  if (!date) {
    return "—";
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  const timeText = formatShortTime(value);
  if (dayDiff === 0) {
    return `Today, ${timeText}`;
  }
  if (dayDiff === 1) {
    return `Yesterday, ${timeText}`;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatRateLimitHeadroom(rateLimits: RateLimits | null): string {
  if (!rateLimits || typeof rateLimits !== "object") {
    return "N/A";
  }
  const record = rateLimits as Record<string, unknown>;
  const limit = Number(record.limit ?? record.total ?? 0);
  const remaining = Number(record.remaining ?? 0);
  if (!limit || Number.isNaN(limit) || Number.isNaN(remaining)) {
    return "N/A";
  }
  return `${((remaining / limit) * 100).toFixed(1)}%`;
}

export function computeDurationSeconds(
  start: string | null | undefined,
  end?: string | null | undefined,
): number | null {
  const startDate = asDate(start);
  if (!startDate) {
    return null;
  }
  const endDate = asDate(end) ?? new Date();
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 1000));
}

export function formatCostUsd(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) {
    return "—";
  }
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumSignificantDigits: 4,
  }).format(usd);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) {
    return "—";
  }
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / k ** i;
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
