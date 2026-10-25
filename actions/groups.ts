"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { coachGroupIds } from "@/lib/coach-access";
import { checkInSince, coachMemberView } from "@/lib/coach-roster";
import { searchMemberIds } from "@/lib/search";
import { ageInYears, groupAgeMessage } from "@/lib/age";
import { memberDisplayStatus } from "@/lib/status";
import type { ActionState } from "@/lib/action-state";

export async function searchMembersForAssignment(query: string) {
  const user = await requireUser();
  const allowed = await coachGroupIds(user);
  if (allowed && allowed.length === 0) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const ids = await searchMemberIds(q, { email: false, take: 6 });
  if (ids.length === 0) return [];
  const members = await prisma.member.findMany({
    where: { id: { in: ids } },
    include: {
      groups: { select: { groupId: true } },
      subscriptions: { orderBy: { startDate: "desc" }, take: 3 },
      checkIns: { where: { checkedInAt: { gte: checkInSince() } }, orderBy: { checkedInAt: "desc" }, take: 30 },
    },
  });
  const byId = new Map(members.map((member) => [member.id, member]));

  return ids.flatMap((id) => {
    const member = byId.get(id);
    if (!member) return [];
    const groupIds = member.groups.map((row) => row.groupId);
    const inRoster = !allowed || groupIds.some((groupId) => allowed.includes(groupId));
    const view = inRoster
      ? coachMemberView(member)
      : { sexLabel: "", ageLabel: "", insuranceLabel: "", checkedInAt: "", checkDates: [] as string[], visits: [] as string[] };
    return [{
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: inRoster ? member.phone : "",
      photoPath: member.photoPath,
      status: memberDisplayStatus(member),
      ...view,
      groupIds: allowed ? groupIds.filter((groupId) => allowed.includes(groupId)) : groupIds,
    }];
  });
}

export async function assignMemberToGroup(memberId: string, groupId: string): Promise<ActionState> {
  const user = await requireUser();
  const allowed = await coachGroupIds(user);
  if (allowed && !allowed.includes(groupId)) return { error: "Ce groupe ne vous est pas attribué." };
  const [member, group] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.trainingGroup.findUnique({ where: { id: groupId } }),
  ]);
  if (!member) return { error: "Adhérent introuvable." };
  if (!group) return { error: "Groupe introuvable." };
  const message = groupAgeMessage(group.name, member.birthDate ? ageInYears(member.birthDate) : null, group.ageMin, group.ageMax);
  if (message) return { error: message };

  await prisma.$transaction([
    prisma.memberGroup.upsert({
      where: { memberId_groupId: { memberId, groupId } },
      create: { memberId, groupId },
      update: {},
    }),
    prisma.memberActivity.upsert({
      where: { memberId_activityId: { memberId, activityId: group.activityId } },
      create: { memberId, activityId: group.activityId },
      update: {},
    }),
  ]);

  revalidatePath("/groupes");
  revalidatePath("/adherents");
  revalidatePath(`/adherents/${memberId}`);
  revalidatePath("/parametres/groupes");
  return { success: `${member.firstName} ${member.lastName} est dans ${group.name}.` };
}

export async function removeMemberFromGroup(memberId: string, groupId: string): Promise<ActionState> {
  const user = await requireUser();
  const allowed = await coachGroupIds(user);
  if (allowed && !allowed.includes(groupId)) return { error: "Ce groupe ne vous est pas attribué." };
  const group = await prisma.trainingGroup.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Groupe introuvable." };
  await prisma.memberGroup.deleteMany({ where: { memberId, groupId } });
  revalidatePath("/groupes");
  revalidatePath("/adherents");
  revalidatePath(`/adherents/${memberId}`);
  revalidatePath("/parametres/groupes");
  return { success: `Retiré de ${group.name}.` };
}
