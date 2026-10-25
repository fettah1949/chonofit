import Link from "next/link";
import type { Metadata } from "next";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { memberTextMatches } from "@/lib/member-match";
import { currentSubscription, memberDisplayStatus } from "@/lib/status";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { InsuranceExportLinks } from "@/components/members/insurance-export-links";
import { MemberAvatar } from "@/components/members/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysRemaining, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { cn, withQuery } from "@/lib/utils";

export const metadata: Metadata = { title: "Adhérents" };

const filters = [
  { value: "", label: "Tous" },
  { value: "ACTIVE", label: "Actifs" },
  { value: "EXPIRED", label: "Expirés" },
  { value: "SUSPENDED", label: "Suspendus" },
];

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statut = params.statut ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 12;

  const members = await prisma.member.findMany({
    include: {
      subscriptions: {
        orderBy: { startDate: "desc" },
        take: 4,
        include: { plan: true },
      },
      activities: { include: { activity: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const matched = members
    .filter((member) => memberTextMatches(member, q, { email: false }))
    .map((member) => ({
      ...member,
      displayStatus: memberDisplayStatus(member),
      current: currentSubscription(member.subscriptions),
    }));
  const decorated = matched.filter((member) => !statut || member.displayStatus === statut);

  const pageCount = Math.max(1, Math.ceil(decorated.length / pageSize));
  const items = decorated.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adhérents"
        description={`${decorated.length} fiche${decorated.length > 1 ? "s" : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            {user.role === "ADMIN" ? (
              <>
                <InsuranceExportLinks />
                <Button asChild variant="outline">
                  <Link href="/adherents/assurance">Importer l'assurance</Link>
                </Button>
              </>
            ) : null}
            <Button asChild>
              <Link href="/adherents/nouveau">Nouvel adhérent</Link>
            </Button>
          </div>
        }
      />
      <form className="flex gap-2" method="get">
        {statut ? <input type="hidden" name="statut" value={statut} /> : null}
        <Input name="q" defaultValue={q} placeholder="Nom ou téléphone" className="h-10" />
        <Button type="submit" variant="outline">
          Rechercher
        </Button>
        {q ? (
          <Button asChild variant="ghost">
            <Link href={withQuery("/adherents", { statut })}>Effacer</Link>
          </Button>
        ) : null}
      </form>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const count = filter.value ? matched.filter((member) => member.displayStatus === filter.value).length : matched.length;
          const pressed = statut === filter.value;
          return (
            <Link
              key={filter.label}
              href={withQuery("/adherents", { q, statut: filter.value })}
              aria-current={pressed ? "page" : undefined}
              className={cn("h-10 rounded-xl border px-3 text-sm font-medium leading-10", pressed ? "border-primary bg-accent" : "bg-card")}
            >
              {filter.label} {count}
            </Link>
          );
        })}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Aucun adhérent" description="Modifiez la recherche ou créez une nouvelle fiche." />
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {items.map((member) => {
            const activities = member.activities.map((row) => row.activity.name).join(", ");
            const end = member.current?.endDate ?? null;
            const daysLeft = end ? differenceInCalendarDays(end, startOfDay(new Date())) : null;
            const soon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
            return (
              <Link key={member.id} href={`/adherents/${member.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/70">
                <MemberAvatar
                  firstName={member.firstName}
                  lastName={member.lastName}
                  photoPath={member.photoPath}
                  className="h-11 w-11 shrink-0 rounded-full text-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">
                      {member.firstName} {member.lastName}
                    </p>
                    <StatusBadge status={member.displayStatus} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {member.phone}
                    {activities ? ` · ${activities}` : ""}
                  </p>
                  <p className={cn("truncate text-sm sm:hidden", soon ? "text-amber-800" : "text-muted-foreground")}>
                    {member.current
                      ? `${member.current.plan.name} · ${end ? formatDate(end) : "Illimité"} · ${daysRemaining(end)}`
                      : "Aucun abonnement"}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right text-sm sm:block">
                  <p className="font-medium">{member.current?.plan.name ?? "Aucun abonnement"}</p>
                  <p className={cn(soon ? "text-amber-800" : "text-muted-foreground")}>
                    {member.current ? (end ? `${formatDate(end)} · ${daysRemaining(end)}` : "Illimité") : "—"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} path="/adherents" params={{ q, statut }} />
    </div>
  );
}
