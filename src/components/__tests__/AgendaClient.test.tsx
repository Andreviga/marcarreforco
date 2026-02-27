import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgendaClient from "@/components/AgendaClient";

const now = Date.now();

const sessions = [
  {
    id: "s1",
    startsAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
    endsAt: new Date(now + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    location: "Unidade Centro",
    modality: "PRESENCIAL",
    priceCents: 1500,
    status: "ATIVA",
    subject: { name: "Matemática" },
    teacher: { name: "Ana" }
  },
  {
    id: "s2",
    startsAt: new Date(now + 24 * 60 * 60 * 1000),
    endsAt: new Date(now + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    location: "Unidade Norte",
    modality: "ONLINE",
    priceCents: 2000,
    status: "ATIVA",
    subject: { name: "História" },
    teacher: { name: "Bruno" }
  }
];

const enrollments: { id: string; sessionId: string; status: string }[] = [
  { id: "e1", sessionId: "s1", status: "AGENDADO" },
  { id: "e2", sessionId: "s2", status: "AGENDADO" }
];


describe("AgendaClient", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });
  it("filters sessions by subject and teacher", async () => {
    render(<AgendaClient sessions={sessions} enrollments={[]} />);

    expect(screen.getByText("Matemática")).toBeInTheDocument();
    expect(screen.getByText("História")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Disciplina"), "mate");

    expect(screen.getByText("Matemática")).toBeInTheDocument();
    expect(screen.queryByText("História")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText("Disciplina"));
    await userEvent.type(screen.getByPlaceholderText("Professor"), "bruno");

    expect(screen.queryByText("Matemática")).not.toBeInTheDocument();
    expect(screen.getByText("História")).toBeInTheDocument();
  });

  it("allows cancel in agenda only when more than 48h", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error test override
    global.fetch = fetchMock;

    render(<AgendaClient sessions={sessions} enrollments={enrollments} />);

    const cancelButtons = screen.getAllByRole("button", { name: "Desmarcar" }) as HTMLButtonElement[];

    expect(cancelButtons[0]).toBeEnabled();
    expect(cancelButtons[1]).toBeDisabled();
    expect(screen.getByText(/você pode desmarcar até 48h antes da aula/i)).toBeInTheDocument();
    expect(screen.getByText(/prazo de desmarcação encerrado/i)).toBeInTheDocument();

    await userEvent.click(cancelButtons[0]);

    expect(fetchMock).toHaveBeenCalledWith("/api/unenroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId: "e1" })
    });
  });
});
