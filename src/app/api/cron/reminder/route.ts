import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";

// Called daily (e.g. via Vercel Cron or an external scheduler).
// Secured by CRON_SECRET env var — pass as Authorization: Bearer <secret>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Test mode: GET /api/cron/reminder?test=1
  // Sends a sample email to contato@raizesedu.com.br without requiring real sessions.
  const { searchParams } = new URL(request.url);
  if (searchParams.get("test") === "1") {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Teste de Lembrete</title></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:0">
  <div style="max-width:540px;margin:32px auto;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden">
    <div style="background:#4f46e5;padding:24px 28px">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">✅ Lembrete — Teste de Envio</h1>
    </div>
    <div style="padding:24px 28px">
      <p style="color:#334155;font-size:14px;margin:0 0 16px">Este é um e-mail de <strong>teste</strong> do sistema de lembretes do Marcar Reforço.</p>
      <p style="color:#334155;font-size:14px;margin:0 0 20px">Se você recebeu este e-mail, a configuração está funcionando corretamente. Os professores e admins receberão lembretes como este um dia antes de cada sessão com alunos agendados.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
        <tr><td style="padding:6px 0;color:#64748b;width:120px">Disciplina</td><td style="padding:6px 0;font-weight:600;color:#1e293b">Matemática (exemplo)</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Data</td><td style="padding:6px 0;color:#1e293b">amanhã, 18/03/2026</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Horário</td><td style="padding:6px 0;color:#1e293b">09:00 – 10:00</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Local</td><td style="padding:6px 0;color:#1e293b">Unidade Central</td></tr>
      </table>
      <p style="color:#334155;font-size:14px;margin:0 0 10px"><strong>1 aluno agendado (exemplo):</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">Nome</th>
            <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">E-mail</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">Aluno Exemplo</td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">aluno@exemplo.com</td></tr>
        </tbody>
      </table>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px">
      Este é um lembrete automático do sistema Marcar Reforço.
    </div>
  </div>
</body>
</html>`;
    try {
      await sendEmail({ to: "contato@raizesedu.com.br", subject: "✅ Teste — Lembrete de sessão Marcar Reforço", html });
      return NextResponse.json({ ok: true, message: "E-mail de teste enviado para contato@raizesedu.com.br" });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }

  // Tomorrow window (America/Sao_Paulo → just use UTC day boundaries that cover tomorrow in Brazil)
  const nowUtc = new Date();
  const tomorrowStart = new Date(nowUtc);
  tomorrowStart.setUTCHours(0, 0, 0, 0);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 1);

  // Sessions starting tomorrow that have at least one AGENDADO enrollment
  const sessions = await prisma.session.findMany({
    where: {
      startsAt: { gte: tomorrowStart, lt: tomorrowEnd },
      status: { not: "CANCELADA" },
      enrollments: { some: { status: "AGENDADO" } }
    },
    include: {
      subject: true,
      teacher: { select: { id: true, name: true, email: true } },
      enrollments: {
        where: { status: "AGENDADO" },
        include: { student: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { startsAt: "asc" }
  });

  if (sessions.length === 0) {
    return NextResponse.json({ sent: 0, message: "Nenhuma sessão para amanhã com alunos agendados." });
  }

  // Admin emails
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true, name: true }
  });

  const results: { sessionId: string; recipients: string[]; ok: boolean }[] = [];

  for (const sess of sessions) {
    const startsAtLabel = sess.startsAt.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo"
    });
    const startTimeLabel = sess.startsAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    });
    const endTimeLabel = sess.endsAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    });

    const studentRows = sess.enrollments
      .map(
        (enr) =>
          `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">${enr.student.name}</td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${enr.student.email}</td></tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Lembrete de Sessão</title></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:0">
  <div style="max-width:540px;margin:32px auto;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden">
    <div style="background:#4f46e5;padding:24px 28px">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Lembrete — Sessão amanhã</h1>
    </div>
    <div style="padding:24px 28px">
      <p style="color:#334155;font-size:14px;margin:0 0 16px">Olá, ${sess.teacher.name}!</p>
      <p style="color:#334155;font-size:14px;margin:0 0 20px">Você tem uma sessão de reforço agendada para <strong>amanhã</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
        <tr><td style="padding:6px 0;color:#64748b;width:120px">Disciplina</td><td style="padding:6px 0;font-weight:600;color:#1e293b">${sess.subject.name}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Data</td><td style="padding:6px 0;color:#1e293b">${startsAtLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Horário</td><td style="padding:6px 0;color:#1e293b">${startTimeLabel} – ${endTimeLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Local</td><td style="padding:6px 0;color:#1e293b">${sess.modality === "ONLINE" ? "Online" : sess.location}</td></tr>
      </table>
      <p style="color:#334155;font-size:14px;margin:0 0 10px"><strong>${sess.enrollments.length} aluno${sess.enrollments.length > 1 ? "s" : ""} agendado${sess.enrollments.length > 1 ? "s" : ""}:</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">Nome</th>
            <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">E-mail</th>
          </tr>
        </thead>
        <tbody>${studentRows}</tbody>
      </table>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px">
      Este é um lembrete automático do sistema Marcar Reforço.
    </div>
  </div>
</body>
</html>`;

    const recipients: string[] = [];
    if (sess.teacher.email) recipients.push(sess.teacher.email);
    for (const admin of admins) {
      if (admin.email && !recipients.includes(admin.email)) {
        recipients.push(admin.email);
      }
    }

    let ok = true;
    for (const to of recipients) {
      try {
        await sendEmail({
          to,
          subject: `Lembrete: sessão de ${sess.subject.name} amanhã (${startTimeLabel})`,
          html
        });
      } catch {
        ok = false;
      }
    }

    results.push({ sessionId: sess.id, recipients, ok });
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent, total: sessions.length, results });
}
