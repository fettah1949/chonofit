"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { sellEquipmentItem } from "@/actions/equipment-sales";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GearCard = {
  id: string;
  name: string;
  packName: string;
  activityName: string;
  price: number;
  stock: number;
};

function stockCaption(stock: number) {
  return stock <= 0 ? "Rupture" : "en réserve";
}

function groupsOf(items: GearCard[]) {
  const groups: { key: string; packName: string; activityName: string; items: GearCard[] }[] = [];
  for (const item of items) {
    const key = `${item.activityName}\0${item.packName}`;
    const current = groups.find((group) => group.key === key);
    if (current) current.items.push(item);
    else groups.push({ key, packName: item.packName, activityName: item.activityName, items: [item] });
  }
  return groups;
}

export type GearSaleRow = {
  id: string;
  itemName: string;
  packName: string;
  quantity: number;
  unitPrice: number;
  method: string;
  soldAt: string;
};

export function GearDesk({
  currency,
  items,
  sales,
}: {
  currency: string;
  items: GearCard[];
  sales: GearSaleRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seller, setSeller] = useState<GearCard | null>(null);
  const stockTotal = items.reduce((sum, item) => sum + item.stock, 0);
  const emptyCount = items.filter((item) => item.stock <= 0).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-display text-lg font-semibold">Tenues</h2>
          <p className="text-sm text-muted-foreground">
            Articles du catalogue, à l'unité, sans créer d'adhérent. Le pack ne s'applique pas ici.
          </p>
        </div>
        {items.length > 0 ? (
          <p className="text-sm font-medium tabular-nums">
            {stockTotal} {stockTotal > 1 ? "pièces" : "pièce"} en réserve
            {emptyCount > 0 ? ` · ${emptyCount} en rupture` : ""}
          </p>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-sm text-muted-foreground">Aucun article de tenue.</p>
      ) : (
        <div className="space-y-5">
          {groupsOf(items).map((group) => (
            <div key={group.key} className="space-y-3">
              <h3 className="font-display text-base font-semibold">
                {group.packName}
                <span className="font-sans text-sm font-normal text-muted-foreground"> · {group.activityName}</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {group.items.map((item) => {
                  const empty = item.stock <= 0;
                  return (
                    <article key={item.id} className="flex flex-col rounded-2xl border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 truncate font-display text-base font-semibold" title={item.name}>
                          {item.name}
                        </h4>
                        <p
                          className={cn("font-display text-2xl font-semibold leading-none tabular-nums", empty && "text-primary")}
                          aria-label={empty ? `${item.name} en rupture` : `${item.stock} ${item.name} en réserve`}
                        >
                          {item.stock}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.price, currency)}</p>
                      <p className={cn("text-xs", empty ? "font-medium text-primary" : "text-muted-foreground")}>{stockCaption(item.stock)}</p>
                      <Button className="mt-3 h-10 w-full" disabled={empty} onClick={() => setSeller(item)}>
                        {empty ? "Rupture" : "Vendre"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-2xl border bg-card">
        <h3 className="border-b px-4 py-3 font-medium">Dernières ventes au comptoir</h3>
        {sales.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Aucune vente sans inscription pour le moment.</p>
        ) : (
          <div className="divide-y">
            {sales.map((sale) => (
              <a key={sale.id} href={`/tenues/${sale.id}/recu`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/70">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {sale.itemName} · {sale.packName}
                    {sale.quantity > 1 ? ` × ${sale.quantity}` : ""}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    Comptoir · {formatDateTime(sale.soldAt)} · {METHOD_LABELS[sale.method as PaymentMethod] ?? sale.method}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium">{formatMoney(sale.unitPrice * sale.quantity, currency)}</p>
              </a>
            ))}
          </div>
        )}
      </div>
      <SellDialog
        item={seller}
        currency={currency}
        pending={pending}
        onClose={() => setSeller(null)}
        onSell={(input) => {
          startTransition(async () => {
            const result = await sellEquipmentItem(input);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            if (result?.redirectTo) router.push(result.redirectTo);
          });
        }}
      />
    </section>
  );
}

function SellDialog({
  item,
  currency,
  pending,
  onClose,
  onSell,
}: {
  item: GearCard | null;
  currency: string;
  pending: boolean;
  onClose: () => void;
  onSell: (input: { itemId: string; quantity: number; method: string }) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<string>("CASH");
  const [seen, setSeen] = useState<string | null>(null);
  if ((item?.id ?? null) !== seen) {
    setSeen(item?.id ?? null);
    setQuantity(1);
    setMethod("CASH");
  }

  const max = item?.stock ?? 1;
  const total = item ? item.price * quantity : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    onSell({ itemId: item.id, quantity, method });
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? `Vendre ${item.name}` : "Vendre"}</DialogTitle>
          <DialogDescription>
            {item ? `${item.packName} · ${formatMoney(item.price, currency)} l'unité · ${item.stock} en réserve. Sans adhérent.` : ""}
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <form className="space-y-4" onSubmit={submit}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Quantité</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="h-12 w-12" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-display text-xl font-semibold">{quantity}</span>
                <Button type="button" variant="outline" className="h-12 w-12" disabled={quantity >= max} onClick={() => setQuantity((current) => Math.min(max, current + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-right font-display text-2xl font-semibold">{formatMoney(total, currency)}</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={method === value}
                  className={cn("h-10 rounded-xl border px-3 text-sm font-medium", method === value ? "border-primary bg-accent" : "bg-card")}
                  onClick={() => setMethod(value)}
                >
                  {METHOD_LABELS[value]}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || item.stock < 1}>
                {pending ? "Enregistrement…" : `Encaisser ${formatMoney(total, currency)}`}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
