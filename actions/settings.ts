"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { gymSchema, planSchema, userSchema } from "@/lib/validators";
import { deleteUpload, safeUploadPath } from "@/lib/uploads";
import { uniqueMessage } from "@/lib/db-errors";
import { roundMoney } from "@/lib/utils";
import { isRole } from "@/lib/constants";
import { isTemporaryPassword } from "@/lib/passwords";
import type { ActionState } from "@/lib/action-state";

async function countActiveAdmins(exceptId?: string) {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      active: true,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
  });
}

export async function updateGym(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = gymSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    currency: formData.get("currency") ?? "MAD",
    logoPath: formData.get("logoPath") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const logoPath = parsed.data.logoPath;
  if (logoPath && !safeUploadPath(logoPath, "gym")) {
    return { error: "Le logo envoyé est invalide." };
  }

  const current = await prisma.gymSettings.findUnique({ where: { id: "default" } });
  await prisma.gymSettings.upsert({
    where: { id: "default" },
    update: {
      name: parsed.data.name,
      address: parsed.data.address ?? "",
      phone: parsed.data.phone ?? "",
      email: parsed.data.email ?? "",
      currency: parsed.data.currency,
      logoPath: logoPath || null,
    },
    create: {
      id: "default",
      name: parsed.data.name,
      address: parsed.data.address ?? "",
      phone: parsed.data.phone ?? "",
      email: parsed.data.email ?? "",
      currency: parsed.data.currency,
      logoPath: logoPath || null,
    },
  });

  if (current?.logoPath && current.logoPath !== logoPath) await deleteUpload(current.logoPath);
  revalidatePath("/parametres");
  revalidatePath("/");
  return { success: "Informations de la salle enregistrées." };
}

export async function savePlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    durationDays: formData.get("durationDays"),
    price: formData.get("price"),
    description: formData.get("description") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const data = {
    name: parsed.data.name,
    durationDays: parsed.data.durationDays,
    price: roundMoney(parsed.data.price),
    description: parsed.data.description ?? "",
    active: parsed.data.active,
  };
  const id = String(formData.get("id") ?? "");

  if (id) {
    await prisma.subscriptionPlan.update({ where: { id }, data });
  } else {
    await prisma.subscriptionPlan.create({ data });
  }
  revalidatePath("/parametres/formules");
  revalidatePath("/abonnements");
  return { success: id ? "Formule mise à jour." : "Formule créée." };
}

export async function deletePlan(id: string): Promise<ActionState> {
  await requireAdmin();
  const used = await prisma.subscription.count({ where: { planId: id } });
  if (used > 0) {
    return {
      error: "Cette formule est déjà utilisée. Désactivez-la plutôt que de la supprimer.",
    };
  }
  await prisma.subscriptionPlan.delete({ where: { id } });
  revalidatePath("/parametres/formules");
  return { success: "Formule supprimée." };
}

export async function saveUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: String(formData.get("password") ?? ""),
    active: id ? formData.get("active") === "on" : true,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  if (!isRole(parsed.data.role)) return { error: "Rôle invalide." };

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password?.trim() ?? "";
  const requestedGroups = parsed.data.role === "COACH" ? [...new Set(formData.getAll("groupId").map(String).filter(Boolean))] : [];
  const knownGroups = requestedGroups.length
    ? await prisma.trainingGroup.findMany({ where: { id: { in: requestedGroups } }, select: { id: true } })
    : [];
  if (knownGroups.length !== requestedGroups.length) return { error: "Un groupe est introuvable." };

  try {
    if (!id) {
      if (password.length < 8) {
        return { error: "Le mot de passe doit contenir au moins 8 caractères." };
      }
      if (isTemporaryPassword(password)) {
        return { error: "Choisissez un mot de passe différent du mot de passe initial." };
      }
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: parsed.data.name,
            email,
            role: parsed.data.role,
            active: true,
            passwordHash: await bcrypt.hash(password, 10),
          },
        });
        if (knownGroups.length > 0) {
          await tx.userGroup.createMany({
            data: knownGroups.map((group) => ({ userId: user.id, groupId: group.id })),
          });
        }
      });
      revalidatePath("/parametres/utilisateurs");
      revalidatePath("/groupes");
      return { success: "Utilisateur créé." };
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return { error: "Utilisateur introuvable." };
    if (password && password.length < 8) {
      return { error: "Le mot de passe doit contenir au moins 8 caractères." };
    }
    if (password && isTemporaryPassword(password)) {
      return { error: "Choisissez un mot de passe différent du mot de passe initial." };
    }

    const becomesInactiveAdmin =
      existing.role === "ADMIN" &&
      existing.active &&
      (parsed.data.role !== "ADMIN" || !parsed.data.active);
    if (becomesInactiveAdmin && (await countActiveAdmins(existing.id)) === 0) {
      return { error: "Il doit rester au moins un administrateur actif." };
    }
    if (existing.id === current.id && (parsed.data.role !== "ADMIN" || !parsed.data.active)) {
      return { error: "Vous ne pouvez pas retirer votre propre accès administrateur." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          name: parsed.data.name,
          email,
          role: parsed.data.role,
          active: parsed.data.active,
          ...(password || existing.role !== parsed.data.role || existing.active !== parsed.data.active
            ? { sessionVersion: { increment: 1 } }
            : {}),
          ...(password
            ? { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false }
            : {}),
        },
      });
      await tx.userGroup.deleteMany({ where: { userId: id } });
      if (knownGroups.length > 0) {
        await tx.userGroup.createMany({
          data: knownGroups.map((group) => ({ userId: id, groupId: group.id })),
        });
      }
    });
    revalidatePath("/parametres/utilisateurs");
    revalidatePath("/groupes");
    return { success: "Utilisateur mis à jour." };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Enregistrement impossible." };
  }
}

export async function deleteUser(id: string): Promise<ActionState> {
  const current = await requireAdmin();
  if (id === current.id) return { error: "Vous ne pouvez pas supprimer votre propre compte." };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Utilisateur introuvable." };
  if (user.role === "ADMIN" && user.active && (await countActiveAdmins(user.id)) === 0) {
    return { error: "Impossible de supprimer le dernier administrateur." };
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/parametres/utilisateurs");
  return { success: "Utilisateur supprimé." };
}
