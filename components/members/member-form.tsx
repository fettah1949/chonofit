"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fieldClass, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoCapture } from "@/components/members/photo-capture";
import { SubmitButton } from "@/components/shared/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { ageFromInput, ageRangeLabel, formatAge, groupAgeMessage, memberAgeError } from "@/lib/age";
import { daysRemaining, formatDate, formatMoney, parseDateOnly, toInputDate, todayInput } from "@/lib/format";
import { GUARDIAN_RELATIONS, INSURANCE_PRICE, METHOD_LABELS, PAYMENT_METHODS } from "@/lib/constants";
import { gearCharge, packQuote } from "@/lib/gear";
import { cn, roundMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export type CatalogActivity = { id: string; name: string };
export type CatalogGroup = {
  id: string;
  name: string;
  activityId: string;
  daysLabel: string;
  ageMin: number | null;
  ageMax: number | null;
};
export type CatalogPack = { id: string; name: string; activityId: string; price: number };
export type CatalogItem = { id: string; name: string; packId: string; activityId: string; price: number };
export type CatalogPlan = { id: string; name: string; price: number; durationDays: number };
export type CatalogPurchase = {
  id: string;
  itemName: string;
  packName: string;
  unitPrice: number;
  purchasedAt: string;
};

export type MemberFormValues = {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  guardianName: string;
  guardianRelation: string;
  birthDate: string;
  sex: string;
  notes: string;
  photoPath: string;
  hasInsurance: boolean;
  insuranceStart: string;
  insuranceEnd: string;
  activityIds: string[];
  groupIds: string[];
  ownedItemIds: string[];
};

const emptyMember: MemberFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  phone2: "",
  guardianName: "",
  guardianRelation: "",
  birthDate: "",
  sex: "",
  notes: "",
  photoPath: "",
  hasInsurance: false,
  insuranceStart: "",
  insuranceEnd: "",
  activityIds: [],
  groupIds: [],
  ownedItemIds: [],
};

