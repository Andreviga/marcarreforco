// Limitador de tentativas em memória (janela deslizante) para rotas de
// autenticação. Em serverless cada instância tem seu próprio contador, então
// isto é mitigação de melhor esforço, não garantia — mas encarece muito a
// força bruta simples sem custo de infraestrutura.
const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const entries = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);
  if (entries.length >= limit) {
    buckets.set(key, entries);
    return false;
  }
  entries.push(now);
  buckets.set(key, entries);
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      if (!v.some((ts) => ts > cutoff)) buckets.delete(k);
      if (buckets.size <= MAX_BUCKETS / 2) break;
    }
  }
  return true;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
