"use client";

import { useActionState, useState } from "react";
import { updateGym } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoCapture } from "@/components/members/photo-capture";
import { SubmitButton } from "@/components/shared/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function GymForm({
  settings,
}: {
  settings: {
    name: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
    logoPath: string | null;
  };
}) {
  const [state, action] = useActionState(updateGym, null);
  const [logoPath, setLogoPath] = useState(settings.logoPath ?? "");
  useActionToast(state);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <input type="hidden" name="logoPath" value={logoPath} />
      <Card>
        <CardContent>
          <PhotoCapture kind="logo" value={logoPath} onChange={setLogoPath} firstName="C" lastName="F" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nom de la salle</Label>
            <Input id="name" name="name" required defaultValue={settings.name} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" name="address" defaultValue={settings.address} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" defaultValue={settings.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={settings.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Input id="currency" name="currency" maxLength={3} placeholder="MAD" defaultValue={settings.currency} />
          </div>
          {state?.error ? <p className="text-sm text-red-800 sm:col-span-2">{state.error}</p> : null}
          <div className="sm:col-span-2">
            <SubmitButton>Enregistrer la salle</SubmitButton>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
