import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgendaClient from "@/components/AgendaClient";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() })
}));

const sessions = [
  {
    id: "s1",
    startsAt: new Date("2024-01-10T10:00:00.000Z"),
    endsAt: new Date("2024-01-10T11:00:00.000Z"),
    location: "Unidade Centro",
    modality: "PRESENCIAL",
    priceCents: 1500,
    capacity: 10,
    enrolledCount: 3,
    status: "ATIVA",
    subject: { name: "Matemática" },
    teacher: { name: "Ana" }
  },
  {
    id: "s2",
    startsAt: new Date("2024-01-12T12:00:00.000Z"),
    endsAt: new Date("2024-01-12T13:00:00.000Z"),
    location: "Unidade Norte",
    modality: "ONLINE",
    priceCents: 2000,
    capacity: 10,
    enrolledCount: 0,
    status: "ATIVA",
    subject: { name: "História" },
    teacher: { name: "Bruno" }
  }
];

const enrollments: { id: string; sessionId: string; status: string }[] = [];

describe("AgendaClient", () => {
  it("filters sessions by subject and teacher", async () => {
    render(<AgendaClient sessions={sessions} enrollments={enrollments} />);

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

  it("shows remaining spots and the full badge for upcoming sessions", () => {
    const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const upcoming = [
      {
        id: "f1",
        startsAt: future(10),
        endsAt: new Date(future(10).getTime() + 60 * 60 * 1000),
        location: "Unidade Centro",
        modality: "PRESENCIAL",
        priceCents: 1500,
        capacity: 5,
        enrolledCount: 5,
        status: "ATIVA",
        subject: { name: "Física" },
        teacher: { name: "Carla" }
      },
      {
        id: "f2",
        startsAt: future(11),
        endsAt: new Date(future(11).getTime() + 60 * 60 * 1000),
        location: "Unidade Centro",
        modality: "PRESENCIAL",
        priceCents: 1500,
        capacity: 5,
        enrolledCount: 3,
        status: "ATIVA",
        subject: { name: "Química" },
        teacher: { name: "Davi" }
      }
    ];

    render(<AgendaClient sessions={upcoming} enrollments={[]} />);

    expect(screen.getByText("Sessão lotada")).toBeInTheDocument();
    expect(screen.getByText("Sem vagas")).toBeInTheDocument();
    expect(screen.getByText("2 vagas restantes")).toBeInTheDocument();
    expect(screen.getByText("Últimas 2 vagas")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Agendar" })).toHaveLength(1);
  });
});
