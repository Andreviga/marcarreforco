-- CreateEnum
CREATE TYPE "PackageBillingType" AS ENUM ('PACKAGE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PackageBillingCycle" AS ENUM ('MONTHLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'OVERDUE', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('PAYMENT_CREDIT', 'ENROLL_RESERVE', 'ENROLL_RELEASE', 'ADMIN_ADJUST');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "creditsReserved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SessionPackage" ADD COLUMN     "billingCycle" "PackageBillingCycle",
ADD COLUMN     "billingType" "PackageBillingType" NOT NULL DEFAULT 'PACKAGE',
ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "document" TEXT;

-- CreateTable
CREATE TABLE "AsaasCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asaasId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsaasCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsaasSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "asaasId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsaasSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsaasPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "asaasId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "billingType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsaasPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCreditBalance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCreditLedger" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "enrollmentId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCustomer_userId_key" ON "AsaasCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCustomer_asaasId_key" ON "AsaasCustomer"("asaasId");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasSubscription_asaasId_key" ON "AsaasSubscription"("asaasId");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasPayment_asaasId_key" ON "AsaasPayment"("asaasId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCreditBalance_studentId_subjectId_key" ON "StudentCreditBalance"("studentId", "subjectId");

-- CreateIndex
CREATE INDEX "StudentCreditLedger_studentId_subjectId_idx" ON "StudentCreditLedger"("studentId", "subjectId");

-- AddForeignKey
ALTER TABLE "SessionPackage" ADD CONSTRAINT "SessionPackage_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCustomer" ADD CONSTRAINT "AsaasCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasSubscription" ADD CONSTRAINT "AsaasSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasSubscription" ADD CONSTRAINT "AsaasSubscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SessionPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasPayment" ADD CONSTRAINT "AsaasPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasPayment" ADD CONSTRAINT "AsaasPayment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SessionPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasPayment" ADD CONSTRAINT "AsaasPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AsaasSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditBalance" ADD CONSTRAINT "StudentCreditBalance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditBalance" ADD CONSTRAINT "StudentCreditBalance_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AsaasPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
