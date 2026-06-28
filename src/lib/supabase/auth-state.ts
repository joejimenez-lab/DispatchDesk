import type { SupabaseClient, User } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import type { Database } from "@/types/database";

const SIGNED_OUT_AUTH_CODES = new Set([
  "bad_jwt",
  "no_authorization",
  "refresh_token_already_used",
  "refresh_token_not_found",
  "session_expired",
  "session_not_found",
]);

type AuthErrorShape = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
};

export type AuthRequestContext = {
  method?: string;
  path?: string;
  route?: string;
  kind: "api" | "page";
};

export type SanitizedAuthError = {
  name: string;
  message: string;
  status?: number;
  code?: string;
};

export type AuthResult =
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated"; reason: string }
  | { status: "unavailable"; error: SanitizedAuthError; statusCode: 503 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function authErrorShape(error: unknown): AuthErrorShape {
  if (!isRecord(error)) return { message: String(error) };

  return {
    name: typeof error.name === "string" ? error.name : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    status: typeof error.status === "number" ? error.status : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
  };
}

export function sanitizeAuthError(error: unknown): SanitizedAuthError {
  const shape = authErrorShape(error);

  return {
    name: shape.name ?? "AuthError",
    message: shape.message ?? "Authentication service failed.",
    status: shape.status,
    code: shape.code,
  };
}

export function missingSupabaseConfigResult(): AuthResult {
  return {
    status: "unavailable",
    error: {
      name: "SupabaseConfigurationError",
      message: "Supabase authentication is not configured.",
      code: "missing_supabase_config",
    },
    statusCode: 503,
  };
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function isConfirmedSignedOut(error: unknown) {
  const shape = authErrorShape(error);

  return (
    shape.name === "AuthSessionMissingError" ||
    (typeof shape.code === "string" && SIGNED_OUT_AUTH_CODES.has(shape.code))
  );
}

export function classifyAuthFailure(error: unknown): AuthResult {
  if (isConfirmedSignedOut(error)) {
    const sanitized = sanitizeAuthError(error);
    return { status: "unauthenticated", reason: sanitized.code ?? sanitized.name };
  }

  return {
    status: "unavailable",
    error: sanitizeAuthError(error),
    statusCode: 503,
  };
}

export async function getVerifiedUser(supabase: Pick<SupabaseClient<Database>, "auth">): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (data?.user) return { status: "authenticated", user: data.user };
    if (error) return classifyAuthFailure(error);

    return { status: "unauthenticated", reason: "missing_user" };
  } catch (error) {
    return classifyAuthFailure(error);
  }
}

export function logAuthUnavailable(result: AuthResult, context: AuthRequestContext) {
  if (result.status !== "unavailable") return;

  logError("auth.unavailable", result.error.message, {
    authErrorName: result.error.name,
    authErrorStatus: result.error.status,
    authErrorCode: result.error.code,
    method: context.method,
    path: context.path,
    route: context.route,
    kind: context.kind,
  });
}
