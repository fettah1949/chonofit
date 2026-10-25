"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { searchMembersForPayment } from "@/actions/payments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatMoney, todayInput } from "@/lib/format";
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { cn, roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export type OpenPayment = {
  id: string;
  receiptNumber: string;
  remainder: number;
  amount: number;
  subscriptionId: string | null;
};

export type PaymentMember = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  photoPath: string | null;
  status: string;
  currentLabel: string;
  subscriptions: { id: string; name: string; price: number; ended: boolean; detail: string }[];
  openPayments: OpenPayment[];
};

function RemainderHint({ amount, remainder, currency }: { amount: string; remainder: number; currency: string }) {
  const typed = Number(amount);
  if (!Number.isFinite(typed) || typed <= 0) return null;
  const leftover = roundMoney(remainder - typed);
  return (
    <p className={cn("text-xs", leftover < 0 ? "text-red-800" : "text-amber-950")}>
      {leftover < 0
        ? "Ce versement dépasse le reste."
        : leftover === 0
          ? "Le reçu sera soldé."
          : `Il restera ${formatMoney(leftover, currency)} sur ce reçu.`}
    </p>
  );
}

function dueFor(member: PaymentMember | null | undefined, preferred?: string) {
  if (!member || member.openPayments.length === 0) return null;
  return member.openPayments.find((item) => item.id === preferred) ?? member.openPayments[0];
}

