import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const TEST_TOKEN = "teste";

type CleanupAction = "OLD_CANCELED_SESSIONS" | "TEST_TEACHERS_UNUSED" | "TEST_SUBJECTS_UNUSED";

function isCleanupAction(value: string): value is CleanupAction {
  return ["OLD_CANCELED_SESSIONS", "TEST_TEACHERS_UNUSED", "TEST_SUBJECTS_UNUSED"].includes(value);
}

async function cleanupOldCanceledSessions() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 2);

  const sessions = await prisma.session.findMany({
    where: {
      status: "CANCELADA",
      startsAt: { lt: cutoff },
      attendances: { none: {} },
      invoiceItems: { none: {} }
    },
    select: { id: true }
  });

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) return { deletedSessions: 0, deletedEnrollments: 0 };

  const [enrollmentsResult, sessionsResult] = await prisma.$transaction([
    prisma.enrollment.deleteMany({ where: { sessionId: { in: sessionIds } } }),
    prisma.session.deleteMany({ where: { id: { in: sessionIds } } })
  ]);

  return {
    deletedSessions: sessionsResult.count,
    deletedEnrollments: enrollmentsResult.count
  };
}

async function cleanupTestTeachersUnused() {
  const teachers = await prisma.user.findMany({
    where: {
      role: "PROFESSOR",
      OR: [{ name: { contains: TEST_TOKEN, mode: "insensitive" } }, { email: { contains: TEST_TOKEN, mode: "insensitive" } }]
    },
    select: {
      id: true,
      _count: {
        select: {
          sessions: true,
          teacherSubjects: true,
          teacherTickets: true,
          markedAttendances: true,
          ticketMessages: true
        }
      }
    }
  });

  const deletableIds = teachers
    .filter((teacher) => Object.values(teacher._count).every((count) => count === 0))
    .map((teacher) => teacher.id);

  if (deletableIds.length === 0) return { deletedTeachers: 0 };

  const [, profilesResult, usersResult] = await prisma.$transaction([
    prisma.teacherSubject.deleteMany({ where: { teacherId: { in: deletableIds } } }),
    prisma.teacherProfile.deleteMany({ where: { userId: { in: deletableIds } } }),
    prisma.user.deleteMany({ where: { id: { in: deletableIds } } })
  ]);

  return { deletedTeachers: usersResult.count, deletedProfiles: profilesResult.count };
}

async function cleanupTestSubjectsUnused() {
  const subjects = await prisma.subject.findMany({
    where: { name: { contains: TEST_TOKEN, mode: "insensitive" } },
    select: {
      id: true,
      _count: {
        select: {
          sessions: true,
          packages: true,
          teachers: true,
          creditBalances: true,
          creditLedger: true,
          creditLots: true
        }
      }
    }
  });

  const deletableIds = subjects
    .filter((subject) => Object.values(subject._count).every((count) => count === 0))
    .map((subject) => subject.id);

  if (deletableIds.length === 0) return { deletedSubjects: 0 };

  const result = await prisma.subject.deleteMany({ where: { id: { in: deletableIds } } });
  return { deletedSubjects: result.count };
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (!action || typeof action !== "string" || !isCleanupAction(action)) {
    return NextResponse.json({ message: "Ação de limpeza inválida." }, { status: 400 });
  }

  const result =
    action === "OLD_CANCELED_SESSIONS"
      ? await cleanupOldCanceledSessions()
      : action === "TEST_TEACHERS_UNUSED"
        ? await cleanupTestTeachersUnused()
        : await cleanupTestSubjectsUnused();

  await logAudit({
    actorUserId: session.user.id,
    action: "ADMIN_CLEANUP",
    entityType: "Maintenance",
    entityId: action,
    payload: { action, result }
  });

  return NextResponse.json({ ok: true, action, result });
}
