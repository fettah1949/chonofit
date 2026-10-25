"use client";

import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { SaleBars } from "@/components/dashboard/sale-bars";
import { fieldClass } from "@/components/ui/input";
import { loadMonthStats } from "@/actions/stats";
import { formatMoney } from "@/lib/format";
import { cn, withQuery } from "@/lib/utils";

type PlanLine = { id: string; name: string; count: number; amount: number };
type GearLine = { id: string; name: string; activity: string; count: number; amount: number };

export function MonthStats({
  sujet,
  month,
  year,
  label,
  years,
  months,
  currency,
  subscriptions,
  gear,
}: {
  sujet: "abonnements" | "tenues";
  month: number;
  year: number;
  label: string;
  years: number[];
  months: string[];
  currency: string;
  subscriptions: { count: number; amount: number; plans: PlanLine[] };
  gear: { count: number; amount: number; items: GearLine[] };
}) {
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState({ sujet, month, year, label, subscriptions, gear });
  const [monthValue, setMonthValue] = useState(String(month));
  const [yearValue, setYearValue] = useState(String(year));

  function apply(nextSujet: "abonnements" | "tenues", mois: string, annee: string, push = true) {
    startTransition(async () => {
      const result = await loadMonthStats(nextSujet, mois, annee);
      if (!result) return;
      setView(result);
      setMonthValue(String(result.month));
      setYearValue(String(result.year));
      if (!push) return;
      const href = `${withQuery("/", { sujet: result.sujet, mois: result.month, annee: result.year })}#statistiques`;
      const current = window.history.state as { __NA?: boolean; _N?: boolean } | null;
      if (current && (current.__NA || current._N)) {
        window.history.pushState(current, "", href);
      }
    });
  }

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      apply(params.get("sujet") === "tenues" ? "tenues" : "abonnements", params.get("mois") ?? String(month), params.get("annee") ?? String(year), false);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [month, year]);

  function show(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(view.sujet, monthValue, yearValue);
  }

  const subscriptionsView = view.sujet === "abonnements";

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Statistiques</h2>
          <p className="mt-1 text-sm text-muted-foreground">{view.label}</p>
        </div>
        <form className="flex flex-wrap items-center gap-2" onSubmit={show}>
          <label className="sr-only" htmlFor="mois">Mois</label>
          <select
            id="mois"
            value={monthValue}
            onChange={(event) => setMonthValue(event.target.value)}
            className={cn(fieldClass, "h-10 w-auto min-w-36")}
          >
            {months.map((name, index) => (
              <option key={name} value={index + 1}>{name}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="annee">Année</label>
          <select
            id="annee"
            value={yearValue}
            onChange={(event) => setYearValue(event.target.value)}
            className={cn(fieldClass, "h-10 w-auto")}
          >
            {years.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "…" : "Voir"}
          </button>
        </form>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["abonnements", "tenues"] as const).map((value) => {
          const pressed = view.sujet === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              disabled={pending}
              onClick={() => apply(value, monthValue, yearValue)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-medium",
                pressed ? "border-primary bg-accent" : "bg-background",
              )}
            >
              {value === "abonnements" ? "Abonnements" : "Tenues"}
            </button>
          );
        })}
      </div>
      {subscriptionsView ? (
        <Figures
          label="Formules commencées"
          amount={view.subscriptions.amount}
          countLabel={countLabel(view.subscriptions.count, "formule", "formules", "Aucune formule")}
          currency={currency}
          hint="Prix des formules dont le début tombe dans le mois choisi."
        >
          {view.subscriptions.plans.length > 0 ? (
            <SaleBars items={view.subscriptions.plans} currency={currency} noun="formule" />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Aucun abonnement commencé sur cette période.</p>
          )}
        </Figures>
      ) : (
        <Figures
          label="Tenues vendues"
          amount={view.gear.amount}
          countLabel={countLabel(view.gear.count, "pièce", "pièces", "Aucune pièce")}
          currency={currency}
          hint="Prix des tenues vendues dans le mois choisi. Un pack complet est compté au prix du pack."
        >
          {view.gear.items.length > 0 ? (
            <SaleBars items={view.gear.items} currency={currency} noun="pièce" />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Aucune tenue vendue sur cette période.</p>
          )}
        </Figures>
      )}
    </>
  );
}

function Figures({
  label,
  amount,
  countLabel,
  currency,
  hint,
  children,
}: {
  label: string;
  amount: number;
  countLabel: string;
  currency: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{formatMoney(amount, currency)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{countLabel}</p>
      {children}
      <p className="mt-4 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function countLabel(count: number, one: string, many: string, none: string) {
  if (count === 0) return none;
  if (count === 1) return `1 ${one}`;
  return `${count} ${many}`;
}