export function PaymentForm({
  initial,
  currency,
  defaultPaymentId,
  action,
}: {
  initial: PaymentMember | null;
  currency: string;
  defaultPaymentId?: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const initialDue = dueFor(initial, defaultPaymentId);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipFocus = useRef(true);
  const searchSeq = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaymentMember[]>([]);
  const [searching, startSearch] = useTransition();
  const [member, setMember] = useState<PaymentMember | null>(initial);
  const firstOpen = initial?.subscriptions.find((item) => !item.ended);
  const [subscriptionId, setSubscriptionId] = useState(initialDue?.subscriptionId ?? firstOpen?.id ?? "");
  const [paymentId, setPaymentId] = useState(initialDue?.id ?? "");
  const [amount, setAmount] = useState(initialDue ? String(initialDue.remainder) : firstOpen ? String(firstOpen.price) : "");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  useActionToast(state);

  const openSubscriptions = member?.subscriptions.filter((item) => !item.ended) ?? [];
  const selected = openSubscriptions.find((item) => item.id === subscriptionId) ?? null;
  const due = member?.openPayments.find((item) => item.id === paymentId) ?? null;

  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    if (!member) inputRef.current?.focus();
  }, [member]);

  function search(value: string) {
    setQuery(value);
    const seq = ++searchSeq.current;
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const found = await searchMembersForPayment(value);
      if (searchSeq.current === seq) setResults(found);
    });
  }

  function choose(item: PaymentMember) {
    const next = item.subscriptions.find((subscription) => !subscription.ended);
    const open = dueFor(item);
    setMember(item);
    setQuery("");
    setResults([]);
    setPaymentId(open?.id ?? "");
    setSubscriptionId(open?.subscriptionId ?? next?.id ?? "");
    setAmount(open ? String(open.remainder) : next ? String(next.price) : "");
  }

  function chargeSeparately() {
    const next = openSubscriptions[0];
    setPaymentId("");
    setSubscriptionId(next?.id ?? "");
    setAmount(next ? String(next.price) : "");
  }

  function pickSubscription(id: string) {
    const next = openSubscriptions.find((item) => item.id === id);
    setSubscriptionId(id);
    if (next) setAmount(String(next.price));
  }

  if (!member) {
    return (
      <div className="space-y-3">
        <Input
          ref={inputRef}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          placeholder="Encaisser : nom ou téléphone"
          className="h-14 text-base"
          onChange={(event) => search(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results.length === 1) {
              event.preventDefault();
              choose(results[0]);
            }
          }}
        />
        {searching ? <p className="text-sm text-muted-foreground">Recherche…</p> : null}
        {!searching && query.trim().length >= 2 && results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun adhérent.</p>
        ) : null}
        <div className="space-y-2">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-left hover:bg-secondary/70"
              onClick={() => choose(item)}
            >
              <MemberAvatar
                firstName={item.firstName}
                lastName={item.lastName}
                photoPath={item.photoPath}
                className="h-11 w-11 shrink-0 rounded-full text-sm"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">
                    {item.firstName} {item.lastName}
                  </span>
                  {item.status !== "ACTIVE" ? <StatusBadge status={item.status} /> : null}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {item.phone}
                  {item.phone2 ? ` · ${item.phone2}` : ""} · {item.currentLabel}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border bg-card p-4">
      <input type="hidden" name="memberId" value={member.id} />
      {due ? <input type="hidden" name="paymentId" value={due.id} /> : null}
      <input type="hidden" name="subscriptionId" value={selected?.id ?? due?.subscriptionId ?? ""} />
      <input type="hidden" name="method" value={method} />
      <div className="flex items-center gap-3">
        <MemberAvatar
          firstName={member.firstName}
          lastName={member.lastName}
          photoPath={member.photoPath}
          className="h-11 w-11 shrink-0 rounded-full text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {member.firstName} {member.lastName}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {member.phone}
            {member.phone2 ? ` · ${member.phone2}` : ""}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setMember(null)}>
          Changer
        </Button>
      </div>

      {due ? (
        <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p>
            Reste {formatMoney(due.remainder, currency)} sur le reçu {due.receiptNumber}. Le versement complète ce reçu.
          </p>
          <p className="mt-1 text-xs">Déjà encaissé {formatMoney(due.amount, currency)}.</p>
          <button type="button" className="mt-2 font-medium underline" onClick={chargeSeparately}>
            Encaisser un autre paiement
          </button>
        </div>
      ) : openSubscriptions.length === 0 ? (
        <p className="text-sm text-amber-800">
          Aucun abonnement en cours.{" "}
          <a className="font-medium underline" href={`/abonnements?adherent=${member.id}#attribution`}>
            Attribuer une formule
          </a>
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Abonnement</p>
          <div className="flex flex-wrap gap-2">
            {openSubscriptions.map((item) => {
              const pressed = item.id === selected?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={pressed}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm",
                    pressed ? "border-primary bg-accent" : "bg-background",
                  )}
                  onClick={() => pickSubscription(item.id)}
                >
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatMoney(item.price, currency)} · {item.detail}
                  </span>
                </button>
              );
            })}
          </div>
          {member.openPayments[0] ? (
            <button
              type="button"
              className="text-sm font-medium text-amber-800 underline"
              onClick={() => {
                const open = member.openPayments[0];
                setPaymentId(open.id);
                setAmount(String(open.remainder));
              }}
            >
              Compléter le reçu {member.openPayments[0].receiptNumber}
            </button>
          ) : null}
        </div>
      )}

      {due || selected ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">{due ? "Versement" : "Montant"}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                max={due ? due.remainder : undefined}
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              {due ? <RemainderHint amount={amount} remainder={due.remainder} currency={currency} /> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">Date</Label>
              <Input id="paidAt" name="paidAt" type="date" required defaultValue={todayInput()} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Mode</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={method === item}
                  className={cn(
                    "h-10 rounded-xl border px-3 text-sm font-medium",
                    method === item ? "border-primary bg-accent" : "bg-background",
                  )}
                  onClick={() => setMethod(item)}
                >
                  {METHOD_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input id="note" name="note" placeholder="Facultatif" />
          </div>
        </>
      ) : null}

      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      {due || selected ? (
        <SubmitButton pendingLabel="Enregistrement…">
          {due ? "Compléter ce reçu" : "Enregistrer le paiement"}
        </SubmitButton>
      ) : null}
    </form>
  );
}
