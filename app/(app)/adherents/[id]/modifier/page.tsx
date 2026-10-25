import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { saveMember } from "@/actions/members";
import { MemberForm } from "@/components/members/member-form";
import { PageHeader } from "@/components/shared/page-header";
import { getSettings } from "@/lib/maintenance";
import { toInputDate } from "@/lib/format";
import { loadCatalog } from "@/lib/catalog";
import { formatDays } from "@/lib/discipline";

export const metadata: Metadata = { title: "Modifier un adhérent" };

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [settings, catalog, member] = await Promise.all([
    getSettings(),
    loadCatalog(prisma),
    prisma.member.findUnique({
      where: { id },
      include: {
        activities: true,
        groups: true,
        equipmentPurchases: { include: { item: { include: { pack: true } } }, orderBy: { purchasedAt: "desc" } },
      },
    }),
  ]);
  if (!member) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Modifier l'adhérent" description={`${member.firstName} ${member.lastName}`} />
      <MemberForm
        action={saveMember}
        currency={settings.currency}
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
        purchases={member.equipmentPurchases.map((purchase) => ({
          id: purchase.id,
          itemName: purchase.item.name,
          packName: purchase.item.pack.name,
          unitPrice: purchase.unitPrice,
          purchasedAt: purchase.purchasedAt.toISOString(),
        }))}
        member={{
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          phone: member.phone,
          phone2: member.phone2,
          guardianName: member.guardianName,
          guardianRelation: member.guardianRelation,
          birthDate: toInputDate(member.birthDate),
          sex: member.sex,
          notes: member.notes,
          photoPath: member.photoPath ?? "",
          hasInsurance: member.hasInsurance,
          insuranceStart: toInputDate(member.insuranceStart),
          insuranceEnd: toInputDate(member.insuranceEnd),
          activityIds: member.activities.map((activity) => activity.activityId),
          groupIds: member.groups.map((group) => group.groupId),
          ownedItemIds: [...new Set(member.equipmentPurchases.map((purchase) => purchase.itemId))],
        }}
      />
    </div>
  );
}
