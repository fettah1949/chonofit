import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { UserManager } from "@/components/settings/user-manager";
import type { Role } from "@/lib/constants";
import { describeGroup } from "@/lib/age";
import { formatDays } from "@/lib/discipline";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const current = await requireAdmin();
  const [users, groups] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { coachGroups: { select: { groupId: true } } },
    }),
    prisma.trainingGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { activity: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" description="Admins, réceptionnistes et coachs." />
      <SettingsNav />
      <UserManager
        currentUserId={current.id}
        groups={groups.map((group) => ({
          id: group.id,
          name: group.name,
          activityName: group.activity.name,
          daysLabel: describeGroup(formatDays(group.days, "short"), group.ageMin, group.ageMax),
        }))}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          active: user.active,
          groupIds: user.coachGroups.map((row) => row.groupId),
        }))}
      />
    </div>
  );
}
