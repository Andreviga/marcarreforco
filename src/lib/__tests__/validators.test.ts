/** @jest-environment node */

import { isPackageEligibleForSerie, isPackageEligibleForTurma, isTurmaEligible } from "@/lib/validators";

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


  describe("isTurmaEligible", () => {
    it("allows any turma when discipline has no eligibility restriction", () => {
      expect(isTurmaEligible([], "Manhã")).toBe(true);
      expect(isTurmaEligible(undefined, "Tarde")).toBe(true);
    });

    it("enforces discipline eligible turmas", () => {
      expect(isTurmaEligible(["MANHA"], "Manhã")).toBe(true);
      expect(isTurmaEligible(["MANHA"], "Tarde")).toBe(false);
      expect(isTurmaEligible(["TARDE"], "Tarde")).toBe(true);
    });
  });

  describe("isPackageEligibleForTurma", () => {
    it("allows generic package for any turma", () => {
      expect(isPackageEligibleForTurma("Pacote Matemática", "Manhã")).toBe(true);
      expect(isPackageEligibleForTurma("Pacote Matemática", "Tarde")).toBe(true);
    });

    it("restricts package with Manhã marker", () => {
      expect(isPackageEligibleForTurma("Pacote Matemática - Manhã", "Manhã")).toBe(true);
      expect(isPackageEligibleForTurma("Pacote Matemática - Manhã", "Tarde")).toBe(false);
    });

    it("restricts package with Tarde marker", () => {
      expect(isPackageEligibleForTurma("Pacote Português - Tarde", "Tarde")).toBe(true);
      expect(isPackageEligibleForTurma("Pacote Português - Tarde", "Manhã")).toBe(false);
    });
  });
});
