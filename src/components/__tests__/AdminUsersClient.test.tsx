import { render, screen } from "@testing-library/react";
import AdminUsersClient from "@/components/AdminUsersClient";

const users = [
  {
    id: "u1",
    name: "Joana",
    email: "joana@example.com",
    role: "ADMIN"
  },
  {
    id: "u2",
    name: "Rafael",
    email: "rafael@example.com",
    role: "PROFESSOR"
  }
];

describe("AdminUsersClient", () => {
  it("renders users list", () => {
    render(<AdminUsersClient users={users} subjects={[]} />);

    expect(screen.getByText("Joana")).toBeInTheDocument();
    expect(screen.getByText(/rafael@example.com/i)).toBeInTheDocument();
  });
});
