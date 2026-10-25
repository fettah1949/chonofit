import type { Metadata } from "next";
import { saveMember } from "@/actions/members";
import { MemberForm } from "@/components/members/member-form";
import { PageHeader } from "@/components/shared/page-header";
import { getSettings } from "@/lib/maintenance";
import { prisma } from "@/lib/prisma";
import { loadCatalog } from "@/lib/catalog";
import { formatDays } from "@/lib/discipline";

export const metadata: Metadata = { title: "Nouvel adhérent" };

export default async function NewMemberPage() {
  const [settings, catalog, plans] = await Promise.all([
    getSettings(),
    loadCatalog(prisma),
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { price: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Nouvel adhérent" description="Activité, assurance, groupe, tenue et paiement. La photo est facultative." />
      <MemberForm
        action={saveMember}
        currency={settings.currency}
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
        }))}
        activities={catalog.activities.map((activity) => ({ id: activity.id, name: activity.name }))}
        groups={catalog.groups.map((group) => ({
          id: group.id,
          name: group.name,
          activityId: group.activityId,
          daysLabel: formatDays(group.days),
          ageMin: group.ageMin,
          ageMax: group.ageMax,
        }))}
        packs={catalog.packs.map((pack) => ({
          id: pack.id,
          name: pack.name,
          activityId: pack.activityId,
          price: pack.price,
        }))}
        items={catalog.items.map((item) => ({
          id: item.id,
          name: item.name,
          packId: item.packId,
          activityId: item.activityId,
          price: item.price,
        }))}
      />
    </div>
  );
}
