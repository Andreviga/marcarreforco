import { z } from "zod";

const optionalText = () =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(60).optional()
  );

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
  .refine(isAllowedSerie, { message: "Serie nao atendida pelo plantao." });

export const serieSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  requiredSerieSchema.optional()
);
export const turmaSchema = optionalText();
export const unidadeSchema = optionalText();

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

export const subjectSchema = z.object({
  name: z.string().min(2),
  defaultPriceCents: z.number().int().min(0).optional()
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
  billingCycle: z.enum(["MONTHLY", "WEEKLY"]).optional(),
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
  document: z.string().min(11).max(18)
});

export const creditAllocationSchema = z.object({
  paymentId: z.string().min(1),
  subjectId: z.string().min(1)
});

export const adminCreditAdjustSchema = z.object({
  userId: z.string().min(1),
  subjectId: z.string().min(1),
  amount: z.number().int().min(1)
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
