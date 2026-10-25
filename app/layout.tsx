import type { Metadata } from "next";
import { Barlow_Condensed, Figtree } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
});

const heading = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: {
    default: "Chrono Fitness",
    template: "%s · Chrono Fitness",
  },
  description: "Gestion des adhérents, abonnements, paiements et présences d'une salle de sport.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${body.variable} ${heading.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
