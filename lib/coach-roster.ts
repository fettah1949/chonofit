import { subDays, startOfDay } from "date-fns";
import { ageInYears, formatAge } from "@/lib/age";
import { insuranceState } from "@/lib/discipline";
import { formatShortDay, toInputDate } from "@/lib/format";

export function checkInSince(now = new Date()) {
  return subDays(startOfDay(now), 21);
}

export function coachMemberView(
  member: {
    sex: string;
    birthDate: Date | null;
    hasInsurance: boolean;
    insuranceStart: Date | null;
    insuranceEnd: Date | null;
    checkIns: { checkedInAt: Date }[];
  },
  now = new Date(),
) {
  const sexLabel = member.sex === "M" ? "Garçon" : member.sex === "F" ? "Fille" : "";
  const ageLabel = member.birthDate ? formatAge(ageInYears(member.birthDate, now)) : "";
  const insuranceLabel = insuranceState(member.hasInsurance, member.insuranceStart, member.insuranceEnd, now).label;
  const today = toInputDate(now);
  const todayCheck = member.checkIns.find((row) => toInputDate(row.checkedInAt) === today);
  const checkedInAt = todayCheck
    ? `${String(todayCheck.checkedInAt.getHours()).padStart(2, "0")}:${String(todayCheck.checkedInAt.getMinutes()).padStart(2, "0")}`
    : "";
  const checkDates = [...new Set(member.checkIns.map((row) => toInputDate(row.checkedInAt)))];
  const visits = member.checkIns.slice(0, 3).map((row) => formatShortDay(row.checkedInAt));
  return { sexLabel, ageLabel, insuranceLabel, checkedInAt, checkDates, visits };
}

export function missedLastSessions(days: number[], checkDates: string[], todayIso: string, count = 2) {
  const [year, month, day] = todayIso.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  const sessions: string[] = [];
  for (let i = 0; i < 28 && sessions.length < count; i += 1) {
    cursor.setDate(cursor.getDate() - 1);
    if (days.includes(cursor.getDay())) sessions.push(toInputDate(cursor));
  }
  return sessions.length > 0 && sessions.every((session) => !checkDates.includes(session));
}
