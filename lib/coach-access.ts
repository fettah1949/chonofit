import { prisma } from "@/lib/prisma";

export async function coachGroupIds(user: { id: string; role: string }) {
  if (user.role !== "COACH") return null;
  const rows = await prisma.userGroup.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  return rows.map((row) => row.groupId);
}
