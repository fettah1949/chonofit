import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { formatMonthLabel, formatShortDay, toInputDate } from "@/lib/format";
import { listRenewals } from "@/lib/renewals";
import { isSubscriptionCurrent } from "@/lib/status";
import { roundMoney } from "@/lib/utils";

const OTHER_METHODS = ["CARD", "TRANSFER", "OTHER"];

type DashboardPayment = {
  paidAt: Date;
  amount: number;
  method: string;
  subscriptionId: string | null;
  member: { id: string; firstName: string; lastName: string };
};

export async function getDashboardData(currency: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const chartStart = startOfMonth(subMonths(now, 5));
  const renewals = await listRenewals();
  const upcoming = renewals.filter((subscription) => subscription.endDate && subscription.endDate >= todayStart);

  const [activeSubscriptions, payments, checkIns, members, blockedCandidates, openAdvances] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: todayEnd },
        OR: [{ endDate: null }, { endDate: { gte: todayStart } }],
        member: { status: "ACTIVE" },
      },
      select: { memberId: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: chartStart } },
      select: {
        paidAt: true,
        amount: true,
        method: true,
        subscriptionId: true,
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.checkIn.findMany({
      where: { checkedInAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { checkedInAt: "asc" },
      select: {
        memberId: true,
        checkedInAt: true,
        member: { select: { firstName: true, lastName: true, photoPath: true } },
      },
    }),
    prisma.member.findMany({
      where: { createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.member.findMany({
      where: {
        OR: [
          { status: "SUSPENDED" },
          {
            subscriptions: {
              some: {
                status: "SUSPENDED",
                startDate: { lte: todayEnd },
                OR: [{ endDate: null }, { endDate: { gte: todayStart } }],
              },
            },
          },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoPath: true,
        status: true,
        subscriptions: {
          where: {
            status: { in: ["ACTIVE", "SUSPENDED"] },
            startDate: { lte: todayEnd },
            OR: [{ endDate: null }, { endDate: { gte: todayStart } }],
          },
          select: {
            status: true,
            startDate: true,
            endDate: true,
            plan: { select: { name: true } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: { remainder: { gt: 0 } },
      orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }, { paidAt: "asc" }],
      select: {
        id: true,
        amount: true,
        remainder: true,
        receiptNumber: true,
        member: { select: { id: true, firstName: true, lastName: true, photoPath: true } },
        subscription: { select: { plan: { select: { name: true } } } },
      },
    }),
  ]);

  const monthPayments = payments.filter((payment) => payment.paidAt >= monthStart && payment.paidAt <= monthEnd);
  const subscriptionIds = [
    ...new Set(monthPayments.flatMap((payment) => (payment.subscriptionId ? [payment.subscriptionId] : []))),
  ];
  const priorGroups = subscriptionIds.length
    ? await prisma.payment.groupBy({
        by: ["subscriptionId"],
        where: { subscriptionId: { in: subscriptionIds }, paidAt: { lt: monthStart } },
        _count: { _all: true },
      })
    : [];
  const priorCounts = new Map(
    priorGroups.flatMap((group) => (group.subscriptionId ? [[group.subscriptionId, group._count._all] as const] : [])),
  );

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = startOfMonth(subMonths(now, 5 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatMonthLabel(date),
      members: 0,
      revenue: 0,
    };
  });
  const monthIndex = new Map(months.map((month) => [month.key, month]));

  for (const member of members) {
    const date = member.createdAt;
    const bucket = monthIndex.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.members += 1;
  }
  for (const payment of payments) {
    const date = payment.paidAt;
    const bucket = monthIndex.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.revenue = roundMoney(bucket.revenue + payment.amount);
  }

  const todayPayments = payments.filter((payment) => payment.paidAt >= todayStart && payment.paidAt <= todayEnd);
  const cashPayments = todayPayments.filter((payment) => payment.method === "CASH");
  const otherBuckets = new Map<string, number>();
  for (const payment of todayPayments) {
    if (payment.method === "CASH") continue;
    otherBuckets.set(payment.method, roundMoney((otherBuckets.get(payment.method) ?? 0) + payment.amount));
  }
  const monthName = format(now, "MMMM", { locale: fr });

  return {
    currency,
    activeMembers: new Set(activeSubscriptions.map((item) => item.memberId)).size,
    expiringCount: upcoming.length,
    expiringHint: expiringHint(upcoming, now),
    expiring: renewals,
    monthLabel: monthName.charAt(0).toUpperCase() + monthName.slice(1),
    monthRevenue: roundMoney(monthPayments.reduce((sum, payment) => sum + payment.amount, 0)),
    duplicateReceipts: duplicateReceipts(monthPayments, priorCounts),
    today: {
      cash: roundMoney(cashPayments.reduce((sum, payment) => sum + payment.amount, 0)),
      cashCount: cashPayments.length,
      receiptCount: todayPayments.length,
      others: OTHER_METHODS.flatMap((method) => {
        const amount = otherBuckets.get(method) ?? 0;
        return amount > 0 ? [{ method, amount }] : [];
      }),
    },
    visitors: groupVisitors(checkIns),
    blockedMembers: blockedMembers(blockedCandidates),
    advances: openAdvances.map((payment) => ({
      id: payment.id,
      memberId: payment.member.id,
      firstName: payment.member.firstName,
      lastName: payment.member.lastName,
      photoPath: payment.member.photoPath,
      planName: payment.subscription?.plan.name ?? "",
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      remainder: payment.remainder,
    })),
    months,
  };
}

function expiringHint(
  upcoming: { reminder: { status: string; createdAt: Date } | null }[],
  now: Date,
) {
  if (upcoming.length === 0) return "Rien cette semaine";
  const reminded = upcoming.filter((item) => item.reminder?.status === "SENT");
  const pending = upcoming.length - reminded.length;
  if (pending === 0 && reminded.length === 1 && reminded[0].reminder) {
    const sentAt = reminded[0].reminder.createdAt;
    if (startOfDay(sentAt).getTime() === startOfDay(now).getTime()) {
      return `Relancé à ${format(sentAt, "HH:mm")}`;
    }
    return `Relancé le ${format(sentAt, "d MMM", { locale: fr })}`;
  }
  if (pending === 0) return reminded.length > 1 ? `${reminded.length} relancés` : "Relancé";
  if (reminded.length === 0) return "À relancer";
  const pendingLabel = pending > 1 ? `${pending} à relancer` : "1 à relancer";
  const remindedLabel = reminded.length > 1 ? `${reminded.length} relancés` : "1 relancé";
  return `${pendingLabel} · ${remindedLabel}`;
}

function duplicateReceipts(monthPayments: DashboardPayment[], priorCounts: Map<string, number>) {
  const bySubscription = new Map<string, DashboardPayment[]>();
  for (const payment of monthPayments) {
    if (!payment.subscriptionId) continue;
    const rows = bySubscription.get(payment.subscriptionId) ?? [];
    rows.push(payment);
    bySubscription.set(payment.subscriptionId, rows);
  }

  const byMember = new Map<string, { firstName: string; lastName: string; amount: number; extraCount: number }>();
  for (const [subscriptionId, rows] of bySubscription) {
    const ordered = [...rows].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
    const extras = (priorCounts.get(subscriptionId) ?? 0) > 0 ? ordered : ordered.slice(1);
    if (extras.length === 0) continue;
    const member = ordered[0].member;
    const current = byMember.get(member.id) ?? {
      firstName: member.firstName,
      lastName: member.lastName,
      amount: 0,
      extraCount: 0,
    };
    current.amount = roundMoney(current.amount + extras.reduce((sum, row) => sum + row.amount, 0));
    current.extraCount += extras.length;
    byMember.set(member.id, current);
  }
  return [...byMember.values()];
}

function groupVisitors(
  checkIns: {
    memberId: string;
    checkedInAt: Date;
    member: { firstName: string; lastName: string; photoPath: string | null };
  }[],
) {
  const byMember = new Map<
    string,
    {
      memberId: string;
      firstName: string;
      lastName: string;
      photoPath: string | null;
      firstAt: Date;
      lastAt: Date;
      count: number;
    }
  >();
  for (const checkIn of checkIns) {
    const current = byMember.get(checkIn.memberId);
    if (!current) {
      byMember.set(checkIn.memberId, {
        memberId: checkIn.memberId,
        firstName: checkIn.member.firstName,
        lastName: checkIn.member.lastName,
        photoPath: checkIn.member.photoPath,
        firstAt: checkIn.checkedInAt,
        lastAt: checkIn.checkedInAt,
        count: 1,
      });
      continue;
    }
    current.count += 1;
    if (checkIn.checkedInAt < current.firstAt) current.firstAt = checkIn.checkedInAt;
    if (checkIn.checkedInAt > current.lastAt) current.lastAt = checkIn.checkedInAt;
  }
  return [...byMember.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

function blockedMembers(
  members: {
    id: string;
    firstName: string;
    lastName: string;
    photoPath: string | null;
    status: string;
    subscriptions: {
      status: string;
      startDate: Date;
      endDate: Date | null;
      plan: { name: string };
    }[];
  }[],
) {
  return members.flatMap((member) => {
    const open = member.subscriptions;
    if (open.length === 0) return [];
    const blocked = member.status === "SUSPENDED" || !open.some((subscription) => isSubscriptionCurrent(subscription));
    if (!blocked) return [];
    const period =
      open.find((subscription) => isSubscriptionCurrent(subscription)) ??
      [...open].sort((a, b) => {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return a.endDate.getTime() - b.endDate.getTime();
      })[0];
    return [
      {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        photoPath: member.photoPath,
        planName: period.plan.name,
        endDate: period.endDate,
      },
    ];
  });
}

export async function getCheckinStats(period: "jour" | "7" | "mois" = "jour") {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(subDays(now, 6));
  const monthStart = startOfMonth(now);
  const chartStart = startOfDay(subDays(now, 13));
  const listStart = period === "mois" ? monthStart : period === "7" ? weekStart : todayStart;

  const [todayCount, weekCount, monthCount, recent, chartRows] = await Promise.all([
    prisma.checkIn.count({ where: { checkedInAt: { gte: todayStart } } }),
    prisma.checkIn.count({ where: { checkedInAt: { gte: weekStart } } }),
    prisma.checkIn.count({ where: { checkedInAt: { gte: monthStart } } }),
    prisma.checkIn.findMany({
      where: { checkedInAt: { gte: listStart } },
      orderBy: { checkedInAt: "desc" },
      include: { member: true },
      take: 80,
    }),
    prisma.checkIn.findMany({
      where: { checkedInAt: { gte: chartStart } },
      select: { checkedInAt: true },
    }),
  ]);

  const days = eachDayOfInterval({ start: chartStart, end: todayStart }).map((day) => ({
    key: toInputDate(day),
    label: format(day, "d", { locale: fr }),
    hint: formatShortDay(day),
    value: 0,
  }));
  const dayIndex = new Map(days.map((day) => [day.key, day]));
  for (const row of chartRows) {
    const bucket = dayIndex.get(toInputDate(row.checkedInAt));
    if (bucket) bucket.value += 1;
  }

  return {
    todayCount,
    weekCount,
    monthCount,
    recent,
    days,
    rangeLabel: `${formatShortDay(chartStart)} – ${formatShortDay(todayStart)}`,
  };
}

export type GearPeriod = "jour" | "7" | "mois" | "tous";

const gearPeriods: GearPeriod[] = ["jour", "7", "mois", "tous"];

export async function getGearStats(period: GearPeriod = "mois") {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfDay(subDays(now, 6));
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const chartStart = startOfMonth(subMonths(now, 5));
  const bounds: Record<GearPeriod, { start: Date | null; end: Date | null }> = {
    jour: { start: todayStart, end: todayEnd },
    "7": { start: weekStart, end: todayEnd },
    mois: { start: monthStart, end: monthEnd },
    tous: { start: null, end: null },
  };
  const purchases = await prisma.equipmentPurchase.findMany({
    select: {
      unitPrice: true,
      purchasedAt: true,
      item: { select: { id: true, name: true, activity: { select: { name: true } } } },
    },
  });

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = startOfMonth(subMonths(now, 5 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatMonthLabel(date),
      count: 0,
      amount: 0,
    };
  });
  const monthIndex = new Map(months.map((month) => [month.key, month]));
  const items = new Map<string, { id: string; name: string; activity: string; count: number; amount: number }>();
  const counts: Record<GearPeriod, number> = { jour: 0, "7": 0, mois: 0, tous: 0 };
  let amount = 0;
  let count = 0;
  let monthAmount = 0;
  let todayAmount = 0;

  for (const purchase of purchases) {
    const bucket = monthIndex.get(`${purchase.purchasedAt.getFullYear()}-${purchase.purchasedAt.getMonth()}`);
    if (purchase.purchasedAt >= chartStart && purchase.purchasedAt <= monthEnd && bucket) {
      bucket.count += 1;
      bucket.amount = roundMoney(bucket.amount + purchase.unitPrice);
    }
    for (const key of gearPeriods) {
      if (inGearPeriod(purchase.purchasedAt, bounds[key])) counts[key] += 1;
    }
    if (inGearPeriod(purchase.purchasedAt, bounds.mois)) monthAmount = roundMoney(monthAmount + purchase.unitPrice);
    if (inGearPeriod(purchase.purchasedAt, bounds.jour)) todayAmount = roundMoney(todayAmount + purchase.unitPrice);
    if (!inGearPeriod(purchase.purchasedAt, bounds[period])) continue;
    count += 1;
    amount = roundMoney(amount + purchase.unitPrice);
    const current = items.get(purchase.item.id) ?? {
      id: purchase.item.id,
      name: purchase.item.name,
      activity: purchase.item.activity.name,
      count: 0,
      amount: 0,
    };
    current.count += 1;
    current.amount = roundMoney(current.amount + purchase.unitPrice);
    items.set(purchase.item.id, current);
  }

  return {
    period,
    amount,
    count,
    monthCount: counts.mois,
    monthAmount,
    todayCount: counts.jour,
    todayAmount,
    counts,
    months,
    items: [...items.values()].sort(
      (left, right) => right.amount - left.amount || left.name.localeCompare(right.name, "fr"),
    ),
  };
}

function inGearPeriod(date: Date, bound: { start: Date | null; end: Date | null }) {
  if (bound.start && date < bound.start) return false;
  if (bound.end && date > bound.end) return false;
  return true;
}

export const STAT_MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function statMonth(mois: string | undefined, annee: string | undefined, now = new Date()) {
  const yearNum = Number(annee);
  const monthNum = Number(mois);
  const year = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= now.getFullYear() + 1 ? yearNum : now.getFullYear();
  const month = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : now.getMonth() + 1;
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  const raw = format(start, "MMMM yyyy", { locale: fr });
  return { year, month, start, end, label: raw.charAt(0).toUpperCase() + raw.slice(1) };
}

export async function getChosenMonthStats(start: Date, end: Date) {
  const [subscriptions, purchases, firstSubscription, firstPurchase] = await Promise.all([
    prisma.subscription.findMany({
      where: { startDate: { gte: start, lte: end } },
      select: { price: true, plan: { select: { id: true, name: true } } },
    }),
    prisma.equipmentPurchase.findMany({
      where: { purchasedAt: { gte: start, lte: end } },
      select: {
        unitPrice: true,
        item: { select: { id: true, name: true, activity: { select: { name: true } } } },
      },
    }),
    prisma.subscription.findFirst({ orderBy: { startDate: "asc" }, select: { startDate: true } }),
    prisma.equipmentPurchase.findFirst({ orderBy: { purchasedAt: "asc" }, select: { purchasedAt: true } }),
  ]);

  const plans = new Map<string, { id: string; name: string; count: number; amount: number }>();
  let subscriptionAmount = 0;
  for (const subscription of subscriptions) {
    subscriptionAmount = roundMoney(subscriptionAmount + subscription.price);
    const current = plans.get(subscription.plan.id) ?? {
      id: subscription.plan.id,
      name: subscription.plan.name,
      count: 0,
      amount: 0,
    };
    current.count += 1;
    current.amount = roundMoney(current.amount + subscription.price);
    plans.set(subscription.plan.id, current);
  }

  const items = new Map<string, { id: string; name: string; activity: string; count: number; amount: number }>();
  let gearAmount = 0;
  let gearCount = 0;
  for (const purchase of purchases) {
    gearCount += 1;
    gearAmount = roundMoney(gearAmount + purchase.unitPrice);
    const current = items.get(purchase.item.id) ?? {
      id: purchase.item.id,
      name: purchase.item.name,
      activity: purchase.item.activity.name,
      count: 0,
      amount: 0,
    };
    current.count += 1;
    current.amount = roundMoney(current.amount + purchase.unitPrice);
    items.set(purchase.item.id, current);
  }

  const firstYear = Math.min(
    firstSubscription?.startDate.getFullYear() ?? new Date().getFullYear(),
    firstPurchase?.purchasedAt.getFullYear() ?? new Date().getFullYear(),
    new Date().getFullYear() - 2,
  );
  const years = Array.from({ length: new Date().getFullYear() - firstYear + 1 }, (_, index) => new Date().getFullYear() - index);

  return {
    years,
    subscriptions: {
      count: subscriptions.length,
      amount: subscriptionAmount,
      plans: [...plans.values()].sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name, "fr")),
    },
    gear: {
      count: gearCount,
      amount: gearAmount,
      items: [...items.values()].sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name, "fr")),
    },
  };
}
