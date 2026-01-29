import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgendaClient from "@/components/AgendaClient";

const sessions = [
  {
    id: "s1",
    startsAt: new Date("2024-01-10T10:00:00.000Z"),
    endsAt: new Date("2024-01-10T11:00:00.000Z"),
    location: "Unidade Centro",
    modality: "PRESENCIAL",
    priceCents: 1500,
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
});
