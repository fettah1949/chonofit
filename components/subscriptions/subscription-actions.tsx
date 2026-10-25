"use client";

import { deleteSubscription, setSubscriptionStatus } from "@/actions/subscriptions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Button } from "@/components/ui/button";

export function SubscriptionActions({
  id,
  status,
  memberId,
  memberStatus,
  renewHref,
  allowDelete = false,
}: {
  id: string;
  status: string;
  memberId: string;
  memberStatus: string;
  renewHref?: string;
  allowDelete?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      {renewHref ? (
        <Button asChild size="sm" variant="outline">
          <a href={renewHref}>Renouveler</a>
        </Button>
      ) : null}
      {memberStatus === "SUSPENDED" ? (
        <Button asChild size="sm" variant="outline">
          <a href={`/adherents/${memberId}`}>Fiche</a>
        </Button>
      ) : status === "SUSPENDED" ? (
        <ConfirmButton
          size="sm"
          title="Réactiver cet abonnement ?"
          description="Il redeviendra l'abonnement actif de l'adhérent si la date de fin n'est pas dépassée."
          action={() => setSubscriptionStatus(id, "ACTIVE")}
        >
          Réactiver
        </ConfirmButton>
      ) : status === "ACTIVE" ? (
        <ConfirmButton
          size="sm"
          title="Suspendre cet abonnement ?"
          description="L'accès de cette période est coupé. La fiche adhérent, elle, ne change pas."
          action={() => setSubscriptionStatus(id, "SUSPENDED")}
        >
          Suspendre
        </ConfirmButton>
      ) : null}
      {allowDelete ? (
        <ConfirmButton
          size="sm"
          variant="destructive"
          title="Supprimer cet abonnement ?"
          description="Les paiements déjà encaissés restent dans l'historique, sans lien avec cette formule."
          confirmLabel="Supprimer"
          action={() => deleteSubscription(id)}
        >
          Supprimer
        </ConfirmButton>
      ) : null}
    </div>
  );
}
