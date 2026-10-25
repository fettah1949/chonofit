import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";
import { ChronoLogo } from "@/components/brand/chrono-logo";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-black text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 12% 18%, rgba(225,6,0,0.28), transparent 26%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.06), transparent 24%)",
          }}
        />
        <div className="relative">
          <ChronoLogo size="lg" />
          <p className="mt-12 max-w-md font-display text-5xl font-bold italic uppercase leading-[0.92] tracking-tight">
            La salle,
            <br />
            tenue simplement.
          </p>
          <p className="mt-5 max-w-md text-white/70">
            Adhérents, abonnements, encaissements et pointage sur le poste d'accueil.
          </p>
        </div>
        <ul className="relative space-y-2 border-l-2 border-[#e10600] pl-4 text-sm text-white/75">
          <li>Recherche d'un adhérent en quelques lettres</li>
          <li>Photo prise à l'accueil ou importée depuis la galerie</li>
          <li>Reçu imprimable et historique des présences</li>
        </ul>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <ChronoLogo tone="dark" size="md" />
          </div>
          <h1 className="font-display text-3xl font-semibold">Connexion</h1>
          <p className="mt-2 text-sm text-muted-foreground">Accès réservé à l'équipe de la salle.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
