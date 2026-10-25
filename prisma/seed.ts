import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureCatalog } from "../lib/catalog";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin1234!", 10);
  const receptionPassword = await bcrypt.hash("Reception1234!", 10);

  await renameAccount("admin@chonofit.local", "admin@chono.fitness");
  await prisma.user.upsert({
    where: { email: "admin@chono.fitness" },
    update: {},
    create: {
      name: "Mohamed",
      email: "admin@chono.fitness",
      passwordHash: adminPassword,
      role: "ADMIN",
      mustChangePassword: true,
    },
  });

  await prisma.user.updateMany({
    where: { email: "admin@chono.fitness", name: { in: ["Alex Martin", "Omar"] } },
    data: { name: "Mohamed" },
  });

  await renameAccount("reception@chonofit.local", "reception@chono.fitness");
  await prisma.user.upsert({
    where: { email: "reception@chono.fitness" },
    update: {},
    create: {
      name: "Réception",
      email: "reception@chono.fitness",
      passwordHash: receptionPassword,
      role: "RECEPTIONIST",
      mustChangePassword: true,
    },
  });

  await prisma.user.updateMany({
    where: { email: "reception@chono.fitness", name: "Inès Bernard" },
    data: { name: "Réception" },
  });

  const coachPassword = await bcrypt.hash("Coach1234!", 10);
  for (const coach of [
    { name: "Soufiane", email: "soufiane@chono.fitness", previous: "soufiane@chonofit.local" },
    { name: "Abdelkhalek", email: "abdelkhalek@chono.fitness", previous: "abdelkhalek@chonofit.local" },
  ]) {
    await renameAccount(coach.previous, coach.email);
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
      email: "contact@chono.fitness",
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

  await prisma.gymSettings.updateMany({
    where: { id: "default", email: "contact@chonofit.local" },
    data: { email: "contact@chono.fitness" },
  });

  await ensureCatalog(prisma, true);

  console.log("Comptes prêts :");
  console.log("  Admin        admin@chono.fitness / Admin1234!");
  console.log("  Réception    reception@chono.fitness / Reception1234!");
  console.log("  Coach        soufiane@chono.fitness / Coach1234!");
  console.log("  Coach        abdelkhalek@chono.fitness / Coach1234!");
}

async function renameAccount(from: string, to: string) {
  if (await prisma.user.findUnique({ where: { email: to } })) return;
  await prisma.user.updateMany({ where: { email: from }, data: { email: to } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
