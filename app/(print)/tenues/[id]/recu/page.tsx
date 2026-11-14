import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { requireUser } from "@/lib/session";
import { ChronoLogo } from "@/components/brand/chrono-logo";
import { PrintButton } from "@/components/payments/print-button";
import { formatDateTime, formatMoney } from "@/lib/format";
import { METHOD_LABELS, type PaymentMethod } from "@/lib/constants";

export const metadata: Metadata = { title: "Reçu tenue" };

export default async function GearReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [sale, settings] = await Promise.all([
    prisma.equipmentSale.findUnique({
      where: { id },
      include: { item: { include: { pack: true } } },
    }),
    getSettings(),
  ]);
  if (!sale) notFound();

  const total = formatMoney(sale.unitPrice * sale.quantity, settings.currency);
  const line = sale.quantity > 1 ? `${sale.item.name} × ${sale.quantity}` : sale.item.name;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <PrintButton />
        <Link href="/boutique" className="inline-flex h-11 items-center rounded-xl border bg-card px-4 text-sm">
          Retour
        </Link>
      </div>
      <article className="rounded-2xl border bg-white p-8 text-[#141414] shadow-sm print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b pb-5">
          <div>
            {settings.logoPath ? (
              <img src={settings.logoPath} alt="" className="mb-3 h-14 w-14 rounded-xl object-cover" />
            ) : (
              <ChronoLogo tone="dark" size="sm" className="mb-4" />
            )}
            <h1 className="font-display text-2xl font-semibold">{settings.name}</h1>
            {settings.address ? <p className="text-sm">{settings.address}</p> : null}
            {settings.phone ? <p className="text-sm">{settings.phone}</p> : null}
            {settings.email ? <p className="text-sm">{settings.email}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Reçu tenue</p>
            <p className="font-display text-xl font-semibold">{sale.receiptNumber}</p>
            <p className="text-sm">{formatDateTime(sale.soldAt)}</p>
          </div>
        </header>
        <section className="grid gap-4 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Vente</p>
            <p className="mt-1 font-medium">Comptoir</p>
            <p className="text-sm">Sans inscription</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Article</p>
            <p className="mt-1 font-medium">{line}</p>
            <p className="text-sm">{sale.item.pack.name}</p>
            <p className="text-sm">{formatMoney(sale.unitPrice, settings.currency)} l'unité</p>
            <p className="text-sm">{METHOD_LABELS[sale.method as PaymentMethod] ?? sale.method}</p>
          </div>
        </section>
        <section className="rounded-xl bg-neutral-50 px-4 py-5">
          <div className="flex items-center justify-between">
            <span>Montant encaissé</span>
            <strong className="font-display text-3xl">{total}</strong>
          </div>
        </section>
        <p className="mt-10 text-sm text-neutral-500">Merci de votre confiance.</p>
      </article>
    </main>
  );
}
