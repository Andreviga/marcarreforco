-- Script para corrigir assinaturas que estão como ACTIVE sem pagamento confirmado
-- Execução única após deploy da correção

-- 1. Desativar assinaturas que não têm nenhum pagamento confirmado
UPDATE "AsaasSubscription" 
SET status = 'INACTIVE'
WHERE status = 'ACTIVE'
  AND id NOT IN (
    SELECT DISTINCT "subscriptionId"
    FROM "AsaasPayment"
    WHERE "subscriptionId" IS NOT NULL
      AND status = 'CONFIRMED'
  );

-- 2. Verificar assinaturas que foram corrigidas
SELECT 
  s.id,
  s."userId",
  s.status,
  s."createdAt",
  p.name as package_name,
  COUNT(ap.id) as total_payments,
  COUNT(CASE WHEN ap.status = 'CONFIRMED' THEN 1 END) as confirmed_payments
FROM "AsaasSubscription" s
JOIN "SessionPackage" p ON s."packageId" = p.id
LEFT JOIN "AsaasPayment" ap ON s.id = ap."subscriptionId"
GROUP BY s.id, s."userId", s.status, s."createdAt", p.name
ORDER BY s."createdAt" DESC;
