"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { logout } from "@/actions/auth";
import { ChronoLogo } from "@/components/brand/chrono-logo";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

const links: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/adherents", label: "Adhérents", icon: Users },
  { href: "/abonnements", label: "Abonnements", icon: CreditCard },
  { href: "/paiements", label: "Paiements", icon: Wallet },
  { href: "/pointage", label: "Pointage", icon: ClipboardCheck },
];

export function AppShell({
  gymName,
  logoPath,
  user,
  children,
}: {
  gymName: string;
  logoPath?: string | null;
  user: { name?: string | null; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const groupes: (typeof links)[number] = { href: "/groupes", label: "Groupes", icon: UsersRound };
  const settings: (typeof links)[number] = { href: "/parametres", label: "Paramètres", icon: Settings };
  const items =
    user.role === "COACH" ? [groupes] : user.role === "ADMIN" ? [...links, groupes, settings] : [...links, groupes];

  return (
    <div className="min-h-screen">
      {open ? <button className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Fermer le menu" /> : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start gap-2 px-4 pb-5 pt-6">
          <div className="min-w-0 flex-1">
            {logoPath ? (
              <img src={logoPath} alt={gymName} className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <ChronoLogo size="nav" />
            )}
            {logoPath ? <p className="mt-2 truncate font-display text-lg font-semibold">{gymName}</p> : null}
          </div>
          <button className="rounded-lg p-1 lg:hidden" onClick={() => setOpen(false)} aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white",
                  active && "bg-white text-[#111111] hover:bg-white hover:text-[#111111]",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-white/55">{ROLE_LABELS[user.role]}</p>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur lg:px-8">
          <button className="rounded-xl border bg-card p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <ChronoLogo tone="dark" size="sm" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
