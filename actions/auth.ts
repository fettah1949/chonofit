"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTemporaryPassword } from "@/lib/passwords";
import { loginBlocked, loginFailed } from "@/lib/login-throttle";
import { requireUser } from "@/lib/session";
import type { ActionState } from "@/lib/action-state";

export async function login(_prev: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (loginBlocked(email)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      loginFailed(email);
      if (loginBlocked(email)) {
        return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
      }
      return { error: "E-mail ou mot de passe incorrect." };
    }
    throw error;
  }
  return null;
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (next !== confirm) return { error: "Les deux nouveaux mots de passe sont différents." };
  if (isTemporaryPassword(next)) return { error: "Choisissez un mot de passe différent du mot de passe initial." };
  if (next === current) return { error: "Le nouveau mot de passe doit être différent de l'actuel." };

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row?.active) return { error: "Compte introuvable." };
  const valid = await bcrypt.compare(current, row.passwordHash);
  if (!valid) return { error: "Le mot de passe actuel est incorrect." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(next, 10),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });
  await signOut({ redirectTo: "/login" });
  return { success: "Mot de passe modifié." };
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
