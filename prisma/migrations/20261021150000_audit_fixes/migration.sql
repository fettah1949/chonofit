-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GymSettings" ADD COLUMN "autoReminders" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReceiptSequence" (
    "year" INTEGER NOT NULL PRIMARY KEY,
    "last" INTEGER NOT NULL
);
