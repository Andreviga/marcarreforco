import { render, screen, waitFor } from "@testing-library/react";
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

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "user@example.com");
    await user.type(screen.getByLabelText("Senha"), "123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(signInMock).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "user@example.com",
      password: "123"
    });

    await waitFor(() => {
      expect(screen.getByText("Credenciais inválidas. Tente novamente.")).toBeInTheDocument();
    });
  }, 10000);
});
