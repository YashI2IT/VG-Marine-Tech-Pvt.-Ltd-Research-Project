import { api } from "@/lib/api";
import { isAxiosError } from "axios";

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type RegisterPayload = {
  name?: string;
  email: string;
  password: string;
  role?: string;
};

export type AuthUser = { id: number; email: string; role: string; name?: string };

export function classifyAuthError(err: unknown): { kind: "invalid" | "server" | "network" | "validation" | "conflict"; message: string } {
  if (isAxiosError(err)) {
    if (!err.response) {
      return { kind: "network", message: "Network error. Check that the API is reachable." };
    }
    if (err.response.status === 409) {
      return { kind: "conflict", message: err.response.data?.error || "An account with this email already exists." };
    }
    if (err.response.status === 401) {
      return { kind: "invalid", message: err.response.data?.error || "Invalid credentials." };
    }
    if (err.response.status === 400) {
      return { kind: "validation", message: err.response.data?.error || "Please check the form fields." };
    }
    return { kind: "server", message: err.response.data?.error || "Server error. Try again." };
  }
  return { kind: "server", message: "Unexpected error" };
}

export async function login(payload: LoginPayload) {
  const { data } = await api.post<{ message: string; user: AuthUser }>("/auth/login", payload);
  return data;
}

export async function register(payload: RegisterPayload) {
  const { data } = await api.post<{ message: string; user: AuthUser }>("/auth/register", payload);
  return data;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function getSession() {
  const { data } = await api.get<{ user: AuthUser }>("/auth/me");
  return data.user;
}

export async function requestPasswordReset(email: string) {
  const { data } = await api.post<{ message: string }>("/auth/forgot-password", { email });
  return data;
}
