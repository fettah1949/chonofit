"use client";

import { useState } from "react";
import { useActionState } from "react";
import { continuePayment } from "@/actions/payments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatMoney, todayInput } from "@/lib/format";
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { cn, roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export function ContinuePayment({
  paymentId,
  memberId,
  receiptNumber,
  collected,
  remainder,
  currency,
}: {
  paymentId: string;
  memberId: string;
  receiptNumber: string;
  collected: number;
  remainder: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(continuePayment, null as ActionState);
  const [amount, setAmount] = useState(String(remainder));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  useActionToast(state);

  const typed = Number(amount);
  const leftover = Number.isFinite(typed) ? roundMoney(remainder - typed) : null;

  return (
    <form id={`completer-${paymentId}`} action={formAction} className="space-y-3 rounded-xl bg-amber-50 p-4">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="method" value={method} />
      <div>
        <p className="text-sm text-amber-950">Reste à payer sur le reçu {receiptNumber}</p>
        <p className="font-display text-2xl font-semibold text-amber-950">{formatMoney(remainder, currency)}</p>
        <p className="text-xs text-amber-900">
          Déjà encaissé {formatMoney(collected, currency)}. Le versement complète ce reçu.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`settle-${paymentId}`}>Versement</Label>
          <Input
            id={`settle-${paymentId}`}
            name="amount"
            type="number"
            min="0.01"
            max={remainder}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`settle-date-${paymentId}`}>Date</Label>
          <Input id={`settle-date-${paymentId}`} name="paidAt" type="date" required defaultValue={todayInput()} />
        </div>
      </div>
      {leftover != null && typed > 0 ? (
        <p className={cn("text-sm", leftover < 0 ? "text-red-800" : "text-amber-950")}>
          {leftover < 0
            ? "Ce versement dépasse le reste."
            : leftover === 0
              ? "Le reçu sera soldé."
              : `Il restera ${formatMoney(leftover, currency)} sur ce reçu.`}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAmount(String(remainder))}>
          Tout le reste
        </Button>
        {PAYMENT_METHODS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={method === item}
            className={cn(
              "h-9 rounded-xl border px-3 text-sm font-medium",
              method === item ? "border-primary bg-white" : "bg-amber-50",
            )}
            onClick={() => setMethod(item)}
          >
            {METHOD_LABELS[item]}
          </button>
        ))}
      </div>
      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      <SubmitButton pendingLabel="Enregistrement…">Compléter ce reçu</SubmitButton>
    </form>
  );
}
