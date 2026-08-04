import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  normalizeSupabaseLogEvents,
  overallStatus,
  sanitizeLogMessage,
} from "./observability";
import type { ProviderStatus, StatusState } from "./types";

function provider(state: StatusState): ProviderStatus {
  return {
    state,
    summary: state,
    configured: state !== "unconfigured",
    checks: [],
  };
}

describe("status telemetry", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("redacts credentials, email addresses, IP addresses, and query strings", () => {
    const events = normalizeSupabaseLogEvents({
      result: [{
        id: "event-1",
        timestamp: "2026-08-03T12:00:00.000Z",
        source: "edge_logs",
        severity: "error",
        path: "/auth/callback?token=secret",
        status_code: "500",
        event_message: "Bearer abc.def user@example.com from 192.168.1.10 token_abcdefghijklmnopqrstuvwxyz1234567890",
      }],
    });

    expect(events).toEqual([expect.objectContaining({
      path: "/auth/callback",
      statusCode: 500,
      message: "Bearer [redacted] [redacted-email] from [redacted-ip] [redacted]",
    })]);
  });

  it("does not return database statements", () => {
    expect(sanitizeLogMessage("SELECT * FROM private_table", "postgres_logs"))
      .toBe("Database error recorded; open Logs Explorer for restricted details.");
  });

  it("does not return storage messages or storage object paths", () => {
    const events = normalizeSupabaseLogEvents({
      result: [{
        id: "event-2",
        timestamp: "2026-08-03T12:00:00.000Z",
        source: "storage_logs",
        severity: "error",
        path: "/object/private/load-documents/customer-file.pdf",
        event_message: "Could not open customer-file.pdf",
      }],
    });

    expect(events[0]).toEqual(expect.objectContaining({
      message: "Storage error recorded; open Logs Explorer for restricted details.",
      path: undefined,
    }));
  });

  it("marks a required Supabase outage as unavailable", () => {
    expect(overallStatus(provider("operational"), provider("unavailable"), provider("operational")))
      .toEqual({ state: "unavailable", summary: "A required application service is unavailable." });
  });

  it("ignores optional unconfigured Vercel history", () => {
    expect(overallStatus(provider("operational"), provider("operational"), provider("unconfigured")))
      .toEqual({ state: "operational", summary: "All configured core checks are operational." });
  });
});
