-- Aditiva e segura para produção: nova coluna com padrão 10. Nenhuma
-- inscrição existente é alterada ou removida (sessões que já têm mais de 10
-- inscritos continuam com todos; apenas não aceitam novas inscrições até o
-- admin aumentar o limite).
ALTER TABLE "Session" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 10;
