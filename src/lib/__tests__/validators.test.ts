/** @jest-environment node */

import { isPackageEligibleForSerie, isSerieEligible } from "@/lib/validators";

describe("validators package eligibility", () => {
  describe("isPackageEligibleForSerie", () => {
    it("matches package range for 1o ao 3o", () => {
      expect(isPackageEligibleForSerie("Pacote 1º ao 3º", "2º ano")).toBe(true);
      expect(isPackageEligibleForSerie("Pacote 1º ao 3º", "5º ano")).toBe(false);
    });

    it("matches package range for 4o ao 9o", () => {
      expect(isPackageEligibleForSerie("Pacote 4o ao 9o", "7º ano")).toBe(true);
      expect(isPackageEligibleForSerie("Pacote 4o ao 9o", "2º ano")).toBe(false);
    });
  });

  describe("isSerieEligible", () => {
    it("allows any serie when discipline has no eligibility restriction", () => {
      expect(isSerieEligible([], "1º ano")).toBe(true);
      expect(isSerieEligible(undefined, "9º ano")).toBe(true);
    });

    it("enforces discipline eligible series", () => {
      expect(isSerieEligible(["1", "2", "3"], "2º ano")).toBe(true);
      expect(isSerieEligible(["1", "2", "3"], "5º ano")).toBe(false);
      expect(isSerieEligible(["7", "8", "9"], "8º ano")).toBe(true);
    });
  });
});
