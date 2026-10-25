import { Prisma } from "@prisma/client";

export function uniqueMessage(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return null;
  }
  const target = String(error.meta?.target ?? "");
  if (target.includes("phone")) return "Ce numéro de téléphone est déjà utilisé.";
  if (target.includes("email")) return "Cette adresse e-mail est déjà utilisée.";
  if (target.includes("receiptNumber")) return "Le numéro de reçu existe déjà. Réessayez.";
  return "Cette information est déjà utilisée.";
}

export function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
