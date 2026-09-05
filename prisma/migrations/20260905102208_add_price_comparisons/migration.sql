-- CreateTable
CREATE TABLE "PriceComparison" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "shopifyPrice" REAL NOT NULL,
    "competitorPrice" REAL NOT NULL,
    "competitorurl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceComparison_shop_productId_key" ON "PriceComparison"("shop", "productId");
