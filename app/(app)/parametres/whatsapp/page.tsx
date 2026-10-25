import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { WhatsAppPanel } from "@/components/settings/whatsapp-panel";
import { getSettings } from "@/lib/maintenance";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppSettingsPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        description="Le reçu part en image depuis le numéro de la salle. Les relances automatiques restent coupées tant que cette page ne les active pas."
      />
      <SettingsNav />
      <WhatsAppPanel autoReminders={settings.autoReminders} />
    </div>
  );
}
