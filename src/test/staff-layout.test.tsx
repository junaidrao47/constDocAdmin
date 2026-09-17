import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffLayout from "@/app/(staff)/layout";

const replace = vi.fn();
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/documents",
  useRouter: () => ({ replace }),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth,
}));

describe("staff route protection", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("redirects unauthenticated users to login", () => {
    useAuth.mockReturnValue({ session: null, isLoading: false, logout: vi.fn() });
    render(<StaffLayout><p>Private content</p></StaffLayout>);

    expect(replace).toHaveBeenCalledWith("/staff/login");
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("redirects customer sessions to access denied", () => {
    useAuth.mockReturnValue({ session: { user: { role: "customer", email: "customer@example.com" } }, isLoading: false, logout: vi.fn() });
    render(<StaffLayout><p>Private content</p></StaffLayout>);

    expect(replace).toHaveBeenCalledWith("/403");
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("shows manager navigation for an authenticated staff member", () => {
    useAuth.mockReturnValue({ session: { user: { role: "manager", email: "manager@example.com" } }, isLoading: false, logout: vi.fn() });
    render(<StaffLayout><p>Private content</p></StaffLayout>);

    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Oversight" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });
});