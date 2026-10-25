import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toInputDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayInput() {
  return toInputDate(new Date());
}

export function computeEndDate(start: Date, durationDays: number) {
  if (durationDays <= 0) return null;
  return addDays(start, durationDays - 1);
}

export function formatDate(
  date: Date | string | null | undefined,
  fallback = "—",
) {
  if (!date) return fallback;
  const value = typeof date === "string" ? new Date(date) : date;
  return format(value, "d MMM yyyy", { locale: fr });
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  return format(value, "d MMM yyyy 'à' HH:mm", { locale: fr });
}

export function formatMonthLabel(date: Date) {
  const label = format(date, "MMM yy", { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDay(date: Date) {
  return format(date, "d MMM", { locale: fr });
}

export function formatMoney(amount: number, currency = "MAD") {
  try {
    return new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function daysRemaining(end: Date | string | null | undefined) {
  if (!end) return "Illimité";
  const endDate = typeof end === "string" ? new Date(end) : end;
  const days = differenceInCalendarDays(endDate, startOfDay(new Date()));
  if (days < 0) return `Expiré depuis ${Math.abs(days)} j`;
  if (days === 0) return "Expire aujourd'hui";
  if (days === 1) return "Expire demain";
  return `${days} jours restants`;
}

export function durationLabel(days: number) {
  if (days <= 0) return "Illimité";
  if (days === 1) return "1 jour";
  return `${days} jours`;
}
