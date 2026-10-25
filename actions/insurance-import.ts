"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { parseDateOnly } from "@/lib/format";
import {
  importRowKey,
  rowsFromCsv,
  rowsFromTable,
  sameMember,
  type InsuranceImportRow,
} from "@/lib/insurance-import";

export type InsurancePerson = { id: string; name: string };
export type InsuranceUnknown = { name: string; phone: string };

export type InsuranceImportState = {
  error?: string;
  success?: string;
  redirectTo?: string;
  confirmed?: InsurancePerson[];
  unpaid?: InsurancePerson[];
  missing?: InsurancePerson[];
  unknown?: InsuranceUnknown[];
} | null;

function cellText(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value ?? "").trim();
}

function readSheet(buffer: Buffer) {
  const book = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) return [];
  const table = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  return table.map((row) => {
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) record[key] = cellText(value);
    return record;
  });
}

function readRows(file: File, buffer: Buffer): { rows: InsuranceImportRow[]; errors: string[] } | { error: string } {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return rowsFromTable(readSheet(buffer));
  return rowsFromCsv(buffer.toString("utf8"));
}

function personName(member: { firstName: string; lastName: string }) {
  return `${member.firstName} ${member.lastName}`;
}

export async function importInsuranceList(_prev: InsuranceImportState, formData: FormData): Promise<InsuranceImportState> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier CSV ou Excel." };
  const filename = file.name.toLowerCase();
  if (!filename.endsWith(".csv") && !filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
    return { error: "Utilisez un fichier CSV ou Excel." };
  }
  if (file.size > 2_000_000) return { error: "Le fichier dépasse 2 Mo." };

  let parsed: { rows: InsuranceImportRow[]; errors: string[] } | { error: string };
  try {
    parsed = readRows(file, Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "Le fichier n'a pas pu être lu. Utilisez un CSV ou un Excel." };
  }
  if ("error" in parsed) return { error: parsed.error };
  if (parsed.rows.length + parsed.errors.length === 0) return { error: "Le fichier ne contient aucune ligne d'adhérent." };
  if (parsed.rows.length > 400) return { error: "Le fichier dépasse 400 adhérents." };

  const members = await prisma.member.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true, phone2: true, hasInsurance: true },
  });

  const confirmed: InsurancePerson[] = [];
  const unpaid: InsurancePerson[] = [];
  const unknown: InsuranceUnknown[] = [];
  const errors = [...parsed.errors];
  const seen = new Set<string>();
  const matched = new Set<string>();
  const updates: { id: string; row: InsuranceImportRow }[] = [];

  for (const row of parsed.rows) {
    const key = importRowKey(row);
    if (seen.has(key)) {
      errors.push(`Ligne ${row.line} : cet adhérent est déjà dans le fichier.`);
      continue;
    }
    seen.add(key);
    const matches = members.filter((member) => sameMember(member, row));
    if (matches.length > 1) {
      errors.push(`Ligne ${row.line} : plusieurs fiches portent ce nom et ce numéro.`);
      continue;
    }
    if (matches.length === 0) {
      unknown.push({ name: personName(row), phone: row.phone });
      continue;
    }
    updates.push({ id: matches[0].id, row });
    matched.add(matches[0].id);
    const person = { id: matches[0].id, name: personName(matches[0]) };
    if (row.paid) confirmed.push(person);
    else unpaid.push(person);
  }

  if (updates.length > 0) {
    try {
      await prisma.$transaction(updates.map((update) => applyInsuranceStatus(update.id, update.row)));
    } catch {
      return { error: "L'import a été annulé. Aucune fiche n'a été modifiée." };
    }
  }

  const missing = members
    .filter((member) => member.hasInsurance && !matched.has(member.id))
    .map((member) => ({ id: member.id, name: personName(member) }))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
  confirmed.sort((left, right) => left.name.localeCompare(right.name, "fr"));
  unpaid.sort((left, right) => left.name.localeCompare(right.name, "fr"));
  unknown.sort((left, right) => left.name.localeCompare(right.name, "fr"));

  revalidatePath("/adherents");
  revalidatePath("/");
  revalidatePath("/groupes");
  for (const update of updates) revalidatePath(`/adherents/${update.id}`);

  const summary = `${confirmed.length} payé${confirmed.length > 1 ? "s" : ""} chez l'assurance. ${unpaid.length} non payé${unpaid.length > 1 ? "s" : ""} chez l'assurance. ${missing.length} payé${missing.length > 1 ? "s" : ""} chez nous, absent${missing.length > 1 ? "s" : ""} du fichier. ${unknown.length} inconnu${unknown.length > 1 ? "s" : ""} chez nous.`;
  const detail = errors.length ? ` ${errors.length} ligne${errors.length > 1 ? "s" : ""} ignorée${errors.length > 1 ? "s" : ""}. ${errors.slice(0, 3).join(" ")}` : "";
  return { success: `${summary}${detail}`, confirmed, unpaid, missing, unknown };
}

function applyInsuranceStatus(id: string, row: InsuranceImportRow) {
  return prisma.member.update({
    where: { id },
    data: row.paid
      ? {
          insuranceConfirmed: true,
          insuranceConfirmedStart: row.start ? parseDateOnly(row.start) : null,
          insuranceConfirmedEnd: row.end ? parseDateOnly(row.end) : null,
        }
      : {
          insuranceConfirmed: false,
          insuranceConfirmedStart: null,
          insuranceConfirmedEnd: null,
        },
  });
}
