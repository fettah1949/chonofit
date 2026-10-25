"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import { getSettings } from "@/lib/maintenance";
import { formatMoney } from "@/lib/format";
import { whatsAppPhone, type WhatsAppLinkStatus } from "@/lib/whatsapp";
import { beginWhatsAppLink, logoutWhatsApp, readWhatsAppLink, sendWhatsAppImage } from "@/lib/whatsapp-link";
import { listRenewals } from "@/lib/renewals";
import { deliverRenewalReminder } from "@/lib/reminders";
import type { ActionState } from "@/lib/action-state";

export async function whatsAppSnapshot(): Promise<WhatsAppLinkStatus> {
  await requireAdmin();
  return readWhatsAppLink();
}

export async function startWhatsAppLink(): Promise<WhatsAppLinkStatus> {
  await requireAdmin();
  return beginWhatsAppLink();
}

export async function stopWhatsAppLink(): Promise<WhatsAppLinkStatus> {
  await requireAdmin();
  return logoutWhatsApp();
}

export async function saveAutoReminders(formData: FormData) {
  await requireAdmin();
  await prisma.gymSettings.update({
    where: { id: "default" },
    data: { autoReminders: formData.get("enabled") === "on" },
  });
  revalidatePath("/parametres/whatsapp");
}

function isPng(buffer: Buffer) {
  return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
}

export async function sendReceiptOnWhatsApp(paymentId: string, formData: FormData): Promise<ActionState> {
  await requireUser();
  const file = formData.get("image");
  if (!(file instanceof File)) return { error: "Image du reçu manquante." };
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 32 || buffer.length > 3_000_000 || !isPng(buffer)) {
    return { error: "Image du reçu invalide." };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: true },
  });
  if (!payment) return { error: "Reçu introuvable." };
  const phone = whatsAppPhone(payment.member.phone);
  if (!phone) return { error: "Le numéro de l'adhérent est invalide." };

  const settings = await getSettings();
  const caption = `Reçu ${payment.receiptNumber} — ${formatMoney(payment.amount, settings.currency)}`;

  try {
    await sendWhatsAppImage(phone, buffer, caption);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_LINKED") {
      return { error: "WhatsApp n'est pas connecté. Ouvrez Paramètres → WhatsApp et scannez le QR." };
    }
    if (error instanceof Error && error.message === "NO_WHATSAPP") {
      return { error: "Ce numéro n'est pas inscrit sur WhatsApp." };
    }
    console.error("Envoi WhatsApp impossible", error);
    return { error: "WhatsApp n'a pas pu envoyer l'image. Réessayez dans un instant." };
  }

  return { success: `Reçu envoyé à ${payment.member.firstName} sur WhatsApp.` };
}

export async function sendRenewalReminder(subscriptionId: string): Promise<ActionState> {
  const user = await requireUser();
  const due = await listRenewals();
  const subscription = due.find((item) => item.id === subscriptionId);
  if (!subscription) return { error: "Cette échéance n'est plus à relancer." };
  const result = await deliverRenewalReminder(subscription, user.id);
  return { error: result.error, success: result.success };
}
