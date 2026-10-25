import { revalidatePath } from "next/cache";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { formatDate } from "@/lib/format";
import { listRenewals } from "@/lib/renewals";
import { renewalWhatsAppMessage, whatsAppPhone } from "@/lib/whatsapp";
import { sendWhatsAppText } from "@/lib/whatsapp-link";
import type { ActionState } from "@/lib/action-state";

type Due = Awaited<ReturnType<typeof listRenewals>>[number];

const globalJob = globalThis as unknown as { chronoReminderJob?: { started: boolean; running: boolean } };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function record(subscription: Due, createdById: string | null, status: "SENT" | "FAILED", error = "") {
  await prisma.reminder.create({
    data: {
      memberId: subscription.memberId,
      subscriptionId: subscription.id,
      status,
      error,
      createdById,
    },
  });
  try {
    revalidatePath("/");
    revalidatePath("/abonnements");
  } catch {
    // L'envoi automatique n'a pas de requête en cours.
  }
}

export async function deliverRenewalReminder(subscription: Due, createdById: string | null): Promise<ActionState & { code?: string }> {
  if (!subscription.endDate) return { error: "Cette échéance n'est plus à relancer.", code: "NOT_DUE" };

  const phone = whatsAppPhone(subscription.member.phone);
  if (!phone) {
    await record(subscription, createdById, "FAILED", "PHONE");
    return { error: "Le numéro de l'adhérent est invalide.", code: "PHONE" };
  }

  const text = renewalWhatsAppMessage({
    gymName: (await getSettings()).name,
    firstName: subscription.member.firstName,
    planName: subscription.plan.name,
    endLabel: formatDate(subscription.endDate),
    days: differenceInCalendarDays(subscription.endDate, startOfDay(new Date())),
  });

  try {
    await sendWhatsAppText(phone, text);
  } catch (error) {
    const code =
      error instanceof Error && (error.message === "NOT_LINKED" || error.message === "NO_WHATSAPP")
        ? error.message
        : "FAILED";
    if (code !== "NOT_LINKED") await record(subscription, createdById, "FAILED", code);
    if (code === "NOT_LINKED") {
      return { error: "WhatsApp n'est pas connecté. Ouvrez Paramètres → WhatsApp et scannez le QR.", code };
    }
    if (code === "NO_WHATSAPP") return { error: "Ce numéro n'est pas inscrit sur WhatsApp.", code };
    console.error("Relance WhatsApp impossible");
    return { error: "WhatsApp n'a pas pu envoyer la relance. Réessayez dans un instant.", code };
  }

  await record(subscription, createdById, "SENT");
  return { success: `Relance envoyée à ${subscription.member.firstName} sur WhatsApp.`, code: "SENT" };
}

export async function sendDueReminders() {
  const job = globalJob.chronoReminderJob ?? { started: true, running: false };
  globalJob.chronoReminderJob = job;
  if (job.running) return;
  job.running = true;
  let sent = 0;
  try {
    const settings = await getSettings();
    if (!settings.autoReminders) {
      console.info("Relances automatiques : coupées dans les paramètres.");
      return;
    }
    const due = await listRenewals();
    const today = startOfDay(new Date());
    for (const item of due) {
      const reminder = item.reminder;
      if (reminder?.status === "SENT") continue;
      if (reminder?.error === "NO_WHATSAPP" || reminder?.error === "PHONE") continue;
      if (reminder?.status === "FAILED" && reminder.createdAt >= today) continue;
      const result = await deliverRenewalReminder(item, null);
      if (result.code === "NOT_LINKED") return;
      if (result.code === "SENT") sent += 1;
      await delay(3000);
    }
  } catch {
    console.error("Relances automatiques interrompues");
  } finally {
    job.running = false;
  }
  console.info(sent > 0 ? `Relances automatiques : ${sent} envoyée${sent > 1 ? "s" : ""}.` : "Relances automatiques : rien à envoyer.");
}

export function startAutomaticReminders() {
  if (globalJob.chronoReminderJob?.started) return;
  globalJob.chronoReminderJob = { started: true, running: false };
  console.info("Relances automatiques programmées.");
  setTimeout(() => void sendDueReminders(), 45_000);
  setInterval(() => void sendDueReminders(), 6 * 60 * 60 * 1000);
}
