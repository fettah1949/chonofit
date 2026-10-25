"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action-state";

export function ConfirmButton({
  title,
  description,
  children,
  confirmLabel = "Confirmer",
  variant = "outline",
  size = "default",
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  confirmLabel?: string;
  variant?: "outline" | "destructive" | "default" | "secondary" | "ghost";
  size?: "default" | "sm";
  action: () => Promise<ActionState>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await action();
                  if (result?.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(result?.success ?? "Opération effectuée.");
                  setOpen(false);
                  if (result?.redirectTo) router.push(result.redirectTo);
                  else router.refresh();
                });
              }}
            >
              {pending ? "Veuillez patienter…" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
