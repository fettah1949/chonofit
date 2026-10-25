"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/parametres", label: "Salle" },
  { href: "/parametres/formules", label: "Formules" },
  { href: "/parametres/utilisateurs", label: "Utilisateurs" },
  { href: "/parametres/whatsapp", label: "WhatsApp" },
  { href: "/parametres/groupes", label: "Groupes" },
  { href: "/parametres/tenues", label: "Tenues" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
