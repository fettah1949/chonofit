-- AlterTable
ALTER TABLE "Member" ADD COLUMN "hasInsurance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "insuranceStart" DATETIME;
ALTER TABLE "Member" ADD COLUMN "insuranceEnd" DATETIME;

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "MemberActivity" (
    "memberId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    PRIMARY KEY ("memberId", "activityId"),
    CONSTRAINT "MemberActivity_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "days" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TrainingGroup_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberGroup" (
    "memberId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    PRIMARY KEY ("memberId", "groupId"),
    CONSTRAINT "MemberGroup_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packName" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EquipmentItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentPurchase_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_code_key" ON "Activity"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGroup_code_key" ON "TrainingGroup"("code");

-- CreateIndex
CREATE INDEX "TrainingGroup_activityId_idx" ON "TrainingGroup"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentItem_code_key" ON "EquipmentItem"("code");

-- CreateIndex
CREATE INDEX "EquipmentItem_activityId_idx" ON "EquipmentItem"("activityId");

-- CreateIndex
CREATE INDEX "EquipmentPurchase_memberId_purchasedAt_idx" ON "EquipmentPurchase"("memberId", "purchasedAt");
