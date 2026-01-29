import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSubjectsClient from "@/components/AdminSubjectsClient";

const subjects = [
  { id: "s1", name: "Física", defaultPriceCents: 1200 },
  { id: "s2", name: "Química" }
];

describe("AdminSubjectsClient", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });

  it("renders subjects and formatted price", () => {
    render(<AdminSubjectsClient subjects={subjects} />);

    const item = screen.getByText(/Física/);
    expect(item).toHaveTextContent(/R\$/);
    expect(screen.getByText("Química")).toBeInTheDocument();
  });

  it("submits new subject", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;

    render(<AdminSubjectsClient subjects={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nome da disciplina"), "Biologia");
    const priceInput = screen.getByPlaceholderText("Preço");
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "2500");
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Biologia", defaultPriceCents: 2500 })
    });
  });
});
