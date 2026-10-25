"use client";

import Link from "next/link";
import { deletePayment } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";

export function PaymentActions({
  id,
  settleHref,
  canDelete = false,
}: {
  id: string;
  settleHref?: string;
  canDelete?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      {settleHref ? (
        <Button asChild size="sm">
          <Link href={settleHref}>Compléter</Link>
        </Button>
      ) : null}
      <Button asChild variant="outline" size="sm">
        <Link href={`/paiements/${id}/recu`}>Reçu</Link>
      </Button>
      {canDelete ? (
        <ConfirmButton
          variant="outline"
          size="sm"
          title="Supprimer ce paiement ?"
          description="Le reçu ne sera plus disponible. Son numéro ne sera pas réutilisé."
          confirmLabel="Supprimer"
          action={() => deletePayment(id)}
        >
          Supprimer
        </ConfirmButton>
      ) : null}
    </div>
  );
}
