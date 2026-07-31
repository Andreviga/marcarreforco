import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentPaymentsClient from "@/components/StudentPaymentsClient";

const packageItem = {
  id: "pkg-1",
  name: "Pacote Matemática",
  sessionCount: 4,
  priceCents: 12000,
  billingType: "PACKAGE" as const,
  billingCycle: null,
  subject: { id: "subject-1", name: "Matemática" }
};

const defaultProps = {
  packages: [packageItem],
  balances: [],
  subscriptions: [],
  subjects: [packageItem.subject],
  pendingCredits: [],
  pendingOneTimePayments: [],
  document: "52998224725"
};

describe("StudentPaymentsClient PIX checkout", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("shows the QR Code, copy-and-paste code and external fallback on the same page", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: "payment-1",
        paymentUrl: "https://sandbox.asaas.com/i/example",
        pix: {
          encodedImage: "aW1hZ2U=",
          payload: "000201PIX-COPIA-E-COLA",
          expirationDate: "2026-08-01T12:00:00.000Z"
        }
      })
    } as Response);

    render(<StudentPaymentsClient {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Contratar" }));

    expect(await screen.findByRole("heading", { name: "Pague com PIX" })).toBeInTheDocument();
    expect(screen.getByAltText("QR Code para pagamento via PIX")).toHaveAttribute(
      "src",
      "data:image/png;base64,aW1hZ2U="
    );
    expect(screen.getByDisplayValue("000201PIX-COPIA-E-COLA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir página segura do Asaas" })).toHaveAttribute(
      "href",
      "https://sandbox.asaas.com/i/example"
    );

    await userEvent.click(screen.getByRole("button", { name: "Copiar código PIX" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("000201PIX-COPIA-E-COLA"));
    expect(screen.getByText("Código PIX copiado.")).toBeInTheDocument();
  });

  it("keeps the Asaas page available when the inline QR Code is unavailable", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: "payment-1",
        paymentUrl: "https://www.asaas.com/i/example",
        pix: null
      })
    } as Response);

    render(<StudentPaymentsClient {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Contratar" }));

    expect(await screen.findByText("Não foi possível exibir o QR Code aqui. Use a página segura do Asaas para pagar.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir página segura do Asaas" })).toHaveAttribute(
      "href",
      "https://www.asaas.com/i/example"
    );
    expect(screen.queryByAltText("QR Code para pagamento via PIX")).not.toBeInTheDocument();
  });
});
