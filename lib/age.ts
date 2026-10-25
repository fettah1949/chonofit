import { parseDateOnly, toInputDate } from "@/lib/format";

export const MAX_MEMBER_AGE = 15;

export function ageInYears(birth: Date, today = new Date()) {
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function formatAge(age: number) {
  return age <= 1 ? `${age} an` : `${age} ans`;
}

export function memberAgeError(isoDate: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "La date de naissance est invalide.";
  const birth = parseDateOnly(isoDate);
  if (toInputDate(birth) !== isoDate) return "La date de naissance est invalide.";
  const age = ageInYears(birth, today);
  if (age < 0) return "La date de naissance ne peut pas être dans le futur.";
  if (age > MAX_MEMBER_AGE) return "L'âge maximum est de 15 ans.";
  return null;
}

export function ageFromInput(isoDate: string, today = new Date()) {
  if (memberAgeError(isoDate, today) === "La date de naissance est invalide.") return null;
  return ageInYears(parseDateOnly(isoDate), today);
}

export function ageRangeLabel(min: number | null | undefined, max: number | null | undefined) {
  if (min == null || max == null) return "";
  if (min === max) return formatAge(min);
  return `${min}–${max} ans`;
}

export function describeGroup(daysLabel: string, min: number | null | undefined, max: number | null | undefined) {
  const age = ageRangeLabel(min, max);
  return age ? `${daysLabel} · ${age}` : daysLabel;
}

export function parseAgeRange(minRaw: string, maxRaw: string) {
  const minText = minRaw.trim();
  const maxText = maxRaw.trim();
  if (!minText || !maxText) return { error: "Indiquez l'âge minimum et l'âge maximum." };
  if (!/^\d{1,2}$/.test(minText) || !/^\d{1,2}$/.test(maxText)) return { error: "L'âge doit être un nombre entier." };
  const ageMin = Number(minText);
  const ageMax = Number(maxText);
  if (ageMin > MAX_MEMBER_AGE || ageMax > MAX_MEMBER_AGE) return { error: "L'âge maximum d'un groupe est de 15 ans." };
  if (ageMin > ageMax) return { error: "L'âge minimum dépasse l'âge maximum." };
  return { ageMin, ageMax };
}

export function groupAgeMessage(
  groupName: string,
  age: number | null,
  min: number | null | undefined,
  max: number | null | undefined,
) {
  const range = ageRangeLabel(min, max);
  if (!range) return null;
  if (age == null) return `Indiquez la date de naissance. ${groupName} est réservé aux ${range}.`;
  if (min != null && max != null && (age < min || age > max)) return `${groupName} est réservé aux ${range}.`;
  return null;
}
