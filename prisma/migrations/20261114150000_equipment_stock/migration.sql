-- AlterTable
ALTER TABLE "EquipmentItem" ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EquipmentSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "EquipmentSale_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSale_receiptNumber_key" ON "EquipmentSale"("receiptNumber");

-- CreateIndex
CREATE INDEX "EquipmentSale_soldAt_idx" ON "EquipmentSale"("soldAt");

-- CreateIndex
CREATE INDEX "EquipmentSale_itemId_soldAt_idx" ON "EquipmentSale"("itemId", "soldAt");
