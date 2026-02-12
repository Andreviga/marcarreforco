# Agendamento de Reforço (MVP)

Sistema web para agendamento de aulas de reforço com pagamento antecipado via Asaas.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- NextAuth (Credentials) + bcrypt
- PostgreSQL + Prisma
- Docker Compose para banco

## Pré-requisitos
- Node.js 20+
- Docker + Docker Compose

## Configuração
1. Instale dependências:
   - `npm install`
2. Configure variáveis de ambiente:
   - Copie `.env.example` para `.env`
3. Suba o banco:
   - `docker compose up -d`
4. Rode migrations e seed:
   - `npx prisma migrate dev`
   - `npx prisma db seed`
5. Inicie o projeto:
   - `npm run dev`

## Usuários seed
- Admin: admin@colegio.com / 123456
- Professor: professor@colegio.com / 123456
- Aluno: aluno@colegio.com / 123456

## Scripts úteis
- `npm run prisma:migrate`
- `npm run prisma:seed`
- `npm run prisma:generate`

## Funcionalidades principais
- RBAC (Aluno/Professor/Admin)
- Agendamento de sessões
- Chamada com presença (PRESENTE, AUSENTE, ATRASADO)
- Pagamento antecipado com pacotes e assinaturas (Asaas)
- Saldo de créditos por disciplina
- Auditoria de ações críticas

## Variáveis Asaas
- `ASAAS_API_KEY` (sandbox ou produção)
- `ASAAS_ENV` (`sandbox` ou `production`)
- `ASAAS_WEBHOOK_TOKEN` (opcional, usado para validar webhook)
