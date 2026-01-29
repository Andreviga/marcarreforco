/** @jest-environment node */

import ProfessorIndexPage from "@/app/professor/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn()
}));

describe("ProfessorIndexPage", () => {
  const redirectMock = redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw new Error("redirect");
    });
  });

  it("redirects to professor sessions", () => {
    expect(() => ProfessorIndexPage()).toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/professor/sessoes");
  });
});