export function MemberForm({
  member = emptyMember,
  activities,
  groups,
  packs,
  items,
  purchases = [],
  plans = [],
  currency,
  action,
}: {
  member?: MemberFormValues;
  activities: CatalogActivity[];
  groups: CatalogGroup[];
  packs: CatalogPack[];
  items: CatalogItem[];
  purchases?: CatalogPurchase[];
  plans?: CatalogPlan[];
  currency: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [photoPath, setPhotoPath] = useState(member.photoPath);
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [phone, setPhone] = useState(member.phone);
  const [phone2, setPhone2] = useState(member.phone2);
  const [guardianName, setGuardianName] = useState(member.guardianName);
  const [guardianRelation, setGuardianRelation] = useState(member.guardianRelation);
  const [birthDate, setBirthDate] = useState(member.birthDate);
  const [sex, setSex] = useState(member.sex);
  const [notes, setNotes] = useState(member.notes);
  const [activityIds, setActivityIds] = useState(member.activityIds);
  const [groupIds, setGroupIds] = useState(member.groupIds);
  const [itemIds, setItemIds] = useState(member.ownedItemIds);
  const [hasInsurance, setHasInsurance] = useState(member.hasInsurance);
  const [insuranceStart, setInsuranceStart] = useState(member.insuranceStart || todayInput());
  const [insuranceEnd, setInsuranceEnd] = useState(member.insuranceEnd);
  const [insuranceEndTouched, setInsuranceEndTouched] = useState(Boolean(member.insuranceEnd));
  const [activityHint, setActivityHint] = useState(false);
  const [refusedGroupId, setRefusedGroupId] = useState<string | null>(null);
  const [recordPayment, setRecordPayment] = useState(!member.id);
  const [planId, setPlanId] = useState("");
  const [payStart, setPayStart] = useState(todayInput());
  const [payAmount, setPayAmount] = useState("");
  const [advanceTouched, setAdvanceTouched] = useState(false);
  const [payMethod, setPayMethod] = useState("CASH");
  useActionToast(state);
  const birthProblem = birthDate ? memberAgeError(birthDate) : null;
  const birthError = birthProblem && birthDate !== member.birthDate ? birthProblem : null;
  const birthAge = birthDate ? ageFromInput(birthDate) : null;
  const knownAge = birthDate && birthProblem !== "La date de naissance est invalide." ? birthAge : null;

  const owned = useMemo(() => new Set(member.ownedItemIds), [member.ownedItemIds]);
  const visibleGroups = groups.filter((group) => activityIds.includes(group.activityId));
  const groupAgeNotice = visibleGroups
    .filter((group) => groupIds.includes(group.id))
    .map((group) => groupAgeMessage(group.name, knownAge, group.ageMin, group.ageMax))
    .find((message) => message != null);
  const refusedGroup = visibleGroups.find((group) => group.id === refusedGroupId) ?? null;
  const refusedMessage = refusedGroup
    ? groupAgeMessage(refusedGroup.name, knownAge, refusedGroup.ageMin, refusedGroup.ageMax)
    : null;
  const visibleItems = items.filter((item) => activityIds.includes(item.activityId));
  const visiblePacks = packs.filter((pack) => visibleItems.some((item) => item.packId === pack.id));
  const newTotal = gearCharge(
    visibleItems.map((item) => ({ id: item.id, packId: item.packId, price: item.price })),
    visiblePacks.map((pack) => ({ id: pack.id, price: pack.price })),
    itemIds,
    member.ownedItemIds,
  ).total;
  const cover = insuranceLabel(hasInsurance, insuranceStart, insuranceEnd);
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;
  const signup = !member.id;
  const insuranceCharge = hasInsurance ? INSURANCE_PRICE : 0;
  const billTotal = roundMoney((selectedPlan?.price ?? 0) + newTotal + insuranceCharge);
  const advance = roundMoney(Number(payAmount) || 0);
  const reste = roundMoney(Math.max(0, billTotal - advance));
  const paymentBlocked = recordPayment && (advance <= 0 || advance > billTotal || (!selectedPlan && newTotal <= 0 && insuranceCharge <= 0));
  const missing = [
    !firstName.trim() || !lastName.trim() ? "nom" : "",
    phone.trim().length < 6 ? "téléphone" : "",
    activityIds.length === 0 ? "activité" : "",
    birthError ? "âge" : "",
    groupAgeNotice ? "groupe" : "",
    paymentBlocked ? "paiement" : "",
  ].filter(Boolean);

  useEffect(() => {
    if (!signup || !recordPayment) return;
    if (!advanceTouched || advance > billTotal) {
      setPayAmount(billTotal > 0 ? String(billTotal) : "");
    }
  }, [signup, recordPayment, advanceTouched, billTotal, advance]);

  function toggleActivity(id: string) {
    const next = activityIds.includes(id) ? activityIds.filter((value) => value !== id) : [...activityIds, id];
    if (next.length > 0) setActivityHint(false);
    setActivityIds(next);
    setGroupIds((selected) => selected.filter((groupId) => groups.some((group) => group.id === groupId && next.includes(group.activityId))));
    setItemIds((selected) => {
      const stillThere = (itemId: string) => items.some((item) => item.id === itemId && next.includes(item.activityId));
      const keptOwned = member.ownedItemIds.filter(stillThere);
      const keptNew = selected.filter((itemId) => !owned.has(itemId) && stillThere(itemId));
      return [...new Set([...keptOwned, ...keptNew])];
    });
  }

  function toggleGroup(id: string) {
    const group = groups.find((item) => item.id === id);
    setGroupIds((current) => {
      if (current.includes(id)) {
        setRefusedGroupId(null);
        return current.filter((value) => value !== id);
      }
      const issue = group ? groupAgeMessage(group.name, knownAge, group.ageMin, group.ageMax) : null;
      if (issue) {
        setRefusedGroupId(id);
        return current;
      }
      setRefusedGroupId(null);
      return [...current, id];
    });
  }

  function toggleItem(id: string) {
    if (owned.has(id)) return;
    setItemIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function togglePack(packId: string) {
    const packItems = visibleItems.filter((item) => item.packId === packId && !owned.has(item.id));
    const allOn = packItems.every((item) => itemIds.includes(item.id));
    setItemIds((current) => {
      const next = new Set(current);
      for (const item of packItems) {
        if (allOn) next.delete(item.id);
        else next.add(item.id);
      }
      return [...next];
    });
  }

  return (
    <form
      action={formAction}
      className="space-y-6"
      onSubmit={(event) => {
        if (birthError || activityIds.length === 0 || paymentBlocked) {
          event.preventDefault();
          if (activityIds.length === 0) setActivityHint(true);
        }
      }}
    >
      {member.id ? <input type="hidden" name="id" value={member.id} /> : null}
      <input type="hidden" name="photoPath" value={photoPath} />
      {activityIds.map((id) => (
        <input key={id} type="hidden" name="activityId" value={id} />
      ))}
      {groupIds.map((id) => (
        <input key={id} type="hidden" name="groupId" value={id} />
      ))}
      {itemIds.map((id) => (
        <input key={id} type="hidden" name="itemId" value={id} />
      ))}

      <div className="grid items-start gap-6 min-[560px]:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="min-[560px]:sticky min-[560px]:top-20">
          <CardContent>
            <PhotoCapture
              value={photoPath}
              onChange={setPhotoPath}
              firstName={firstName || "A"}
              lastName={lastName || "B"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4">
            <div className="border-b pb-3">
              <SectionTitle>Informations</SectionTitle>
              <p className="text-sm text-muted-foreground">Nom, parent, téléphone et âge. 15 ans maximum.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" name="firstName" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" name="lastName" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  required
                  placeholder="06 12 34 56 78"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone2">Téléphone 2</Label>
                <Input
                  id="phone2"
                  name="phone2"
                  placeholder="06 12 34 56 78"
                  value={phone2}
                  onChange={(event) => setPhone2(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guardianName">Nom du parent</Label>
                <Input
                  id="guardianName"
                  name="guardianName"
                  placeholder="Prénom et nom"
                  value={guardianName}
                  onChange={(event) => setGuardianName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardianRelation">Lien de parenté</Label>
                <select
                  id="guardianRelation"
                  name="guardianRelation"
                  className={fieldClass}
                  value={guardianRelation}
                  onChange={(event) => setGuardianRelation(event.target.value)}
                >
                  <option value="">Choisir</option>
                  {GUARDIAN_RELATIONS.map((relation) => (
                    <option key={relation} value={relation}>
                      {relation}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 rounded-xl bg-secondary/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="birthDate">Date de naissance</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  value={birthDate}
                  aria-invalid={birthError ? true : undefined}
                  className={birthError ? "border-red-400 focus:border-red-500 focus:ring-red-200" : birthAge !== null && !birthProblem ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200" : undefined}
                  onChange={(event) => setBirthDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sexe</Label>
                <input type="hidden" name="sex" value={sex} />
                <div className="flex gap-2">
                  {(
                    [
                      ["M", "Garçon"],
                      ["F", "Fille"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={sex === value}
                      className={cn(
                        "h-10 min-w-24 rounded-xl border bg-card px-3 text-sm font-medium",
                        sex === value ? "border-primary bg-accent" : "hover:bg-background",
                      )}
                      onClick={() => setSex(sex === value ? "" : value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <BirthStatus
                className="sm:col-span-2"
                error={birthError}
                problem={birthProblem}
                age={birthAge}
                sameAsSaved={birthDate === member.birthDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                className="min-h-16"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Informations utiles à l'accueil"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <section className={cn("rounded-2xl border bg-card p-5", activityHint && activityIds.length === 0 && "border-red-300")}>
        <SectionTitle>Activités</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">Au moins une activité. Les deux sont possibles.</p>
        {activityHint && activityIds.length === 0 ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            Choisissez Karaté, Kickboxing, ou les deux.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {activities.map((activity) => (
            <Choice
              key={activity.id}
              checked={activityIds.includes(activity.id)}
              label={activity.name}
              onChange={() => toggleActivity(activity.id)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle>Assurance</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">{insuranceSummary(hasInsurance, insuranceStart, insuranceEnd, cover.label)}</p>
          </div>
          {hasInsurance ? <p className="font-display text-2xl font-semibold">{formatMoney(INSURANCE_PRICE, currency)}</p> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!hasInsurance}
            className={cn("rounded-xl border px-3 py-2 text-sm", !hasInsurance ? "border-primary bg-accent" : "bg-card hover:bg-secondary")}
            onClick={() => setHasInsurance(false)}
          >
            Sans assurance
          </button>
          <button
            type="button"
            aria-pressed={hasInsurance}
            className={cn("rounded-xl border px-3 py-2 text-sm", hasInsurance ? "border-primary bg-accent" : "bg-card hover:bg-secondary")}
            onClick={() => {
              setHasInsurance(true);
              setInsuranceEnd((current) => (insuranceEndTouched ? current : yearAfter(insuranceStart)));
            }}
          >
            Avec assurance
          </button>
        </div>
        {hasInsurance ? <input type="hidden" name="hasInsurance" value="on" /> : null}
        {hasInsurance ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="insuranceStart">Début</Label>
              <Input
                id="insuranceStart"
                name="insuranceStart"
                type="date"
                value={insuranceStart}
                onChange={(event) => {
                  const value = event.target.value;
                  setInsuranceStart(value);
                  if (!insuranceEndTouched) setInsuranceEnd(yearAfter(value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insuranceEnd">Fin</Label>
              <Input
                id="insuranceEnd"
                name="insuranceEnd"
                type="date"
                value={insuranceEnd}
                onChange={(event) => {
                  setInsuranceEndTouched(true);
                  setInsuranceEnd(event.target.value);
                }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <SectionTitle>Groupes</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {knownAge != null ? `${formatAge(knownAge)}. ` : ""}
          Plusieurs groupes sont possibles. Seule une tranche qui contient cet âge peut être choisie.
        </p>
        {activityIds.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Choisissez d'abord une activité.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleGroups.map((group) => {
              const checked = groupIds.includes(group.id);
              const issue = groupAgeMessage(group.name, knownAge, group.ageMin, group.ageMax);
              const range = ageRangeLabel(group.ageMin, group.ageMax);
              return (
                <Choice
                  key={group.id}
                  checked={checked}
                  disabled={Boolean(issue) && !checked}
                  warning={Boolean(issue)}
                  label={group.name}
                  detail={[group.daysLabel, range || "Tranche d'âge à renseigner", issue && knownAge != null ? "Hors tranche" : ""].filter(Boolean).join(" · ")}
                  onChange={() => toggleGroup(group.id)}
                />
              );
            })}
          </div>
        )}
        {groupAgeNotice || refusedMessage ? <p className="mt-3 text-sm text-amber-800">{groupAgeNotice ?? refusedMessage}</p> : null}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionTitle>Tenues</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">Le pack complet est facturé à son prix. Sinon, chaque article est facturé à l'unité.</p>
          </div>
          <p className="font-display text-2xl font-semibold">{formatMoney(newTotal, currency)}</p>
        </div>
        {activityIds.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Choisissez d'abord une activité.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {visiblePacks.map((pack) => {
              const packItems = visibleItems.filter((item) => item.packId === pack.id);
              const quote = packQuote(
                packItems.map((item) => ({ id: item.id, packId: item.packId, price: item.price })),
                pack.price,
                itemIds,
                member.ownedItemIds,
              );
              const canTakePack = packItems.length > 1 && packItems.every((item) => !owned.has(item.id));
              return (
                <div key={pack.id} className="space-y-2">
                  <p className="font-medium">{pack.name}</p>
                  {canTakePack ? (
                    <Choice
                      checked={quote.complete}
                      label="Pack complet"
                      detail={formatMoney(pack.price, currency)}
                      onChange={() => togglePack(pack.id)}
                    />
                  ) : null}
                  <div className="grid gap-2">
                    {packItems.map((item) => (
                      <Choice
                        key={item.id}
                        checked={itemIds.includes(item.id)}
                        disabled={owned.has(item.id)}
                        label={item.name}
                        detail={owned.has(item.id) ? "Déjà acheté" : quote.complete ? "Inclus dans le pack" : formatMoney(item.price, currency)}
                        onChange={() => toggleItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {purchases.length > 0 ? (
          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium">Historique des achats</p>
            <ul className="mt-2 space-y-2">
              {purchases.map((purchase) => (
                <li key={purchase.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {purchase.itemName}
                    <span className="text-muted-foreground"> · {purchase.packName}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatMoney(purchase.unitPrice, currency)} · {formatDate(purchase.purchasedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {signup ? (
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
            <div>
              <SectionTitle>Paiement</SectionTitle>
              <p className="text-sm text-muted-foreground">
                {recordPayment ? "Touchez une formule, puis ajustez l'avance." : "La fiche sera créée sans encaissement."}
              </p>
            </div>
            <label className={cn("flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium", recordPayment ? "border-primary bg-accent" : "bg-card")}>
              <input
                type="checkbox"
                name="recordPayment"
                className="h-4 w-4 accent-primary"
                checked={recordPayment}
                onChange={(event) => setRecordPayment(event.target.checked)}
              />
              Encaisser maintenant
            </label>
          </div>
          {recordPayment ? (
            <div className="mt-4 space-y-4">
              <input type="hidden" name="planId" value={planId} />
              <input type="hidden" name="payMethod" value={payMethod} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={planId === ""}
                  className={cn("rounded-xl border px-3 py-2 text-left text-sm", planId === "" ? "border-primary bg-accent" : "bg-card hover:bg-secondary")}
                  onClick={() => setPlanId("")}
                >
                  Sans formule
                </button>
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    aria-pressed={planId === plan.id}
                    className={cn("rounded-xl border px-3 py-2 text-left", planId === plan.id ? "border-primary bg-accent" : "bg-card hover:bg-secondary")}
                    onClick={() => setPlanId(plan.id)}
                  >
                    <span className="block text-sm font-medium">{plan.name}</span>
                    <span className="font-display text-lg font-semibold leading-none">{formatMoney(plan.price, currency)}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedPlan ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="payStart">Début</Label>
                    <Input id="payStart" name="payStart" type="date" required value={payStart} onChange={(event) => setPayStart(event.target.value)} />
                  </div>
                ) : null}
                <div className={cn("space-y-1.5", !selectedPlan && "sm:col-span-2")}>
                  <Label>Mode</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method}
                        type="button"
                        aria-pressed={payMethod === method}
                        className={cn("h-10 rounded-xl border px-3 text-sm font-medium", payMethod === method ? "border-primary bg-accent" : "bg-card hover:bg-secondary")}
                        onClick={() => setPayMethod(method)}
                      >
                        {METHOD_LABELS[method]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                {billTotal <= 0 ? (
                  <p className="text-sm text-muted-foreground">Choisissez une formule, une tenue ou l'assurance.</p>
                ) : (
                  <>
                    <ul className="space-y-1.5 text-sm">
                      {selectedPlan ? (
                        <li className="flex justify-between gap-3">
                          <span>{selectedPlan.name}</span>
                          <span className="tabular-nums">{formatMoney(selectedPlan.price, currency)}</span>
                        </li>
                      ) : null}
                      {newTotal > 0 ? (
                        <li className="flex justify-between gap-3">
                          <span>Tenues</span>
                          <span className="tabular-nums">{formatMoney(newTotal, currency)}</span>
                        </li>
                      ) : null}
                      {hasInsurance ? (
                        <li className="flex justify-between gap-3">
                          <span>Assurance</span>
                          <span className="tabular-nums">{formatMoney(INSURANCE_PRICE, currency)}</span>
                        </li>
                      ) : null}
                    </ul>
                    <div className="mt-3 grid items-end gap-3 border-t border-border pt-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-display text-2xl font-semibold leading-none tabular-nums">{formatMoney(billTotal, currency)}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="payAmount">Avance</Label>
                          {reste > 0 && advance < billTotal ? (
                            <button type="button" className="text-xs font-medium text-primary" onClick={() => { setAdvanceTouched(true); setPayAmount(String(billTotal)); }}>
                              Tout encaisser
                            </button>
                          ) : null}
                        </div>
                        <Input
                          id="payAmount"
                          name="payAmount"
                          type="number"
                          min="0.01"
                          max={billTotal}
                          step="0.01"
                          required
                          value={payAmount}
                          onChange={(event) => {
                            setAdvanceTouched(true);
                            setPayAmount(event.target.value);
                          }}
                          className="h-10 bg-card text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>
                      <div className={cn("flex h-10 flex-col justify-center rounded-xl px-3", reste > 0 ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950")}>
                        <p className="text-xs">{reste > 0 ? "Reste à payer" : "Soldé"}</p>
                        <p className="font-display text-lg font-semibold leading-none tabular-nums">{formatMoney(reste, currency)}</p>
                      </div>
                    </div>
                    {advance > billTotal ? <p className="mt-2 text-sm text-red-800">L'avance dépasse le total.</p> : null}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <p className="text-sm">
          {missing.length === 0 ? (
            <span className="font-medium text-emerald-800">{member.id ? "Prêt à enregistrer." : "Prêt à créer."}</span>
          ) : (
            <span className="text-muted-foreground">Il reste : {missing.join(", ")}</span>
          )}
        </p>
        <div className="flex gap-2">
          <SubmitButton>{member.id ? "Enregistrer" : "Créer l'adhérent"}</SubmitButton>
          <Button asChild variant="outline">
            <Link href={member.id ? `/adherents/${member.id}` : "/adherents"}>Annuler</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function BirthStatus({
  error,
  problem,
  age,
  sameAsSaved,
  className,
}: {
  error: string | null;
  problem: string | null;
  age: number | null;
  sameAsSaved: boolean;
  className?: string;
}) {
  if (!problem && age === null) return null;
  if (error) {
    return (
      <div role="alert" className={cn("flex min-h-11 items-center gap-3 rounded-xl bg-red-50 px-3 py-2 text-red-900", className)}>
        {age !== null && age >= 0 ? <span className="font-display text-2xl font-semibold leading-none">{formatAge(age)}</span> : null}
        <span className="text-sm font-medium">{error}</span>
      </div>
    );
  }
  if (age !== null && problem && sameAsSaved) {
    return (
      <div className={cn("flex min-h-11 items-center gap-3 rounded-xl bg-card px-3 py-2", className)}>
        <span className="font-display text-2xl font-semibold leading-none">{formatAge(age)}</span>
        <span className="text-sm text-muted-foreground">Date déjà enregistrée</span>
      </div>
    );
  }
  if (age !== null) {
    return (
      <div className={cn("flex min-h-11 items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-950", className)}>
        <span className="font-display text-2xl font-semibold leading-none">{formatAge(age)}</span>
        <span className="text-sm">Âge accepté</span>
      </div>
    );
  }
  return <p className={cn("text-sm text-red-800", className)}>{problem}</p>;
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("font-display text-lg font-semibold", className)}>{children}</h2>;
}

function Choice({
  checked,
  label,
  detail,
  disabled,
  warning,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  disabled?: boolean;
  warning?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2",
        checked && !warning && "border-primary bg-accent",
        warning && "border-amber-300 bg-amber-50",
        disabled && "cursor-not-allowed",
        disabled && !warning && "opacity-80",
      )}
      onClick={(event) => {
        if (!disabled) return;
        event.preventDefault();
        onChange();
      }}
    >
      <input
        type="checkbox"
        className="h-5 w-5 accent-primary"
        checked={checked}
        disabled={disabled}
        ref={(node) => {
          if (node && node.checked !== checked) node.checked = checked;
        }}
        onChange={onChange}
      />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {detail ? <span className="block text-sm text-muted-foreground">{detail}</span> : null}
      </span>
    </label>
  );
}

function yearAfter(start: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return "";
  const date = parseDateOnly(start);
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() - 1);
  return toInputDate(date);
}

function insuranceSummary(hasInsurance: boolean, start: string, end: string, status: string) {
  if (!hasInsurance) return "La fiche sera créée sans assurance.";
  if (!start || !end) return "Indiquez le début et la fin.";
  if (end < start) return "La fin est avant le début.";
  return `${status} · ${formatDate(parseDateOnly(start))} → ${formatDate(parseDateOnly(end))} · ${daysRemaining(parseDateOnly(end))}`;
}

function insuranceLabel(hasInsurance: boolean, start: string, end: string) {
  if (!hasInsurance) return { label: "Pas d'assurance", className: "bg-secondary text-secondary-foreground" };
  if (!start || !end) return { label: "Dates manquantes", className: "bg-amber-100 text-amber-950" };
  const today = todayInput();
  if (end < today) return { label: "Expirée", className: "bg-red-100 text-red-900" };
  if (start > today) return { label: "Pas encore commencée", className: "bg-amber-100 text-amber-950" };
  return { label: "Valide", className: "bg-emerald-100 text-emerald-950" };
}
