"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { createCheckIn, searchMembersForCheckin } from "@/actions/checkins";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { daysRemaining } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CheckinMember = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  photoPath: string | null;
  status: string;
  planName: string;
  endDate: string | null;
  checkedInAt: string | null;
};

export type CheckinSession = {
  id: string;
  name: string;
  daysLabel: string;
  today: boolean;
  memberIds: string[];
};

function MemberRow({
  member,
  pending,
  onAsk,
}: {
  member: CheckinMember;
  pending: boolean;
  onAsk: (member: CheckinMember) => void;
}) {
  return (
    <article className="flex items-center gap-3 px-3 py-2.5">
      <MemberAvatar
        firstName={member.firstName}
        lastName={member.lastName}
        photoPath={member.photoPath}
        className="h-12 w-12 shrink-0 rounded-full text-sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">
            {member.firstName} {member.lastName}
          </p>
          {member.status !== "ACTIVE" ? <StatusBadge status={member.status} /> : null}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {member.phone}
          {member.phone2 ? ` · ${member.phone2}` : ""} · {member.planName} · {daysRemaining(member.endDate)}
        </p>
      </div>
      {member.checkedInAt ? (
        <p className="shrink-0 text-sm font-medium text-emerald-800">Présent {format(new Date(member.checkedInAt), "HH:mm")}</p>
      ) : (
        <Button className="h-12 shrink-0 px-5" disabled={pending} onClick={() => onAsk(member)}>
          {pending ? "Pointage…" : "Pointer"}
        </Button>
      )}
    </article>
  );
}

export function CheckinPanel({ members, sessions }: { members: CheckinMember[]; sessions: CheckinSession[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<CheckinMember[]>([]);
  const [searching, startSearch] = useTransition();
  const [presentAt, setPresentAt] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmMember, setConfirmMember] = useState<CheckinMember | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);

  const results = found.map((member) => ({ ...member, checkedInAt: presentAt[member.id] ?? member.checkedInAt }));

  function search(value: string) {
    setQuery(value);
    const seq = ++searchSeq.current;
    if (value.trim().length < 2) {
      setFound([]);
      return;
    }
    startSearch(async () => {
      const rows = await searchMembersForCheckin(value);
      if (searchSeq.current === seq) setFound(rows);
    });
  }

  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const todaySessions = sessions.filter((session) => session.today);
  const otherSessions = sessions.filter((session) => !session.today);
  const chipSessions = todaySessions.length === 0 ? sessions : otherSessions;
  const extraSession = chipSessions.find((session) => session.id === extraId) ?? null;

  function stamp(member: CheckinMember) {
    return { ...member, checkedInAt: presentAt[member.id] ?? member.checkedInAt };
  }

  function roster(session: CheckinSession) {
    return session.memberIds
      .map((id) => byId.get(id))
      .filter((member): member is CheckinMember => Boolean(member))
      .map(stamp)
      .sort(
        (a, b) => a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr"),
      );
  }

  async function checkIn(member: CheckinMember) {
    if (member.checkedInAt || pendingId) return;
    setPendingId(member.id);
    const result = await createCheckIn(member.id);
    setPendingId(null);
    setConfirmMember(null);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    const at = new Date().toISOString();
    setPresentAt((current) => ({ ...current, [member.id]: at }));
    toast.success(result?.success ?? "Entrée enregistrée.");
    setQuery("");
    inputRef.current?.focus();
    router.refresh();
  }

  function ask(member: CheckinMember) {
    if (member.checkedInAt) return;
    if (member.status === "ACTIVE") void checkIn(member);
    else setConfirmMember(member);
  }

  function sessionCard(session: CheckinSession) {
    const people = roster(session);
    const present = people.filter((member) => member.checkedInAt).length;
    return (
      <section key={session.id} className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b px-3 py-2">
          <div>
            <h2 className="font-medium">{session.name}</h2>
            <p className="text-xs text-muted-foreground">{session.daysLabel}</p>
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            {present} présent{present > 1 ? "s" : ""}
          </p>
        </div>
        {people.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Aucune personne dans ce groupe.</p>
        ) : (
          <div className="divide-y">
            {people.map((member) => (
              <MemberRow key={member.id} member={member} pending={pendingId === member.id} onAsk={ask} />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(event) => search(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || results.length !== 1 || pendingId) return;
            event.preventDefault();
            ask(results[0]);
          }}
          placeholder="Nom ou téléphone"
          className="h-14 pl-12 text-base"
        />
      </div>
      {searching ? <p className="text-sm text-muted-foreground">Recherche…</p> : null}
      {!searching && query.trim().length >= 2 && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun adhérent.</p>
      ) : null}
      <div className="space-y-2">
        {results.map((member) => (
          <div key={member.id} className="overflow-hidden rounded-2xl border bg-card">
            <MemberRow member={member} pending={pendingId === member.id} onAsk={ask} />
          </div>
        ))}
      </div>
      <section className="space-y-3">
        {todaySessions.length === 0 ? <p className="text-sm text-muted-foreground">Aucun cours aujourd'hui.</p> : todaySessions.map(sessionCard)}
        {chipSessions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {chipSessions.map((session) => {
              const people = roster(session);
              const present = people.filter((member) => member.checkedInAt).length;
              const pressed = extraId === session.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setExtraId(pressed ? null : session.id)}
                  className={cn("h-10 rounded-xl border px-3 text-sm font-medium", pressed ? "border-primary bg-accent" : "bg-card")}
                >
                  {session.name} {present}/{people.length}
                </button>
              );
            })}
          </div>
        ) : null}
        {extraSession ? sessionCard(extraSession) : null}
      </section>
      <Dialog open={Boolean(confirmMember)} onOpenChange={(open) => !open && setConfirmMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonnement non actif</DialogTitle>
            <DialogDescription>
              {confirmMember
                ? `${confirmMember.firstName} ${confirmMember.lastName} est ${confirmMember.status === "SUSPENDED" ? "suspendu" : "expiré"}. Enregistrer l'entrée quand même ?`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMember(null)}>
              Annuler
            </Button>
            <Button onClick={() => confirmMember && void checkIn(confirmMember)}>Enregistrer quand même</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
