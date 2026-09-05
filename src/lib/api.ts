import type { ApiEnvelope, ApiErrorShape } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

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

export function configureApiTokens(store: TokenStore | null) {
  tokenStore = store;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { message?: string } | null;
  if (!response.ok) {
    throw new ApiError(payload?.message ?? "The API request failed.", response.status);
  }

  return (payload && "data" in payload ? payload.data : payload) as T;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, hasRetried = false): Promise<T> {
  const accessToken = tokenStore?.getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && tokenStore && !hasRetried) {
    const refreshedToken = await tokenStore.refresh();
    if (refreshedToken) {
      return apiRequest<T>(path, init, true);
    }
  }

  return parseResponse<T>(response);
}

export async function loginRequest(email: string, password: string) {
  return apiRequest<{ user: import("./types").User; accessToken: string; refreshToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshRequest(refreshToken: string) {
  return apiRequest<{ user: import("./types").User; accessToken: string; refreshToken: string }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}