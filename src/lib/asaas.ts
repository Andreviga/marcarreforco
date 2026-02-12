type AsaasRequestOptions = Omit<RequestInit, "body"> & { body?: Record<string, unknown> };

type AsaasEnvironment = "sandbox" | "production";

const ASAAS_ENV = (process.env.ASAAS_ENV as AsaasEnvironment | undefined) ?? "sandbox";
const ASAAS_BASE_URL =
  ASAAS_ENV === "production" ? "https://www.asaas.com/api/v3" : "https://sandbox.asaas.com/api/v3";

function getApiKey() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY nao configurada");
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
