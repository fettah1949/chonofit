import { z } from "zod";
import { GUARDIAN_RELATIONS, ROLES } from "@/lib/constants";

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "L'adresse e-mail est invalide.",
  });

export const memberSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(80),
  lastName: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Le téléphone doit contenir au moins 6 caractères.")
    .max(30),
  phone2: z
    .string()
    .trim()
    .max(30)
    .refine((value) => value === "" || value.length >= 6, {
      message: "Le second téléphone doit contenir au moins 6 caractères.",
    }),
  sex: z.enum(["", "M", "F"], { message: "Le sexe indiqué est invalide." }),
  birthDate: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "La date de naissance est invalide.",
    }),
  notes: z.string().max(2000).optional().default(""),
  photoPath: z.string().max(300).optional().default(""),
  guardianName: z.string().trim().max(120).optional().default(""),
  guardianRelation: z.string().trim().max(40).optional().default(""),
}).superRefine((data, ctx) => {
  const relation = data.guardianRelation;
  if (relation && !GUARDIAN_RELATIONS.includes(relation as (typeof GUARDIAN_RELATIONS)[number])) {
    ctx.addIssue({ code: "custom", path: ["guardianRelation"], message: "Le lien de parenté indiqué est invalide." });
  }
  if (data.guardianName && !relation) {
    ctx.addIssue({ code: "custom", path: ["guardianRelation"], message: "Indiquez le lien de parenté." });
  }
  if (relation && !data.guardianName) {
    ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Indiquez le nom du parent." });
  }
});

export const planSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la formule est obligatoire.").max(80),
  durationDays: z.coerce
    .number()
    .int({ message: "La durée doit être un nombre entier de jours." })
    .min(0, "La durée doit être positive. 0 signifie illimité."),
  price: z.coerce.number().min(0, "Le prix doit être positif ou nul."),
  description: z.string().max(500).optional().default(""),
  active: z.boolean().default(true),
});

export const gymSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la salle est obligatoire.").max(120),
  address: z.string().max(300).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  email: optionalEmail,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "La devise doit être un code à 3 lettres, par exemple MAD."),
  logoPath: z.string().max(300).optional().default(""),
});

export const userSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  email: z.string().trim().email("L'adresse e-mail est invalide.").max(160),
  role: z.enum(ROLES, {
    errorMap: () => ({ message: "Le rôle est invalide." }),
  }),
  password: z.string().optional().default(""),
  active: z.boolean().default(true),
});

export const subscriptionSchema = z.object({
  memberId: z.string().min(1, "Choisissez un adhérent."),
  planId: z.string().min(1, "Choisissez une formule."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date de début est invalide."),
  price: z.coerce.number().min(0, "Le prix doit être positif ou nul."),
  note: z.string().max(300).optional().default(""),
  method: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]).optional(),
  recordPayment: z.boolean().default(false),
});

const paymentMethod = z.enum(["CASH", "CARD", "TRANSFER", "OTHER"], {
  errorMap: () => ({ message: "Choisissez un mode de paiement." }),
});

export const paymentSchema = z.object({
  memberId: z.string().min(1, "Choisissez un adhérent."),
  subscriptionId: z.string().min(1, "Choisissez un abonnement."),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0."),
  method: paymentMethod,
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date de paiement est invalide."),
  note: z.string().max(300).optional().default(""),
});

export const settleSchema = z.object({
  paymentId: z.string().min(1, "Reçu introuvable."),
  memberId: z.string().min(1, "Choisissez un adhérent."),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0."),
  method: paymentMethod,
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date de paiement est invalide."),
  note: z.string().max(300).optional().default(""),
});
