"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isPaymentMethod } from "@/lib/constants";
import { nextReceiptNumber } from "@/lib/receipts";
import { requireUser } from "@/lib/session";
import { searchMemberIds } from "@/lib/search";
import { deleteUpload, safeUploadPath } from "@/lib/uploads";
import { roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

const productSchema = z.object({
  id: z.string().trim().optional().default(""),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  price: z.string().trim().min(1, "Le prix est obligatoire."),
  stock: z.string().trim().optional(),
  photoPath: z.string().trim().max(300).optional().default(""),
});

function readPrice(value: string) {
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return null;
  return roundMoney(amount);
}

function readStock(value: string | undefined) {
  const quantity = Math.floor(Number(value));
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999) return null;
  return quantity;
}

async function requireDesk() {
  const user = await requireUser();
  if (user.role === "COACH") return null;
  return user;
}

function photoOrNull(value: string) {
  const path = value.trim();
  if (!path) return null;
  if (!safeUploadPath(path, "shop")) return undefined;
  return path;
}

export async function saveShopProduct(input: {
  id?: string;
  name: string;
  price: string;
  stock?: string;
  photoPath: string;
}): Promise<ActionState> {
  const user = await requireDesk();
  if (!user) return { error: "Accès refusé." };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Le produit est incomplet." };
  const price = readPrice(parsed.data.price);
  if (price === null) return { error: "Le prix est invalide." };
  const photoPath = photoOrNull(parsed.data.photoPath);
  if (photoPath === undefined) return { error: "La photo envoyée est invalide." };

  const id = parsed.data.id;
  if (id) {
    const previous = await prisma.shopProduct.findUnique({ where: { id }, select: { id: true, photoPath: true } });
    if (!previous) return { error: "Produit introuvable." };
    await prisma.shopProduct.update({
      where: { id },
      data: { name: parsed.data.name, price, photoPath },
    });
    if (previous.photoPath && previous.photoPath !== photoPath) await deleteUpload(previous.photoPath);
  } else {
    const stock = readStock(parsed.data.stock);
    if (stock === null) return { error: "La quantité est invalide." };
    await prisma.shopProduct.create({
      data: {
        name: parsed.data.name,
        price,
        stock,
        photoPath,
      },
    });
  }

  revalidatePath("/boutique");
  return { success: id ? "Produit mis à jour." : "Produit ajouté." };
}

export async function restockShopProduct(productId: string, added: number): Promise<ActionState> {
  const user = await requireDesk();
  if (!user) return { error: "Accès refusé." };
  const quantity = Math.floor(Number(added));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    return { error: "Indiquez une quantité à ajouter." };
  }
  const product = await prisma.shopProduct.findUnique({ where: { id: productId }, select: { id: true, name: true } });
  if (!product) return { error: "Produit introuvable." };
  await prisma.shopProduct.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
  revalidatePath("/boutique");
  return { success: `${quantity} ajoutée${quantity > 1 ? "s" : ""} au stock de ${product.name}.` };
}

export async function deleteShopProduct(productId: string): Promise<ActionState> {
  const user = await requireDesk();
  if (!user) return { error: "Accès refusé." };
  const product = await prisma.shopProduct.findUnique({
    where: { id: productId },
    select: { id: true, photoPath: true, _count: { select: { sales: true } } },
  });
  if (!product) return { error: "Produit introuvable." };
  if (product._count.sales > 0) return { error: "Ce produit a déjà été vendu. Il reste dans l'historique." };
  await prisma.shopProduct.delete({ where: { id: productId } });
  await deleteUpload(product.photoPath);
  revalidatePath("/boutique");
  return { success: "Produit supprimé." };
}

export async function searchMembersForShop(query: string) {
  const user = await requireDesk();
  if (!user) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const ids = await searchMemberIds(q, { email: false, take: 6 });
  if (ids.length === 0) return [];
  const members = await prisma.member.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const byId = new Map(members.map((member) => [member.id, member]));
  return ids.flatMap((id) => {
    const member = byId.get(id);
    return member ? [member] : [];
  });
}

export async function sellShopProduct(input: {
  productId: string;
  quantity: number;
  memberId: string;
  method: string;
}): Promise<ActionState> {
  const user = await requireDesk();
  if (!user) return { error: "Accès refusé." };
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isInteger(quantity) || quantity < 1) return { error: "Indiquez une quantité." };
  if (!isPaymentMethod(input.method)) return { error: "Choisissez un moyen de paiement." };
  const memberId = input.memberId.trim();
  if (memberId) {
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) return { error: "Adhérent introuvable." };
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const taken = await tx.shopProduct.updateMany({
        where: { id: input.productId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (taken.count !== 1) {
        const exists = await tx.shopProduct.findUnique({ where: { id: input.productId }, select: { stock: true } });
        if (!exists) throw new Error("MISSING");
        throw new Error("STOCK");
      }
      const product = await tx.shopProduct.findUniqueOrThrow({
        where: { id: input.productId },
        select: { price: true },
      });
      const receiptNumber = await nextReceiptNumber(tx);
      return tx.shopSale.create({
        data: {
          productId: input.productId,
          memberId: memberId || null,
          quantity,
          unitPrice: product.price,
          method: input.method,
          receiptNumber,
          createdById: user.id,
        },
        select: { id: true },
      });
    });
    revalidatePath("/boutique");
    revalidatePath("/");
    if (memberId) revalidatePath(`/adherents/${memberId}`);
    return { success: "Vente enregistrée.", redirectTo: `/boutique/${sale.id}/recu` };
  } catch (error) {
    if (error instanceof Error && error.message === "STOCK") {
      return { error: "Il n'y a pas assez de pièces en réserve." };
    }
    if (error instanceof Error && error.message === "MISSING") return { error: "Produit introuvable." };
    throw error;
  }
}
