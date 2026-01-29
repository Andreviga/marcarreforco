import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InscricoesClient from "@/components/InscricoesClient";

const enrollments = [
  {
    id: "e1",
    status: "AGENDADO",
    session: {
      id: "s1",
      startsAt: new Date("2024-01-10T10:00:00.000Z"),
      endsAt: new Date("2024-01-10T11:00:00.000Z"),
      subject: { name: "Matemática" },
      teacher: { name: "Ana" }
    }
  },
  {
    id: "e2",
    status: "CANCELADO",
    session: {
      id: "s2",
      startsAt: new Date("2024-01-12T10:00:00.000Z"),
      endsAt: new Date("2024-01-12T11:00:00.000Z"),
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

  it("shows unenroll button only for scheduled enrollments and submits", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;

    render(<InscricoesClient enrollments={enrollments} />);

    expect(screen.getByText("Matemática")).toBeInTheDocument();
    expect(screen.getByText("História")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desmarcar" })).toBeInTheDocument();
    expect(screen.queryByText("Desmarcando...")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Desmarcar" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/unenroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId: "e1" })
    });
  });
});
