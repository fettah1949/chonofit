"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { memberSchema } from "@/lib/validators";
import { computeEndDate, parseDateOnly, toInputDate } from "@/lib/format";
import { ageInYears, groupAgeMessage, memberAgeError } from "@/lib/age";
import { deleteUpload, safeUploadPath } from "@/lib/uploads";
import { uniqueMessage } from "@/lib/db-errors";
import { nextReceiptNumber } from "@/lib/receipts";
import { INSURANCE_PRICE, isPaymentMethod } from "@/lib/constants";
import { gearCharge } from "@/lib/gear";
import { roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

class SignupPaymentError extends Error {}

function photoOrNull(value: string) {
  if (!value) return null;
  if (!safeUploadPath(value, "members")) return undefined;
  return value;
}

export async function saveMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = memberSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    phone2: formData.get("phone2") ?? "",
    guardianName: formData.get("guardianName") ?? "",
    guardianRelation: formData.get("guardianRelation") ?? "",
    sex: formData.get("sex") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    notes: formData.get("notes") ?? "",
    photoPath: formData.get("photoPath") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const photoPath = photoOrNull(parsed.data.photoPath);
  if (photoPath === undefined) return { error: "La photo envoyée est invalide." };

  const discipline = await readDiscipline(formData);
  if ("error" in discipline) return { error: discipline.error };
  const id = String(formData.get("id") ?? "");
  const signup = id ? null : await readSignupPayment(formData, discipline.itemIds, discipline.hasInsurance);
  if (signup && "error" in signup) return { error: signup.error };

  const data = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone.replace(/\s+/g, " ").trim(),
    phone2: parsed.data.phone2.replace(/\s+/g, " ").trim(),
    guardianName: parsed.data.guardianName.replace(/\s+/g, " ").trim(),
    guardianRelation: parsed.data.guardianRelation,
    sex: parsed.data.sex,
    birthDate: parsed.data.birthDate ? parseDateOnly(parsed.data.birthDate) : null,
    notes: parsed.data.notes ?? "",
    photoPath,
    hasInsurance: discipline.hasInsurance,
    insuranceStart: discipline.insuranceStart,
    insuranceEnd: discipline.insuranceEnd,
  };

  const previous = id
    ? await prisma.member.findUnique({ where: { id }, select: { id: true, photoPath: true, birthDate: true } })
    : null;
  if (id && !previous) return { error: "Adhérent introuvable." };
  const storedBirth = previous?.birthDate ? toInputDate(previous.birthDate) : "";
  if (parsed.data.birthDate && parsed.data.birthDate !== storedBirth) {
    const ageError = memberAgeError(parsed.data.birthDate);
    if (ageError) return { error: ageError };
  }
  const age = data.birthDate ? ageInYears(data.birthDate) : null;
  for (const group of discipline.groups) {
    const message = groupAgeMessage(group.name, age, group.ageMin, group.ageMax);
    if (message) return { error: message };
  }

  try {
    const member = await prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.member.update({ where: { id }, data })
        : await tx.member.create({ data });
      let tenueNames: string[] = [];
      let gearTotal = 0;

      await tx.memberActivity.deleteMany({ where: { memberId: saved.id } });
      if (discipline.activityIds.length > 0) {
        await tx.memberActivity.createMany({
          data: discipline.activityIds.map((activityId) => ({ memberId: saved.id, activityId })),
        });
      }

      await tx.memberGroup.deleteMany({ where: { memberId: saved.id } });
      if (discipline.groupIds.length > 0) {
        await tx.memberGroup.createMany({
          data: discipline.groupIds.map((groupId) => ({ memberId: saved.id, groupId })),
        });
      }

      if (discipline.itemIds.length > 0) {
        const owned = await tx.equipmentPurchase.findMany({
          where: { memberId: saved.id },
          select: { itemId: true },
        });
        const ownedIds = new Set(owned.map((purchase) => purchase.itemId));
        const freshIds = discipline.itemIds.filter((itemId) => !ownedIds.has(itemId));
        if (freshIds.length > 0) {
          const chosen = await tx.equipmentItem.findMany({ where: { id: { in: freshIds } } });
          const packIds = [...new Set(chosen.map((item) => item.packId))];
          const [packItems, packs] = await Promise.all([
            tx.equipmentItem.findMany({ where: { packId: { in: packIds } } }),
            tx.equipmentPack.findMany({ where: { id: { in: packIds } } }),
          ]);
          const charge = gearCharge(
            packItems.map((item) => ({ id: item.id, packId: item.packId, price: item.price })),
            packs.map((pack) => ({ id: pack.id, price: pack.price })),
            freshIds,
          );
          tenueNames = chosen.map((item) => item.name);
          gearTotal = charge.total;
          await tx.equipmentPurchase.createMany({
            data: chosen.map((item) => ({
              memberId: saved.id,
              itemId: item.id,
              unitPrice: charge.unitPrices.get(item.id) ?? roundMoney(item.price),
            })),
          });
        }
      }

      let paymentId: string | null = null;
      if (!id && signup) {
        let subscriptionId: string | null = null;
        if (signup.plan && signup.startDate) {
          const created = await tx.subscription.create({
            data: {
              memberId: saved.id,
              planId: signup.plan.id,
              startDate: signup.startDate,
              endDate: computeEndDate(signup.startDate, signup.plan.durationDays),
              status: "ACTIVE",
              price: roundMoney(signup.plan.price),
            },
          });
          subscriptionId = created.id;
        }
        const due = roundMoney((signup.plan?.price ?? 0) + gearTotal + (discipline.hasInsurance ? INSURANCE_PRICE : 0));
        const remainder = roundMoney(due - signup.amount);
        if (remainder < -0.001) throw new SignupPaymentError("L'avance dépasse le total.");
        const receiptNumber = await nextReceiptNumber(tx);
        const payment = await tx.payment.create({
          data: {
            memberId: saved.id,
            subscriptionId,
            amount: signup.amount,
            remainder: Math.max(0, remainder),
            method: signup.method,
            paidAt: new Date(),
            note: [
              tenueNames.length > 0 ? `Tenues : ${tenueNames.join(", ")}` : "",
              discipline.hasInsurance ? `Assurance : ${INSURANCE_PRICE}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
            receiptNumber,
            createdById: user.id,
          },
        });
        paymentId = payment.id;
      }

      return { saved, paymentId };
    });

    if (previous?.photoPath && previous.photoPath !== member.saved.photoPath) {
      await deleteUpload(previous.photoPath);
    }

    revalidatePath("/adherents");
    revalidatePath(`/adherents/${member.saved.id}`);
    revalidatePath("/abonnements");
    revalidatePath("/paiements");
    revalidatePath("/");
    return {
      success: member.paymentId ? "Adhérent créé et paiement encaissé." : id ? "Adhérent mis à jour." : "Adhérent créé.",
      redirectTo: member.paymentId ? `/paiements/${member.paymentId}/recu` : `/adherents/${member.saved.id}`,
    };
  } catch (error) {
    if (error instanceof SignupPaymentError) return { error: error.message };
    return { error: uniqueMessage(error) ?? "Enregistrement impossible." };
  }
}

async function readSignupPayment(formData: FormData, itemIds: string[], hasInsurance: boolean) {
  if (formData.get("recordPayment") !== "on") return null;
  const amount = roundMoney(Number(String(formData.get("payAmount") ?? "").replace(",", ".")));
  const method = String(formData.get("payMethod") ?? "");
  const planId = String(formData.get("planId") ?? "");
  if (!isPaymentMethod(method)) return { error: "Choisissez un mode de paiement." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Indiquez l'avance, ou décochez le paiement." };
  }
  if (!planId && itemIds.length === 0 && !hasInsurance) {
    return { error: "Choisissez une formule, une tenue ou l'assurance, ou décochez le paiement." };
  }

  if (!planId) {
    return { plan: null, startDate: null, amount, method };
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan?.active) return { error: "Cette formule n'est plus disponible." };
  const startRaw = String(formData.get("payStart") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) return { error: "Indiquez la date de début de l'abonnement." };
  return {
    plan: { id: plan.id, price: plan.price, durationDays: plan.durationDays },
    startDate: parseDateOnly(startRaw),
    amount,
    method,
  };
}

async function readDiscipline(formData: FormData) {
  const activityIds = [...new Set(formData.getAll("activityId").map(String).filter(Boolean))];
  const groupIds = [...new Set(formData.getAll("groupId").map(String).filter(Boolean))];
  const itemIds = [...new Set(formData.getAll("itemId").map(String).filter(Boolean))];
  const hasInsurance = formData.get("hasInsurance") === "on";
  const startRaw = String(formData.get("insuranceStart") ?? "");
  const endRaw = String(formData.get("insuranceEnd") ?? "");

  if (activityIds.length === 0) return { error: "Choisissez au moins une activité : Karaté ou Kickboxing." };

  const activities = await prisma.activity.findMany({ where: { id: { in: activityIds } } });
  if (activities.length !== activityIds.length) return { error: "Une activité choisie n'existe plus." };

  const groups = groupIds.length
    ? await prisma.trainingGroup.findMany({ where: { id: { in: groupIds } } })
    : [];
  if (groups.length !== groupIds.length) return { error: "Un groupe choisi n'existe plus." };
  if (groups.some((group) => !activityIds.includes(group.activityId))) {
    return { error: "Un groupe ne correspond pas à l'activité choisie." };
  }

  const items = itemIds.length
    ? await prisma.equipmentItem.findMany({ where: { id: { in: itemIds } } })
    : [];
  if (items.length !== itemIds.length) return { error: "Un article choisi n'existe plus." };
  if (items.some((item) => !activityIds.includes(item.activityId))) {
    return { error: "Un article ne correspond pas à l'activité choisie." };
  }

  if (hasInsurance && (!/^\d{4}-\d{2}-\d{2}$/.test(startRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(endRaw))) {
    return { error: "Indiquez la date de début et la date de fin de l'assurance." };
  }
  if (hasInsurance && endRaw < startRaw) {
    return { error: "La fin de l'assurance est avant le début." };
  }

  return {
    activityIds,
    groupIds,
    groups,
    itemIds,
    hasInsurance,
    insuranceStart: hasInsurance ? parseDateOnly(startRaw) : null,
    insuranceEnd: hasInsurance ? parseDateOnly(endRaw) : null,
  };
}

export async function setMemberStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<ActionState> {
  await requireUser();
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) return { error: "Adhérent introuvable." };
  await prisma.member.update({ where: { id }, data: { status } });
  revalidatePath("/adherents");
  revalidatePath(`/adherents/${id}`);
  revalidatePath("/");
  return {
    success: status === "SUSPENDED" ? "Adhérent suspendu." : "Adhérent réactivé.",
  };
}

export async function deleteMember(id: string): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Seul un administrateur peut supprimer un adhérent." };
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) return { error: "Adhérent introuvable." };
  await prisma.member.delete({ where: { id } });
  await deleteUpload(member.photoPath);
  revalidatePath("/adherents");
  revalidatePath("/");
  return { success: "Adhérent supprimé.", redirectTo: "/adherents" };
}
