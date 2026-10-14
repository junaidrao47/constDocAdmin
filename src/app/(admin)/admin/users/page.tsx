"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api";
import type { User, UserList, UserRole } from "@/lib/types";

const roles: Array<"" | UserRole> = ["", "customer", "agent", "manager", "admin"];
const pageSize = 20;

export default function AdminUsersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [status, setStatus] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "customer" as UserRole,
  });
  const query = useQuery({
    queryKey: ["admin-users", search, role, status, page],
    queryFn: () =>
      apiRequest<UserList>(
        `/admin/users?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}${role ? `&role=${role}` : ""}${status ? `&isActive=${status}` : ""}`,
      ),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest<User>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
          name: form.name || undefined,
        }),
      }),
    onSuccess: () => {
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", password: "", role: "customer" });
      setFeedback("User created successfully.");
      void client.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: unknown) =>
      setCreateError(error instanceof ApiError ? error.message : "Could not create user."),
  });
  const toggle = useMutation({
    mutationFn: ({ user, isActive }: { user: User; isActive: boolean }) =>
      apiRequest(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_, variables) => {
      setFeedback(variables.isActive ? "Access enabled." : "Access disabled.");
      void client.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: unknown) =>
      setFeedback(error instanceof ApiError ? error.message : "Could not update access."),
  });
  /**
   * How many admins can still sign in, asked separately from the visible list.
   *
   * The guard below used `query.data.total`, which is the *filtered* count: with a
   * search or a role filter applied it could read 1 for any single row, and with no
   * filter it was the total number of users rather than of admins. Either way the
   * last admin could be disabled and nobody could get back into the admin portal.
   *
   * `pageSize=1` because only the total is wanted. The key shares the "admin-users"
   * prefix, so the invalidation after a toggle refetches this too.
   */
  const activeAdmins = useQuery({
    queryKey: ["admin-users", "active-admin-count"],
    queryFn: () => apiRequest<UserList>("/admin/users?role=admin&isActive=true&page=1&pageSize=1"),
  });

  /**
   * True while this user is the only admin left who can sign in — and also while the
   * count is still unknown, because guessing wrong in the permissive direction locks
   * the organisation out.
   */
  function isLastActiveAdmin(user: User): boolean {
    if (user.role !== "admin" || user.isActive === false) return false;
    return activeAdmins.data === undefined || activeAdmins.data.total <= 1;
  }

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageSize));
  function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreateError("");
    if (form.name.trim().length < 2 || !form.email.includes("@") || form.password.length < 8) {
      setCreateError("Enter a valid name, email, and password of at least 8 characters.");
      return;
    }
    create.mutate();
  }
  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }
  return (
    <div className="p-5 sm:p-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Access control
          </p>
          <h1 className="mt-2 text-3xl font-semibold">User management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search accounts, create staff or customers, and control access.
          </p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            setShowCreate(!showCreate);
            setCreateError("");
          }}
        >
          {showCreate ? "Close" : "Create user"}
        </Button>
      </header>
      {feedback && (
        <p
          role="status"
          className="mb-5 border border-success/30 bg-success/10 p-3 text-sm text-success"
        >
          {feedback}
        </p>
      )}
      {showCreate && (
        <form
          className="mb-6 grid gap-4 border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={submitCreate}
        >
          <Input
            placeholder="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            placeholder="Temporary password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <select
            className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
          >
            {roles.filter(Boolean).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Passwords must be 8–72 characters. Staff roles are created here only.
            </p>
            <Button disabled={create.isPending} className="bg-primary text-primary-foreground">
              {create.isPending ? "Creating..." : "Create account"}
            </Button>
          </div>
          {createError && (
            <p role="alert" className="sm:col-span-2 lg:col-span-5 text-sm text-destructive">
              {createError}
            </p>
          )}
        </form>
      )}
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <Input
          aria-label="Search users"
          placeholder="Search name, email, or phone"
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
        />
        <select
          aria-label="Filter by role"
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as typeof role);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {roles.filter(Boolean).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by access"
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setPage(1);
          }}
        >
          <option value="">All access</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </div>
      {query.isError && (
        <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{query.error instanceof Error ? query.error.message : "Unable to load users."}</p>
          <Button
            className="mt-3 border border-destructive/30 bg-card text-destructive"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </div>
      )}
      {query.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div className="h-16 animate-pulse bg-muted" key={item} />
          ))}
        </div>
      )}
      {query.data && (
        <>
          <div className="space-y-3 md:hidden">
            {query.data.items.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                toggle={toggle.mutate}
                pending={toggle.isPending}
                isLastActiveAdmin={isLastActiveAdmin(user)}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto border border-border bg-card md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {query.data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium">{user.name ?? "Unnamed user"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-5 py-4 uppercase text-xs tracking-wider">{user.role}</td>
                    <td className="px-5 py-4">
                      {user.isActive === false ? "Disabled" : "Enabled"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        disabled={toggle.isPending || isLastActiveAdmin(user)}
                        title={
                          isLastActiveAdmin(user)
                            ? "The last active admin cannot be disabled."
                            : undefined
                        }
                        className={
                          user.isActive === false
                            ? "bg-success text-primary-foreground"
                            : "border border-destructive/30 bg-card text-destructive"
                        }
                        onClick={() => toggle.mutate({ user, isActive: user.isActive === false })}
                      >
                        {user.isActive === false ? "Enable" : "Disable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {query.data.total} account{query.data.total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                className="border border-border bg-card"
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="px-2 py-2">
                {page} / {totalPages}
              </span>
              <Button
                disabled={page >= totalPages}
                className="border border-border bg-card"
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserCard({
  user,
  toggle,
  pending,
  isLastActiveAdmin,
}: {
  user: User;
  toggle: (input: { user: User; isActive: boolean }) => void;
  pending: boolean;
  /** The card had no guard at all, so on a phone the last admin was always disableable. */
  isLastActiveAdmin: boolean;
}) {
  return (
    <article className="border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{user.name ?? "Unnamed user"}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{user.email}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider">{user.role}</span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span>{user.isActive === false ? "Disabled" : "Enabled"}</span>
        <Button
          disabled={pending || isLastActiveAdmin}
          title={isLastActiveAdmin ? "The last active admin cannot be disabled." : undefined}
          className={
            user.isActive === false
              ? "bg-success text-primary-foreground"
              : "border border-destructive/30 bg-card text-destructive"
          }
          onClick={() => toggle({ user, isActive: user.isActive === false })}
        >
          {user.isActive === false ? "Enable" : "Disable"}
        </Button>
      </div>
    </article>
  );
}
