import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { requireUser } from "@/lib/session";
import { ChronoLogo } from "@/components/brand/chrono-logo";
import { MemberAvatar } from "@/components/members/member-avatar";
import { PrintButton } from "@/components/payments/print-button";
import { WhatsAppReceiptButton } from "@/components/payments/whatsapp-receipt-button";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { initials } from "@/lib/utils";
import { whatsAppPhone } from "@/lib/whatsapp";
import { METHOD_LABELS, type PaymentMethod } from "@/lib/constants";

export const metadata: Metadata = { title: "Reçu" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [payment, settings] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: { member: true, subscription: { include: { plan: true } } },
    }),
    getSettings(),
  ]);
  if (!payment) notFound();

  const amount = formatMoney(payment.amount, settings.currency);
  const endDate = payment.subscription?.endDate ? formatDate(payment.subscription.endDate) : null;
  const whatsApp = whatsAppPhone(payment.member.phone);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <PrintButton />
        {whatsApp ? (
          <WhatsAppReceiptButton
            paymentId={payment.id}
            receipt={{
              address: settings.address,
              gymPhone: settings.phone,
              receiptNumber: payment.receiptNumber,
              paidAt: formatDateTime(payment.paidAt),
              memberName: `${payment.member.firstName} ${payment.member.lastName}`,
              memberPhone: payment.member.phone,
              photoUrl: payment.member.photoPath,
              initials: initials(payment.member.firstName, payment.member.lastName),
              planName: payment.subscription?.plan.name ?? "Paiement",
              method: METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method,
              amount,
              endDate,
              note: [payment.note, payment.remainder > 0 ? `Reste : ${formatMoney(payment.remainder, settings.currency)}` : ""].filter(Boolean).join(" · "),
            }}
          />
        ) : null}
        <Link href="/paiements" className="inline-flex h-11 items-center rounded-xl border bg-card px-4 text-sm">
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
            <p className="text-xs uppercase tracking-wide text-neutral-500">Reçu</p>
            <p className="font-display text-xl font-semibold">{payment.receiptNumber}</p>
            <p className="text-sm">{formatDateTime(payment.paidAt)}</p>
          </div>
        </header>
        <section className="grid gap-4 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Adhérent</p>
            <div className="mt-2 flex items-center gap-3">
              <MemberAvatar
                firstName={payment.member.firstName}
                lastName={payment.member.lastName}
                photoPath={payment.member.photoPath}
                className="h-28 w-16 shrink-0 rounded-xl bg-neutral-100 object-contain text-lg"
              />
              <div>
                <p className="font-medium">
                  {payment.member.firstName} {payment.member.lastName}
                </p>
                <p className="text-sm">{payment.member.phone}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Abonnement</p>
            <p className="mt-1 font-medium">{payment.subscription?.plan.name ?? "—"}</p>
            <p className="text-sm">{METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}</p>
          </div>
        </section>
        <section className="rounded-xl bg-neutral-50 px-4 py-5">
          <div className="flex items-center justify-between">
            <span>{payment.remainder > 0 ? "Avance encaissée" : "Montant encaissé"}</span>
            <strong className="font-display text-3xl">{amount}</strong>
          </div>
          {payment.remainder > 0 ? (
            <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
              <span>Reste à payer</span>
              <strong className="font-display text-2xl">{formatMoney(payment.remainder, settings.currency)}</strong>
            </div>
          ) : null}
        </section>
        {payment.note ? <p className="mt-4 text-sm">Note : {payment.note}</p> : null}
        <p className="mt-10 text-sm text-neutral-500">Merci de votre confiance.</p>
      </article>
    </main>
  );
}

