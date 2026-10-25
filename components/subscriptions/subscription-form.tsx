"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { Input, fieldClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/shared/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { computeEndDate, formatDate, formatMoney, parseDateOnly, todayInput } from "@/lib/format";
import { memberTextMatches } from "@/lib/member-match";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";

export type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string;
  status: string;
};

export type PlanOption = {
  id: string;
  name: string;
  durationDays: number;
  price: number;
};

export function SubscriptionForm({
  members,
  plans,
  currency,
  defaultMemberId,
  coverageByMember,
  action,
}: {
  members: MemberOption[];
  plans: PlanOption[];
  currency: string;
  defaultMemberId?: string;
  coverageByMember: Record<string, { planId: string; startDate: string }>;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const initial = members.find((member) => member.id === defaultMemberId) ?? null;
  const initialCover = defaultMemberId ? coverageByMember[defaultMemberId] : undefined;
  const initialPlan = plans.find((plan) => plan.id === initialCover?.planId) ?? plans[0];
  const [query, setQuery] = useState(initial ? `${initial.firstName} ${initial.lastName}` : "");
  const [memberId, setMemberId] = useState(initial?.id ?? "");
  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const [startDate, setStartDate] = useState(initialCover?.startDate ?? todayInput());
  const [price, setPrice] = useState(String(initialPlan?.price ?? ""));
  const [recordPayment, setRecordPayment] = useState(true);
  const [openList, setOpenList] = useState(false);
  useActionToast(state);

  const plan = plans.find((item) => item.id === planId);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return members.slice(0, 6);
    return members.filter((member) => memberTextMatches(member, q)).slice(0, 6);
  }, [members, query]);

  const endLabel = (() => {
    if (!plan || !startDate) return "—";
    const end = computeEndDate(parseDateOnly(startDate), plan.durationDays);
    return end ? formatDate(end) : "Illimité";
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attribuer un abonnement</CardTitle>
        <CardDescription>
          Le renouvellement reprend la formule en cours et commence le lendemain de la fin déjà payée. Une durée de 0 jour crée un accès illimité.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="memberId" value={memberId} />
          <div className="relative space-y-2 md:col-span-2">
            <Label htmlFor="memberSearch">Adhérent</Label>
            <Input
              id="memberSearch"
              value={query}
              placeholder="Nom ou téléphone"
              autoComplete="off"
              onFocus={() => setOpenList(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setMemberId("");
                setOpenList(true);
              }}
            />
            {openList && !memberId ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-card shadow-lg">
                {results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Aucun adhérent.</p>
                ) : (
                  results.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setMemberId(member.id);
                        setQuery(`${member.firstName} ${member.lastName}`);
                        const cover = coverageByMember[member.id];
                        const nextPlan = plans.find((plan) => plan.id === cover?.planId);
                        if (nextPlan) {
                          setPlanId(nextPlan.id);
                          setPrice(String(nextPlan.price));
                        }
                        if (cover) setStartDate(cover.startDate);
                        setOpenList(false);
                      }}
                    >
                      {member.firstName} {member.lastName}
                      <span className="ml-2 text-muted-foreground">{member.phone}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="planId">Formule</Label>
            <select
              id="planId"
              name="planId"
              className={fieldClass}
              value={planId}
              onChange={(event) => {
                const next = plans.find((item) => item.id === event.target.value);
                setPlanId(event.target.value);
                if (next) setPrice(String(next.price));
              }}
            >
              {plans.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {formatMoney(item.price, currency)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Date de début</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Prix</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              value={price}
              onChange={(event) => {
                const next = event.target.value;
                setPrice(next);
                if (Number(next) <= 0) setRecordPayment(false);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Date de fin</Label>
            <p className="flex h-11 items-center rounded-xl bg-secondary px-3 text-sm">{endLabel}</p>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              name="recordPayment"
              className="h-4 w-4 accent-primary"
              checked={recordPayment}
              onChange={(event) => setRecordPayment(event.target.checked)}
            />
            Enregistrer le paiement maintenant
          </label>
          <div className="space-y-2">
            <Label htmlFor="method">Mode de paiement</Label>
            <select id="method" name="method" className={fieldClass} defaultValue="CASH">
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input id="note" name="note" placeholder="Optionnel" />
          </div>
          {startDate > todayInput() ? (
            <p className="text-sm text-muted-foreground md:col-span-2">
              Les jours déjà payés restent ouverts jusqu'à cette date de début.
            </p>
          ) : null}
          {members.find((member) => member.id === memberId)?.status === "SUSPENDED" ? (
            <p className="text-sm text-amber-800 md:col-span-2">
              Cet adhérent est suspendu. Le renouvellement n'enlève pas la suspension.
            </p>
          ) : null}
          {state?.error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 md:col-span-2">{state.error}</p>
          ) : null}
          <div>
            <SubmitButton pendingLabel="Enregistrement…">
              {coverageByMember[memberId] ? "Renouveler" : "Attribuer"}
            </SubmitButton>
          </div>
        </form>
        {plans.length === 0 ? (
          <Button asChild className="mt-4" variant="outline">
            <a href="/parametres/formules">Créer une formule</a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
