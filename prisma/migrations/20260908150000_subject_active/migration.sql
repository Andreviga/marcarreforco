-- Aditiva e segura para produção: nenhuma linha é alterada além do novo
-- campo, que nasce true para todas as disciplinas existentes.
ALTER TABLE "Subject" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
