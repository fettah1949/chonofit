import { auth } from "@/auth";
import { isRole, type Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      sessionVersion: true,
      mustChangePassword: true,
    },
  });

  const roleMatches = row != null && isRole(row.role) && row.role === session.user.role;
  if (!row?.active || !roleMatches || row.sessionVersion !== session.user.sessionVersion) {
    redirect("/session/expire");
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    mustChangePassword: row.mustChangePassword,
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
