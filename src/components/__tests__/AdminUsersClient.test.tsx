import { render, screen } from "@testing-library/react";
import AdminUsersClient from "@/components/AdminUsersClient";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() })
}));

const users = [
  {
    id: "u1",
    name: "Joana",
    email: "joana@example.com",
    role: "ADMIN",
    createdAt: "2024-01-01T00:00:00.000Z"
  },
  {
    id: "u2",
    name: "Rafael",
    email: "rafael@example.com",
    role: "PROFESSOR",
    createdAt: "2024-01-02T00:00:00.000Z"
  }
];

describe("AdminUsersClient", () => {
  it("renders users list", () => {
    render(<AdminUsersClient users={users} subjects={[]} />);

    expect(screen.getByText("Joana")).toBeInTheDocument();
    expect(screen.getByText(/rafael@example.com/i)).toBeInTheDocument();
  });
});
