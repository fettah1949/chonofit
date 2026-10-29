import Link from "next/link";
import type { Metadata } from "next";
import { endOfDay, format, isToday, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { CheckinPanel } from "@/components/checkin/checkin-panel";
import { MemberAvatar } from "@/components/members/member-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { getCheckinStats } from "@/lib/stats";
import { currentSubscription, memberDisplayStatus } from "@/lib/status";
import { describeGroup } from "@/lib/age";
import { formatDays, parseDays } from "@/lib/discipline";
import { formatDate, toInputDate } from "@/lib/format";
import { cn, withQuery } from "@/lib/utils";

export const metadata: Metadata = { title: "Pointage" };

const periods = [
  { value: "jour", label: "Aujourd'hui" },
  { value: "7", label: "7 jours" },
  { value: "mois", label: "Ce mois" },
] as const;

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const params = await searchParams;
  const periode = params.periode === "7" || params.periode === "mois" ? params.periode : "jour";
  const now = new Date();
  const todayStart = startOfDay(now);
  const [stats, members, trainingGroups] = await Promise.all([
    getCheckinStats(periode),
    prisma.member.findMany({
      where: { groups: { some: {} } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        subscriptions: { orderBy: { startDate: "desc" }, take: 3, include: { plan: true } },
        checkIns: {
          where: { checkedInAt: { gte: todayStart, lte: endOfDay(todayStart) } },
          orderBy: { checkedInAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.trainingGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { members: { select: { memberId: true } } },
    }),
  ]);
  const max = Math.max(1, ...stats.days.map((day) => day.value));
  const todayKey = toInputDate(now);
  const counts: Record<(typeof periods)[number]["value"], number> = {
    jour: stats.todayCount,
    "7": stats.weekCount,
    mois: stats.monthCount,
  };
  const groups: { key: string; label: string; items: typeof stats.recent }[] = [];

  for (const checkIn of stats.recent) {
    const key = toInputDate(checkIn.checkedInAt);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({
        key,
        label: isToday(checkIn.checkedInAt) ? "Aujourd'hui" : formatDate(checkIn.checkedInAt),
        items: [checkIn],
      });
    } else {
      last.items.push(checkIn);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Pointage" />
      <CheckinPanel
        members={members.map((member) => {
          const current = currentSubscription(member.subscriptions);
          return {
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone,
            phone2: member.phone2 ?? "",
            photoPath: member.photoPath,
            status: memberDisplayStatus(member),
            planName: current?.plan.name ?? "Sans abonnement",
            startDate: current?.startDate?.toISOString() ?? null,
            endDate: current?.endDate?.toISOString() ?? null,
            checkedInAt: member.checkIns[0]?.checkedInAt.toISOString() ?? null,
          };
        })}
        sessions={trainingGroups.map((group) => ({
          id: group.id,
          name: group.name,
          daysLabel: describeGroup(formatDays(group.days, "short"), group.ageMin, group.ageMax),
          today: parseDays(group.days).includes(now.getDay()),
          memberIds: group.members.map((row) => row.memberId),
        }))}
      />
      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {periods.map((filter) => {
            const pressed = periode === filter.value;
            return (
              <Link
                key={filter.value}
                href={filter.value === "jour" ? "/pointage" : withQuery("/pointage", { periode: filter.value })}
                aria-current={pressed ? "page" : undefined}
                className={cn(
                  "h-10 rounded-xl border px-3 text-sm font-medium leading-10",
                  pressed ? "border-primary bg-accent" : "bg-card",
                )}
              >
                {filter.label} {counts[filter.value]}
              </Link>
            );
          })}
        </div>
        {groups.length === 0 ? (
          <p className="rounded-2xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            {periode === "jour" ? "Aucune entrée aujourd'hui." : "Aucune entrée sur cette période."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="border-t bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground first:border-t-0">
                  {group.label}
                </p>
                <div className="divide-y">
                  {group.items.map((checkIn) => (
                    <Link
                      key={checkIn.id}
                      href={`/adherents/${checkIn.member.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/70"
                    >
                      <MemberAvatar
                        firstName={checkIn.member.firstName}
                        lastName={checkIn.member.lastName}
                        photoPath={checkIn.member.photoPath}
                        className="h-11 w-11 shrink-0 rounded-full text-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {checkIn.member.firstName} {checkIn.member.lastName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">{checkIn.member.phone}</p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{format(checkIn.checkedInAt, "HH:mm")}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">14 jours</h2>
          <p className="text-sm text-muted-foreground">{stats.rangeLabel}</p>
        </div>
        <div className="flex items-end gap-1">
          {stats.days.map((day) => (
            <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${day.hint} · ${day.value}`}>
              <span className="h-4 text-[10px] tabular-nums text-muted-foreground">{day.value > 0 ? day.value : ""}</span>
              <div className="flex h-10 w-full items-end justify-center">
                <div
                  className={cn(
                    "w-full max-w-8 rounded-md",
                    day.value > 0 ? "bg-primary" : "bg-border",
                    day.key === todayKey && day.value > 0 ? "ring-2 ring-primary/30" : "",
                  )}
                  style={{ height: `${Math.max(day.value > 0 ? 6 : 3, Math.round((day.value / max) * 40))}px` }}
                />
              </div>
              <span className={cn("text-[11px] tabular-nums", day.key === todayKey ? "font-medium text-foreground" : "text-muted-foreground")}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
