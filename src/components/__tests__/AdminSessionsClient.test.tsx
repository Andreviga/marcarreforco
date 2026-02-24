import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSessionsClient from "@/components/AdminSessionsClient";

const subjects = [
  { id: "sub1", name: "Matemática", defaultPriceCents: 4000 },
  { id: "sub2", name: "História", defaultPriceCents: 2500 }
];

const teachers = [
  { id: "t1", name: "Ana" },
  { id: "t2", name: "Bruno" }
];

const sessions = [
  {
    id: "sess1",
    startsAt: new Date("2024-01-10T10:00:00.000Z"),
    endsAt: new Date("2024-01-10T11:00:00.000Z"),
    location: "Sala 1",
    modality: "PRESENCIAL",
    priceCents: 4000,
    status: "ATIVA",
    subject: { id: "sub1", name: "Matemática" },
    teacher: { id: "t1", name: "Ana" }
  }
];

describe("AdminSessionsClient", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });

  it("updates selected subject", async () => {
    render(<AdminSessionsClient sessions={sessions} subjects={subjects} teachers={teachers} />);

    const subjectSelect = screen.getByLabelText(/Disciplina/i) as HTMLSelectElement;

    await userEvent.selectOptions(subjectSelect, "sub2");

    expect(subjectSelect.value).toBe("sub2");
  });

  it("creates repeated sessions and cancels a session", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;

    render(<AdminSessionsClient sessions={sessions} subjects={subjects} teachers={teachers} />);

    const dateInput = screen.getByLabelText(/^Data/i) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2024-01-10" } });

    const repeatInput = screen.getByLabelText(/Repetir por \(semanas\)/i) as HTMLInputElement;
    await userEvent.clear(repeatInput);
    await userEvent.type(repeatInput, "2");
    await userEvent.click(screen.getByRole("button", { name: "Criar sessões" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/sessions",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "sess1", status: "CANCELADA" })
    });
  });
});
