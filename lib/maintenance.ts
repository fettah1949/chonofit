import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function refreshExpiredSubscriptions() {
  await prisma.subscription.updateMany({
    where: {
      status: { in: ["ACTIVE", "SUSPENDED"] },
      endDate: { lt: startOfDay(new Date()) },
    },
    data: { status: "EXPIRED" },
  });
}

export async function getSettings() {
  return prisma.gymSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", name: "Chrono Fitness", currency: "MAD" },
  });
}
