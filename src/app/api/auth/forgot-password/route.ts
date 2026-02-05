import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";

const requestSchema = z.object({
  email: z.string().email()
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ message: "Se existir uma conta, enviaremos o e-mail." });
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() }
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetLink = `${baseUrl}/login/reset?token=${rawToken}`;

  const html = `
    <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
              <tr>
                <td style="padding:24px 28px 8px 28px;">
                  <div style="display:inline-block;background:#ecfdf3;color:#047857;font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;">REDEFINICAO DE SENHA</div>
                  <h1 style="margin:16px 0 8px 0;font-size:22px;line-height:1.3;">Ola, ${user.name}!</h1>
                  <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                    Recebemos sua solicitacao para redefinir a senha. Clique no botao abaixo para criar uma nova senha.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:8px 28px 20px 28px;">
                  <a href="${resetLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">
                    Criar nova senha
                  </a>
                  <p style="margin:12px 0 0 0;font-size:12px;color:#64748b;">Este link expira em 1 hora.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 24px 28px;">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                    Se voce nao solicitou este e-mail, ignore esta mensagem.
                  </p>
                  <p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:#94a3b8;word-break:break-all;">
                    Se o botao nao funcionar, copie e cole este link no navegador:<br />
                    <span style="color:#475569;">${resetLink}</span>
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0 0;font-size:11px;color:#94a3b8;">Colégio Raizes - Reforco Escolar</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: "Redefinicao de senha",
      html
    });
  } catch (error) {
    return NextResponse.json({ message: "Falha ao enviar e-mail" }, { status: 500 });
  }

  return NextResponse.json({ message: "Se existir uma conta, enviaremos o e-mail." });
}
