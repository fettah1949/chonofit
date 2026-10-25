import Link from "next/link";
import type { Metadata } from "next";
import { InsuranceExportLinks } from "@/components/members/insurance-export-links";
import { InsuranceImportForm } from "@/components/members/insurance-import-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Importer l'assurance" };

export default async function InsuranceImportPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Importer l'assurance"
        description="La colonne Statut met à jour la fiche : Payé confirme chez l'assurance, Non payé retire cette confirmation. Une fiche payée au club et absente du fichier est seulement affichée."
        action={
          <div className="flex flex-wrap gap-2">
            <InsuranceExportLinks />
            <Button asChild variant="outline">
              <a href="/modeles/assurance.csv" download>
                Modèle CSV
              </a>
            </Button>
          </div>
        }
      />
      <InsuranceImportForm />
      <section className="space-y-2 text-sm text-muted-foreground">
        <p>Colonnes reconnues : Prénom, Nom, Téléphone, Téléphone 2, Naissance, Sexe, Début, Fin, Statut. Seuls le prénom, le nom et le téléphone sont obligatoires.</p>
        <p>Statut Payé confirme le paiement chez l'assurance. Sans date, aucune période n'est inventée. Statut Non payé retire la confirmation. Le paiement au club ne change pas. Une personne inconnue au club n'est pas créée.</p>
        <p>Exporter propose tous les adhérents, ceux payés chez l'assurance, ou ceux non payés chez l'assurance. Le paiement au club n'entre pas dans ce choix.</p>
        <p>Deux enfants avec le même numéro sont distingués par leur nom.</p>
        <p>
          <Link className="text-primary underline" href="/adherents">
            Retour aux adhérents
          </Link>
        </p>
      </section>
    </div>
  );
}
