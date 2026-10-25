import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="font-display text-5xl font-semibold">404</p>
        <p className="mt-2 text-muted-foreground">Cette page n'existe pas.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline">
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}
