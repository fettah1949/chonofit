"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { parseAgeRange } from "@/lib/age";
import { serializeSessions, sessionTimeError, type SessionClock } from "@/lib/discipline";
import { roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

function readDays(formData: FormData) {
  return [...new Set(formData.getAll("day").map((value) => Number(value)))]
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
}

function readSessions(formData: FormData) {
  const selected = readDays(formData);
  const times: Record<number, SessionClock> = {};
  for (const day of selected) {
    times[day] = {
      start: String(formData.get(`start-${day}`) ?? "").trim(),
      end: String(formData.get(`end-${day}`) ?? "").trim(),
    };
  }
  const error = sessionTimeError(selected, times);
  if (error) return { error };
  return { days: serializeSessions(selected, times) };
}

export async function updateTrainingGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sessions = readSessions(formData);
  const ages = parseAgeRange(String(formData.get("ageMin") ?? ""), String(formData.get("ageMax") ?? ""));

  if (!name) return { error: "Le nom du groupe est obligatoire." };
  if ("error" in sessions) return { error: sessions.error };
  if ("error" in ages) return { error: ages.error };

  const group = await prisma.trainingGroup.findUnique({ where: { id } });
  if (!group) return { error: "Groupe introuvable." };

  await prisma.trainingGroup.update({
    where: { id },
    data: { name, days: sessions.days, ageMin: ages.ageMin, ageMax: ages.ageMax },
  });
  revalidatePath("/parametres/groupes");
  revalidatePath("/groupes");
  revalidatePath("/pointage");
  revalidatePath("/adherents", "layout");
  return { success: "Groupe enregistré." };
}

export async function createTrainingGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const activityId = String(formData.get("activityId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sessions = readSessions(formData);
  const ages = parseAgeRange(String(formData.get("ageMin") ?? ""), String(formData.get("ageMax") ?? ""));

  if (!name) return { error: "Le nom du groupe est obligatoire." };
  if ("error" in sessions) return { error: sessions.error };
  if ("error" in ages) return { error: ages.error };

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "Choisissez une activité." };

  const siblings = await prisma.trainingGroup.findMany({
    where: { activityId },
    select: { name: true, sortOrder: true },
  });
  const sameName = siblings.some((group) => group.name.localeCompare(name, "fr", { sensitivity: "accent" }) === 0);
  if (sameName) return { error: "Ce groupe existe déjà pour cette activité." };

  const sortOrder = siblings.reduce((max, group) => Math.max(max, group.sortOrder), 0) + 1;
  await prisma.trainingGroup.create({
    data: {
      code: `GROUP-${randomBytes(4).toString("hex").toUpperCase()}`,
      name,
      days: sessions.days,
      ageMin: ages.ageMin,
      ageMax: ages.ageMax,
      sortOrder,
      activityId,
    },
  });

  revalidatePath("/parametres/groupes");
  revalidatePath("/groupes");
  revalidatePath("/pointage");
  revalidatePath("/adherents", "layout");
  return { success: "Groupe ajouté." };
}

export async function deleteTrainingGroup(id: string): Promise<ActionState> {
  await requireAdmin();
  const group = await prisma.trainingGroup.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!group) return { error: "Groupe introuvable." };

  await prisma.trainingGroup.delete({ where: { id } });
  revalidatePath("/parametres/groupes");
  revalidatePath("/adherents", "layout");
  return {
    success: group._count.members > 0 ? "Groupe supprimé. Les adhérents ne sont plus inscrits." : "Groupe supprimé.",
  };
}

export async function updateEquipmentItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "").replace(",", "."));
  if (!name) return { error: "Le nom de l'article est obligatoire." };
  if (!Number.isFinite(price) || price < 0) return { error: "Le prix doit être positif ou nul." };

  const item = await prisma.equipmentItem.findUnique({ where: { id } });
  if (!item) return { error: "Article introuvable." };

  await prisma.equipmentItem.update({
    where: { id },
    data: { name, price: roundMoney(price) },
  });
  revalidatePath("/parametres/tenues");
  revalidatePath("/adherents", "layout");
  return { success: "Article enregistré." };
}

export async function updateEquipmentPack(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const price = Number(String(formData.get("price") ?? "").replace(",", "."));
  if (!Number.isFinite(price) || price < 0) return { error: "Le prix du pack doit être positif ou nul." };

  const pack = await prisma.equipmentPack.findUnique({ where: { id } });
  if (!pack) return { error: "Pack introuvable." };

  await prisma.equipmentPack.update({
    where: { id },
    data: { price: roundMoney(price) },
  });
  revalidatePath("/parametres/tenues");
  revalidatePath("/adherents", "layout");
  return { success: "Prix du pack enregistré." };
}

export async function createEquipmentItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const activityId = String(formData.get("activityId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const packId = String(formData.get("packId") ?? "");
  const packName = String(formData.get("packName") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "").replace(",", "."));

  if (!name) return { error: "Le nom de l'article est obligatoire." };
  if (!Number.isFinite(price) || price < 0) return { error: "Le prix doit être positif ou nul." };

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "Choisissez une activité." };

  const pack = await resolvePack(activityId, packId, packName, roundMoney(price));
  if ("error" in pack) return pack;

  const siblings = await prisma.equipmentItem.findMany({
    where: { packId: pack.id },
    select: { name: true, sortOrder: true },
  });
  const sameName = siblings.some((item) => item.name.localeCompare(name, "fr", { sensitivity: "accent" }) === 0);
  if (sameName) return { error: "Cet article existe déjà dans ce pack." };

  const sortOrder = siblings.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
  await prisma.equipmentItem.create({
    data: {
      code: `ITEM-${randomBytes(4).toString("hex").toUpperCase()}`,
      name,
      price: roundMoney(price),
      sortOrder,
      activityId,
      packId: pack.id,
    },
  });

  revalidatePath("/parametres/tenues");
  revalidatePath("/adherents", "layout");
  return { success: "Article ajouté." };
}

async function resolvePack(activityId: string, packId: string, packName: string, firstPrice: number) {
  if (packId) {
    const pack = await prisma.equipmentPack.findUnique({ where: { id: packId } });
    if (!pack || pack.activityId !== activityId) return { error: "Choisissez un pack." };
    return pack;
  }
  if (!packName) return { error: "Le nom du pack est obligatoire." };

  const existing = await prisma.equipmentPack.findMany({ where: { activityId } });
  const same = existing.find((pack) => pack.name.localeCompare(packName, "fr", { sensitivity: "accent" }) === 0);
  if (same) return same;

  return prisma.equipmentPack.create({
    data: {
      code: `PACK-${randomBytes(4).toString("hex").toUpperCase()}`,
      name: packName,
      price: firstPrice,
      sortOrder: existing.reduce((max, pack) => Math.max(max, pack.sortOrder), 0) + 1,
      activityId,
    },
  });
}
