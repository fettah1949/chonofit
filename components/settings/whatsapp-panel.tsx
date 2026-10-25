"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveAutoReminders, startWhatsAppLink, stopWhatsAppLink, whatsAppSnapshot } from "@/actions/whatsapp";
import type { WhatsAppLinkStatus } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const labels: Record<WhatsAppLinkStatus["status"], string> = {
  disconnected: "Non connecté",
  connecting: "Connexion…",
  qr: "En attente du scan",
  open: "Connecté",
};

export function WhatsAppPanel({ autoReminders }: { autoReminders: boolean }) {
  const [state, setState] = useState<WhatsAppLinkStatus | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let ignore = false;
    void whatsAppSnapshot().then((next) => {
      if (!ignore) setState(next);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!state || (state.status !== "qr" && state.status !== "connecting")) return;
    const timer = setTimeout(() => {
      void whatsAppSnapshot().then(setState);
    }, 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function connect() {
    setPending(true);
    try {
      const next = await startWhatsAppLink();
      setState(next);
      if (next.error) toast.error(next.error);
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    setPending(true);
    try {
      setState(await stopWhatsAppLink());
      toast.success("WhatsApp déconnecté.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp de la salle</CardTitle>
        <CardDescription>
          Reliez le numéro une seule fois. Ensuite, le bouton du reçu envoie l&apos;image directement à l&apos;adhérent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          État : <span className="font-medium">{state ? labels[state.status] : "Chargement…"}</span>
          {state?.phone ? <span className="text-muted-foreground"> · +{state.phone}</span> : null}
        </p>
        {state?.status === "qr" && state.qr ? (
          <div className="space-y-3">
            <img src={state.qr} alt="QR code WhatsApp" className="h-64 w-64 rounded-xl border bg-white p-2" />
            <p className="max-w-md text-sm text-muted-foreground">
              Sur le téléphone : WhatsApp, Appareils connectés, Connecter un appareil. Scannez ce code.
            </p>
          </div>
        ) : null}
        {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        <form key={autoReminders ? "on" : "off"} action={saveAutoReminders} className="space-y-3 border-t pt-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={autoReminders} className="mt-1" />
            <span>Envoyer les relances d&apos;échéance automatiquement, une seule fois par abonnement.</span>
          </label>
          <Button type="submit" variant="outline">
            Enregistrer les relances
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {state?.status !== "open" ? (
            <Button onClick={connect} disabled={pending || state?.status === "connecting" || state?.status === "qr"}>
              {pending || state?.status === "connecting" ? "Connexion…" : "Connecter WhatsApp"}
            </Button>
          ) : (
            <Button variant="outline" onClick={disconnect} disabled={pending}>
              Déconnecter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
