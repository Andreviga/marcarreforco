const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./"
});

const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**"
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10
    }
  }
};

module.exports = createJestConfig(customJestConfig);
