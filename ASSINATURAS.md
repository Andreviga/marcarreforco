# Pacotes de Aulas e Créditos

## Modelo atual (vigente)

- Todos os pacotes são **compra única via PIX**, definidos por **quantidade de aulas** (ex.: 4, 8, 12, 16, 20 aulas) — não existe mais assinatura mensal nem "N dias por semana".
- **Os créditos não expiram.** O aluno usa as aulas quando quiser. A coluna `StudentCreditLot.expiresAt` continua no banco (obrigatória), mas recebe `2099-12-31` e é ignorada por todas as consultas; os lotes são consumidos por ordem de criação (FIFO).
- Lotes que já tinham vencido e ainda tinham saldo foram reativados pela migração `20261104120000_one_time_packages_no_expiry`.
- O checkout (`POST /api/payments/checkout`) sempre gera uma cobrança única. Pacotes antigos do tipo assinatura foram convertidos em pacotes comuns pela migração.
- **Assinaturas já existentes no Asaas não foram canceladas**: continuam cobrando até o aluno cancelar em *Pagamentos → Suas assinaturas*, e cada cobrança paga continua creditando aulas (agora sem validade). O webhook e `/api/subscriptions/[id]` permanecem para isso.
- Tabela de preços (seed): 1º ao 3º — 4 aulas R$ 22, 8 aulas R$ 39, 20 aulas R$ 89 (pacote especial), avulso R$ 7; 4º ao 9º — 4 aulas R$ 27, 8 aulas R$ 48, 12 aulas R$ 66, 16 aulas R$ 81, 20 aulas R$ 95, avulso R$ 9.

> O restante deste documento descreve o **modelo antigo (legado)** de assinatura mensal com validade de 30 dias e é mantido apenas como referência histórica.

---

# Sistema de Assinaturas e Créditos

## 📌 Visão Geral

O sistema trabalha com **assinaturas mensais** que concedem créditos de aulas com **expiração automática de 30 dias**.

---

## 🔄 Fluxos Completos

### 1️⃣ Assinatura Paga com Sucesso

```
┌─────────────────────────────────────────────────┐
│ 1. Aluno clica "Contratar" no pacote mensal    │
│    Ex: "4 aulas/mês - R$ 27,00"                │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Sistema cria assinatura no Asaas             │
│    Status: INACTIVE (aguardando pagamento)      │
│    Aparece: "Aguardando pagamento" (amarelo)    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Aluno paga PIX/Boleto                        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Webhook processa pagamento                   │
│    Status: INACTIVE → ACTIVE                    │
│    Aparece: "Assinatura ativa" (verde)          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. Sistema adiciona 4 créditos                  │
│    Validade: 30 dias a partir do pagamento      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 6. Aluno usa (ou não) as 4 aulas               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 7. Após 30 dias: CRÉDITOS EXPIRAM               │
│    (Automaticamente removidos do saldo)         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 8. Próximo mês: Nova cobrança automática        │
│    Se pagar → +4 créditos novos (30 dias)       │
│    Se NÃO pagar → Status vira OVERDUE           │
└─────────────────────────────────────────────────┘
```

---

### 2️⃣ Assinatura Criada mas NÃO Paga

```
┌─────────────────────────────────────────────────┐
│ 1. Aluno clica "Contratar"                      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Assinatura criada (INACTIVE)                 │
│    Aparece: "Aguardando pagamento" (amarelo)    │
│    Botão: "Cancelar" disponível                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3A. Aluno cancela manualmente                   │
│     Status: INACTIVE → CANCELED                 │
│     Resultado: Assinatura some, pode contratar  │
│               novamente                          │
└─────────────────────────────────────────────────┘
                    OU
┌─────────────────────────────────────────────────┐
│ 3B. Pagamento vence sem ser pago                │
│     Asaas muda status para OVERDUE              │
│     Webhook processa: Status → OVERDUE          │
│     Resultado: Assinatura some, pode contratar  │
│               novamente                          │
└─────────────────────────────────────────────────┘
```

---

### 3️⃣ Cancelamento de Assinatura Ativa

