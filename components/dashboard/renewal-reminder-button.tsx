"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendRenewalReminder } from "@/actions/whatsapp";

export function RenewalReminderButton({
  subscriptionId,
  sent = false,
}: {
  subscriptionId: string;
  sent?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    try {
      const result = await sendRenewalReminder(subscriptionId);
      if (result?.error) toast.error(result.error);
      else toast.success(result?.success ?? "Relance envoyée.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void send()}
      disabled={pending}
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-3 text-sm font-medium text-white disabled:opacity-60 sm:flex-none"
    >
      <WhatsAppIcon />
      {pending ? "Envoi…" : sent ? "Renvoyer" : "Relancer"}
    </button>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M20.5 3.5A11 11 0 0 0 2.1 16.8L1 22.3l5.6-1.1A11 11 0 0 0 20.5 3.5zM12 20.1a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-3.3.7.7-3.2-.2-.3A8.1 8.1 0 1 1 12 20.1zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.6 6.6 0 0 1-2-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4.1-.3a1.8 1.8 0 0 0 0-.4c0-.1-.5-1.3-.7-1.7s-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.8 3.3 4.3 4.3 0 0 0 2.6.7 2.2 2.2 0 0 0 1.5-.7 1.8 1.8 0 0 0 .4-1.3c0-.1-.2-.2-.4-.3z" />
    </svg>
  );
}
