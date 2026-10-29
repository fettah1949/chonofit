"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { createCheckIn } from "@/actions/checkins";
import { assignMemberToGroup, removeMemberFromGroup, searchMembersForAssignment } from "@/actions/groups";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { inactiveAccessSentence } from "@/lib/constants";
import { missedLastSessions } from "@/lib/coach-roster";
import { toInputDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  photoPath: string | null;
  status: string;
  sexLabel: string;
  ageLabel: string;
  insuranceLabel: string;
  checkedInAt: string;
  checkDates: string[];
  visits: string[];
};

type GroupCard = {
  id: string;
  name: string;
  activityId: string;
  days: number[];
  daysLabel: string;
  members: Person[];
};

type Match = Person & { groupIds: string[] };

function byName(a: Person, b: Person) {
  return a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr");
}

function peopleLabel(count: number) {
  return count > 1 ? `${count} personnes` : `${count} personne`;
}

function countWord(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`;
}

function profileLine(member: Person) {
  return [member.sexLabel, member.ageLabel].filter(Boolean).join(" · ");
}

function clockNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function PresentControl({ member, pending, onPresent }: { member: Person; pending: boolean; onPresent: () => void }) {
  if (member.checkedInAt) {
    return <span className="shrink-0 text-xs font-medium text-emerald-800">Présent {member.checkedInAt}</span>;
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onPresent}
      className="h-8 shrink-0 rounded-lg border bg-card px-2.5 text-xs font-medium disabled:opacity-60"
    >
      Présent
    </button>
  );
}

function uniqueCount(list: GroupCard[]) {
  return new Set(list.flatMap((group) => group.members.map((member) => member.id))).size;
}

export function GroupAssigner({
  weekday,
  today,
  activities,
  groups,
}: {
  weekday: number;
  today: string;
  activities: { id: string; name: string }[];
  groups: GroupCard[];
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [searching, startSearch] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmMember, setConfirmMember] = useState<Person | null>(null);
  const [roster, setRoster] = useState(groups);
  const hasToday = groups.some((group) => group.days.includes(weekday));
  const [filter, setFilter] = useState(hasToday ? "today" : "all");

  useEffect(() => {
    setRoster(groups);
  }, [groups]);

  const visible = (
    filter === "all" ? roster : filter === "today" ? roster.filter((group) => group.days.includes(weekday)) : roster.filter((group) => group.activityId === filter)
  )
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const rank = (group: GroupCard) => (group.days.includes(weekday) ? 0 : 2) + (group.members.length === 0 ? 1 : 0);
      return rank(a.group) - rank(b.group) || a.index - b.index;
    })
    .map((row) => row.group);

  const filters = [
    { id: "today", label: "Aujourd'hui", count: uniqueCount(roster.filter((group) => group.days.includes(weekday))) },
    { id: "all", label: "Tous", count: uniqueCount(roster) },
    ...activities.map((activity) => ({
      id: activity.id,
      label: activity.name,
      count: uniqueCount(roster.filter((group) => group.activityId === activity.id)),
    })),
  ];

  function search(value: string) {
    setQuery(value);
    const seq = ++searchSeq.current;
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const found = await searchMembersForAssignment(value);
      if (searchSeq.current === seq) setResults(found);
    });
  }

  function openMember(member: Person) {
    searchSeq.current += 1;
    const groupIds = roster.filter((group) => group.members.some((row) => row.id === member.id)).map((group) => group.id);
    setQuery("");
    setResults([{ ...member, groupIds }]);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: "start" }));
  }

  function closeMember() {
    searchSeq.current += 1;
    setQuery("");
    setResults([]);
  }

  function move(member: Person, groupId: string, add: boolean) {
    setRoster((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;
        const exists = group.members.some((row) => row.id === member.id);
        if (add === exists) return group;
        const members = add ? [...group.members, member].sort(byName) : group.members.filter((row) => row.id !== member.id);
        return { ...group, members };
      }),
    );
  }

  async function toggle(member: Match, group: GroupCard) {
    const key = `${member.id}:${group.id}`;
    const on = member.groupIds.includes(group.id);
    setPendingKey(key);
    setResults((current) =>
      current.map((item) =>
        item.id === member.id
          ? { ...item, groupIds: on ? item.groupIds.filter((id) => id !== group.id) : [...item.groupIds, group.id] }
          : item,
      ),
    );
    move(member, group.id, !on);
    const result = on ? await removeMemberFromGroup(member.id, group.id) : await assignMemberToGroup(member.id, group.id);
    setPendingKey(null);
    if (result?.error) {
      toast.error(result.error);
      setResults((current) =>
        current.map((item) =>
          item.id === member.id
            ? { ...item, groupIds: on ? [...item.groupIds, group.id] : item.groupIds.filter((id) => id !== group.id) }
            : item,
        ),
      );
      move(member, group.id, on);
      return;
    }
    router.refresh();
  }

  function stampPresent(memberId: string, time: string) {
    const day = toInputDate(new Date());
    const apply = <T extends Person>(member: T): T =>
      member.id === memberId
        ? { ...member, checkedInAt: time, checkDates: member.checkDates.includes(day) ? member.checkDates : [day, ...member.checkDates] }
        : member;
    setRoster((current) => current.map((group) => ({ ...group, members: group.members.map(apply) })));
    setResults((current) => current.map(apply));
  }

  async function savePresent(member: Person) {
    setConfirmMember(null);
    setPendingKey(`in:${member.id}`);
    const result = await createCheckIn(member.id);
    setPendingKey(null);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    stampPresent(member.id, clockNow());
    router.refresh();
  }

  function markPresent(member: Person) {
    if (member.checkedInAt) return;
    if (member.status !== "ACTIVE") {
      setConfirmMember(member);
      return;
    }
    void savePresent(member);
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Nom ou téléphone"
          className="h-14 pl-12 text-base"
        />
      </div>
      {searching ? <p className="text-sm text-muted-foreground">Recherche…</p> : null}
      {!searching && query.trim().length >= 2 && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun adhérent.</p>
      ) : null}
      {!searching && results.length > 0 ? (
        <div ref={panelRef} className="scroll-mt-20 space-y-3">
          {results.map((member) => (
            <article key={member.id} className="rounded-2xl border bg-card p-3">
              <div className="flex items-center gap-3">
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
                    <StatusBadge status={member.status} />
                  </div>
                  {member.phone ? <p className="truncate text-sm text-muted-foreground">{member.phone}</p> : null}
                  {profileLine(member) ? <p className="truncate text-sm text-muted-foreground">{profileLine(member)}</p> : null}
                  {member.insuranceLabel ? <p className="truncate text-sm text-muted-foreground">{member.insuranceLabel}</p> : null}
                  {member.visits.length > 0 || member.insuranceLabel ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {member.visits.length > 0 ? `Passages : ${member.visits.join(", ")}` : "Aucun passage récent."}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button type="button" onClick={closeMember} aria-label="Fermer" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
                    <X className="h-5 w-5" />
                  </button>
                  <PresentControl member={member} pending={pendingKey === `in:${member.id}`} onPresent={() => markPresent(member)} />
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {activities.map((activity) => {
                  const choices = roster.filter((group) => group.activityId === activity.id);
                  if (choices.length === 0) return null;
                  return (
                    <div key={activity.id}>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{activity.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {choices.map((group) => {
                          const on = member.groupIds.includes(group.id);
                          const pending = pendingKey === `${member.id}:${group.id}`;
                          return (
                            <button
                              key={group.id}
                              type="button"
                              aria-pressed={on}
                              disabled={pending}
                              onClick={() => void toggle(member, group)}
                              className={cn(
                                "rounded-xl border px-3 py-2 text-left disabled:opacity-60",
                                on ? "border-primary bg-accent" : "bg-card",
                              )}
                            >
                              <span className="block text-sm font-medium">{group.name}</span>
                              <span className="block text-xs text-muted-foreground">{group.daysLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "h-10 rounded-xl border px-3 text-sm font-medium tabular-nums",
              filter === item.id ? "border-primary bg-accent" : "bg-card",
            )}
          >
            {item.label} {item.count}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-6 text-sm text-muted-foreground">
          {filter === "today" ? "Aucun cours aujourd'hui." : "Aucun groupe."}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((group) => (
            <section key={group.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <h2 className="font-medium">
                    {group.name}
                    {filter !== "today" && group.days.includes(weekday) ? (
                      <span className="ml-2 text-xs font-medium text-primary">Aujourd'hui</span>
                    ) : null}
                  </h2>
                  <p className="text-sm text-muted-foreground">{group.daysLabel}</p>
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  <p>{peopleLabel(group.members.length)}</p>
                  {group.members.filter((member) => member.checkedInAt).length > 0 ? (
                    <p className="text-xs text-emerald-800">
                      {countWord(group.members.filter((member) => member.checkedInAt).length, "présent", "présents")}
                    </p>
                  ) : null}
                  {group.members.filter((member) => !member.checkedInAt && missedLastSessions(group.days, member.checkDates, today)).length > 0 ? (
                    <p className="text-xs text-amber-800">
                      {countWord(
                        group.members.filter((member) => !member.checkedInAt && missedLastSessions(group.days, member.checkDates, today)).length,
                        "absent",
                        "absents",
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
              {group.members.length > 0 ? (
                <div className="divide-y border-t">
                  {group.members.map((member) => {
                    const absent = !member.checkedInAt && missedLastSessions(group.days, member.checkDates, today);
                    return (
                      <div key={member.id} className="flex items-center gap-2 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openMember(member)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left hover:bg-secondary/70"
                        >
                          <MemberAvatar
                            firstName={member.firstName}
                            lastName={member.lastName}
                            photoPath={member.photoPath}
                            className="h-9 w-9 shrink-0 rounded-full text-xs"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate font-medium">
                                {member.firstName} {member.lastName}
                              </span>
                              {member.status !== "ACTIVE" ? <StatusBadge status={member.status} /> : null}
                              {absent ? <span className="shrink-0 text-xs font-medium text-amber-800">Absent</span> : null}
                            </span>
                            <span className="block truncate text-sm text-muted-foreground">{member.phone}</span>
                          </span>
                        </button>
                        <PresentControl member={member} pending={pendingKey === `in:${member.id}`} onPresent={() => markPresent(member)} />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
      <Dialog open={Boolean(confirmMember)} onOpenChange={(open) => !open && setConfirmMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonnement non actif</DialogTitle>
            <DialogDescription>
              {confirmMember
                ? `${inactiveAccessSentence(`${confirmMember.firstName} ${confirmMember.lastName}`, confirmMember.status)} Enregistrer la présence quand même ?`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMember(null)}>
              Annuler
            </Button>
            <Button onClick={() => confirmMember && void savePresent(confirmMember)}>Enregistrer quand même</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
