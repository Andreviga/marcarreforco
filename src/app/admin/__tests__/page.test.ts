/** @jest-environment node */

import AdminIndexPage from "@/app/admin/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn()
}));

describe("AdminIndexPage", () => {
  const redirectMock = redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw new Error("redirect");
    });
  });

  it("redirects to admin sessions", async () => {
    expect(() => AdminIndexPage()).toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/admin/sessoes");
  });
});
