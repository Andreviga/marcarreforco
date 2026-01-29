import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttendanceClient from "@/components/AttendanceClient";

const fetchMock = jest.fn();
const consoleErrorMock = jest.spyOn(console, "error");

describe("AttendanceClient", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true });
    // @ts-expect-error - override fetch for test
    global.fetch = fetchMock;
    consoleErrorMock.mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("submits attendance with note", async () => {
    render(
      <AttendanceClient
        sessionId="ABC"
        enrollments={[
          {
            id: "e1",
            student: { id: "s1", name: "Maria" },
            status: "ATIVA",
            attendance: null
          }
        ]}
      />
    );

    await userEvent.type(screen.getByPlaceholderText("Observação"), "Chegou cedo");
    await userEvent.click(screen.getByRole("button", { name: "PRESENTE" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId: "e1", status: "PRESENTE", note: "Chegou cedo" })
    });

  });
});
