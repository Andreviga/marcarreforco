import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";
import { signIn } from "next-auth/react";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn()
}));

describe("LoginPage", () => {
  const signInMock = signIn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows error when credentials invalid", async () => {
    signInMock.mockResolvedValue({ error: "invalid" });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText("E-mail"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(signInMock).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "user@example.com",
      password: "123"
    });

    expect(await screen.findByText("Credenciais inválidas. Tente novamente.")).toBeInTheDocument();
  });
});
