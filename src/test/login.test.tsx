import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const login = vi.fn();
const logout = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ login, logout }),
}));

describe("role-specific login", () => {
  beforeEach(() => {
    login.mockReset();
    logout.mockReset();
    replace.mockReset();
  });

  it("validates email and password before calling the API", async () => {
    const user = userEvent.setup();
    render(<LoginForm audience="staff" />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Enter a valid work email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("routes staff users to the staff dashboard", async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce({ user: { role: "agent" } });
    render(<LoginForm audience="staff" />);
    await user.type(screen.getByLabelText(/work email/i), "agent@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff"));
  });

  it("routes admins to the admin dashboard and rejects staff accounts there", async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce({ user: { role: "admin" } });
    const { rerender } = render(<LoginForm audience="admin" />);
    await user.type(screen.getByLabelText(/work email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in to control/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));

    replace.mockReset();
    login.mockResolvedValueOnce({ user: { role: "agent" } });
    rerender(<LoginForm audience="admin" />);
    await user.click(screen.getByRole("button", { name: /sign in to control/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not an administrator");
  });
});
