"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";

const choices = [
  { filtre: "tous", label: "Tous les adhérents", hint: "La liste complète" },
  { filtre: "avec", label: "Avec assurance", hint: "Payé chez l'assurance" },
  { filtre: "sans", label: "Sans assurance", hint: "Non payé chez l'assurance" },
];

export function InsuranceExportLinks() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Exporter</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 rounded-xl border bg-card p-1 shadow-lg"
        >
          {choices.map((choice) => (
            <DropdownMenu.Item key={choice.filtre} asChild>
              <a
                href={`/adherents/assurance/export?filtre=${choice.filtre}`}
                className="flex cursor-pointer flex-col rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-secondary"
              >
                <span className="text-sm font-medium">{choice.label}</span>
                <span className="text-xs text-muted-foreground">{choice.hint}</span>
              </a>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
