"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createEquipmentItem, updateEquipmentItem, updateEquipmentPack } from "@/actions/catalog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/hooks/use-action-toast";

type GearPack = { id: string; name: string; activityId: string; price: number };
type GearItem = { id: string; name: string; packId: string; price: number; activityId: string };

export function EquipmentEditor({
  packs,
  items,
  activities,
  currency,
}: {
  packs: GearPack[];
  items: GearItem[];
  activities: { id: string; name: string }[];
  currency: string;
}) {
  const [activityFilter, setActivityFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const visible = activityFilter === "all" ? items : items.filter((item) => item.activityId === activityFilter);
  const visiblePacks = packs.filter((pack) => visible.some((item) => item.packId === pack.id));
  const total = visiblePacks.reduce((sum, pack) => sum + pack.price, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip pressed={activityFilter === "all"} onClick={() => setActivityFilter("all")}>
            Tout
          </Chip>
          {activities.map((activity) => (
            <Chip key={activity.id} pressed={activityFilter === activity.id} onClick={() => setActivityFilter(activity.id)}>
              {activity.name}
            </Chip>
          ))}
        </div>
        <Chip pressed={adding} onClick={() => setAdding((open) => !open)}>
          {adding ? "Fermer" : "Ajouter un article"}
        </Chip>
      </div>
      <p className="text-sm text-muted-foreground">
        {visiblePacks.length === 0 ? "Aucun pack" : visiblePacks.length > 1 ? `${visiblePacks.length} packs` : "1 pack"} · {formatMoney(total, currency)}
      </p>
      {adding ? (
        <AddItemForm
          activities={activities}
          packs={packs}
          currency={currency}
          lockedActivityId={activityFilter === "all" ? null : activityFilter}
        />
      ) : null}
      {visiblePacks.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-6 text-sm text-muted-foreground">Aucun article pour cette activité.</p>
      ) : (
        visiblePacks.map((pack) => {
          const packItems = visible.filter((item) => item.packId === pack.id);
          const activityName = activities.find((activity) => activity.id === pack.activityId)?.name;
          const unitTotal = packItems.reduce((sum, item) => sum + item.price, 0);
          const unitDiffers = Math.round(unitTotal * 100) !== Math.round(pack.price * 100);
          return (
            <section key={pack.id} className="overflow-hidden rounded-2xl border bg-card">
              <PackPriceForm pack={pack} currency={currency}>
                <h2 className="font-display text-lg font-semibold">{pack.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {activityFilter === "all" && activityName ? `${activityName} · ` : ""}
                  {packItems.length > 1 ? `${packItems.length} articles` : "1 article"}
                  {unitDiffers ? ` · à l'unité ${formatMoney(unitTotal, currency)}` : ""}
                </p>
              </PackPriceForm>
              <div className="divide-y">
                {packItems.map((item) => (
                  <ItemRow key={item.id} item={item} currency={currency} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function AddItemForm({
  activities,
  packs,
  currency,
  lockedActivityId,
}: {
  activities: { id: string; name: string }[];
  packs: GearPack[];
  currency: string;
  lockedActivityId: string | null;
}) {
  const [state, action] = useActionState(createEquipmentItem, null);
  useActionToast(state);
  const [activityId, setActivityId] = useState(lockedActivityId ?? activities[0]?.id ?? "");
  const choices = packs.filter((pack) => pack.activityId === activityId);
  const [packId, setPackId] = useState(choices[0]?.id ?? "");
  const [packName, setPackName] = useState("");
  const [customPack, setCustomPack] = useState(choices.length === 0);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const lock = lockedActivityId ?? "";
  const [seenLock, setSeenLock] = useState(lock);
  if (seenLock !== lock) {
    const nextPacks = packs.filter((pack) => pack.activityId === lock);
    setSeenLock(lock);
    if (lock) {
      setActivityId(lock);
      setCustomPack(nextPacks.length === 0);
      setPackId(nextPacks[0]?.id ?? "");
      setPackName("");
    }
  }

  useEffect(() => {
    if (!state?.success) return;
    setCustomPack(false);
    setName("");
    setPrice("");
  }, [state]);

  function selectActivity(id: string) {
    const nextPacks = packs.filter((pack) => pack.activityId === id);
    setActivityId(id);
    if (nextPacks.length === 0) {
      setCustomPack(true);
      setPackId("");
      return;
    }
    setCustomPack(false);
    setPackId(nextPacks.some((pack) => pack.id === packId) ? packId : nextPacks[0].id);
  }

  return (
    <form action={action} className="space-y-3 rounded-2xl border bg-card p-4">
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="packId" value={customPack ? "" : packId} />
      {lockedActivityId ? null : (
        <div className="flex flex-wrap gap-2">
          {activities.map((activity) => (
            <Chip key={activity.id} pressed={activityId === activity.id} onClick={() => selectActivity(activity.id)}>
              {activity.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map((pack) => (
          <Chip
            key={pack.id}
            pressed={!customPack && packId === pack.id}
            onClick={() => {
              setCustomPack(false);
              setPackId(pack.id);
            }}
          >
            {pack.name}
          </Chip>
        ))}
        <Chip
          pressed={customPack}
          onClick={() => {
            setCustomPack(true);
            setPackName("");
          }}
        >
          Nouveau pack
        </Chip>
      </div>
      {customPack ? (
        <Input
          name="packName"
          value={packName}
          onChange={(event) => setPackName(event.target.value)}
          placeholder="Nom du pack"
          aria-label="Nom du pack"
          required
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ceinture, protège-tibias…"
          aria-label="Article"
          className="h-10 min-w-40 flex-1"
          required
        />
        <PriceField value={price} onChange={setPrice} currency={currency} className="w-32 shrink-0" />
        <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
      </div>
      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
    </form>
  );
}

function PackPriceForm({
  pack,
  currency,
  children,
}: {
  pack: GearPack;
  currency: string;
  children: React.ReactNode;
}) {
  const [state, action] = useActionState(updateEquipmentPack, null);
  useActionToast(state);
  const [price, setPrice] = useState(String(pack.price));
  const parsed = Number(price.replace(",", "."));
  const dirty = !Number.isFinite(parsed) || Math.round(parsed * 100) !== Math.round(pack.price * 100);

  useEffect(() => {
    setPrice(String(pack.price));
  }, [pack.price]);

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <input type="hidden" name="id" value={pack.id} />
      <div className="min-w-40 flex-1">{children}</div>
      <div className="flex items-center gap-2">
        <PriceField name="price" value={price} onChange={setPrice} currency={currency} label="Prix du pack complet" className="w-36" />
        <SaveButton dirty={dirty} />
      </div>
      {state?.error ? <p className="w-full rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
    </form>
  );
}

function ItemRow({ item, currency }: { item: GearItem; currency: string }) {
  const [state, action] = useActionState(updateEquipmentItem, null);
  useActionToast(state);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const parsed = Number(price.replace(",", "."));
  const dirty = name.trim() !== item.name || !Number.isFinite(parsed) || Math.round(parsed * 100) !== Math.round(item.price * 100);

  useEffect(() => {
    setName(item.name);
    setPrice(String(item.price));
  }, [item.name, item.price]);

  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto]">
      <input type="hidden" name="id" value={item.id} />
      <Input name="name" value={name} onChange={(event) => setName(event.target.value)} aria-label="Nom de l'article" className="h-10 border-transparent bg-secondary/60" required />
      <PriceField name="price" value={price} onChange={setPrice} currency={currency} label="Prix" className="w-full" />
      <SaveButton dirty={dirty} />
      {state?.error ? <p className="col-span-full rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
    </form>
  );
}

function PriceField({
  name = "price",
  value,
  onChange,
  currency,
  label = "Prix",
  className,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        name={name}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 w-full pr-12 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        required
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
    </div>
  );
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  if (!dirty && !pending) return null;
  return (
    <Button type="submit" size="sm" disabled={pending} className="col-span-full sm:col-span-1 sm:w-auto">
      {pending ? "…" : "Enregistrer"}
    </Button>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("h-10 rounded-xl border px-3 text-sm font-medium", pressed ? "border-primary bg-accent" : "bg-card")}
    >
      {children}
    </button>
  );
}
