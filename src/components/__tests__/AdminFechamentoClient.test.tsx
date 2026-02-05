import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import AdminFechamentoClient from "@/components/AdminFechamentoClient";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  )
}));

const reports = {
  totalByStudent: [{ name: "Joana", total: 2500 }],
  totalBySubject: [{ name: "Matemática", total: 3000 }],
  totalByTeacher: [{ name: "Ana", total: 4000 }],
  totalByMonth: [{ label: "Jan/2024", total: 5500 }],
  presenceRanking: [{ name: "Carlos", count: 8 }]
};

const invoices = [
  {
    id: "inv1",
    month: 1,
    year: 2024,
    status: "ABERTA",
    totalCents: 5500,
    student: { name: "Joana" }
  }
];

const students = [{ id: "stu-1", name: "Joana" }];

const filters = {
  month: 1,
  year: 2024,
  status: "TODAS",
  studentId: "",
  page: 1,
  pageSize: 10,
  total: 1
};

describe("AdminFechamentoClient", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 1 }) });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });

  it("renders invoices and report sections", () => {
    render(
      <AdminFechamentoClient
        invoices={invoices}
        reports={reports}
        students={students}
        filters={filters}
      />
    );

    expect(screen.getAllByText("Joana").length).toBeGreaterThan(0);
    expect(screen.getByText("Matemática")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Jan/2024")).toBeInTheDocument();
    expect(screen.getByText("Carlos")).toBeInTheDocument();
  });

  it("generates invoices", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 1 }) });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;

    render(
      <AdminFechamentoClient
        invoices={invoices}
        reports={reports}
        students={students}
        filters={filters}
      />
    );

    const monthInput = screen.getByLabelText("Mês");
    const yearInput = screen.getByLabelText("Ano");

    await userEvent.clear(monthInput);
    await userEvent.type(monthInput, "2");
    await userEvent.clear(yearInput);
    await userEvent.type(yearInput, "2025");
    await userEvent.click(screen.getByRole("button", { name: "Gerar" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 2, year: 2025 })
    });
  });
});
