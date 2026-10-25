import type { Prisma } from "@prisma/client";
import { isUniqueError } from "@/lib/db-errors";

export async function nextReceiptNumber(db: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma) {
  const year = new Date().getFullYear();
  const prefix = `CF-${year}-`;
  const existing = await db.receiptSequence.findUnique({ where: { year } });
  if (!existing) {
    const last = await db.payment.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
    });
    const current = last ? Number(last.receiptNumber.slice(prefix.length)) : 0;
    try {
      await db.receiptSequence.create({ data: { year, last: Number.isFinite(current) ? current : 0 } });
    } catch (error) {
      if (!isUniqueError(error)) throw error;
    }
  }
  const row = await db.receiptSequence.update({
    where: { year },
    data: { last: { increment: 1 } },
  });
  return `${prefix}${String(row.last).padStart(5, "0")}`;
}
