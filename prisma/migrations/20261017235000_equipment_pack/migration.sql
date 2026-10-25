-- CreateTable
CREATE TABLE "EquipmentPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EquipmentPack_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill one pack per activity and pack name. The pack price starts as the sum of its articles.
INSERT INTO "EquipmentPack" ("id", "code", "name", "activityId", "price", "sortOrder")
SELECT
    lower(hex(randomblob(12))),
    CASE
        WHEN a."code" = 'KICK' AND i."packName" = 'Pack Kickboxing' THEN 'PACK-KICK'
        WHEN a."code" = 'KARATE' AND i."packName" = 'Pack Karaté' THEN 'PACK-KARATE'
        ELSE 'PACK-' || upper(hex(randomblob(4)))
    END,
    i."packName",
    i."activityId",
    SUM(i."price"),
    MIN(i."sortOrder")
FROM "EquipmentItem" i
JOIN "Activity" a ON a."id" = i."activityId"
GROUP BY i."activityId", i."packName";

-- RedefineTable
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EquipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EquipmentItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "EquipmentPack" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EquipmentItem" ("id", "code", "name", "packId", "activityId", "price", "sortOrder")
SELECT i."id", i."code", i."name", p."id", i."activityId", i."price", i."sortOrder"
FROM "EquipmentItem" i
JOIN "EquipmentPack" p ON p."activityId" = i."activityId" AND p."name" = i."packName";
DROP TABLE "EquipmentItem";
ALTER TABLE "new_EquipmentItem" RENAME TO "EquipmentItem";
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentPack_code_key" ON "EquipmentPack"("code");

-- CreateIndex
CREATE INDEX "EquipmentPack_activityId_idx" ON "EquipmentPack"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentItem_code_key" ON "EquipmentItem"("code");

-- CreateIndex
CREATE INDEX "EquipmentItem_activityId_idx" ON "EquipmentItem"("activityId");

-- CreateIndex
CREATE INDEX "EquipmentItem_packId_idx" ON "EquipmentItem"("packId");
