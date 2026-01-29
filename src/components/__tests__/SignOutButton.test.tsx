import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignOutButton from "@/components/SignOutButton";

const signOutMock = jest.fn();

jest.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args)
}));

describe("SignOutButton", () => {
  beforeEach(() => {
    signOutMock.mockClear();
  });

  it("calls signOut with callbackUrl", async () => {
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