```
┌─────────────────────────────────────────────────┐
│ 1. Aluno tem assinatura ACTIVE                  │
│    Aparece: "Assinatura ativa" (verde)          │
│    + Botão "Cancelar"                           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Aluno clica "Cancelar"                       │
│    Confirma: "Tem certeza?"                     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Sistema cancela no Asaas                     │
│    Status: ACTIVE → CANCELED                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Mensagem: "Assinatura cancelada!"            │
│    Aguarda 2 segundos e recarrega página        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. Assinatura some da lista                     │
│    Botão "Contratar" aparece novamente          │
│    ✅ PODE CONTRATAR DE NOVO!                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 6. Créditos já concedidos NÃO são removidos     │
│    (Continuam valendo até expirar em 30 dias)   │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Estados da Assinatura

| Status | Badge | Botão Disponível | Pode Contratar? |
|--------|-------|------------------|-----------------|
| **ACTIVE** | 🟢 Verde "Assinatura ativa" | Cancelar | ❌ Não |
| **INACTIVE** | 🟡 Amarelo "Aguardando pagamento" | Cancelar | ❌ Não |
| **CANCELED** | (não aparece) | Contratar | ✅ Sim |
| **OVERDUE** | (não aparece) | Contratar | ✅ Sim |
| **Sem assinatura** | - | Contratar | ✅ Sim |

---

## ⏰ Expiração de Créditos

### Como funciona:

1. **Créditos ganham validade de 30 dias** ao serem adicionados
2. **Expiração é automática** - o sistema filtra créditos expirados nas consultas
3. **Não há notificação** - simplesmente somem do saldo
4. **Regra FIFO**: créditos mais antigos são usados primeiro

### Exemplo prático:

```
Dia 01/03: Paga assinatura → Ganha 4 créditos (expiram 31/03)
Dia 15/03: Usa 2 aulas → Sobram 2 créditos
Dia 01/04: Nova cobrança → Ganha +4 créditos (expiram 01/05)
            Total: 6 créditos (2 antigos + 4 novos)
Dia 01/04: Créditos antigos expiram → Sobram 4 créditos
```

---

## 🔧 Lógica Técnica

### Frontend (StudentPaymentsClient.tsx)

```typescript
// Filtra apenas assinaturas ATIVAS ou PENDENTES
const subscriptionMap = useMemo(() => {
  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === "ACTIVE" || sub.status === "INACTIVE"
  );
  return new Map(activeSubscriptions.map((sub) => [sub.package.id, sub]));
}, [subscriptions]);

// Se tem assinatura ativa/pendente → mostra badge + botão cancelar
// Se NÃO tem (CANCELED/OVERDUE/null) → mostra botão "Contratar"
```

### Backend (Webhook do Asaas)

```typescript
// Quando paga o primeiro pagamento da assinatura
if (payload.payment?.subscription && paymentStatus === "CONFIRMED") {
  await prisma.asaasSubscription.updateMany({
    where: { asaasId: payload.payment.subscription },
    data: { status: "ACTIVE" }
  });
  
  // Adiciona créditos com expiração de 30 dias
  await addPaymentCredits({
    studentId: payment.userId,
    subjectId: payment.package.subjectId,
    amount: payment.package.sessionCount,
    paymentId: payment.id,
    paidAt: payment.paidAt // Base para calcular expiração
  });
}
```

### Expiração de Créditos (credits.ts)

```typescript
const CREDIT_TTL_DAYS = 30;

function getExpiryDate(base?: Date) {
  return addDays(base ?? new Date(), CREDIT_TTL_DAYS);
}

// Ao buscar saldo, filtra automaticamente créditos expirados
where: {
  expiresAt: { gt: now } // Só créditos válidos
}
```

---

## ✅ Checklist de Funcionalidades

- [x] Criar assinatura (INACTIVE)
- [x] Ativar assinatura após pagamento (ACTIVE)
- [x] Cancelar assinatura ativa (CANCELED)
- [x] Cancelar assinatura pendente (CANCELED)
- [x] Permitir contratar novamente após cancelamento
- [x] Expiração automática de créditos (30 dias)
- [x] Cobrança recorrente mensal (Asaas)
- [x] Webhook processa pagamentos
- [x] FIFO: créditos mais antigos usados primeiro
- [x] Status OVERDUE para pagamentos vencidos
- [ ] Notificação de créditos próximos a expirar (futuro)
- [ ] Relatório de créditos expirados (futuro)

---

## 🐛 Casos de Borda

### O que acontece se:

**1. Aluno cancela mas tem créditos?**
- ✅ Créditos continuam válidos até expirar (30 dias)
- ❌ Não recebe novos créditos no próximo mês

**2. Aluno tem 2 assinaturas do mesmo pacote?**
- ❌ Não pode ter (frontend bloqueia botão "Contratar")
- ✅ Precisa cancelar a atual para contratar novamente

**3. Pagamento atrasa?**
- ⏰ Asaas muda status para OVERDUE
- ❌ Não adiciona créditos
- ✅ Assinatura continua tentando cobrar
- 💡 Aluno pode cancelar e contratar novamente

**4. Aluno paga depois de vencido?**
- ✅ Webhook processa normalmente
- ✅ Status volta para ACTIVE
- ✅ Créditos são adicionados

---

## 📝 Resumo para o Usuário

**Quando você contrata uma assinatura:**
1. ✅ Pode cancelar a qualquer momento (antes ou depois de pagar)
2. ✅ Se cancelar, pode contratar novamente depois
3. ✅ Créditos duram 30 dias desde o pagamento
4. ✅ Cada mês pago = créditos novos (30 dias de validade)
5. ✅ Se não pagar, assinatura fica OVERDUE e você pode cancelar/recontratar

**A lógica está correta agora!** 🎉
