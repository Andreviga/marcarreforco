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

    const subjectSelect = screen.getAllByLabelText(/Disciplina/i)[0] as HTMLSelectElement;

    await userEvent.selectOptions(subjectSelect, "sub2");

    expect(subjectSelect.value).toBe("sub2");
  });


  it("creates monthly sessions using selected professor and discipline", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;

    render(<AdminSessionsClient sessions={sessions} subjects={subjects} teachers={teachers} />);

    const disciplineSelects = screen.getAllByLabelText(/Disciplina/i);
    const teacherSelects = screen.getAllByLabelText(/Professor/i);

    await userEvent.selectOptions(disciplineSelects[1], "sub2");
    await userEvent.selectOptions(teacherSelects[1], "t2");

    await userEvent.click(screen.getByRole("button", { name: "Gerar sessões do mês" }));

    const monthlyPostCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === "/api/admin/sessions" && call[1]?.method === "POST"
    );

    expect(monthlyPostCalls.length).toBeGreaterThan(0);
    const firstPayload = JSON.parse(monthlyPostCalls[0][1].body);
    expect(firstPayload.subjectId).toBe("sub2");
    expect(firstPayload.teacherId).toBe("t2");
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
