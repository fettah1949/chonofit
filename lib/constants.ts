export const ROLES = ["ADMIN", "RECEPTIONIST", "COACH"] as const;
export type Role = (typeof ROLES)[number];

export const DISPLAY_STATUSES = ["ACTIVE", "UPCOMING", "EXPIRED", "SUSPENDED"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const INSURANCE_PRICE = 100;

export const GUARDIAN_RELATIONS = ["Père", "Mère", "Tuteur", "Tutrice", "Oncle", "Tante", "Grand-parent", "Autre"] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  RECEPTIONIST: "Réceptionniste",
  COACH: "Coach",
};

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  ACTIVE: "Actif",
  UPCOMING: "À venir",
  EXPIRED: "Expiré",
  SUSPENDED: "Suspendu",
};

export function inactiveAccessSentence(name: string, status: string) {
  if (status === "SUSPENDED") return `${name} est suspendu.`;
  if (status === "UPCOMING") return `L'abonnement de ${name} n'a pas encore commencé.`;
  return `${name} est expiré.`;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
};

export function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}

export function seesMoney(role: string) {
  return role === "ADMIN";
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}
