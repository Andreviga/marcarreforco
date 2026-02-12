-- CreateTable
CREATE TABLE "StudentCreditLot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "paymentId" TEXT,
    "total" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCreditLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentCreditLot_studentId_subjectId_idx" ON "StudentCreditLot"("studentId", "subjectId");

-- CreateIndex
CREATE INDEX "StudentCreditLot_expiresAt_idx" ON "StudentCreditLot"("expiresAt");

-- AddForeignKey
ALTER TABLE "StudentCreditLot" ADD CONSTRAINT "StudentCreditLot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLot" ADD CONSTRAINT "StudentCreditLot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLot" ADD CONSTRAINT "StudentCreditLot_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AsaasPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "StudentCreditLedger" ADD COLUMN "creditLotId" TEXT;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_creditLotId_fkey" FOREIGN KEY ("creditLotId") REFERENCES "StudentCreditLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
