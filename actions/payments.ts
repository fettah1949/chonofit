"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { paymentSchema, settleSchema } from "@/lib/validators";
import { formatDate, formatMoney, parseDateOnly, periodRemainingLabel, todayInput } from "@/lib/format";
import { searchMemberIds } from "@/lib/search";
import { memberDisplayStatus } from "@/lib/status";
import { getSettings } from "@/lib/maintenance";
import { nextReceiptNumber } from "@/lib/receipts";
import { isUniqueError } from "@/lib/db-errors";
import { roundMoney } from "@/lib/utils";
import { METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";

const paymentMemberInclude = {
  subscriptions: {
    orderBy: { startDate: "desc" as const },
    take: 6,
    include: { plan: true },
  },
  payments: {
    where: { remainder: { gt: 0 } },
    orderBy: { paidAt: "desc" as const },
    take: 5,
    select: { id: true, receiptNumber: true, remainder: true, amount: true, subscriptionId: true },
  },
};

function toPaymentMember(
  member: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    phone2: string;
    photoPath: string | null;
    status: string;
    subscriptions: {
      id: string;
      status: string;
      startDate: Date;
      endDate: Date | null;
      price: number;
      plan: { name: string };
    }[];
    payments: {
      id: string;
      receiptNumber: string;
      remainder: number;
      amount: number;
      subscriptionId: string | null;
    }[];
  },
  todayStart: Date,
) {
  const ended = (subscription: (typeof member.subscriptions)[number]) =>
    subscription.status === "EXPIRED" || (subscription.endDate != null && subscription.endDate < todayStart);
  const open = member.subscriptions.find((subscription) => !ended(subscription));
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    phone2: member.phone2 ?? "",
    photoPath: member.photoPath,
    status: memberDisplayStatus(member),
    currentLabel: open
      ? `${open.plan.name} · ${periodRemainingLabel(open.startDate, open.endDate, open.status)}`
      : "Aucun abonnement en cours",
    subscriptions: member.subscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.plan.name,
      price: subscription.price,
      ended: ended(subscription),
      detail: periodRemainingLabel(subscription.startDate, subscription.endDate, subscription.status),
    })),
    openPayments: member.payments,
  };
}

export async function findPaymentMember(memberId?: string, paymentId?: string) {
  await requireUser();
  if (!memberId && !paymentId) return null;
  const todayStart = startOfDay(new Date());
  const member = await prisma.member.findFirst({
    where: memberId ? { id: memberId } : { payments: { some: { id: paymentId } } },
    include: paymentMemberInclude,
  });
  return member ? toPaymentMember(member, todayStart) : null;
}

export async function searchMembersForPayment(query: string) {
  await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];
  const ids = await searchMemberIds(q, { email: false, take: 6 });
  if (ids.length === 0) return [];
  const todayStart = startOfDay(new Date());
  const members = await prisma.member.findMany({
    where: { id: { in: ids } },
    include: paymentMemberInclude,
  });
  const byId = new Map(members.map((member) => [member.id, member]));
  return ids.flatMap((id) => {
    const member = byId.get(id);
    return member ? [toPaymentMember(member, todayStart)] : [];
  });
}

function joinNote(existing: string, addition: string) {
  const next = [existing.trim(), addition.trim()].filter(Boolean).join(" · ");
  if (next.length <= 300) return next;
  const room = 300 - addition.length - 3;
  if (room < 1) return addition.slice(0, 300);
  return `${existing.slice(0, room).trimEnd()} · ${addition}`;
}

