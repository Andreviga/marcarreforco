-- Pacotes viram compra única por quantidade de aulas e os créditos deixam de
-- expirar. Migração segura para produção: nada é apagado, nenhuma assinatura
-- do Asaas é tocada (quem já assina continua podendo ver e cancelar).

-- 1) Pacotes de assinatura passam a ser pacotes comuns (compra única).
UPDATE "SessionPackage"
SET "billingType" = 'PACKAGE', "billingCycle" = NULL
WHERE "billingType" <> 'PACKAGE' OR "billingCycle" IS NOT NULL;

-- 2) Renomeia "N dia(s)/semana" para "N aulas" (a quantidade de aulas é a
--    mesma, só muda o rótulo). Só renomeia se o nome novo ainda não existir
--    (o nome é único) e ignora qualquer colisão inesperada.
DO $$
DECLARE
  pkg RECORD;
  new_name TEXT;
BEGIN
  FOR pkg IN
    SELECT "id", "name", "sessionCount"
    FROM "SessionPackage"
    WHERE "name" ~* '^(Pacote especial )?[0-9]+ dias?/semana'
  LOOP
    new_name := regexp_replace(
      pkg."name",
      '[0-9]+ dias?/semana',
      pkg."sessionCount"::TEXT || ' aulas',
      'i'
    );
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM "SessionPackage" WHERE "name" = new_name) THEN
        UPDATE "SessionPackage" SET "name" = new_name WHERE "id" = pkg."id";
      END IF;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 3) Créditos não expiram: reativa lotes vencidos que ainda têm saldo e
--    estende a validade dos lotes com saldo. A coluna continua existindo
--    (NOT NULL) e o código passou a ignorá-la nas consultas.
UPDATE "StudentCreditLot"
SET "expiresAt" = TIMESTAMP '2099-12-31 23:59:59'
WHERE "remaining" > 0 AND "expiresAt" < TIMESTAMP '2099-01-01 00:00:00';
