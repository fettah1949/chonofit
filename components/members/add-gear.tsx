"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { addMemberGear } from "@/actions/members";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { gearCharge, packQuote } from "@/lib/gear";
import { formatMoney } from "@/lib/format";
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export type GearChoice = {
  id: string;
  name: string;
  activityName: string;
  price: number;
  items: { id: string; name: string; price: number; owned: boolean; stock: number }[];
};

export function AddGear({
  memberId,
  currency,
  packs,
}: {
  memberId: string;
  currency: string;
  packs: GearChoice[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [state, action] = useActionState(addMemberGear, null as ActionState);
  useActionToast(state);

  const lines = useMemo(
    () => packs.flatMap((pack) => pack.items.map((item) => ({ id: item.id, packId: pack.id, price: item.price }))),
    [packs],
  );
  const ownedIds = useMemo(
    () => packs.flatMap((pack) => pack.items.filter((item) => item.owned).map((item) => item.id)),
    [packs],
  );
  const charge = gearCharge(
    lines,
    packs.map((pack) => ({ id: pack.id, price: pack.price })),
    selected,
    ownedIds,
  );
  const severalActivities = new Set(packs.map((pack) => pack.activityName)).size > 1;

  function toggle(id: string) {
    const item = packs.flatMap((pack) => pack.items).find((row) => row.id === id);
    if (item && !item.owned && item.stock <= 0) return;
    setSelected((current) => (current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]));
  }

  function toggleRest(pack: GearChoice) {
    const fresh = pack.items.filter((item) => !item.owned && item.stock > 0).map((item) => item.id);
    const allOn = fresh.every((id) => selected.includes(id));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of fresh) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return [...next];
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected([]);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajouter un article</DialogTitle>
          <DialogDescription>Touchez ce qui manque. Le pack complet garde son prix seulement s'il est pris en entier.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="method" value={method} />
          {selected.map((id) => (
            <input key={id} type="hidden" name="itemId" value={id} />
          ))}
          <div className="space-y-5">
            {packs.map((pack) => {
              const fresh = pack.items.filter((item) => !item.owned && item.stock > 0);
              const restSelected = fresh.length > 0 && fresh.every((item) => selected.includes(item.id));
              const quote = packQuote(
                pack.items.map((item) => ({ id: item.id, packId: pack.id, price: item.price })),
                pack.price,
                selected,
                ownedIds,
              );
              const rest = fresh.reduce((sum, item) => sum + item.price, 0);
              const wholePack = fresh.length === pack.items.length && fresh.length > 1;
              return (
                <div key={pack.id} className="space-y-2">
                  <p className="text-sm font-medium">
                    {pack.name}
                    {severalActivities ? <span className="font-normal text-muted-foreground"> · {pack.activityName}</span> : null}
                  </p>
                  {fresh.length > 1 ? (
                    <button
                      type="button"
                      aria-pressed={restSelected}
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left",
                        restSelected ? "border-primary bg-accent" : "bg-card hover:bg-secondary",
                      )}
                      onClick={() => toggleRest(pack)}
                    >
                      <span className="font-medium">{wholePack ? "Pack complet" : "Tout ce qui manque"}</span>
                      <span className="tabular-nums">{formatMoney(wholePack ? pack.price : rest, currency)}</span>
                    </button>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {pack.items.map((item) => {
                      const on = selected.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={item.owned || item.stock <= 0}
                          aria-pressed={item.owned ? undefined : on}
                          className={cn(
                            "flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 text-left",
                            (item.owned || item.stock <= 0) && "cursor-not-allowed bg-secondary text-muted-foreground",
                            !item.owned && item.stock > 0 && on && "border-primary bg-accent",
                            !item.owned && item.stock > 0 && !on && "bg-card hover:bg-secondary",
                          )}
                          onClick={() => toggle(item.id)}
                        >
                          <span>
                            <span className="block font-medium">{item.name}</span>
                            <span className="block text-xs">{item.stock === 0 ? "Rupture" : `${item.stock} en réserve`}</span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums">
                            {item.owned ? "Déjà pris" : item.stock <= 0 ? "Rupture" : quote.complete ? "Inclus" : formatMoney(item.price, currency)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm text-muted-foreground">{selected.length === 0 ? "Aucun article choisi" : `${selected.length} article${selected.length > 1 ? "s" : ""}`}</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{formatMoney(charge.total, currency)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={method === value}
                  className={cn(
                    "h-10 rounded-xl border px-3 text-sm font-medium",
                    method === value ? "border-primary bg-accent" : "bg-card hover:bg-secondary",
                  )}
                  onClick={() => setMethod(value)}
                >
                  {METHOD_LABELS[value]}
                </button>
              ))}
            </div>
            {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
            <SubmitButton className="w-full" disabled={selected.length === 0} pendingLabel="Enregistrement…">
              {selected.length === 0 ? "Choisir un article" : `Encaisser ${formatMoney(charge.total, currency)}`}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
