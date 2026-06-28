import { describe, expect, it } from "vitest";
import {
  classifyAuthFailure,
  getVerifiedUser,
  missingSupabaseConfigResult,
  sanitizeAuthError,
} from "./auth-state";
import type { User } from "@supabase/supabase-js";

function supabaseWithGetUser(result: unknown) {
  return {
    auth: {
      getUser: async () => result,
    },
  } as never;
}

describe("auth state classifier", () => {
  it("returns authenticated when Supabase verifies a user", async () => {
    const user = { id: "user-1" } as User;

    await expect(getVerifiedUser(supabaseWithGetUser({ data: { user }, error: null }))).resolves.toEqual({
      status: "authenticated",
      user,
    });
  });

  it("returns unauthenticated for a missing session", async () => {
    await expect(
      getVerifiedUser(supabaseWithGetUser({
        data: { user: null },
        error: { name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 },
      })),
    ).resolves.toEqual({
      status: "unauthenticated",
      reason: "AuthSessionMissingError",
    });
  });

  it("returns unauthenticated for expired session-token failures", () => {
    expect(classifyAuthFailure({
      name: "AuthApiError",
      message: "Session expired",
      status: 401,
      code: "session_expired",
    })).toEqual({
      status: "unauthenticated",
      reason: "session_expired",
    });
  });

  it("returns unavailable for auth dependency failures and sanitizes details", async () => {
    const result = await getVerifiedUser(supabaseWithGetUser({
      data: { user: null },
      error: {
        name: "AuthRetryableFetchError",
        message: "fetch failed",
        status: 503,
        code: "request_timeout",
        headers: { authorization: "Bearer secret" },
      },
    }));

    expect(result).toEqual({
      status: "unavailable",
      statusCode: 503,
      error: {
        name: "AuthRetryableFetchError",
        message: "fetch failed",
        status: 503,
        code: "request_timeout",
      },
    });
  });

  it("returns unavailable for missing Supabase configuration", () => {
    expect(missingSupabaseConfigResult()).toEqual({
      status: "unavailable",
      statusCode: 503,
      error: {
        name: "SupabaseConfigurationError",
        message: "Supabase authentication is not configured.",
        code: "missing_supabase_config",
      },
    });
  });

  it("does not include raw request data in sanitized auth errors", () => {
    expect(sanitizeAuthError({
      name: "AuthApiError",
      message: "failed",
      status: 500,
      code: "unexpected_failure",
      cookie: "secret",
      access_token: "secret",
    })).toEqual({
      name: "AuthApiError",
      message: "failed",
      status: 500,
      code: "unexpected_failure",
    });
  });
});
