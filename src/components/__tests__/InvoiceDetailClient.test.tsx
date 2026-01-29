import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvoiceDetailClient from "@/components/InvoiceDetailClient";

const invoice = {
  id: "inv1",
  month: 1,
  year: 2024,
  status: "PENDENTE",
  totalCents: 3000,
  student: { name: "Clara", email: "clara@example.com" },
  items: [
    {
      id: "it1",
      description: "Aula 1",
      occurredAt: new Date("2024-01-10T10:00:00.000Z"),
      amountCents: 1500,
      attendance: { status: "PRESENTE" },
      session: { subject: { name: "Matemática" }, teacher: { name: "Ana" } }
    }
  ]
};

describe("InvoiceDetailClient", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });

  it("renders invoice details and updates status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;

    render(<InvoiceDetailClient invoice={invoice} />);

    expect(screen.getByText("Clara")).toBeInTheDocument();
    expect(screen.getByText("clara@example.com")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
    expect(screen.getByText("Aula 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Marcar como paga" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "inv1", status: "PAGA" })
    });
  });
});
