import { z } from "zod";
import { isValidDocument } from "@/lib/asaas";

const optionalText = () =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(60).optional()
  );

const normalizeTurma = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSerie = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "o")
    .replace(/\s+/g, " ")
    .trim();

const isAllowedSerie = (value: string) => {
  const normalized = normalizeSerie(value);
  return /^[1-9]\s*o?\s*ano$/.test(normalized);
};

const requiredSerieSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine(isAllowedSerie, { message: "Série não atendida pelo plantão." });

export const serieSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  requiredSerieSchema.optional()
);
export const turmaSchema = optionalText();
export const unidadeSchema = optionalText();

// Função para verificar se um pacote é elegível para a série do aluno
export function isPackageEligibleForSerie(packageName: string, studentSerie: string | null | undefined): boolean {
  if (!studentSerie) return true; // Se não tem série, mostra todos

  const normalized = normalizeSerie(studentSerie);
  const serieNumber = parseInt(normalized.match(/^(\d+)/)?.[1] ?? "0");

  if (serieNumber === 0) return true; // Série inválida, mostra todos

  const packageLower = packageName.toLowerCase();

  // Pacote específico para 1º ao 3º ano
  if (packageLower.includes("1o ao 3o") || packageLower.includes("1º ao 3º")) {
    return serieNumber >= 1 && serieNumber <= 3;
  }

  // Pacote específico para 4º ao 9º ano
  if (packageLower.includes("4o ao 9o") || packageLower.includes("4º ao 9º")) {
    return serieNumber >= 4 && serieNumber <= 9;
  }

  // Pacotes gerais sem especificação de série
  return true;
}

export function isTurmaEligible(
  eligibleTurmas: Array<"MANHA" | "TARDE"> | null | undefined,
  studentTurma: string | null | undefined
): boolean {
  if (!eligibleTurmas || eligibleTurmas.length === 0) return true;
  if (!studentTurma) return false;

  const turmaNormalized = normalizeTurma(studentTurma);
  const studentIsManha = turmaNormalized.includes("manha");
  const studentIsTarde = turmaNormalized.includes("tarde");

  return (eligibleTurmas.includes("MANHA") && studentIsManha) || (eligibleTurmas.includes("TARDE") && studentIsTarde);
}

export function isSerieEligible(
  eligibleSeries: string[] | null | undefined,
  studentSerie: string | null | undefined
): boolean {
  if (!eligibleSeries || eligibleSeries.length === 0) return true;
  if (!studentSerie) return false;

  const normalized = normalizeSerie(studentSerie);
  const serieNumber = parseInt(normalized.match(/^(\d+)/)?.[1] ?? "0", 10);
  if (serieNumber < 1 || serieNumber > 9) return false;

  return eligibleSeries.includes(String(serieNumber));
}

// Função para verificar se um pacote é elegível para a turma do aluno
export function isPackageEligibleForTurma(packageName: string, studentTurma: string | null | undefined): boolean {
  if (!studentTurma) return true; // Se não tem turma, mostra todos

  const packageNormalized = normalizeTurma(packageName);
  const turmaNormalized = normalizeTurma(studentTurma);

  const packageHasManha = packageNormalized.includes("manha");
  const packageHasTarde = packageNormalized.includes("tarde");

  // Pacote sem recorte de turma
  if (!packageHasManha && !packageHasTarde) {
    return true;
  }

  const studentIsManha = turmaNormalized.includes("manha");
  const studentIsTarde = turmaNormalized.includes("tarde");

  if (packageHasManha && !packageHasTarde) {
    return studentIsManha;
  }

  if (packageHasTarde && !packageHasManha) {
    return studentIsTarde;
  }

  // Pacote atende ambas as turmas
  return true;
}

export const sessionCreateSchema = z.object({
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().min(1),
  modality: z.enum(["PRESENCIAL", "ONLINE"]),
  priceCents: z.number().int().min(0).optional(),
  status: z.enum(["ATIVA", "CANCELADA"]).optional()
});

export const sessionUpdateSchema = sessionCreateSchema.partial().extend({
  id: z.string().min(1)
});

export const enrollSchema = z.object({
  sessionId: z.string().min(1)
});

export const unenrollSchema = z.object({
  enrollmentId: z.string().min(1)
});

export const attendanceMarkSchema = z.object({
  enrollmentId: z.string().min(1),
  status: z.enum(["PRESENTE", "AUSENTE", "ATRASADO"]),
  note: z.string().max(300).optional()
});

export const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ALUNO", "PROFESSOR", "ADMIN"]),
  serie: serieSchema,
  turma: turmaSchema,
  unidade: unidadeSchema,
  subjectIds: z.array(z.string()).optional()
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  id: z.string().min(1)
});

export const userDeleteSchema = z.object({
  id: z.string().min(1)
});

const turmaEligibilitySchema = z.array(z.enum(["MANHA", "TARDE"])).optional();
const serieEligibilitySchema = z.array(z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"])).optional();

export const subjectSchema = z.object({
  name: z.string().min(2),
  defaultPriceCents: z.number().int().min(0).optional(),
  eligibleTurmas: turmaEligibilitySchema,
  eligibleSeries: serieEligibilitySchema
});

export const subjectUpdateSchema = subjectSchema.extend({
  id: z.string().min(1)
});

export const packageSchema = z.object({
  name: z.string().min(2),
  sessionCount: z.number().int().min(1),
  priceCents: z.number().int().min(0),
  active: z.boolean().optional(),
  billingType: z.enum(["PACKAGE", "SUBSCRIPTION"]).optional(),
  billingCycle: z.enum(["MONTHLY", "WEEKLY"]).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional()
});

export const packageUpdateSchema = packageSchema.partial().extend({
  id: z.string().min(1)
});

export const paymentCheckoutSchema = z.object({
  packageId: z.string().min(1),
  billingType: z.enum(["PIX"]).optional()
});

export const profileDocumentSchema = z.object({
  document: z
    .string()
    .min(11, "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos")
    .max(18, "Documento inválido")
    .refine((doc) => isValidDocument(doc), {
      message: "CPF ou CNPJ inválido"
    })
});

export const creditAllocationSchema = z.object({
  paymentId: z.string().min(1),
  subjectId: z.string().min(1).optional()
});

export const adminCreditAdjustSchema = z.object({
  userId: z.string().min(1),
  subjectId: z.string().min(1),
  delta: z.number().int().refine((value) => value !== 0, "Delta não pode ser zero")
});

export const ticketCreateSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(5).max(1000),
  category: z.enum(["MELHORIA", "DUVIDA"]),
  studentId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional()
});

export const ticketMessageSchema = z.object({
  ticketId: z.string().min(1),
  message: z.string().min(2).max(800)
});

export const ticketStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ABERTO", "EM_ANDAMENTO", "RESOLVIDO", "FECHADO"])
});

export const onboardingStudentSchema = z.object({
  serie: requiredSerieSchema,
  turma: z.string().min(1).max(60),
  unidade: z.string().min(1).max(60)
});

export const onboardingTeacherSchema = z.object({
  subjectIds: z.array(z.string().min(1)).min(1)
});