async function applyToSamePayment(formData: FormData): Promise<ActionState> {
  const parsed = settleSchema.safeParse({
    paymentId: formData.get("paymentId"),
    memberId: formData.get("memberId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    paidAt: formData.get("paidAt"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const payment = await prisma.payment.findFirst({
    where: { id: parsed.data.paymentId, memberId: parsed.data.memberId },
  });
  if (!payment) return { error: "Reçu introuvable." };
  if (payment.remainder <= 0) return { error: "Ce reçu est déjà soldé." };

  const added = roundMoney(parsed.data.amount);
  if (added - payment.remainder > 0.001) {
    return { error: "Le versement dépasse le reste à payer." };
  }

  const settings = await getSettings();
  const remainder = roundMoney(Math.max(0, payment.remainder - added));
  const amount = roundMoney(payment.amount + added);
  const detail = [
    `Versement ${formatMoney(added, settings.currency)} le ${formatDate(parseDateOnly(parsed.data.paidAt))}`,
    METHOD_LABELS[parsed.data.method as PaymentMethod],
    parsed.data.note.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  await prisma.payment.update({
    where: { id: payment.id },
    data: { amount, remainder, note: joinNote(payment.note, detail) },
  });

  revalidatePath("/paiements");
  revalidatePath(`/adherents/${payment.memberId}`);
  revalidatePath(`/paiements/${payment.id}/recu`);
  revalidatePath("/");
  return {
    success: remainder > 0 ? "Versement ajouté au même reçu." : "Reçu soldé.",
    redirectTo: `/paiements/${payment.id}/recu`,
  };
}

export async function continuePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  return applyToSamePayment(formData);
}

export async function createPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (String(formData.get("paymentId") ?? "").trim()) {
    return applyToSamePayment(formData);
  }
  const parsed = paymentSchema.safeParse({
    memberId: formData.get("memberId"),
    subscriptionId: formData.get("subscriptionId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    paidAt: formData.get("paidAt"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { id: parsed.data.subscriptionId, memberId: parsed.data.memberId },
  });
  if (!subscription) return { error: "Abonnement introuvable pour cet adhérent." };
  const ended = subscription.status === "EXPIRED" || (subscription.endDate && subscription.endDate < startOfDay(new Date()));
  if (ended) {
    return { error: "Cet abonnement est terminé. Renouvelez-le : un paiement seul ne prolonge pas la période." };
  }

  const paidAt =
    parsed.data.paidAt === todayInput() ? new Date() : parseDateOnly(parsed.data.paidAt);
  const amount = roundMoney(parsed.data.amount);
  const open = await prisma.payment.findFirst({
    where: { subscriptionId: subscription.id, remainder: { gt: 0 } },
    select: { id: true },
  });
  if (open) return { error: "Un reçu est encore ouvert. Complétez-le au lieu d'en créer un autre." };
  const collected = await prisma.payment.aggregate({
    where: { subscriptionId: subscription.id },
    _sum: { amount: true },
  });
  const outstanding = roundMoney(Math.max(0, roundMoney(subscription.price) - (collected._sum.amount ?? 0)));
  if (outstanding > 0 && amount - outstanding > 0.001) {
    return { error: "Le montant dépasse le reste à payer." };
  }
  const remainder = outstanding > 0 ? roundMoney(Math.max(0, outstanding - amount)) : 0;

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const receiptNumber = await nextReceiptNumber(tx);
      return tx.payment.create({
        data: {
          memberId: parsed.data.memberId,
          subscriptionId: subscription.id,
          amount,
          remainder,
          method: parsed.data.method,
          paidAt,
          note: parsed.data.note ?? "",
          receiptNumber,
          createdById: user.id,
        },
      });
    });

    revalidatePath("/paiements");
    revalidatePath(`/adherents/${payment.memberId}`);
    revalidatePath("/");
    return {
      success: "Paiement enregistré.",
      redirectTo: `/paiements/${payment.id}/recu`,
    };
  } catch (error) {
    if (isUniqueError(error)) return { error: "Le numéro de reçu est déjà utilisé. Réessayez." };
    return { error: "Enregistrement du paiement impossible." };
  }
}

export async function deletePayment(id: string): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Seul un administrateur peut supprimer un paiement." };
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return { error: "Paiement introuvable." };
  await prisma.payment.delete({ where: { id } });
  revalidatePath("/paiements");
  revalidatePath(`/adherents/${payment.memberId}`);
  revalidatePath("/");
  return { success: "Paiement supprimé." };
}
