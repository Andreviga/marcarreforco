import AdminFaturaDetailPage from "@/app/admin/faturas/[id]/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn()
}));

describe("AdminFaturaDetailPage", () => {
  const redirectMock = redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to pagamentos", async () => {
    await AdminFaturaDetailPage({ params: { id: "inv1" } });

    expect(redirectMock).toHaveBeenCalledWith("/admin/pagamentos");
  });
});
