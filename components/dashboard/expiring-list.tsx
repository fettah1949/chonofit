import Link from "next/link";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { MemberAvatar } from "@/components/members/member-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RenewalReminderButton } from "@/components/dashboard/renewal-reminder-button";
import { daysRemaining, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type ExpiringSubscription = {
  id: string;
  memberId: string;
  endDate: Date | null;
  price: number;
  plan: { name: string };
  member: {
    firstName: string;
    lastName: string;
    phone: string;
    photoPath: string | null;
    status?: string;
  };
  reminder?: { status: string; error: string; createdAt: Date } | null;
};

function daysUntil(endDate: Date | null) {
  if (!endDate) return 99;
  return differenceInCalendarDays(endDate, startOfDay(new Date()));
}

function urgencyClass(days: number) {
  if (days < 0 || days <= 1) return "border-l-red-600";
  if (days <= 3) return "border-l-amber-500";
  return "border-l-neutral-300";
}

export function ExpiringList({
  subscriptions,
  currency,
  selectedMemberId,
  embedded = false,
  showPrice = true,
}: {
  subscriptions: ExpiringSubscription[];
  currency: string;
  selectedMemberId?: string;
  embedded?: boolean;
  showPrice?: boolean;
}) {
  const ranked = [...subscriptions].sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
  const lapsed = ranked.filter((item) => daysUntil(item.endDate) < 0);
  const upcoming = ranked.filter((item) => daysUntil(item.endDate) >= 0);
  const todayCount = upcoming.filter((item) => daysUntil(item.endDate) === 0).length;
  const sentCount = ranked.filter((item) => item.reminder?.status === "SENT").length;
  const groups = (
    <div className="space-y-5">
      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun abonnement ne se termine dans les 7 prochains jours, et personne n'a expiré depuis 30 jours sans suite.
        </p>
      ) : (
        <>
          <RenewalGroup
            title="À relancer maintenant"
            tone="urgent"
            items={upcoming.filter((item) => daysUntil(item.endDate) <= 1)}
            currency={currency}
            showPrice={showPrice}
            selectedMemberId={selectedMemberId}
          />
          <RenewalGroup
            title="Dans la semaine"
            items={upcoming.filter((item) => daysUntil(item.endDate) > 1)}
            currency={currency}
            showPrice={showPrice}
            selectedMemberId={selectedMemberId}
          />
          <RenewalGroup
            title="Expirés sans renouvellement"
            items={lapsed}
            currency={currency}
            showPrice={showPrice}
            selectedMemberId={selectedMemberId}
          />
        </>
      )}
    </div>
  );

  if (embedded) return groups;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Abonnements qui arrivent à échéance</CardTitle>
          <CardDescription>
            {upcoming.length} dans les 7 jours
            {todayCount > 0 ? `, dont ${todayCount} aujourd'hui` : ""}
            {sentCount > 0 ? ` · ${sentCount} relancé${sentCount > 1 ? "s" : ""}` : ""}
            {lapsed.length > 0 ? ` · ${lapsed.length} expiré${lapsed.length > 1 ? "s" : ""} sans suite` : ""}
          </CardDescription>
        </div>
        <Link href="/abonnements?filtre=expirant" className="shrink-0 text-sm font-medium text-primary hover:underline">
          Voir tout
        </Link>
      </CardHeader>
      <CardContent>{groups}</CardContent>
    </Card>
  );
}

function RenewalGroup({
  title,
  tone,
  items,
  currency,
  showPrice,
  selectedMemberId,
}: {
  title: string;
  tone?: "urgent";
  items: ExpiringSubscription[];
  currency: string;
  showPrice: boolean;
  selectedMemberId?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className={cn("text-xs font-medium uppercase tracking-wide", tone === "urgent" ? "text-red-800" : "text-muted-foreground")}>
        {title}
      </p>
      {items.map((subscription) => (
        <RenewalRow
          key={subscription.id}
          subscription={subscription}
          currency={currency}
          showPrice={showPrice}
          selected={subscription.memberId === selectedMemberId}
        />
      ))}
    </div>
  );
}

function RenewalRow({
  subscription,
  currency,
  showPrice,
  selected,
}: {
  subscription: ExpiringSubscription;
  currency: string;
  showPrice: boolean;
  selected: boolean;
}) {
  const days = daysUntil(subscription.endDate);
  const endLabel = formatDate(subscription.endDate);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-l-4 bg-card px-3 py-3 sm:flex-row sm:items-center",
        urgencyClass(days),
        selected && "bg-accent",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href={`/adherents/${subscription.memberId}`} className="shrink-0">
          <MemberAvatar
            firstName={subscription.member.firstName}
            lastName={subscription.member.lastName}
            photoPath={subscription.member.photoPath}
            className="h-11 w-11 rounded-lg text-sm"
          />
        </Link>
        <div className="min-w-0">
          <Link href={`/adherents/${subscription.memberId}`} className="block truncate font-medium hover:underline">
            {subscription.member.firstName} {subscription.member.lastName}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {subscription.plan.name}
            {showPrice ? ` · ${formatMoney(subscription.price, currency)}` : ""}
            {subscription.member.status === "SUSPENDED" ? " · Suspendu" : ""}
          </p>
          <a href={`tel:${subscription.member.phone.replace(/[^\d+]/g, "")}`} className="text-xs text-muted-foreground hover:underline">
            {subscription.member.phone}
          </a>
          {subscription.reminder?.status === "FAILED" ? (
            <p className="text-xs text-red-800">{reminderError(subscription.reminder.error)}</p>
          ) : null}
        </div>
      </div>
      <div className="sm:w-40">
        <p className={cn("text-sm font-medium", days <= 1 ? "text-red-700" : days <= 3 ? "text-amber-800" : "text-muted-foreground")}>
          {daysRemaining(subscription.endDate)}
        </p>
        <p className="text-xs text-muted-foreground">{endLabel}</p>
        {subscription.reminder?.status === "SENT" ? (
          <p className="text-xs text-emerald-800">Relancé {formatDateTime(subscription.reminder.createdAt)}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <RenewalReminderButton subscriptionId={subscription.id} sent={subscription.reminder?.status === "SENT"} />
        <Button asChild className="h-10 flex-1 sm:flex-none">
          <Link href={`/abonnements?filtre=expirant&adherent=${subscription.memberId}#attribution`}>Renouveler</Link>
        </Button>
      </div>
    </article>
  );
}

function reminderError(code: string) {
  if (code === "NO_WHATSAPP") return "Numéro absent de WhatsApp";
  if (code === "PHONE") return "Numéro invalide";
  return "La relance n'est pas partie";
}
