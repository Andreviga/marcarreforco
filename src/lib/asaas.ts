type AsaasRequestOptions = Omit<RequestInit, "body"> & { body?: Record<string, unknown> };

type AsaasEnvironment = "sandbox" | "production";

const ASAAS_ENV = (process.env.ASAAS_ENV as AsaasEnvironment | undefined) ?? "sandbox";
const ASAAS_BASE_URL =
  ASAAS_ENV === "production" ? "https://www.asaas.com/api/v3" : "https://sandbox.asaas.com/api/v3";

function getApiKey() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada");
  }
  return apiKey;
}

export async function asaasFetch<T>(path: string, options: AsaasRequestOptions = {}): Promise<T> {
  const apiKey = getApiKey();
  const response = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Asaas error (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export function normalizeDocument(document: string) {
  return document.replace(/\D/g, "");
}

export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  
  if (cleaned.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  
  if (cleaned.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleaned.charAt(12))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleaned.charAt(13))) return false;
  
  return true;
}

export function isValidDocument(document: string): boolean {
  const cleaned = document.replace(/\D/g, "");
  
  if (cleaned.length === 11) {
    return isValidCPF(cleaned);
  } else if (cleaned.length === 14) {
    return isValidCNPJ(cleaned);
  }
  
  return false;
}
