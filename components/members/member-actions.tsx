"use client";

import Link from "next/link";
import { deleteMember, setMemberStatus } from "@/actions/members";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";

export function MemberActions({
  id,
  suspended,
  settleHref,
  canDelete = false,
}: {
  id: string;
  suspended: boolean;
  settleHref?: string;
  canDelete?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href={`/adherents/${id}/modifier`}>Modifier</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={`/abonnements?adherent=${id}`}>Abonnement</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={settleHref ?? `/paiements?adherent=${id}`}>{settleHref ? "Compléter" : "Paiement"}</Link>
      </Button>
      {suspended ? (
        <ConfirmButton
          title="Réactiver cet adhérent ?"
          description="Son dossier redeviendra actif. Vérifiez aussi que son abonnement est en cours."
          action={() => setMemberStatus(id, "ACTIVE")}
        >
          Réactiver
        </ConfirmButton>
      ) : (
        <ConfirmButton
          title="Suspendre cet adhérent ?"
          description="Le dossier reste en base. Le pointage signalera que l'accès est suspendu."
          action={() => setMemberStatus(id, "SUSPENDED")}
        >
          Suspendre
        </ConfirmButton>
      )}
      {canDelete ? (
        <ConfirmButton
          variant="destructive"
          title="Supprimer cette fiche vide ?"
          description="Elle n'a ni paiement, ni abonnement, ni présence. La photo sera supprimée. Un dossier qui a déjà un historique se suspend, il ne se supprime pas."
          confirmLabel="Supprimer"
          action={() => deleteMember(id)}
        >
          Supprimer
        </ConfirmButton>
      ) : null}
    </div>
  );
}
