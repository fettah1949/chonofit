"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";

export function useActionToast(state: ActionState) {
  const router = useRouter();

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      if (state.redirectTo) router.push(state.redirectTo);
      else router.refresh();
    }
  }, [state, router]);
}
