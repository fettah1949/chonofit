import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/constants";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth") || pathname.startsWith("/brand")) return true;

      const isLoggedIn = Boolean(auth?.user);
      if (pathname === "/login") {
        if (!isLoggedIn) return true;
        const destination = auth?.user?.mustChangePassword
          ? "/compte/mot-de-passe"
          : auth?.user?.role === "COACH"
            ? "/groupes"
            : "/";
        return Response.redirect(new URL(destination, request.nextUrl));
      }

      if (pathname === "/session/expire") return true;

      if (!isLoggedIn) return false;

      if (pathname.startsWith("/uploads") || pathname === "/compte/mot-de-passe") return true;

      if (auth?.user?.mustChangePassword) {
        return Response.redirect(new URL("/compte/mot-de-passe", request.nextUrl));
      }

      if (auth?.user?.role === "COACH" && pathname !== "/groupes") {
        return Response.redirect(new URL("/groupes", request.nextUrl));
      }

      if (
        (pathname.startsWith("/parametres") || pathname.startsWith("/adherents/assurance")) &&
        auth?.user?.role !== "ADMIN"
      ) {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.sessionVersion = user.sessionVersion;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "RECEPTIONIST";
        session.user.sessionVersion = token.sessionVersion ?? -1;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
