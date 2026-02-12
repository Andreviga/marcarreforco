import { Agent } from "undici";
import { readFile } from "fs/promises";

type InterRequestOptions = Omit<RequestInit, "body"> & { body?: Record<string, unknown> };

type TokenCache = { token: string; expiresAt: number } | null;

const DEFAULT_BASE_URL = "https://cdpj.partners.bancointer.com.br";
const DEFAULT_SCOPES = [
  "cob.write",
  "cob.read",
  "pix.read",
  "pix.write",
  "webhook.read",
  "webhook.write"
].join(" ");

let tokenCache: TokenCache = null;
let agentCache: Agent | null = null;

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} nao configurada`);
  }
  return value;
}

function getBaseUrl() {
  return process.env.INTER_BASE_URL ?? DEFAULT_BASE_URL;
}

async function getAgent() {
  if (agentCache) return agentCache;

  const certBase64 = process.env.INTER_CERT_BASE64;
  const keyBase64 = process.env.INTER_KEY_BASE64;
  const certPath = process.env.INTER_CERT_PATH;
  const keyPath = process.env.INTER_KEY_PATH;

  const cert = certBase64
    ? Buffer.from(certBase64, "base64")
    : certPath
      ? await readFile(certPath)
      : null;
  const key = keyBase64
    ? Buffer.from(keyBase64, "base64")
    : keyPath
      ? await readFile(keyPath)
      : null;

  if (!cert || !key) {
    throw new Error("INTER_CERT_BASE64/INTER_CERT_PATH e INTER_KEY_BASE64/INTER_KEY_PATH sao obrigatorios");
  }

  agentCache = new Agent({
    connect: {
      cert,
      key,
      rejectUnauthorized: true
    }
  });

  return agentCache;
}

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }

  const clientId = getEnv("INTER_CLIENT_ID");
  const clientSecret = getEnv("INTER_CLIENT_SECRET");
  const agent = await getAgent();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: process.env.INTER_SCOPES ?? DEFAULT_SCOPES
  }).toString();

  const response = await fetch(`${getBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    dispatcher: agent
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Inter auth error (${response.status}): ${message}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  const expiresIn = (data.expires_in ?? 3600) * 1000;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresIn
  };

  return data.access_token;
}

export async function interFetch<T>(path: string, options: InterRequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  const agent = await getAgent();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    dispatcher: agent
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Inter error (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export function normalizeDocument(document: string) {
  return document.replace(/\D/g, "");
}

export async function createPixCob(params: {
  amountCents: number;
  payerName: string;
  payerDocument: string;
  description: string;
}) {
  const pixKey = getEnv("INTER_PIX_KEY");
  const expiresIn = Number(process.env.INTER_PIX_EXPIRES_IN ?? 3600);
  const document = normalizeDocument(params.payerDocument);
  const devedor = document.length === 14 ? { cnpj: document, nome: params.payerName } : { cpf: document, nome: params.payerName };

  const cob = await interFetch<{
    txid: string;
    loc?: { id: number };
    pixCopiaECola?: string;
  }>("/pix/v2/cob", {
    method: "POST",
    body: {
      calendario: { expiracao: expiresIn },
      devedor,
      valor: { original: (params.amountCents / 100).toFixed(2) },
      chave: pixKey,
      solicitacaoPagador: params.description
    }
  });

  let qrCodeImage: string | null = null;
  let pixCopyPaste = cob.pixCopiaECola ?? null;

  if (cob.loc?.id) {
    const qr = await interFetch<{ imagemQrcode?: string; qrcode?: string }>(`/pix/v2/loc/${cob.loc.id}/qrcode`, {
      method: "GET"
    });
    qrCodeImage = qr.imagemQrcode ?? null;
    pixCopyPaste = pixCopyPaste ?? qr.qrcode ?? null;
  }

  return {
    txid: cob.txid,
    pixCopyPaste,
    qrCodeImage,
    expiresIn
  };
}
