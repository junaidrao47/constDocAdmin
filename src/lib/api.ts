import type { ApiEnvelope, ApiErrorShape } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export class ApiError extends Error implements ApiErrorShape {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type TokenStore = {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
};

let tokenStore: TokenStore | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function configureApiTokens(store: TokenStore | null) {
  tokenStore = store;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (ApiEnvelope<T> & { error?: unknown; details?: { fieldErrors?: Record<string, string[]> } })
    | null;
  if (!response.ok) {
    const fieldErrors =
      payload?.details?.fieldErrors ??
      (payload?.error && typeof payload.error === "object"
        ? (payload.error as { fieldErrors?: Record<string, string[]> }).fieldErrors
        : undefined);
    const first = Object.entries(fieldErrors ?? {}).find(([, messages]) => messages.length > 0);
    const message = first
      ? `${first[0]}: ${first[1][0]}`
      : typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : "The API request failed.";
    throw new ApiError(message, response.status);
  }

  return (payload && "data" in payload ? payload.data : payload) as T;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  hasRetried = false,
): Promise<T> {
  const accessToken = tokenStore?.getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && tokenStore && !hasRetried) {
    refreshInFlight ??= tokenStore.refresh().finally(() => {
      refreshInFlight = null;
    });
    const refreshedToken = await refreshInFlight;
    if (refreshedToken) {
      return apiRequest<T>(path, init, true);
    }
  }

  return parseResponse<T>(response);
}

export async function loginRequest(email: string, password: string) {
  return apiRequest<{ user: import("./types").User; accessToken: string; refreshToken: string }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function refreshRequest(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  return parseResponse<{ user: import("./types").User; accessToken: string; refreshToken: string }>(
    response,
  );
}

export function logoutRequest(refreshToken: string) {
  return apiRequest<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}
