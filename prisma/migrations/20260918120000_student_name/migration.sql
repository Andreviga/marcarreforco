-- Aditiva e segura para produção: nova coluna + backfill (nenhum dado
-- existente é alterado ou removido).
ALTER TABLE "StudentProfile" ADD COLUMN "studentName" TEXT;

-- Cadastros já feitos: replica o nome atual da conta como nome do aluno,
-- conforme decidido (a conta passa a representar o responsável daqui em diante).
UPDATE "StudentProfile" AS sp
SET "studentName" = u."name"
FROM "User" AS u
WHERE u."id" = sp."userId" AND sp."studentName" IS NULL;
