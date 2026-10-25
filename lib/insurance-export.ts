import { toInputDate } from "@/lib/format";

export type InsuranceExportMember = {
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  sex: string;
  birthDate: Date | null;
  hasInsurance: boolean;
  insuranceStart: Date | null;
  insuranceEnd: Date | null;
  insuranceConfirmed: boolean;
  insuranceConfirmedStart: Date | null;
  insuranceConfirmedEnd: Date | null;
};

const headers = ["Prénom", "Nom", "Téléphone", "Téléphone 2", "Naissance", "Sexe", "Début", "Fin", "Statut"];

function frenchDate(date: Date | null) {
  const iso = toInputDate(date);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function sexLabel(sex: string) {
  if (sex === "M") return "Garçon";
  if (sex === "F") return "Fille";
  return "";
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[;"\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function membersToInsuranceCsv(members: InsuranceExportMember[]) {
  const lines = [headers.join(";")];
  for (const member of members) {
    lines.push(
      [
        member.firstName,
        member.lastName,
        member.phone,
        member.phone2,
        frenchDate(member.birthDate),
        sexLabel(member.sex),
        member.hasInsurance ? frenchDate(member.insuranceStart) : member.insuranceConfirmed ? frenchDate(member.insuranceConfirmedStart) : "",
        member.hasInsurance ? frenchDate(member.insuranceEnd) : member.insuranceConfirmed ? frenchDate(member.insuranceConfirmedEnd) : "",
        member.insuranceConfirmed ? "Payé" : "Non payé",
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
