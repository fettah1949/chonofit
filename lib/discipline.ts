import { endOfDay, startOfDay } from "date-fns";

export const WEEK_DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
] as const;

export type SessionClock = { start: string; end: string };

function validClock(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [hour, minute] = time.split(":").map(Number);
  return hour <= 23 && minute <= 59;
}

function readClock(raw: string): SessionClock {
  const match = raw.trim().match(/^(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?$/);
  if (!match || !validClock(match[1])) return { start: "", end: "" };
  return { start: match[1], end: match[2] && validClock(match[2]) ? match[2] : "" };
}

function readToken(part: string) {
  const splitAt = part.indexOf("=");
  const dayRaw = splitAt === -1 ? part : part.slice(0, splitAt);
  const timeRaw = splitAt === -1 ? "" : part.slice(splitAt + 1);
  if (!/^[0-6]$/.test(dayRaw)) return null;
  const value = Number(dayRaw);
  if (!WEEK_DAYS.some((day) => day.value === value)) return null;
  return { value, clock: readClock(timeRaw) };
}

export function parseDays(days: string) {
  return days
    .split(",")
    .map((part) => readToken(part)?.value)
    .filter((value): value is number => value != null);
}

export function parseSessionTimes(days: string) {
  const times: Record<number, SessionClock> = {};
  for (const part of days.split(",")) {
    const token = readToken(part);
    if (token && (token.clock.start || token.clock.end)) times[token.value] = token.clock;
  }
  return times;
}

export function serializeSessions(days: number[], times: Record<number, SessionClock>) {
  return days.map((day) => `${day}=${times[day].start}-${times[day].end}`).join(",");
}

export function sessionTimeError(days: number[], times: Record<number, SessionClock>) {
  if (days.length === 0) return "Choisissez au moins un jour.";
  for (const day of days) {
    const clock = times[day] ?? { start: "", end: "" };
    if (!validClock(clock.start) || !validClock(clock.end)) {
      return "Indiquez l'heure de début et l'heure de fin de chaque séance.";
    }
    if (clock.end <= clock.start) return "L'heure de fin doit être après l'heure de début.";
  }
  return null;
}

export function formatDays(days: string, length: "long" | "short" = "long") {
  return days
    .split(",")
    .flatMap((part) => {
      const token = readToken(part);
      if (!token) return [];
      const day = WEEK_DAYS.find((item) => item.value === token.value);
      if (!day) return [];
      const label = length === "short" ? day.label.slice(0, 3) : day.label;
      const range =
        token.clock.start && token.clock.end ? `${token.clock.start}–${token.clock.end}` : token.clock.start;
      return [range ? `${label} ${range}` : label];
    })
    .join(" · ");
}

export function insuranceState(
  hasInsurance: boolean,
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  now = new Date(),
) {
  if (!hasInsurance) return { label: "Pas d'assurance", tone: "muted" as const };
  if (!start || !end) return { label: "Dates manquantes", tone: "warning" as const };
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (endDate < startOfDay(now)) return { label: "Expirée", tone: "danger" as const };
  if (startDate > endOfDay(now)) return { label: "Pas encore commencée", tone: "warning" as const };
  return { label: "Valide", tone: "success" as const };
}
