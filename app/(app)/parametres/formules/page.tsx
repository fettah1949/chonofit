import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PlanManager } from "@/components/settings/plan-manager";

export const metadata: Metadata = { title: "Formules" };

export default async function PlansPage() {
  const [settings, plans] = await Promise.all([
    getSettings(),
    prisma.subscriptionPlan.findMany({ orderBy: { price: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Formules d'abonnement" description="Mensuel, trimestriel, annuel ou illimité." />
      <SettingsNav />
      <PlanManager plans={plans} currency={settings.currency} />
    </div>
  );
}
