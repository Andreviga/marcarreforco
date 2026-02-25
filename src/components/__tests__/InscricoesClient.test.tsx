import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InscricoesClient from "@/components/InscricoesClient";

const now = Date.now();

const enrollments = [
  {
    id: "e1",
    status: "AGENDADO",
    session: {
      id: "s1",
      startsAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      subject: { name: "Matemática" },
      teacher: { name: "Ana" }
    }
  },
  {
    id: "e2",
    status: "AGENDADO",
    session: {
      id: "s2",
      startsAt: new Date(now + 24 * 60 * 60 * 1000),
      endsAt: new Date(now + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      subject: { name: "História" },
      teacher: { name: "Bruno" }
    }
  }
];

describe("InscricoesClient", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });

  it("shows cancel rules and only allows click when more than 48h", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;

    render(<InscricoesClient enrollments={enrollments} />);

    const buttons = screen.getAllByRole("button", { name: "Desmarcar" }) as HTMLButtonElement[];

    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();
    expect(screen.getByText(/Desmarcação permitida apenas até 48h antes da aula/i)).toBeInTheDocument();

    await userEvent.click(buttons[0]);

    expect(fetchMock).toHaveBeenCalledWith("/api/unenroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId: "e1" })
    });
  });
});
