-- CreateTable
CREATE TABLE "SessionPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionPackage_name_key" ON "SessionPackage"("name");
