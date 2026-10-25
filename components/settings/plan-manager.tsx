"use client";

import { useActionState, useState } from "react";
import { deletePlan, savePlan } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { durationLabel, formatMoney } from "@/lib/format";

type Plan = {
  id: string;
  name: string;
  durationDays: number;
  price: number;
  description: string;
  active: boolean;
};

const blank = { id: "", name: "", durationDays: "30", price: "300", description: "", active: true };

export function PlanManager({ plans, currency }: { plans: Plan[]; currency: string }) {
  const [state, action] = useActionState(savePlan, null);
  const [form, setForm] = useState(blank);
  useActionToast(state);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card>
        <CardContent>
          <form action={action} className="space-y-3">
            {form.id ? <input type="hidden" name="id" value={form.id} /> : null}
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationDays">Durée (jours)</Label>
              <Input
                id="durationDays"
                name="durationDays"
                type="number"
                min="0"
                required
                value={form.durationDays}
                onChange={(event) => setForm({ ...form, durationDays: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">0 = illimité. La durée inclut le jour de début.</p>
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
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                className="h-4 w-4 accent-primary"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Formule disponible
            </label>
            {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
            <div className="flex gap-2">
              <SubmitButton>{form.id ? "Mettre à jour" : "Ajouter"}</SubmitButton>
              {form.id ? (
                <Button type="button" variant="ghost" onClick={() => setForm(blank)}>
                  Annuler
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {plans.map((plan) => (
          <article key={plan.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
                <Badge className={plan.active ? "bg-emerald-100 text-emerald-900" : "bg-secondary"}>
                  {plan.active ? "Disponible" : "Masquée"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {durationLabel(plan.durationDays)} · {formatMoney(plan.price, currency)}
              </p>
              {plan.description ? <p className="mt-1 text-sm">{plan.description}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setForm({
                    id: plan.id,
                    name: plan.name,
                    durationDays: String(plan.durationDays),
                    price: String(plan.price),
                    description: plan.description,
                    active: plan.active,
                  })
                }
              >
                Modifier
              </Button>
              <ConfirmButton
                variant="destructive"
                title={`Supprimer ${plan.name} ?`}
                description="Possible seulement si aucun abonnement n'utilise cette formule."
                confirmLabel="Supprimer"
                action={() => deletePlan(plan.id)}
              >
                Supprimer
              </ConfirmButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
