/** @jest-environment node */

import HomePage from "@/app/page";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn()
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn()
}));

describe("HomePage", () => {
  const getServerSessionMock = getServerSession as jest.Mock;
  const redirectMock = redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw new Error("redirect");
    });
  });

  it("redirects to login when no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(HomePage()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects aluno to agenda", async () => {
    getServerSessionMock.mockResolvedValue({ user: { role: "ALUNO" } });

    await expect(HomePage()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/aluno/agenda");
  });

  it("redirects professor to sessoes", async () => {
    getServerSessionMock.mockResolvedValue({ user: { role: "PROFESSOR" } });

    await expect(HomePage()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/professor/sessoes");
  });

  it("redirects admin to admin sessoes", async () => {
    getServerSessionMock.mockResolvedValue({ user: { role: "ADMIN" } });

    await expect(HomePage()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/admin/sessoes");
  });
});
