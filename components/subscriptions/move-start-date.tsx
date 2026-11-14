"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveSubscriptionStart } from "@/actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MoveStartDate({ id, startDate }: { id: string; startDate: string }) {
  const router = useRouter();
  const [value, setValue] = useState(startDate);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await moveSubscriptionStart(id, value);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success(result?.success ?? "Date de début mise à jour.");
          router.refresh();
        });
      }}
    >
      <Input
        type="date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-9 w-40"
        aria-label="Nouvelle date de début"
        required
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || value === startDate}>
        {pending ? "Enregistrement…" : "Déplacer le début"}
      </Button>
    </form>
  );
}
