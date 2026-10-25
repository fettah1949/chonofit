import Link from "next/link";
import type { Metadata } from "next";
import { format, isToday, startOfDay, startOfMonth, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { createPayment, findPaymentMember } from "@/actions/payments";
import { searchMemberIds } from "@/lib/search";
import { PaymentForm } from "@/components/payments/payment-form";
import { PaymentActions } from "@/components/payments/payment-actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { MemberAvatar } from "@/components/members/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney, toInputDate } from "@/lib/format";
import { METHOD_LABELS, seesMoney, type PaymentMethod } from "@/lib/constants";
import { requireUser } from "@/lib/session";
import { cn, withQuery } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiements" };

const periods = [
  { value: "jour", label: "Aujourd'hui" },
  { value: "7", label: "7 jours" },
  { value: "mois", label: "Ce mois" },
  { value: "", label: "Tous" },
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; periode?: string; adherent?: string; recu?: string; page?: string }>;
}) {
  const user = await requireUser();
  const money = seesMoney(user.role);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const periode = periods.some((item) => item.value === params.periode) ? (params.periode ?? "") : "";
  const page = Math.max(1, Number(params.page) || 1);
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(subDays(now, 6));
  const monthStart = startOfMonth(now);

  const memberIds = q ? await searchMemberIds(q, { email: false }) : null;
  const memberWhere = memberIds ? { memberId: { in: memberIds } } : {};
  const [settings, initialMember] = await Promise.all([
    getSettings(),
    findPaymentMember(params.adherent, params.recu),
  ]);
  const periodStart = periode === "jour" ? todayStart : periode === "7" ? weekStart : periode === "mois" ? monthStart : null;
  const where = {
    ...memberWhere,
    ...(periodStart ? { paidAt: { gte: periodStart } } : {}),
  };

  const [total, payments, todayCount, weekCount, monthCount, allCount] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: { member: true, subscription: { include: { plan: true } } },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
    }),
    prisma.payment.count({ where: { ...memberWhere, paidAt: { gte: todayStart } } }),
    prisma.payment.count({ where: { ...memberWhere, paidAt: { gte: weekStart } } }),
    prisma.payment.count({ where: { ...memberWhere, paidAt: { gte: monthStart } } }),
    prisma.payment.count({ where: memberWhere }),
  ]);

  const counts: Record<string, number> = {
    jour: todayCount,
    "7": weekCount,
    mois: monthCount,
    "": allCount,
  };

  const groups: { key: string; label: string; items: typeof payments }[] = [];
  for (const payment of payments) {
    const key = toInputDate(payment.paidAt);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({
        key,
        label: isToday(payment.paidAt) ? "Aujourd'hui" : formatDate(payment.paidAt),
        items: [payment],
      });
    } else {
      last.items.push(payment);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Paiements"
        description={`${total} encaissement${total > 1 ? "s" : ""}`}
      />
      <PaymentForm
        action={createPayment}
        currency={settings.currency}
        initial={initialMember}
        defaultPaymentId={params.recu}
      />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Historique</h2>
        <form className="flex gap-2" method="get">
          {periode ? <input type="hidden" name="periode" value={periode} /> : null}
          <Input name="q" defaultValue={q} placeholder="Nom ou téléphone" className="h-10" />
          <Button type="submit" variant="outline">
            Rechercher
          </Button>
          {q ? (
            <Button asChild variant="ghost">
              <Link href={withQuery("/paiements", { periode })}>Effacer</Link>
            </Button>
          ) : null}
        </form>
        <div className="flex flex-wrap gap-2">
          {periods.map((filter) => {
            const pressed = periode === filter.value;
            return (
              <Link
                key={filter.label}
                href={withQuery("/paiements", { q, periode: filter.value })}
                aria-current={pressed ? "page" : undefined}
                className={cn(
                  "h-10 rounded-xl border px-3 text-sm font-medium leading-10",
                  pressed ? "border-primary bg-accent" : "bg-card",
                )}
              >
                {filter.label} {counts[filter.value]}
              </Link>
            );
          })}
        </div>
        {payments.length === 0 ? (
          <EmptyState title="Aucun paiement" description="Les encaissements de la période s'afficheront ici." />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="border-t bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground first:border-t-0">
                  {group.label}
                </p>
                <div className="divide-y">
                  {group.items.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Link href={`/adherents/${payment.memberId}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <MemberAvatar
                          firstName={payment.member.firstName}
                          lastName={payment.member.lastName}
                          photoPath={payment.member.photoPath}
                          className="h-11 w-11 shrink-0 rounded-full text-sm"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {payment.member.firstName} {payment.member.lastName}
                          </span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {payment.subscription?.plan.name ?? "—"} · {METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}
                          </span>
                        </span>
                      </Link>
                      <div className="shrink-0 text-right">
                        {money ? (
                          <p className="font-medium tabular-nums">{formatMoney(payment.amount, settings.currency)}</p>
                        ) : null}
                        {money && payment.remainder > 0 ? (
                          <p className="text-xs text-amber-800">Reste {formatMoney(payment.remainder, settings.currency)}</p>
                        ) : null}
                        <p className="text-sm tabular-nums text-muted-foreground">{format(payment.paidAt, "HH:mm")}</p>
                      </div>
                      <PaymentActions
                        id={payment.id}
                        canDelete={user.role === "ADMIN"}
                        settleHref={
                          payment.remainder > 0
                            ? `/paiements?adherent=${payment.memberId}&recu=${payment.id}`
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / 20))} path="/paiements" params={{ q, periode }} />
    </div>
  );
}
