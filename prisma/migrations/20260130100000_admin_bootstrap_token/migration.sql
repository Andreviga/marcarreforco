-- CreateTable
CREATE TABLE "AdminBootstrapToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminBootstrapToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminBootstrapToken_email_idx" ON "AdminBootstrapToken"("email");
