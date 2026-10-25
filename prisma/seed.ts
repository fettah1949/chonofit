import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureCatalog } from "../lib/catalog";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin1234!", 10);
  const receptionPassword = await bcrypt.hash("Reception1234!", 10);

  await prisma.user.upsert({
    where: { email: "admin@chonofit.local" },
    update: {},
    create: {
      name: "Mohamed",
      email: "admin@chonofit.local",
      passwordHash: adminPassword,
      role: "ADMIN",
      mustChangePassword: true,
    },
  });

  await prisma.user.updateMany({
    where: { email: "admin@chonofit.local", name: { in: ["Alex Martin", "Omar"] } },
    data: { name: "Mohamed" },
  });

  await prisma.user.upsert({
    where: { email: "reception@chonofit.local" },
    update: {},
    create: {
      name: "Réception",
      email: "reception@chonofit.local",
      passwordHash: receptionPassword,
      role: "RECEPTIONIST",
      mustChangePassword: true,
    },
  });

  await prisma.user.updateMany({
    where: { email: "reception@chonofit.local", name: "Inès Bernard" },
    data: { name: "Réception" },
  });

  const coachPassword = await bcrypt.hash("Coach1234!", 10);
  for (const coach of [
    { name: "Soufiane", email: "soufiane@chonofit.local" },
    { name: "Abdelkhalek", email: "abdelkhalek@chonofit.local" },
  ]) {
    await prisma.user.upsert({
      where: { email: coach.email },
      update: {},
      create: {
        name: coach.name,
        email: coach.email,
        passwordHash: coachPassword,
        role: "COACH",
        mustChangePassword: true,
      },
    });
  }

  await prisma.gymSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Chrono Fitness",
      address: "12 boulevard d'Anfa, Casablanca",
      phone: "05 22 45 67 89",
      email: "contact@chonofit.local",
      currency: "MAD",
    },
  });

  if ((await prisma.subscriptionPlan.count()) === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        { name: "Mensuel", durationDays: 30, price: 300, description: "Accès libre pendant 30 jours." },
        { name: "Trimestriel", durationDays: 90, price: 800, description: "Trois mois d'accès, sans engagement au-delà." },
        { name: "Annuel", durationDays: 365, price: 2500, description: "Une année complète." },
        { name: "Illimité", durationDays: 0, price: 4500, description: "Accès sans date de fin." },
      ],
    });
  }

  await ensureCatalog(prisma, true);

  console.log("Comptes prêts :");
  console.log("  Admin        admin@chonofit.local / Admin1234!");
  console.log("  Réception    reception@chonofit.local / Reception1234!");
  console.log("  Coach        soufiane@chonofit.local / Coach1234!");
  console.log("  Coach        abdelkhalek@chonofit.local / Coach1234!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
