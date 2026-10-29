"use server";

import { revalidatePath } from "next/cache";
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { coachGroupIds } from "@/lib/coach-access";
import { requireUser } from "@/lib/session";
import { searchMemberIds } from "@/lib/search";
import { currentSubscription, memberDisplayStatus } from "@/lib/status";
import { refreshExpiredSubscriptions } from "@/lib/maintenance";
import type { ActionState } from "@/lib/action-state";

export async function searchMembersForCheckin(query: string) {
  await requireUser();
  await refreshExpiredSubscriptions();
  const q = query.trim();
  if (q.length < 2) return [];

  const ids = await searchMemberIds(q, { email: false, take: 8 });
  if (ids.length === 0) return [];
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const members = await prisma.member.findMany({
    where: { id: { in: ids } },
    include: {
      subscriptions: {
        orderBy: { startDate: "desc" },
        take: 3,
        include: { plan: true },
      },
      checkIns: {
        where: { checkedInAt: { gte: todayStart, lte: todayEnd } },
        orderBy: { checkedInAt: "desc" },
        take: 1,
      },
    },
  });
  const byId = new Map(members.map((member) => [member.id, member]));

  return ids.flatMap((id) => {
    const member = byId.get(id);
    if (!member) return [];
    const current = currentSubscription(member.subscriptions);
    return [{
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      phone2: member.phone2,
      photoPath: member.photoPath,
      status: memberDisplayStatus(member),
      planName: current?.plan.name ?? "Sans abonnement",
      startDate: current?.startDate?.toISOString() ?? null,
      endDate: current?.endDate?.toISOString() ?? null,
      checkedInAt: member.checkIns[0]?.checkedInAt.toISOString() ?? null,
    }];
  });
}

export async function createCheckIn(memberId: string): Promise<ActionState> {
  const user = await requireUser();
  const allowed = await coachGroupIds(user);
  if (allowed) {
    const inGroup = await prisma.memberGroup.findFirst({
      where: { memberId, groupId: { in: allowed } },
      select: { memberId: true },
    });
    if (!inGroup) return { error: "Ce participant n'est pas dans vos groupes." };
  }
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { error: "Adhérent introuvable." };

  const todayStart = startOfDay(new Date());
  const already = await prisma.checkIn.findFirst({
    where: { memberId, checkedInAt: { gte: todayStart, lte: endOfDay(todayStart) } },
  });
  if (already) return { success: `${member.firstName} ${member.lastName} est déjà pointé aujourd'hui.` };

  await prisma.checkIn.create({
    data: { memberId, createdById: user.id },
  });
  revalidatePath("/pointage");
  revalidatePath("/groupes");
  revalidatePath("/");
  return { success: `Entrée enregistrée pour ${member.firstName} ${member.lastName}.` };
}
