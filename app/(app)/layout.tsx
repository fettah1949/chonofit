import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSettings, refreshExpiredSubscriptions } from "@/lib/maintenance";
import { requireUser } from "@/lib/session";
import type { Role } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/compte/mot-de-passe");
  await refreshExpiredSubscriptions();
  const settings = await getSettings();

  return (
    <AppShell
      gymName={settings.name}
      logoPath={settings.logoPath}
      user={{ name: user.name, role: user.role as Role }}
    >
      {children}
    </AppShell>
  );
}
