import { parseDateOnly, toInputDate } from "@/lib/format";
import { fold } from "@/lib/member-match";

export type InsuranceImportRow = {
  line: number;
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  birthDate: string;
  sex: "" | "M" | "F";
  start: string;
  end: string;
  paid: boolean;
};

const aliases = {
  firstName: ["prenom", "prénom", "firstname", "first name"],
  lastName: ["nom", "lastname", "last name", "nom de famille"],
  fullName: ["nom complet", "adherent", "adhérent", "nom et prenom", "nom et prénom", "enfant"],
  phone: ["telephone", "téléphone", "tel", "phone", "gsm", "portable", "numero", "numéro"],
  phone2: ["telephone 2", "téléphone 2", "tel 2", "tel2", "phone2", "portable 2"],
  birth: ["naissance", "date de naissance", "birth", "ddn", "date naissance", "anniversaire"],
  sex: ["sexe", "sex", "genre"],
  start: ["debut", "début", "debut assurance", "début assurance", "du", "date debut", "date début"],
  end: ["fin", "fin assurance", "au", "echeance", "échéance", "date fin"],
  status: ["statut", "status", "paye chez assurance", "paye chez l assurance", "confirmation"],
};

function headerKey(value: string) {
  return fold(value).replace(/[_./]+/g, " ").replace(/\s+/g, " ").trim();
}

function pick(row: Record<string, string>, names: string[]) {
  for (const [key, value] of Object.entries(row)) {
    if (names.includes(headerKey(key))) return value.trim();
  }
  return "";
}

export function parseFlexibleDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = toInputDate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const isoPrefix = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`;
  const local = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (local) {
    const day = local[1].padStart(2, "0");
    const month = local[2].padStart(2, "0");
    const rawYear = local[3];
    const year = rawYear.length === 2 ? (Number(rawYear) > 50 ? `19${rawYear}` : `20${rawYear}`) : rawYear;
    const iso = `${year}-${month}-${day}`;
    return toInputDate(parseDateOnly(iso)) === iso ? iso : null;
  }
  if (/^\d{4,6}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial > 20000 && serial < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30 + serial));
      const iso = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      return iso;
    }
  }
  return null;
}

function columnPresent(row: Record<string, string>, names: string[]) {
  return Object.keys(row).some((key) => names.includes(headerKey(key)));
}

function parsePaid(value: string): boolean | null {
  const text = fold(value).replace(/[-_'’.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const paid = ["paye", "oui", "yes", "o", "1", "avec", "confirme", "vrai", "true", "paye chez l assurance", "paye chez assurance"];
  const unpaid = ["non", "non paye", "no", "n", "0", "sans", "pas paye", "pas confirme", "faux", "false", "non paye chez l assurance", "non paye chez assurance"];
  if (paid.includes(text)) return true;
  if (unpaid.includes(text)) return false;
  return null;
}

function parseSex(value: string): "" | "M" | "F" | null {
  const text = fold(value).replace(/\./g, "");
  if (!text) return "";
  if (["m", "g", "h", "garcon", "masculin", "homme"].includes(text)) return "M";
  if (["f", "fille", "feminin", "femme"].includes(text)) return "F";
  return null;
}

export function cleanPhone(value: string) {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s.\-()/]/g, "");
  const raw = compact.startsWith("+") ? compact.slice(1) : compact;
  if (!/^\d+$/.test(raw) || raw.length < 6 || raw.length > 20) return trimmed.replace(/\s+/g, " ");
  let digits = raw;
  if (digits.startsWith("00212") && digits.length === 14) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("212") && digits.length === 12) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && /^[5-8]/.test(digits)) digits = `0${digits}`;
  return digits;
}

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function parseRecord(row: Record<string, string>, line: number) {
  const full = pick(row, aliases.fullName);
  const split = full ? splitFullName(full) : null;
  const firstName = (pick(row, aliases.firstName) || split?.firstName || "").replace(/\s+/g, " ").trim();
  const lastName = (pick(row, aliases.lastName) || split?.lastName || "").replace(/\s+/g, " ").trim();
  const phone = cleanPhone(pick(row, aliases.phone));
  const phone2 = cleanPhone(pick(row, aliases.phone2));
  if (!firstName && !lastName && !phone) return null;

  if (firstName.length < 1 || lastName.length < 1) {
    return { error: `Ligne ${line} : indiquez le prénom et le nom.` };
  }
  if (firstName.length > 80 || lastName.length > 80) {
    return { error: `Ligne ${line} : le nom est trop long.` };
  }
  if (phoneDigits(phone).length < 6) {
    return { error: `Ligne ${line} : le téléphone est invalide.` };
  }

  const birthRaw = pick(row, aliases.birth);
  const birthDate = parseFlexibleDate(birthRaw);
  if (birthDate === null) return { error: `Ligne ${line} : la date de naissance est invalide.` };

  const sex = parseSex(pick(row, aliases.sex));
  if (sex === null) return { error: `Ligne ${line} : le sexe doit être Garçon ou Fille.` };

  const startRaw = parseFlexibleDate(pick(row, aliases.start));
  const endRaw = parseFlexibleDate(pick(row, aliases.end));
  if (startRaw === null) return { error: `Ligne ${line} : la date de début est invalide.` };
  if (endRaw === null) return { error: `Ligne ${line} : la date de fin est invalide.` };
  const start = startRaw || "";
  const end = endRaw || "";
  if ((start && !end) || (!start && end)) {
    return { error: `Ligne ${line} : indiquez le début et la fin, ou laissez les deux vides.` };
  }
  if (start && end < start) return { error: `Ligne ${line} : la fin de l'assurance est avant le début.` };

  const statusKnown = columnPresent(row, aliases.status);
  const paid = statusKnown ? parsePaid(pick(row, aliases.status)) : true;
  if (paid === null) return { error: `Ligne ${line} : le statut doit être Payé ou Non payé.` };

  const parsed: InsuranceImportRow = { line, firstName, lastName, phone, phone2, birthDate, sex, start, end, paid };
  return { row: parsed };
}

