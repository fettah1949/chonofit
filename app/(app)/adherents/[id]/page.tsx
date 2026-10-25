import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { memberDisplayStatus } from "@/lib/status";
import { MemberActions } from "@/components/members/member-actions";
import { ContinuePayment } from "@/components/payments/continue-payment";
import { MemberAvatar } from "@/components/members/member-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ageInYears, ageRangeLabel, formatAge } from "@/lib/age";
import { daysRemaining, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { formatDays } from "@/lib/discipline";
import { cn } from "@/lib/utils";
import { INSURANCE_PRICE, METHOD_LABELS, seesMoney, type PaymentMethod } from "@/lib/constants";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Fiche adhérent" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const money = seesMoney(user.role);
  const { id } = await params;
  const [member, settings] = await Promise.all([
    prisma.member.findUnique({
      where: { id },
      include: {
        subscriptions: { orderBy: { startDate: "desc" }, include: { plan: true } },
        payments: { orderBy: { paidAt: "desc" }, include: { subscription: { include: { plan: true } } } },
        checkIns: { orderBy: { checkedInAt: "desc" }, take: 12 },
        activities: { include: { activity: true } },
        groups: { include: { group: { include: { activity: true } } } },
        equipmentPurchases: { include: { item: true }, orderBy: { purchasedAt: "desc" } },
      },
    }),
    getSettings(),
  ]);
  if (!member) notFound();

  const status = memberDisplayStatus(member);
  const current = member.subscriptions.find((subscription) => subscription.status === "ACTIVE") ?? member.subscriptions[0];
  const duePayments = member.payments.filter((payment) => payment.remainder > 0);
  const latestDue = duePayments[0];
  const activityNames = member.activities.map((row) => row.activity.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        description={member.phone2 ? `${member.phone} · ${member.phone2}` : member.phone}
        action={
          <MemberActions
            id={member.id}
            suspended={member.status === "SUSPENDED"}
            settleHref={latestDue ? `/paiements?adherent=${member.id}&recu=${latestDue.id}` : undefined}
            canDelete={user.role === "ADMIN"}
          />
        }
      />
      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center text-center">
            <MemberAvatar
              firstName={member.firstName}
              lastName={member.lastName}
              photoPath={member.photoPath}
              className="h-40 w-40 rounded-3xl text-4xl"
            />
            <div className="mt-4">
              <StatusBadge status={status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Téléphone" value={member.phone} />
            <Info label="Téléphone 2" value={member.phone2 || "—"} />
            <Info label="Nom du parent" value={member.guardianName || "—"} />
            <Info label="Lien de parenté" value={member.guardianRelation || "—"} />
            <Info
              label="Naissance"
              value={
                member.birthDate
                  ? `${formatDate(member.birthDate)} · ${formatAge(ageInYears(member.birthDate))}`
                  : "—"
              }
            />
            <Info label="Sexe" value={member.sex === "M" ? "Garçon" : member.sex === "F" ? "Fille" : "—"} />
            <Info label="Inscrit le" value={formatDate(member.createdAt)} />
            <div className="sm:col-span-2">
              <Info label="Notes" value={member.notes || "Aucune note"} />
            </div>
            {current ? (
              <div className="rounded-xl bg-accent p-4 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Abonnement en cours</p>
                <p className="font-display text-xl font-semibold">{current.plan.name}</p>
                <p className="text-sm">
                  {formatDate(current.startDate)} → {current.endDate ? formatDate(current.endDate) : "Illimité"} · {daysRemaining(current.endDate)}
                </p>
              </div>
            ) : null}
            {duePayments.map((payment) => (
              <div key={payment.id} className="sm:col-span-2">
                <ContinuePayment
                  paymentId={payment.id}
                  memberId={member.id}
                  receiptNumber={payment.receiptNumber}
                  collected={payment.amount}
                  remainder={payment.remainder}
                  currency={settings.currency}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Activités et groupes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{activityNames.length > 0 ? activityNames.join(" · ") : "Aucune activité"}</p>
            {member.groups.length === 0 ? (
              <p className="text-muted-foreground">Aucun groupe.</p>
            ) : (
              member.groups.map((row) => (
                <p key={row.groupId}>
                  <span className="font-medium">{row.group.name}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {[formatDays(row.group.days), ageRangeLabel(row.group.ageMin, row.group.ageMax)].filter(Boolean).join(" · ")}
                  </span>
                </p>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assurance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Chez nous</p>
              <p className={cn("font-medium", member.hasInsurance && "text-emerald-800")}>{member.hasInsurance ? "Payé" : "Pas payé"}</p>
              {member.hasInsurance ? (
                <p className="text-muted-foreground">
                  {formatDate(member.insuranceStart)} → {formatDate(member.insuranceEnd)}
                  {money ? ` · ${formatMoney(INSURANCE_PRICE, settings.currency)}` : ""}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-muted-foreground">Chez l'assurance</p>
              <p className={cn("font-medium", member.insuranceConfirmed && "text-emerald-800")}>
                {member.insuranceConfirmed ? "Payé" : "Pas confirmé"}
              </p>
              {member.insuranceConfirmed && member.insuranceConfirmedStart && member.insuranceConfirmedEnd ? (
                <p className="text-muted-foreground">
                  {formatDate(member.insuranceConfirmedStart)} → {formatDate(member.insuranceConfirmedEnd)}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tenues achetées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {member.equipmentPurchases.length === 0 ? (
              <p className="text-muted-foreground">Aucun article.</p>
            ) : (
              member.equipmentPurchases.map((purchase) => (
                <p key={purchase.id} className="flex items-center justify-between gap-3">
                  <span>{purchase.item.name}</span>
                  <span className="text-muted-foreground">
                    {money ? `${formatMoney(purchase.unitPrice, settings.currency)} · ` : ""}
                    {formatDate(purchase.purchasedAt)}
                  </span>
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        <HistoryCard title="Abonnements">
          {member.subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun abonnement. <Link className="text-primary underline" href={`/abonnements?adherent=${member.id}`}>En attribuer un</Link>
            </p>
          ) : (
            member.subscriptions.map((subscription) => (
              <article key={subscription.id} className="border-b py-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{subscription.plan.name}</p>
                  <StatusBadge status={subscription.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(subscription.startDate)} → {subscription.endDate ? formatDate(subscription.endDate) : "Illimité"}
                  {money ? ` · ${formatMoney(subscription.price, settings.currency)}` : ""}
                </p>
              </article>
            ))
          )}
        </HistoryCard>
        <HistoryCard title="Paiements">
          {member.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun paiement.</p>
          ) : (
            member.payments.map((payment) => (
              <article key={payment.id} className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
                <div>
                  {money ? <p className="font-medium">{formatMoney(payment.amount, settings.currency)}</p> : null}
                  {money && payment.remainder > 0 ? <p className="text-xs font-medium text-amber-800">Reste {formatMoney(payment.remainder, settings.currency)}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(payment.paidAt)} · {METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}
                  </p>
                </div>
                <span className="flex shrink-0 gap-3">
                  {payment.remainder > 0 ? (
                    <a className="text-sm font-medium text-amber-800 underline" href={`#completer-${payment.id}`}>
                      Compléter
                    </a>
                  ) : null}
                  <Link className="text-sm text-primary underline" href={`/paiements/${payment.id}/recu`}>
                    Reçu
                  </Link>
                </span>
              </article>
            ))
          )}
        </HistoryCard>
        <HistoryCard title="Présences récentes">
          {member.checkIns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune entrée enregistrée.</p>
          ) : (
            member.checkIns.map((checkIn) => (
              <p key={checkIn.id} className="border-b py-2 text-sm last:border-0">
                {formatDateTime(checkIn.checkedInAt)}
              </p>
            ))
          )}
        </HistoryCard>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function HistoryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
