import { render, screen, within } from "@testing-library/react";
import StudentPaymentsClient from "@/components/StudentPaymentsClient";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() })
}));

const pkg = {
  id: "p1",
  name: "4 aulas - 4o ao 9o",
  sessionCount: 4,
  priceCents: 2700,
  billingType: "SUBSCRIPTION" as const,
  billingCycle: "MONTHLY" as const,
  subject: null
};

function renderClient(subscriptions: Array<{ id: string; status: string; nextDueDate: string | null; package: typeof pkg }>) {
  return render(
    <StudentPaymentsClient
      packages={[pkg]}
      balances={[]}
      subscriptions={subscriptions}
      subjects={[]}
      pendingCredits={[]}
      pendingOneTimePayments={[]}
      document="52998224725"
    />
  );
}

describe("StudentPaymentsClient", () => {
  it("mostra o pacote como compra única, sem prazo, com botão Comprar", () => {
    renderClient([]);

    expect(screen.getByText("Pacotes de aulas")).toBeInTheDocument();
    expect(screen.getByText(/sem prazo para usar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprar" })).toBeEnabled();
    expect(screen.queryByText("Suas assinaturas")).not.toBeInTheDocument();
    expect(screen.queryByText(/Contratar/)).not.toBeInTheDocument();
  });

  it("lista assinatura ACTIVE em 'Suas assinaturas' com botão Cancelar", () => {
    renderClient([{ id: "s1", status: "ACTIVE", nextDueDate: "2026-12-10T00:00:00.000Z", package: pkg }]);

    const heading = screen.getByText("Suas assinaturas");
    const section = heading.parentElement as HTMLElement;
    expect(within(section).getByText("Assinatura ativa")).toBeInTheDocument();
    expect(within(section).getByText(/Próxima cobrança: 10\/12\/2026/)).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    // O card do pacote continua oferecendo somente compra única.
    expect(screen.getByRole("button", { name: "Comprar" })).toBeInTheDocument();
  });
});
