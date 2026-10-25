import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { EquipmentEditor } from "@/components/settings/equipment-editor";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { loadCatalog } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { getGearStats, type GearPeriod } from "@/lib/stats";
import { SaleBars } from "@/components/dashboard/sale-bars";
import { cn, withQuery } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenues" };

const periods: { value: GearPeriod; label: string }[] = [
  { value: "jour", label: "Aujourd'hui" },
  { value: "7", label: "7 jours" },
  { value: "mois", label: "Ce mois" },
  { value: "tous", label: "Tout" },
];

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const params = await searchParams;
  const periode = periods.some((item) => item.value === params.periode) ? (params.periode as GearPeriod) : "mois";
  const periodLabel = periods.find((item) => item.value === periode)?.label ?? "Ce mois";
  const [settings, catalog, gear] = await Promise.all([getSettings(), loadCatalog(prisma), getGearStats(periode)]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tenues" description="Le pack complet a son prix. Un article, ou quelques-uns, gardent le leur." />
      <SettingsNav />
      <div className="flex flex-wrap gap-2">
        {periods.map((filter) => {
          const pressed = periode === filter.value;
          return (
            <Link
              key={filter.value}
              href={filter.value === "mois" ? "/parametres/tenues" : withQuery("/parametres/tenues", { periode: filter.value })}
              aria-current={pressed ? "page" : undefined}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-medium leading-10",
                pressed ? "border-primary bg-accent" : "bg-card",
              )}
            >
              {filter.label} {gear.counts[filter.value]}
            </Link>
          );
        })}
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
          <p className="mt-3 font-display text-3xl font-semibold">{formatMoney(gear.amount, settings.currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{pieceLabel(gear.count)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pièces</p>
          <p className="mt-3 font-display text-3xl font-semibold">{gear.count}</p>
          <p className="mt-1 text-xs text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Références</p>
          <p className="mt-3 font-display text-3xl font-semibold">{gear.items.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Articles vendus</p>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Par article · {periodLabel}</h2>
          {gear.items.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {formatMoney(gear.amount, settings.currency)} · {pieceCount(gear.count)}
            </p>
          ) : null}
        </div>
        {gear.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune tenue vendue sur cette période.</p>
        ) : (
          <SaleBars items={gear.items} currency={settings.currency} noun="pièce" />
        )}
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Six derniers mois</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">Montant des tenues vendues, pack compris au prix du pack.</p>
        <SimpleBarChart
          data={gear.months.map((month) => ({ label: month.label, value: month.amount }))}
          seriesLabel="Tenues"
          allowDecimals
          currency={settings.currency}
        />
      </section>
      <EquipmentEditor
        currency={settings.currency}
        activities={catalog.activities.map((activity) => ({ id: activity.id, name: activity.name }))}
        packs={catalog.packs.map((pack) => ({
          id: pack.id,
          name: pack.name,
          activityId: pack.activityId,
          price: pack.price,
        }))}
        items={catalog.items.map((item) => ({
          id: item.id,
          name: item.name,
          packId: item.packId,
          price: item.price,
          activityId: item.activityId,
        }))}
      />
    </div>
  );
}

function pieceLabel(count: number) {
  if (count === 0) return "Aucune pièce vendue";
  return count > 1 ? `${count} pièces vendues` : "1 pièce vendue";
}

function pieceCount(count: number) {
  return count > 1 ? `${count} pièces` : "1 pièce";
}
