"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createTrainingGroup, deleteTrainingGroup, updateTrainingGroup } from "@/actions/catalog";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WEEK_DAYS, type SessionClock } from "@/lib/discipline";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/hooks/use-action-toast";

type TrainingGroupCard = {
  id: string;
  name: string;
  activityId: string;
  activityName: string;
  memberCount: number;
  days: number[];
  times: Record<number, SessionClock>;
  ageMin: number | null;
  ageMax: number | null;
};

export function GroupEditor({
  groups,
  activities,
}: {
  groups: TrainingGroupCard[];
  activities: { id: string; name: string }[];
}) {
  const [activityFilter, setActivityFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const visible = activityFilter === "all" ? groups : groups.filter((group) => group.activityId === activityFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip pressed={activityFilter === "all"} onClick={() => setActivityFilter("all")}>
            Tout
          </Chip>
          {activities.map((activity) => (
            <Chip key={activity.id} pressed={activityFilter === activity.id} onClick={() => setActivityFilter(activity.id)}>
              {activity.name}
            </Chip>
          ))}
        </div>
        <Chip pressed={adding} onClick={() => setAdding((open) => !open)}>
          {adding ? "Fermer" : "Ajouter un groupe"}
        </Chip>
      </div>
      {adding ? (
        <AddGroupForm
          key={activityFilter}
          activities={activities}
          lockedActivityId={activityFilter === "all" ? null : activityFilter}
        />
      ) : null}
      {visible.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-6 text-sm text-muted-foreground">Aucun groupe pour cette activité.</p>
      ) : (
        activities
          .map((activity) => ({
            ...activity,
            groups: visible.filter((group) => group.activityId === activity.id),
          }))
          .filter((section) => section.groups.length > 0)
          .map((section) => (
            <section key={section.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2 className="font-display text-lg font-semibold">{section.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {section.groups.length > 1 ? `${section.groups.length} groupes` : "1 groupe"}
                </p>
              </div>
              <div className="divide-y">
                {section.groups.map((group) => (
                  <GroupForm key={group.id} group={group} />
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}

function AddGroupForm({
  activities,
  lockedActivityId,
}: {
  activities: { id: string; name: string }[];
  lockedActivityId: string | null;
}) {
  const [state, action] = useActionState(createTrainingGroup, null);
  useActionToast(state);
  const [activityId, setActivityId] = useState(lockedActivityId ?? activities[0]?.id ?? "");
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [times, setTimes] = useState<Record<number, SessionClock>>({});
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");

  useEffect(() => {
    if (!state?.success) return;
    setName("");
    setDays([]);
    setTimes({});
    setAgeMin("");
    setAgeMax("");
  }, [state]);

  if (activities.length === 0) return null;

  return (
    <form action={action} className="space-y-3 rounded-2xl border bg-card p-4">
      <input type="hidden" name="activityId" value={activityId} />
      {lockedActivityId ? null : (
        <div className="flex flex-wrap gap-2">
          {activities.map((activity) => (
            <Chip key={activity.id} pressed={activityId === activity.id} onClick={() => setActivityId(activity.id)}>
              {activity.name}
            </Chip>
          ))}
        </div>
      )}
      <Input name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Karaté 3" aria-label="Nom du groupe" className="h-10" required />
      <DayPicker days={days} onToggle={(day) => setDays((current) => toggleDay(current, day))} />
      <p className="text-sm text-muted-foreground">{daySummary(days) || "Choisissez au moins un jour."}</p>
      <SessionFields days={days} times={times} onChange={(day, field, value) => setTimes((current) => setClock(current, day, field, value))} />
      <AgeRangeFields ageMin={ageMin} ageMax={ageMax} onMin={setAgeMin} onMax={setAgeMax} />
      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
    </form>
  );
}

function GroupForm({ group }: { group: TrainingGroupCard }) {
  const [state, action] = useActionState(updateTrainingGroup, null);
  useActionToast(state);
  const [name, setName] = useState(group.name);
  const [days, setDays] = useState(group.days);
  const [times, setTimes] = useState(group.times);
  const [ageMin, setAgeMin] = useState(ageText(group.ageMin));
  const [ageMax, setAgeMax] = useState(ageText(group.ageMax));
  const dirty =
    name.trim() !== group.name ||
    !sameDays(days, group.days) ||
    timeSignature(days, times) !== timeSignature(group.days, group.times) ||
    ageMin !== ageText(group.ageMin) ||
    ageMax !== ageText(group.ageMax);

  useEffect(() => {
    setName(group.name);
    setDays(group.days);
    setTimes(group.times);
    setAgeMin(ageText(group.ageMin));
    setAgeMax(ageText(group.ageMax));
  }, [group.name, group.days, group.times, group.ageMin, group.ageMax]);

  return (
    <form action={action} className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={group.id} />
      <Input
        name="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Nom du groupe"
        className="h-9 w-full min-w-32 flex-1 basis-32 border-transparent bg-secondary/60 sm:max-w-40 sm:flex-none"
        required
      />
      <DayPicker days={days} onToggle={(day) => setDays((current) => toggleDay(current, day))} />
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{peopleLabel(group.memberCount)}</span>
      {days.length === 0 ? <span className="text-sm text-red-800">Aucun jour</span> : null}
      <SaveButton dirty={dirty} />
      <ConfirmButton
        variant="ghost"
        size="sm"
        title={`Supprimer ${group.name} ?`}
        description={
          group.memberCount > 0
            ? `${group.memberCount > 1 ? `${group.memberCount} adhérents ne seront plus inscrits` : "1 adhérent ne sera plus inscrit"} à ce groupe.`
            : "Ce groupe sera retiré de la liste."
        }
        confirmLabel="Supprimer"
        action={() => deleteTrainingGroup(group.id)}
      >
        <span className="text-red-700">Supprimer</span>
      </ConfirmButton>
      </div>
      <SessionFields days={days} times={times} onChange={(day, field, value) => setTimes((current) => setClock(current, day, field, value))} />
      <AgeRangeFields ageMin={ageMin} ageMax={ageMax} onMin={setAgeMin} onMax={setAgeMax} />
      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
    </form>
  );
}

function AgeRangeFields({
  ageMin,
  ageMax,
  onMin,
  onMax,
}: {
  ageMin: string;
  ageMax: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}) {
  const missing = !ageMin.trim() || !ageMax.trim();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Tranche d'âge</span>
      <Input
        name="ageMin"
        inputMode="numeric"
        value={ageMin}
        onChange={(event) => onMin(event.target.value)}
        aria-label="Âge minimum"
        placeholder="De"
        className="h-9 w-16 px-2 text-center"
        required
      />
      <span className="text-sm text-muted-foreground">à</span>
      <Input
        name="ageMax"
        inputMode="numeric"
        value={ageMax}
        onChange={(event) => onMax(event.target.value)}
        aria-label="Âge maximum"
        placeholder="À"
        className="h-9 w-16 px-2 text-center"
        required
      />
      <span className="text-sm text-muted-foreground">ans</span>
      {missing ? <span className="text-sm text-amber-800">À renseigner</span> : null}
    </div>
  );
}

function SessionFields({
  days,
  times,
  onChange,
}: {
  days: number[];
  times: Record<number, SessionClock>;
  onChange: (day: number, field: "start" | "end", value: string) => void;
}) {
  const selected = WEEK_DAYS.filter((day) => days.includes(day.value));
  if (selected.length === 0) return null;
  const missing = selected.some((day) => !times[day.value]?.start || !times[day.value]?.end);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Séances</p>
      {selected.map((day) => {
        const clock = times[day.value] ?? { start: "", end: "" };
        return (
          <div key={day.value} className="flex flex-wrap items-center gap-2">
            <span className="w-8 text-sm">{day.label.slice(0, 3)}</span>
            <span className="text-sm text-muted-foreground">Début</span>
            <Input
              type="time"
              name={`start-${day.value}`}
              value={clock.start}
              onChange={(event) => onChange(day.value, "start", event.target.value)}
              aria-label={`Début le ${day.label}`}
              className="h-9 w-[7.2rem] px-2"
              required
            />
            <span className="text-sm text-muted-foreground">Fin</span>
            <Input
              type="time"
              name={`end-${day.value}`}
              value={clock.end}
              onChange={(event) => onChange(day.value, "end", event.target.value)}
              aria-label={`Fin le ${day.label}`}
              className="h-9 w-[7.2rem] px-2"
              required
            />
          </div>
        );
      })}
      {missing ? <p className="text-sm text-amber-800">À renseigner</p> : null}
    </div>
  );
}

function DayPicker({ days, onToggle }: { days: number[]; onToggle: (day: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEK_DAYS.map((day) => {
        const checked = days.includes(day.value);
        return (
          <label
            key={day.value}
            className={cn(
              "grid h-9 min-w-9 cursor-pointer place-items-center rounded-lg border px-1.5 text-xs font-medium",
              checked ? "border-primary bg-accent" : "bg-card",
            )}
          >
            <input
              type="checkbox"
              name="day"
              value={day.value}
              checked={checked}
              onChange={() => onToggle(day.value)}
              aria-label={day.label}
              className="sr-only"
            />
            {day.label.slice(0, 3)}
          </label>
        );
      })}
    </div>
  );
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  if (!dirty && !pending) return null;
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Enregistrer"}
    </Button>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("h-10 rounded-xl border px-3 text-sm font-medium", pressed ? "border-primary bg-accent" : "bg-card")}
    >
      {children}
    </button>
  );
}

function toggleDay(days: number[], day: number) {
  return days.includes(day) ? days.filter((value) => value !== day) : [...days, day];
}

function sameDays(left: number[], right: number[]) {
  const sorted = (days: number[]) => [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).join(",");
  return sorted(left) === sorted(right);
}

function setClock(times: Record<number, SessionClock>, day: number, field: "start" | "end", value: string) {
  const current = times[day] ?? { start: "", end: "" };
  return { ...times, [day]: { ...current, [field]: value } };
}

function timeSignature(days: number[], times: Record<number, SessionClock>) {
  return [...days]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((day) => `${day}=${times[day]?.start ?? ""}-${times[day]?.end ?? ""}`)
    .join(",");
}

function ageText(age: number | null) {
  return age == null ? "" : String(age);
}

function peopleLabel(count: number) {
  return count > 1 ? `${count} personnes` : `${count} personne`;
}

function daySummary(days: number[]) {
  return WEEK_DAYS.filter((day) => days.includes(day.value))
    .map((day) => day.label)
    .join(" · ");
}
