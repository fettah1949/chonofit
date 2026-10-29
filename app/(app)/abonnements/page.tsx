import type { Metadata } from "next";
import { differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { coverageByMember, listRenewals, pickLatest } from "@/lib/renewals";
import { createSubscription } from "@/actions/subscriptions";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import { SubscriptionActions } from "@/components/subscriptions/subscription-actions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { MemberAvatar } from "@/components/members/member-avatar";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { daysRemaining, formatDate, formatMoney, periodRemainingLabel } from "@/lib/format";
import { memberTextMatches } from "@/lib/member-match";
import { isSubscriptionCurrent, memberDisplayStatus } from "@/lib/status";
import { cn, withQuery } from "@/lib/utils";
import { seesMoney } from "@/lib/constants";
import { requireUser } from "@/lib/session";
import { ExpiringList } from "@/components/dashboard/expiring-list";

export const metadata: Metadata = { title: "Abonnements" };

const pageSize = 15;

function periodNote(status: string, startDate: Date, endDate: Date | null) {
  if (status === "ACTIVE" && startDate > endOfDay(new Date())) {
    return { text: periodRemainingLabel(startDate, endDate, status), tone: "muted" as const };
  }
  const closedEarly = status === "EXPIRED" && !!endDate && startOfDay(endDate) >= startOfDay(new Date());
  if (closedEarly) return { text: "Ne compte plus", tone: "muted" as const };
  if (status === "SUSPENDED") return { text: "Accès suspendu", tone: "warn" as const };
  const text = daysRemaining(endDate);
  if (status !== "ACTIVE" || !endDate) return { text, tone: "muted" as const };
  const days = differenceInCalendarDays(endDate, startOfDay(new Date()));
  if (days <= 1) return { text, tone: "urgent" as const };
  if (days <= 3) return { text, tone: "warn" as const };
  return { text, tone: "muted" as const };
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; filtre?: string; adherent?: string; vue?: string; page?: string }>;
}) {
  const user = await requireUser();
  const money = seesMoney(user.role);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statut = params.statut ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const renewing = params.filtre === "expirant";
  const historyView = !renewing && params.vue === "historique";

  const [settings, members, plans, coverageRows, dueSubscriptions, subscriptions] = await Promise.all([
    getSettings(),
    prisma.member.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true, phone2: true, status: true },
    }),
    prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
    }),
    prisma.subscription.findMany({
      select: {
        memberId: true,
        planId: true,
        status: true,
        startDate: true,
        endDate: true,
        plan: { select: { active: true, price: true } },
      },
    }),
    renewing ? listRenewals() : Promise.resolve([]),
    renewing
      ? Promise.resolve([])
      : prisma.subscription.findMany({
          include: { member: true, plan: true },
          orderBy: { startDate: "desc" },
        }),
  ]);

  const renewalRows = dueSubscriptions.filter((subscription) => memberTextMatches(subscription.member, q));
  const grouped = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const group = grouped.get(subscription.memberId) ?? [];
    group.push(subscription);
    grouped.set(subscription.memberId, group);
  }

  const currentRows = [...grouped.values()].flatMap((group) => {
    const open = group.find((subscription) => isSubscriptionCurrent(subscription));
    const suspended = group.find(
      (subscription) =>
        subscription.status === "SUSPENDED" &&
        (!subscription.endDate || startOfDay(subscription.endDate) >= startOfDay(new Date())),
    );
    const latest = open ?? suspended ?? pickLatest(group);
    if (!latest) return [];
    return [
      {
        ...latest,
        displayStatus: memberDisplayStatus({ status: latest.member.status, subscriptions: group }),
        olderCount: group.length - 1,
      },
    ];
  });

  const listed = (historyView ? subscriptions : currentRows).filter((subscription) => {
    if (q && !memberTextMatches(subscription.member, q)) return false;
    if (!statut) return true;
    if (historyView) return subscription.status === statut;
    return "displayStatus" in subscription && subscription.displayStatus === statut;
  });

  const today = startOfDay(new Date()).getTime();
  const ordered = [...listed].sort((a, b) => {
    if (historyView) {
      const name =
        a.member.lastName.localeCompare(b.member.lastName, "fr") ||
        a.member.firstName.localeCompare(b.member.firstName, "fr");
      if (name !== 0) return name;
      return b.startDate.getTime() - a.startDate.getTime();
    }
    const rank = (row: (typeof listed)[number]) => {
      const open = row.status === "ACTIVE" || row.status === "SUSPENDED";
      const end = row.endDate?.getTime();
      if (open && end === undefined) return [1, 0] as const;
      if (open && end !== undefined && end >= today) return [0, end] as const;
      return [2, -(end ?? 0)] as const;
    };
    const [groupA, valueA] = rank(a);
    const [groupB, valueB] = rank(b);
    if (groupA !== groupB) return groupA - groupB;
    if (valueA !== valueB) return valueA - valueB;
    return a.member.lastName.localeCompare(b.member.lastName, "fr");
  });

  const visibleSubscriptions = renewing ? renewalRows.slice((page - 1) * pageSize, page * pageSize) : ordered.slice((page - 1) * pageSize, page * pageSize);
  const visibleTotal = renewing ? renewalRows.length : ordered.length;
  const peopleLabel = `${visibleTotal} personne${visibleTotal > 1 ? "s" : ""}`;
  const historyLabel = `${visibleTotal} période${visibleTotal > 1 ? "s" : ""}`;

  const form = (
    <div id="attribution" className="scroll-mt-20">
      <SubscriptionForm
        key={params.adherent ?? "nouveau"}
        action={createSubscription}
        currency={settings.currency}
        defaultMemberId={params.adherent}
        coverageByMember={coverageByMember(coverageRows)}
        members={members}
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          durationDays: plan.durationDays,
          price: plan.price,
        }))}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={renewing ? "Échéances à relancer" : historyView ? "Historique des abonnements" : "Abonnements"}
        description={
          renewing
            ? "Relancez par WhatsApp, puis renouvellez. Une personne à la fois, avec sa formule en cours."
            : historyView
              ? "Les anciennes attributions. « Ne compte plus » veut dire que la date n'ouvre plus la salle."
              : `${peopleLabel}. Une ligne par adhérent : la période qui compte.`
        }
        action={
          renewing ? (
            <Button asChild variant="outline">
              <a href="/abonnements">Abonnements en cours</a>
            </Button>
          ) : (
            <Button asChild>
              <a href="#attribution">Attribuer</a>
            </Button>
          )
        }
      />
      {renewing ? null : (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant={historyView ? "outline" : "default"}>
            <a href={withQuery("/abonnements", { q, statut })}>En cours</a>
          </Button>
          <Button asChild size="sm" variant={historyView ? "default" : "outline"}>
            <a href={withQuery("/abonnements", { q, statut, vue: "historique" })}>Historique</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/abonnements?filtre=expirant">Échéances</a>
          </Button>
        </div>
      )}
      <form className={renewing ? "grid gap-3 md:grid-cols-[1fr_auto]" : "grid gap-3 md:grid-cols-[1fr_200px_auto]"} method="get">
        {renewing ? <input type="hidden" name="filtre" value="expirant" /> : null}
        {historyView ? <input type="hidden" name="vue" value="historique" /> : null}
        <Input name="q" defaultValue={q} placeholder="Nom ou téléphone" />
        {renewing ? null : (
          <select name="statut" defaultValue={statut} className={fieldClass}>
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            {historyView ? null : <option value="UPCOMING">À venir</option>}
            <option value="EXPIRED">Expiré</option>
            <option value="SUSPENDED">Suspendu</option>
          </select>
        )}
        <Button type="submit">Filtrer</Button>
      </form>
      {params.adherent ? form : null}
      {renewing ? (
        <ExpiringList
          embedded
          subscriptions={visibleSubscriptions}
          currency={settings.currency}
          showPrice={money}
          selectedMemberId={params.adherent}
        />
      ) : visibleSubscriptions.length === 0 ? (
        <EmptyState
          title={historyView ? "Aucune période" : "Aucun abonnement en cours"}
          description={historyView ? "Aucune attribution ne correspond à ce filtre." : "Les personnes avec une période ouverte apparaîtront ici."}
        />
      ) : (
        <div className="rounded-2xl border bg-card">
          {historyView ? <p className="border-b px-4 py-3 text-sm text-muted-foreground">{historyLabel}, regroupées par adhérent.</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adhérent</TableHead>
                <TableHead>Formule</TableHead>
                <TableHead>Période</TableHead>
                {money ? <TableHead>Prix</TableHead> : null}
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSubscriptions.map((subscription) => {
                const note = periodNote(subscription.status, subscription.startDate, subscription.endDate);
                const notStarted = subscription.status === "ACTIVE" && subscription.startDate > endOfDay(new Date());
                const days = subscription.endDate ? differenceInCalendarDays(subscription.endDate, startOfDay(new Date())) : null;
                const urgent = !historyView && !notStarted && subscription.status === "ACTIVE" && subscription.member.status !== "SUSPENDED" && days !== null && days <= 1;
                const soon = !historyView && !notStarted && subscription.status === "ACTIVE" && subscription.member.status !== "SUSPENDED" && days !== null && days > 1 && days <= 3;
                const olderCount = "olderCount" in subscription && typeof subscription.olderCount === "number" ? subscription.olderCount : 0;
                const badge =
                  !historyView && "displayStatus" in subscription && typeof subscription.displayStatus === "string"
                    ? subscription.displayStatus
                    : subscription.status;
                return (
                  <TableRow key={subscription.id} className={cn(urgent && "border-l-4 border-l-red-600", soon && "border-l-4 border-l-amber-500")}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          firstName={subscription.member.firstName}
                          lastName={subscription.member.lastName}
                          photoPath={subscription.member.photoPath}
                          className="h-10 w-10 shrink-0 rounded-full"
                        />
                        <div>
                          <a className="font-medium hover:underline" href={`/adherents/${subscription.memberId}`}>
                            {subscription.member.firstName} {subscription.member.lastName}
                          </a>
                          <p className="text-xs text-muted-foreground">{subscription.member.phone}</p>
                          {subscription.member.status === "SUSPENDED" ? (
                            <p className="text-xs text-amber-800">Fiche suspendue</p>
                          ) : olderCount > 0 ? (
                            <a
                              className="text-xs text-muted-foreground hover:underline"
                              href={withQuery("/abonnements", {
                                vue: "historique",
                                q: `${subscription.member.firstName} ${subscription.member.lastName}`,
                              })}
                            >
                              {olderCount} ancienne{olderCount > 1 ? "s" : ""}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{subscription.plan.name}</TableCell>
                    <TableCell>
                      {formatDate(subscription.startDate)} → {subscription.endDate ? formatDate(subscription.endDate) : "Illimité"}
                      <p
                        className={cn(
                          "text-xs",
                          note.tone === "urgent" && "font-medium text-red-700",
                          note.tone === "warn" && "font-medium text-amber-800",
                          note.tone === "muted" && "text-muted-foreground",
                        )}
                      >
                        {note.text}
                      </p>
                    </TableCell>
                    {money ? <TableCell>{formatMoney(subscription.price, settings.currency)}</TableCell> : null}
                    <TableCell>
                      <StatusBadge status={badge} />
                    </TableCell>
                    <TableCell>
                      <SubscriptionActions
                        id={subscription.id}
                        status={subscription.status}
                        memberId={subscription.memberId}
                        memberStatus={subscription.member.status}
                        renewHref={historyView ? undefined : `/abonnements?adherent=${subscription.memberId}#attribution`}
                        allowDelete={historyView && user.role === "ADMIN"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {params.adherent ? null : form}
      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(visibleTotal / pageSize))}
        path="/abonnements"
        params={{ q, statut, filtre: params.filtre, vue: historyView ? "historique" : undefined, adherent: params.adherent }}
      />
    </div>
  );
}
