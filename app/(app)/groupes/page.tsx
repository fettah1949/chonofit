import type { Metadata } from "next";
import { GroupAssigner } from "@/components/groups/group-assigner";
import { PageHeader } from "@/components/shared/page-header";
import { checkInSince, coachMemberView } from "@/lib/coach-roster";
import { describeGroup } from "@/lib/age";
import { formatDays, parseDays } from "@/lib/discipline";
import { toInputDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { coachGroupIds } from "@/lib/coach-access";
import { requireUser } from "@/lib/session";
import { memberDisplayStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Groupes" };

export default async function GroupsAssignPage() {
  const now = new Date();
  const user = await requireUser();
  const assigned = await coachGroupIds(user);
  const [activities, groups] = await Promise.all([
    prisma.activity.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.trainingGroup.findMany({
      where: assigned ? { id: { in: assigned } } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        members: {
          include: {
            member: {
              include: {
                subscriptions: { orderBy: { startDate: "desc" }, take: 3 },
                checkIns: {
                  where: { checkedInAt: { gte: checkInSince(now) } },
                  orderBy: { checkedInAt: "desc" },
                  take: 30,
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Groupes" />
      <GroupAssigner
        weekday={now.getDay()}
        today={toInputDate(now)}
        activities={activities
          .filter((activity) => groups.some((group) => group.activityId === activity.id))
          .map((activity) => ({ id: activity.id, name: activity.name }))}
        groups={groups.map((group) => ({
          id: group.id,
          name: group.name,
          activityId: group.activityId,
          days: parseDays(group.days),
          daysLabel: describeGroup(formatDays(group.days, "short"), group.ageMin, group.ageMax),
          members: group.members
            .map((row) => row.member)
            .sort(
              (a, b) =>
                a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr"),
            )
            .map((member) => ({
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              phone: member.phone,
              photoPath: member.photoPath,
              status: memberDisplayStatus(member),
              ...coachMemberView(member, now),
            })),
        }))}
      />
    </div>
  );
}
