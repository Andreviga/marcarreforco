import { formatCurrency } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats cents into BRL currency", () => {
    expect(formatCurrency(12345)).toBe("R$ 123,45");
    expect(formatCurrency(0)).toBe("R$ 0,00");
  });
});
