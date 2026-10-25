import type { Metadata } from "next";
import { getSettings } from "@/lib/maintenance";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { GymForm } from "@/components/settings/gym-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" description="Identité de la salle, utilisée sur les reçus et dans le menu." />
      <SettingsNav />
      <GymForm settings={settings} />
    </div>
  );
}
