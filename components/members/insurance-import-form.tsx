"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importInsuranceList } from "@/actions/insurance-import";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function InsuranceImportForm() {
  const [state, action] = useActionState(importInsuranceList, null);
  useActionToast(state);

  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="file">Fichier de l'assurance</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="h-auto py-2" />
        <p className="text-sm text-muted-foreground">CSV ou Excel. La colonne Statut vaut Payé ou Non payé. Sans cette colonne, la ligne est payée chez l'assurance.</p>
      </div>
      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      {state?.success ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.success}</p> : null}
      <ResultList title="Payé chez l'assurance" people={state?.confirmed} />
      <ResultList title="Non payé chez l'assurance" people={state?.unpaid} />
      <ResultList title="Payé chez nous, absent du fichier" people={state?.missing} />
      {state?.unknown?.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Dans le fichier, inconnu chez nous</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {state.unknown.map((person) => (
              <li key={`${person.name}-${person.phone}`}>
                {person.name} · {person.phone}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <SubmitButton pendingLabel="Import…">Importer l'assurance</SubmitButton>
    </form>
  );
}

function ResultList({ title, people }: { title: string; people?: { id: string; name: string }[] }) {
  if (!people?.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="space-y-1 text-sm">
        {people.map((person) => (
          <li key={person.id}>
            <Link className="text-primary underline" href={`/adherents/${person.id}`}>
              {person.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
