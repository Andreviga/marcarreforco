# Configuração do Webhook Asaas

## ⚠️ IMPORTANTE: Webhook necessário para assinaturas funcionarem

As assinaturas criadas no sistema ficam com status **INACTIVE** até que o primeiro pagamento seja confirmado. Para que isso funcione automaticamente, você **PRECISA** configurar o webhook do Asaas.

## Como configurar o webhook

### 1. Acesse o painel do Asaas

- Produção: https://www.asaas.com/
- Sandbox: https://sandbox.asaas.com/

### 2. Configure o webhook

1. Vá em **Configurações** → **Webhooks** → **Adicionar webhook**
2. Preencha os campos:
   - **Nome**: Sistema de Reforço
   - **URL**: `https://seu-dominio.vercel.app/api/asaas/webhook`
   - **Eventos para notificar**:
     - ✅ PAYMENT_RECEIVED (Pagamento recebido)
     - ✅ PAYMENT_CONFIRMED (Pagamento confirmado)
     - ✅ PAYMENT_OVERDUE (Pagamento vencido)
     - ✅ PAYMENT_DELETED (Pagamento removido)
     - ✅ PAYMENT_REFUNDED (Pagamento estornado)
   - **Token de autenticação**: Copie o valor de `ASAAS_WEBHOOK_TOKEN` do seu `.env`

### 3. Teste o webhook

Após configurar, o Asaas enviará uma notificação de teste. Você pode verificar no painel se a URL respondeu corretamente (status 200).

## Como funciona

1. **Cliente compra assinatura** → Sistema cria registro com `status: INACTIVE` no banco
2. **Asaas gera cobrança** → Cliente recebe boleto/PIX para pagamento
3. **Cliente paga** → Asaas detecta pagamento e envia webhook para `/api/asaas/webhook`
4. **Webhook processa** → Sistema atualiza assinatura para `status: ACTIVE`
5. **Créditos são adicionados** → Cliente pode agendar aulas

## Webhook já implementado

O endpoint `/api/asaas/webhook` já está implementado e funcional. Ele:

- ✅ Valida o token de autenticação (`ASAAS_WEBHOOK_TOKEN`)
- ✅ Cria/atualiza pagamentos no banco
- ✅ Ativa assinaturas quando pagamento é confirmado
- ✅ Adiciona créditos automaticamente para pacotes
- ✅ Remove créditos quando pagamento é cancelado/estornado
- ✅ Registra logs de auditoria

## Variáveis de ambiente necessárias

Certifique-se que seu `.env` ou Vercel tem:

```env
# URL do Asaas (produção ou sandbox)
ASAAS_API_URL=https://api.asaas.com/v3

# Chave de API (encontre em Integrações → API)
ASAAS_API_KEY=sua_chave_api_aqui

# Token para validar webhooks (crie um token seguro)
ASAAS_WEBHOOK_TOKEN=seu_token_webhook_aqui
```

## Como criar um token seguro

No terminal, gere um token aleatório:

```bash
# PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Linux/Mac
openssl rand -base64 32
```

Copie o resultado e use em `ASAAS_WEBHOOK_TOKEN`.

## Verificando se funciona

1. Crie uma assinatura de teste
2. Vá no painel do Asaas e marque o pagamento como "recebido"
3. Verifique no banco de dados se:
   - A tabela `AsaasSubscription` tem registro com `status = ACTIVE`
   - A tabela `StudentCreditLedger` tem créditos adicionados
   - A tabela `AuditLog` tem registro "PAYMENT_CREDIT"

## Problemas comuns

### Assinatura não ativa após pagamento
- ✅ Verifique se o webhook está configurado no Asaas
- ✅ Verifique se a URL do webhook está correta (`/api/asaas/webhook`)
- ✅ Verifique se `ASAAS_WEBHOOK_TOKEN` está definido e é o mesmo no Asaas
- ✅ Veja os logs do webhook no painel do Asaas (status 401 = token incorreto)

### Webhook retorna erro 401
- O token configurado no Asaas é diferente do `ASAAS_WEBHOOK_TOKEN` no `.env`
- Atualize um dos dois para ficarem iguais

### Webhook retorna erro 500
- Verifique os logs da aplicação no Vercel
- Pode ser erro de conexão com banco ou dados inválidos

## Suporte

Para mais informações sobre webhooks do Asaas:
https://docs.asaas.com/reference/webhooks
