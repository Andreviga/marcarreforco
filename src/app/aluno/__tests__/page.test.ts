/** @jest-environment node */

import AlunoIndexPage from "@/app/aluno/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn()
}));

describe("AlunoIndexPage", () => {
  const redirectMock = redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw new Error("redirect");
    });
  });

  it("redirects to aluno agenda", () => {
    expect(() => AlunoIndexPage()).toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/aluno/agenda");
  });
});
