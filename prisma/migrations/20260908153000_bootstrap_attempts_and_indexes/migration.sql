-- Aditiva e segura para produção (nenhuma linha existente é alterada).

-- Limite de tentativas do token de bootstrap de admin.
ALTER TABLE "AdminBootstrapToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- Índices para as consultas mais frequentes (agenda, cron, ledger, pagamentos).
CREATE INDEX IF NOT EXISTS "Session_startsAt_idx" ON "Session"("startsAt");
CREATE INDEX IF NOT EXISTS "Session_teacherId_idx" ON "Session"("teacherId");
CREATE INDEX IF NOT EXISTS "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE INDEX IF NOT EXISTS "StudentCreditLedger_enrollmentId_idx" ON "StudentCreditLedger"("enrollmentId");
CREATE INDEX IF NOT EXISTS "StudentCreditLedger_paymentId_idx" ON "StudentCreditLedger"("paymentId");
CREATE INDEX IF NOT EXISTS "AsaasPayment_userId_status_idx" ON "AsaasPayment"("userId", "status");
CREATE INDEX IF NOT EXISTS "StudentCreditLot_paymentId_idx" ON "StudentCreditLot"("paymentId");

-- Saldo de lote nunca negativo. NOT VALID: vale só para escritas novas,
-- não trava o deploy caso exista alguma linha legada fora da regra.
ALTER TABLE "StudentCreditLot"
  ADD CONSTRAINT "StudentCreditLot_remaining_nonnegative"
  CHECK ("remaining" >= 0) NOT VALID;
