import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { GroupEditor } from "@/components/settings/group-editor";
import { loadCatalog } from "@/lib/catalog";
import { parseDays, parseSessionTimes } from "@/lib/discipline";

export const metadata: Metadata = { title: "Groupes" };

export default async function GroupsPage() {
  const [catalog, memberCounts] = await Promise.all([
    loadCatalog(prisma),
    prisma.memberGroup.groupBy({ by: ["groupId"], _count: { _all: true } }),
  ]);
  const activities = new Map(catalog.activities.map((activity) => [activity.id, activity.name]));
  const membersByGroup = new Map(memberCounts.map((row) => [row.groupId, row._count._all]));

  return (
    <div className="space-y-6">
      <PageHeader title="Groupes" description="Début, fin de chaque séance et tranche d'âge, groupe par groupe." />
      <SettingsNav />
      <GroupEditor
        activities={catalog.activities.map((activity) => ({ id: activity.id, name: activity.name }))}
        groups={catalog.groups.map((group) => ({
          id: group.id,
          name: group.name,
          activityId: group.activityId,
          activityName: activities.get(group.activityId) ?? "",
          memberCount: membersByGroup.get(group.id) ?? 0,
          days: parseDays(group.days),
          times: parseSessionTimes(group.days),
          ageMin: group.ageMin,
          ageMax: group.ageMax,
        }))}
      />
    </div>
  );
}
