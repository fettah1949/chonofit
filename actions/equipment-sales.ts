"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isPaymentMethod } from "@/lib/constants";
import { nextReceiptNumber } from "@/lib/receipts";
import { requireAdmin, requireUser } from "@/lib/session";
import { GearStockError, takeGearStock } from "@/lib/gear-stock";
import { roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

function refreshGear() {
  revalidatePath("/boutique");
  revalidatePath("/parametres/tenues");
  revalidatePath("/adherents", "layout");
  revalidatePath("/");
}

export async function sellEquipmentItem(input: {
  itemId: string;
  quantity: number;
  method: string;
}): Promise<ActionState> {
  const user = await requireUser();
  if (user.role === "COACH") return { error: "Un coach ne peut pas vendre une tenue." };
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return { error: "Indiquez une quantité." };
  if (!isPaymentMethod(input.method)) return { error: "Choisissez un mode de paiement." };

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const item = await tx.equipmentItem.findUnique({
        where: { id: input.itemId },
        select: { id: true, price: true },
      });
      if (!item) throw new GearStockError("Article introuvable.");
      await takeGearStock(tx, [[item.id, quantity]]);
      const receiptNumber = await nextReceiptNumber(tx);
      return tx.equipmentSale.create({
        data: {
          itemId: item.id,
          quantity,
          unitPrice: roundMoney(item.price),
          method: input.method,
          receiptNumber,
          createdById: user.id,
        },
        select: { id: true },
      });
    });
    refreshGear();
    return { success: "Vente enregistrée.", redirectTo: `/tenues/${sale.id}/recu` };
  } catch (error) {
    if (error instanceof GearStockError) return { error: error.message };
    return { error: "Enregistrement impossible." };
  }
}

export async function restockEquipmentItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const quantity = Math.floor(Number(String(formData.get("quantity") ?? "").replace(",", ".")));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    return { error: "Indiquez une quantité à ajouter." };
  }
  const item = await prisma.equipmentItem.findUnique({
    where: { id },
    select: { id: true, name: true, pack: { select: { name: true } } },
  });
  if (!item) return { error: "Article introuvable." };
  await prisma.equipmentItem.update({ where: { id }, data: { stock: { increment: quantity } } });
  refreshGear();
  return { success: `${quantity} ajoutée${quantity > 1 ? "s" : ""} au stock de ${item.name} · ${item.pack.name}.` };
}
