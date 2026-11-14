import type { Prisma } from "@prisma/client";

export class GearStockError extends Error {}

export async function takeGearStock(tx: Prisma.TransactionClient, lines: Iterable<[string, number]>) {
  for (const [itemId, quantity] of lines) {
    if (quantity <= 0) continue;
    const taken = await tx.equipmentItem.updateMany({
      where: { id: itemId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (taken.count === 1) continue;
    const item = await tx.equipmentItem.findUnique({
      where: { id: itemId },
      select: { name: true, pack: { select: { name: true } } },
    });
    const label = item ? `${item.name} · ${item.pack.name}` : "Cet article";
    throw new GearStockError(`Plus assez de ${label} en réserve.`);
  }
}

export async function returnGearStock(tx: Prisma.TransactionClient, itemIds: string[]) {
  const counts = new Map<string, number>();
  for (const itemId of itemIds) counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  for (const [itemId, quantity] of counts) {
    await tx.equipmentItem.update({
      where: { id: itemId },
      data: { stock: { increment: quantity } },
    });
  }
}
