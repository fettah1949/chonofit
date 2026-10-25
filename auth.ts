import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { isTemporaryPassword } from "@/lib/passwords";
import { loginSucceeded } from "@/lib/login-throttle";
import type { Role } from "@/lib/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        loginSucceeded(email);
        const temporary = isTemporaryPassword(password);
        if (temporary && !user.mustChangePassword) {
          await prisma.user.update({
            where: { id: user.id },
            data: { mustChangePassword: true },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          sessionVersion: user.sessionVersion,
          mustChangePassword: temporary || user.mustChangePassword,
        };
      },
    }),
  ],
});
