import { z } from "zod";

const serieOptions = [
  "1º ano",
  "2º ano",
  "3º ano",
  "4º ano",
  "5º ano",
  "6º ano",
  "7º ano",
  "8º ano",
  "9º ano",
  "1ª série",
  "2ª série",
  "3ª série"
] as const;

const turmaOptions = ["Manhã", "Tarde"] as const;
const unidadeOptions = ["Colégio Raízes"] as const;

const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(values).optional()
  );

export const serieSchema = optionalEnum(serieOptions);
export const turmaSchema = optionalEnum(turmaOptions);
export const unidadeSchema = optionalEnum(unidadeOptions);

export const sessionCreateSchema = z.object({
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().min(1),
  modality: z.enum(["PRESENCIAL", "ONLINE"]),
  priceCents: z.number().int().min(0),
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
  active: z.boolean().optional()
});

export const packageUpdateSchema = packageSchema.partial().extend({
  id: z.string().min(1)
});

export const invoiceGenerateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100)
});
