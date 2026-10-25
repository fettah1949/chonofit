-- AlterTable
ALTER TABLE "Member" ADD COLUMN "insuranceConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "insuranceConfirmedStart" DATETIME;
ALTER TABLE "Member" ADD COLUMN "insuranceConfirmedEnd" DATETIME;
