"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
      <h1 className="font-display text-2xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        L'action n'a pas pu aboutir. Vous pouvez réessayer.
      </p>
      <Button className="mt-5" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
