import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/actions/auth";
import { PasswordForm } from "@/app/compte/mot-de-passe/password-form";
import { ChronoLogo } from "@/components/brand/chrono-logo";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mot de passe" };

export default async function PasswordPage() {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect(user.role === "COACH" ? "/groupes" : "/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <ChronoLogo tone="dark" size="md" />
        <h1 className="mt-8 font-display text-3xl font-semibold">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user.name.trim()}, le mot de passe initial ne peut plus servir. Choisissez-en un autre pour ouvrir la salle.
        </p>
        <PasswordForm />
        <form action={logout} className="mt-4">
          <Button type="submit" variant="ghost">
            Se déconnecter
          </Button>
        </form>
      </div>
    </main>
  );
}
