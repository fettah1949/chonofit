import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toInputDate } from "@/lib/format";

export const RENEWAL_UPCOMING_DAYS = 7;
export const RENEWAL_LAPSED_DAYS = 30;

type CoverageRow = {
  memberId: string;
  planId: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  plan?: { active: boolean; price: number };
};

export function nextPeriodStart(endDate: Date | null | undefined, now = new Date()) {
  const today = startOfDay(now);
  if (!endDate || startOfDay(endDate) < today) return toInputDate(today);
  return toInputDate(addDays(startOfDay(endDate), 1));
}

export function pickLatest<T extends { status: string; startDate: Date; endDate: Date | null }>(subs: T[]) {
  const unlimited = subs.find((sub) => sub.status === "ACTIVE" && !sub.endDate);
  if (unlimited) return unlimited;
  return [...subs].sort((a, b) => {
    const endA = a.endDate?.getTime() ?? -1;
    const endB = b.endDate?.getTime() ?? -1;
    if (endB !== endA) return endB - endA;
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
    return b.startDate.getTime() - a.startDate.getTime();
  })[0];
}

export function inRenewalWindow(endDate: Date, now = new Date()) {
  const day = startOfDay(endDate);
  return day >= startOfDay(subDays(now, RENEWAL_LAPSED_DAYS)) && day <= endOfDay(addDays(now, RENEWAL_UPCOMING_DAYS));
}

export async function listRenewals() {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "EXPIRED", "SUSPENDED"] } },
    include: { member: true, plan: true },
  });
  const byMember = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const group = byMember.get(subscription.memberId) ?? [];
    group.push(subscription);
    byMember.set(subscription.memberId, group);
  }

  const due = [];
  for (const group of byMember.values()) {
    const latest = pickLatest(group);
    if (!latest?.endDate || !inRenewalWindow(latest.endDate)) continue;
    due.push(latest);
  }
  due.sort((a, b) => a.endDate!.getTime() - b.endDate!.getTime());
  const reminders = await prisma.reminder.findMany({
    where: { subscriptionId: { in: due.map((item) => item.id) } },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, (typeof reminders)[number]>();
  for (const reminder of reminders) {
    if (reminder.subscriptionId && !latest.has(reminder.subscriptionId)) latest.set(reminder.subscriptionId, reminder);
  }
  return due.map((item) => ({ ...item, reminder: latest.get(item.id) ?? null }));
}

export function coverageByMember(rows: CoverageRow[]) {
  const byMember = new Map<string, CoverageRow[]>();
  for (const row of rows) {
    const group = byMember.get(row.memberId) ?? [];
    group.push(row);
    byMember.set(row.memberId, group);
  }

  const coverage: Record<string, { planId: string; startDate: string }> = {};
  for (const [memberId, group] of byMember) {
    const latest = pickLatest(group);
    if (!latest) continue;
    coverage[memberId] = {
      planId: latest.plan?.active === false ? "" : latest.planId,
      startDate: nextPeriodStart(latest.endDate),
    };
  }
  return coverage;
}
