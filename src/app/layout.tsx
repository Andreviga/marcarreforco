import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agendamento de Reforço",
  description: "Sistema de agendamento e pagamento antecipado de reforços"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
