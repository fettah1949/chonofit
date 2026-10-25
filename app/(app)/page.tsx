import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Users, CalendarClock, Wallet, ClipboardCheck, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { ExpiringList } from "@/components/dashboard/expiring-list";
import { MemberAvatar } from "@/components/members/member-avatar";
import { getSettings } from "@/lib/maintenance";
import { MonthStats } from "@/components/dashboard/stat-period-form";
import { getChosenMonthStats, getDashboardData, getGearStats, STAT_MONTHS, statMonth } from "@/lib/stats";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { isPaymentMethod, METHOD_LABELS, seesMoney } from "@/lib/constants";
import { withQuery } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sujet?: string; mois?: string; annee?: string }>;
}) {
  const user = await requireUser();
  const settings = await getSettings();
  const money = seesMoney(user.role);
  const params = await searchParams;
  const sujet = params.sujet === "tenues" ? "tenues" : "abonnements";
  const chosen = statMonth(params.mois, params.annee);
  const data = await getDashboardData(settings.currency);
  const firstName = user.name?.split(" ")[0] ?? "bonjour";
  const showCash = money || user.role === "RECEPTIONIST";

  const [gear, monthStats] = await Promise.all([
    money ? getGearStats() : Promise.resolve(null),
    money ? getChosenMonthStats(chosen.start, chosen.end) : Promise.resolve(null),
  ]);
  const extraPassages = data.visitors.reduce((sum, visit) => sum + visit.count, 0) - data.visitors.length;

  const stats = [
    {
      label: "Expirent sous 7 jours",
      value: String(data.expiringCount),
      hint: data.expiringHint,
      href: "/abonnements?filtre=expirant",
      icon: CalendarClock,
    },
    {
      label: "Adhérents actifs",
      value: String(data.activeMembers),
      hint: "Abonnement en cours",
      href: "/adherents?statut=ACTIVE",
      icon: Users,
    },
    {
      label: "Entrées aujourd'hui",
      value: String(data.visitors.length),
      hint: "Personnes passées",
      href: "/pointage",
      icon: ClipboardCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${firstName}`}
        description={`Voici l'activité de ${settings.name}.`}
        action={
          <Link href="/pointage" className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
            Pointer une entrée
          </Link>
        }
      />
      <section className="space-y-4">
        {showCash ? (
          <CashCard
            currency={settings.currency}
            today={data.today}
            aside={
              money ? (
                <div className="sm:max-w-sm sm:text-right">
                  <p className="text-sm text-muted-foreground">
                    {data.monthLabel} · {formatMoney(data.monthRevenue, settings.currency)}
                  </p>
                  {duplicateSummary(data.duplicateReceipts, settings.currency) ? (
                    <p className="mt-1 text-xs text-amber-800">{duplicateSummary(data.duplicateReceipts, settings.currency)}</p>
                  ) : null}
                </div>
              ) : null
            }
          />
        ) : null}
        {money && gear ? (
          <Link href={withQuery("/", { sujet: "tenues", mois: chosen.month, annee: chosen.year }) + "#statistiques"} className="block rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5">
            <p className="text-sm text-muted-foreground">Tenues · {data.monthLabel}</p>
            <p className="mt-3 font-display text-3xl font-semibold">{formatMoney(gear.monthAmount, settings.currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pieceLabel(gear.monthCount)}
              {gear.todayCount > 0 ? ` · aujourd'hui ${formatMoney(gear.todayAmount, settings.currency)}` : ""}
            </p>
          </Link>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <span className="rounded-xl bg-accent p-2 text-accent-foreground">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </Link>
          );
        })}
        </div>
      </section>
      {money && monthStats ? (
        <section id="statistiques" className="rounded-2xl border bg-card p-5">
          <MonthStats
            sujet={sujet}
            month={chosen.month}
            year={chosen.year}
            label={chosen.label}
            years={monthStats.years}
            months={STAT_MONTHS}
            currency={settings.currency}
            subscriptions={monthStats.subscriptions}
            gear={monthStats.gear}
          />
        </section>
      ) : null}
      {data.advances.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-lg font-semibold text-amber-950">Avances à compléter</h2>
          <p className="mt-1 text-sm text-amber-900">Une partie est encaissée. Le reste de la formule est encore dû.</p>
          <ul className="mt-4 space-y-2">
            {data.advances.map((payment) => (
              <li key={payment.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-card px-3 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MemberAvatar
                    firstName={payment.firstName}
                    lastName={payment.lastName}
                    photoPath={payment.photoPath}
                    className="h-11 w-11 rounded-lg text-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {payment.firstName} {payment.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {payment.planName ? `${payment.planName} · ` : ""}
                      avance {formatMoney(payment.amount, settings.currency)} · {payment.receiptNumber}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-medium text-amber-950">Reste {formatMoney(payment.remainder, settings.currency)}</p>
                <Button asChild variant="outline" size="sm" className="sm:w-auto">
                  <Link href={`/paiements?adherent=${payment.memberId}&recu=${payment.id}`}>Compléter</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.blockedMembers.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-lg font-semibold text-amber-950">Payés, accès bloqué</h2>
          <p className="mt-1 text-sm text-amber-900">La formule court encore. Le pointage demandera une confirmation.</p>
          <ul className="mt-4 space-y-2">
            {data.blockedMembers.map((member) => (
              <li key={member.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-card px-3 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MemberAvatar
                    firstName={member.firstName}
                    lastName={member.lastName}
                    photoPath={member.photoPath}
                    className="h-11 w-11 rounded-lg text-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.planName}
                      {member.endDate ? ` · jusqu'au ${formatDate(member.endDate)}` : " · sans échéance"}
                      {" · accès bloqué"}
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="sm:w-auto">
                  <Link href={`/adherents/${member.id}`}>Fiche</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ExpiringList subscriptions={data.expiring} currency={settings.currency} showPrice={money} />
      <Card>
        <CardHeader>
          <CardTitle>Entrées du jour</CardTitle>
          {extraPassages > 0 ? <CardDescription>Un second passage reste sur la même personne.</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {data.visitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Personne n'est encore passé aujourd'hui.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {data.visitors.map((visit) => (
                <Link
                  key={visit.memberId}
                  href={`/adherents/${visit.memberId}`}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm hover:bg-accent"
                >
                  <MemberAvatar
                    firstName={visit.firstName}
                    lastName={visit.lastName}
                    photoPath={visit.photoPath}
                    className="h-10 w-10 rounded-lg text-xs"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {visit.firstName} {visit.lastName}
                  </span>
                  <span className="text-right text-muted-foreground">
                    <span className="block">{format(visit.firstAt, "HH:mm")}</span>
                    {visit.count > 1 ? (
                      <span className="block text-xs">
                        {visit.count}e passage à {format(visit.lastAt, "HH:mm")}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <details className="group rounded-2xl border bg-card shadow-sm">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-5 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            Six derniers mois
            <span className="mt-1 block font-sans text-sm font-normal text-muted-foreground">
              {money ? "Nouveaux adhérents et revenus" : "Nouveaux adhérents"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className={money ? "grid gap-6 px-5 pb-5 lg:grid-cols-2" : "px-5 pb-5"}>
          <div>
            <h3 className="mb-3 font-display text-base font-semibold">Nouveaux adhérents</h3>
            <SimpleBarChart data={data.months.map((month) => ({ label: month.label, value: month.members }))} seriesLabel="Adhérents" />
          </div>
          {money ? (
            <div>
              <h3 className="mb-3 font-display text-base font-semibold">Revenus</h3>
              <SimpleBarChart
                data={data.months.map((month) => ({ label: month.label, value: month.revenue }))}
                seriesLabel="Revenus"
                allowDecimals
                currency={settings.currency}
              />
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function CashCard({
  currency,
  today,
  aside,
}: {
  currency: string;
  today: { cash: number; cashCount: number; receiptCount: number; others: { method: string; amount: number }[] };
  aside?: ReactNode;
}) {
  return (
    <Link href="/paiements?periode=jour" className="block rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-accent p-2 text-accent-foreground">
              <Wallet className="h-4 w-4" />
            </span>
            <p className="text-sm text-muted-foreground">Caisse du jour</p>
          </div>
          <p className="mt-3 font-display text-4xl font-semibold">{formatMoney(today.cash, currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{cashHint(today.cashCount, today.receiptCount)}</p>
          {today.others.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {today.others
                .map((item) => `${isPaymentMethod(item.method) ? METHOD_LABELS[item.method] : item.method} ${formatMoney(item.amount, currency)}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        {aside}
      </div>
    </Link>
  );
}

function pieceLabel(count: number) {
  if (count === 0) return "Aucune pièce vendue";
  return count > 1 ? `${count} pièces vendues` : "1 pièce vendue";
}

function cashHint(cashCount: number, receiptCount: number) {
  if (receiptCount === 0) return "Aucun reçu aujourd'hui";
  if (cashCount === receiptCount) return cashCount === 1 ? "1 reçu en espèces" : `${cashCount} reçus en espèces`;
  if (cashCount === 0) return receiptCount === 1 ? "1 reçu, rien en espèces" : `${receiptCount} reçus, rien en espèces`;
  return cashCount === 1 ? "1 reçu en espèces" : `${cashCount} reçus en espèces`;
}

function de(name: string) {
  return /^[aeiouyàâäéèêëîïôöùûüœ]/i.test(name.trim()) ? `d'${name}` : `de ${name}`;
}

function duplicateSummary(
  items: { firstName: string; lastName: string; amount: number; extraCount: number }[],
  currency: string,
) {
  if (items.length === 0) return "";
  const total = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const money = formatMoney(total, currency);
  const doubled = items.every((item) => item.extraCount === 1);
  const label = (item: (typeof items)[number]) =>
    items.filter((other) => other.firstName === item.firstName).length > 1
      ? `${item.firstName} ${item.lastName}`
      : item.firstName;
  if (items.length === 1) {
    const name = label(items[0]);
    return doubled
      ? `${money} encaissés deux fois sur la période ${de(name)}`
      : `${money} encaissés en plus sur la période ${de(name)}`;
  }
  const names = [...items].sort((a, b) => a.firstName.localeCompare(b.firstName, "fr")).map((item) => label(item));
  const list = names.length === 2 ? names.join(" et ") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
  return doubled ? `${money} encaissés deux fois : ${list}` : `${money} encaissés en plus : ${list}`;
}
