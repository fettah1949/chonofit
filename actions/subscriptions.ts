"use server";

import { revalidatePath } from "next/cache";
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { subscriptionSchema } from "@/lib/validators";
import { computeEndDate, parseDateOnly } from "@/lib/format";
import { nextReceiptNumber } from "@/lib/receipts";
import { isUniqueError } from "@/lib/db-errors";
import { roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export async function createSubscription(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse({
    memberId: formData.get("memberId"),
    planId: formData.get("planId"),
    startDate: formData.get("startDate"),
    price: formData.get("price"),
    note: formData.get("note") ?? "",
    method: formData.get("method") || undefined,
    recordPayment: formData.get("recordPayment") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  if (parsed.data.recordPayment && !parsed.data.method) {
    return { error: "Choisissez un mode de paiement." };
  }
  if (parsed.data.recordPayment && roundMoney(parsed.data.price) <= 0) {
    return { error: "Le montant est à 0. Décochez le paiement pour offrir la formule." };
  }

  const [member, plan] = await Promise.all([
    prisma.member.findUnique({ where: { id: parsed.data.memberId } }),
    prisma.subscriptionPlan.findUnique({ where: { id: parsed.data.planId } }),
  ]);
  if (!member) return { error: "Adhérent introuvable." };
  if (!plan?.active) return { error: "Cette formule n'est plus disponible." };

  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = computeEndDate(startDate, plan.durationDays);
  const price = roundMoney(parsed.data.price);
  const sameDay = await prisma.subscription.findFirst({
    where: {
      memberId: member.id,
      startDate: { gte: startOfDay(startDate), lte: endOfDay(startDate) },
    },
  });
  if (sameDay) {
    return { error: "Un abonnement commence déjà à cette date." };
  }

  try {
    const previous = await prisma.subscription.count({ where: { memberId: member.id } });
    const subscription = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          memberId: member.id,
          status: "ACTIVE",
          OR: [{ endDate: null }, { endDate: { gte: startDate } }],
        },
        data: { status: "EXPIRED" },
      });
      const created = await tx.subscription.create({
        data: {
          memberId: member.id,
          planId: plan.id,
          startDate,
          endDate,
          status: "ACTIVE",
          price,
        },
      });
      if (parsed.data.recordPayment && parsed.data.method) {
        const receiptNumber = await nextReceiptNumber(tx);
        const payment = await tx.payment.create({
          data: {
            memberId: member.id,
            subscriptionId: created.id,
            amount: price,
            method: parsed.data.method,
            paidAt: new Date(),
            note: parsed.data.note ?? "",
            receiptNumber,
            createdById: user.id,
          },
        });
        return { memberId: created.memberId, paymentId: payment.id };
      }
      return { memberId: created.memberId, paymentId: null as string | null };
    });

    revalidatePath("/abonnements");
    revalidatePath("/adherents");
    revalidatePath(`/adherents/${member.id}`);
    revalidatePath("/paiements");
    revalidatePath("/");
    return {
      success: previous > 0 ? "Abonnement renouvelé." : "Abonnement attribué.",
      redirectTo: subscription.paymentId
        ? `/paiements/${subscription.paymentId}/recu`
        : `/adherents/${subscription.memberId}`,
    };
  } catch (error) {
    if (isUniqueError(error)) return { error: "Le reçu n'a pas pu être numéroté. Réessayez." };
    return { error: "Attribution impossible." };
  }
}

export async function setSubscriptionStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<ActionState> {
  await requireUser();
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) return { error: "Abonnement introuvable." };

  if (status === "ACTIVE") {
    const stillValid = !subscription.endDate || subscription.endDate >= new Date(new Date().setHours(0, 0, 0, 0));
    if (!stillValid) {
      return { error: "La date de fin est dépassée. Créez un nouvel abonnement." };
    }
    await prisma.subscription.updateMany({
      where: { memberId: subscription.memberId, status: "ACTIVE", NOT: { id } },
      data: { status: "EXPIRED" },
    });
  }

  await prisma.subscription.update({ where: { id }, data: { status } });
  revalidatePath("/abonnements");
  revalidatePath(`/adherents/${subscription.memberId}`);
  revalidatePath("/");
  return {
    success: status === "SUSPENDED" ? "Abonnement suspendu." : "Abonnement réactivé.",
  };
}

export async function deleteSubscription(id: string): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Seul un administrateur peut supprimer un abonnement." };
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) return { error: "Abonnement introuvable." };
  await prisma.subscription.delete({ where: { id } });
  revalidatePath("/abonnements");
  revalidatePath(`/adherents/${subscription.memberId}`);
  revalidatePath("/paiements");
  revalidatePath("/");
  return { success: "Abonnement supprimé." };
}
