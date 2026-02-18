import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const WIB_TIME_ZONE = "Asia/Jakarta";
const WIB_OFFSET_MINUTES = 7 * 60;
const DATETIME_LOCAL_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function parseDateInput(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const local = parseWibDateTimeLocal(value);
  if (local) return local;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parseWibDateTimeLocal(value: string): Date | null {
  const match = DATETIME_LOCAL_REGEX.exec(value);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - WIB_OFFSET_MINUTES * 60 * 1000;
  const parsed = new Date(utcMillis);

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function toWibDateTimeLocalValue(value: Date | string): string {
  const parsed = parseDateInput(value);
  if (!parsed) return "";

  const wibMillis = parsed.getTime() + WIB_OFFSET_MINUTES * 60 * 1000;
  const wibDate = new Date(wibMillis);

  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibDate.getUTCDate()).padStart(2, "0");
  const hour = String(wibDate.getUTCHours()).padStart(2, "0");
  const minute = String(wibDate.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function getCancellationWindowInfo(createdAt: Date | string, windowMinutes = 15) {
  const created = parseDateInput(createdAt);
  if (!created) {
    return {
      canCancel: false,
      minutesRemaining: 0,
      deadline: null as Date | null,
    };
  }

  const deadline = new Date(created.getTime() + windowMinutes * 60 * 1000);
  const diffMs = deadline.getTime() - Date.now();
  const minutesRemaining = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

  return {
    canCancel: diffMs > 0,
    minutesRemaining,
    deadline,
  };
}

const WIB_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: WIB_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WIB_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: WIB_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const WIB_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: WIB_TIME_ZONE,
  month: "short",
  day: "numeric",
});

export function formatDateTimeWib(value: Date | string): string {
  const parsed = parseDateInput(value);
  if (!parsed) return "—";
  return `${WIB_DATE_TIME_FORMATTER.format(parsed)} WIB`;
}

export function formatDateWib(value: Date | string): string {
  const parsed = parseDateInput(value);
  if (!parsed) return "—";
  return WIB_DATE_FORMATTER.format(parsed);
}

export function formatMonthDayWib(value: Date | string): string {
  const parsed = parseDateInput(value);
  if (!parsed) return "—";
  return WIB_MONTH_DAY_FORMATTER.format(parsed);
}

/**
 * Compute a human-readable duration string from two dates.
 * Returns e.g. "2d 4h", "0d 6h", "3d 0h"
 */
export function formatDuration(start: Date | string, end: Date | string): string {
  const s = parseDateInput(start)?.getTime() ?? NaN;
  const e = parseDateInput(end)?.getTime() ?? NaN;
  if (isNaN(s) || isNaN(e) || e <= s) return "—";

  const totalMs = e - s;
  const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) return `${hours}h`;
  if (hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}
