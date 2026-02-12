import AdminFechamentoPage from "@/app/admin/fechamento/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn()
}));

describe("AdminFechamentoPage", () => {
  const redirectMock = redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to pagamentos", async () => {
    await AdminFechamentoPage();

    expect(redirectMock).toHaveBeenCalledWith("/admin/pagamentos");
  });
});