export function rowsFromTable(table: Record<string, string>[]) {
  const rows: InsuranceImportRow[] = [];
  const errors: string[] = [];
  table.forEach((record, index) => {
    const parsed = parseRecord(record, index + 2);
    if (!parsed) return;
    if ("row" in parsed && parsed.row) rows.push(parsed.row);
    else if ("error" in parsed && typeof parsed.error === "string") errors.push(parsed.error);
  });
  return { rows, errors };
}

function parseCsv(text: string): { table: Record<string, string>[] } | { error: string } {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = source.split("\n").find((line) => line.trim()) ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const grid: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value)) grid.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some((value) => value)) grid.push(row);
  }
  if (grid.length < 2) return { error: "Le fichier ne contient aucune ligne d'adhérent." };
  const headers = grid[0].map(headerKey);
  const known = new Set(Object.values(aliases).flat().map(headerKey));
  if (!headers.some((header) => known.has(header))) {
    return { error: "La première ligne doit contenir les colonnes, par exemple Prénom, Nom et Téléphone." };
  }
  const table = grid.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
  return { table };
}

export function rowsFromCsv(
  text: string,
): { rows: InsuranceImportRow[]; errors: string[] } | { error: string } {
  const parsed = parseCsv(text);
  if ("table" in parsed) return rowsFromTable(parsed.table);
  return { error: parsed.error };
}

export function importRowKey(row: InsuranceImportRow) {
  return `${[fold(row.firstName), fold(row.lastName)].sort().join(" ")}|${phoneDigits(row.phone)}`;
}

export function sameMember(
  member: { firstName: string; lastName: string; phone: string; phone2: string },
  row: InsuranceImportRow,
) {
  const left = [fold(member.firstName), fold(member.lastName)].sort().join(" ");
  const right = [fold(row.firstName), fold(row.lastName)].sort().join(" ");
  if (left !== right) return false;
  const phones = [phoneDigits(member.phone), phoneDigits(member.phone2)].filter((value) => value.length >= 6);
  const wanted = [phoneDigits(row.phone), phoneDigits(row.phone2)].filter((value) => value.length >= 6);
  return wanted.some((value) => phones.includes(value));
}
