"use client";

import { useActionState, useState } from "react";
import { deleteUser, saveUser } from "@/actions/settings";
import { Input, fieldClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

type GroupChoice = {
  id: string;
  name: string;
  activityName: string;
  daysLabel: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  groupIds: string[];
};

const blank = { id: "", name: "", email: "", role: "RECEPTIONIST" as Role, active: true, password: "", groupIds: [] as string[] };

export function UserManager({
  users,
  groups,
  currentUserId,
}: {
  users: UserRow[];
  groups: GroupChoice[];
  currentUserId: string;
}) {
  const [state, action] = useActionState(saveUser, null);
  const [form, setForm] = useState(blank);
  useActionToast(state);
  const names = new Map(groups.map((group) => [group.id, group.name]));
  const activities = [...new Set(groups.map((group) => group.activityName))];

  function toggleGroup(groupId: string) {
    setForm((current) => ({
      ...current,
      groupIds: current.groupIds.includes(groupId)
        ? current.groupIds.filter((id) => id !== groupId)
        : [...current.groupIds, groupId],
    }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</CardTitle>
          <CardDescription>
            {form.id ? "Laissez le mot de passe vide pour le conserver." : "8 caractères minimum."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-3">
            {form.id ? <input type="hidden" name="id" value={form.id} /> : null}
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <select
                id="role"
                name="role"
                className={fieldClass}
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              >
                <option value="ADMIN">Admin</option>
                <option value="RECEPTIONIST">Réceptionniste</option>
                <option value="COACH">Coach</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </div>
            {form.role === "COACH" ? (
              <div className="space-y-2">
                <Label>Groupes</Label>
                <p className="text-sm text-muted-foreground">Sans sélection, le coach voit tous les groupes.</p>
                {form.groupIds.map((id) => (
                  <input key={id} type="hidden" name="groupId" value={id} />
                ))}
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity}>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{activity}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {groups
                          .filter((group) => group.activityName === activity)
                          .map((group) => {
                            const on = form.groupIds.includes(group.id);
                            return (
                              <button
                                key={group.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleGroup(group.id)}
                                className={cn("rounded-xl border px-3 py-2 text-left", on ? "border-primary bg-accent" : "bg-card")}
                              >
                                <span className="block text-sm font-medium">{group.name}</span>
                                <span className="block text-xs text-muted-foreground">{group.daysLabel}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {form.id ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  className="h-4 w-4 accent-primary"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                Compte actif
              </label>
            ) : null}
            {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
            <div className="flex gap-2">
              <SubmitButton>{form.id ? "Mettre à jour" : "Créer"}</SubmitButton>
              {form.id ? (
                <Button type="button" variant="ghost" onClick={() => setForm(blank)}>
                  Annuler
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {users.map((user) => (
          <article key={user.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{user.name}</h2>
                <Badge>{ROLE_LABELS[user.role]}</Badge>
                <Badge className={user.active ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}>
                  {user.active ? "Actif" : "Désactivé"}
                </Badge>
                {user.id === currentUserId ? <Badge className="bg-accent text-accent-foreground">Vous</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {user.role === "COACH" ? (
                <p className="text-sm text-muted-foreground">
                  {user.groupIds.length > 0
                    ? user.groupIds.map((id) => names.get(id) ?? "").filter(Boolean).join(", ")
                    : "Tous les groupes"}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setForm({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    active: user.active,
                    password: "",
                    groupIds: user.groupIds,
                  })
                }
              >
                Modifier
              </Button>
              <ConfirmButton
                variant="destructive"
                title={`Supprimer ${user.name} ?`}
                description="Cette personne ne pourra plus se connecter. Les opérations déjà enregistrées sont conservées."
                confirmLabel="Supprimer"
                action={() => deleteUser(user.id)}
              >
                Supprimer
              </ConfirmButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
