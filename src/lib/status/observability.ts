import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/auth-state";
import { logWarning } from "@/lib/logger";
import type { Database } from "@/types/database";
import type {
  DeploymentSummary,
  ProviderStatus,
  StatusCheck,
  StatusLogEvent,
  StatusSnapshot,
  StatusState,
} from "@/lib/status/types";

const PROVIDER_TIMEOUT_MS = 4_500;
const SUPABASE_LOG_WINDOW_MS = 60 * 60 * 1_000;

type Fetcher = typeof fetch;

type JsonRequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
  latencyMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

async function requestJson(fetcher: Fetcher, url: string, init: RequestInit = {}): Promise<JsonRequestResult> {
  const startedAt = Date.now();

  try {
    const response = await fetcher(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      // Health endpoints are allowed to return an empty or non-JSON body.
    }

    return { ok: response.ok, status: response.status, data, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, status: 0, data: null, latencyMs: Date.now() - startedAt };
  }
}

function checkState(checks: StatusCheck[]): StatusState {
  const configured = checks.filter((check) => check.state !== "unconfigured");
  if (!configured.length) return "unconfigured";
  if (configured.some((check) => check.state === "unavailable")) return "unavailable";
  if (configured.some((check) => check.state === "degraded")) return "degraded";
  return "operational";
}

function providerSummary(name: string, state: StatusState) {
  if (state === "operational") return `${name} checks are healthy.`;
  if (state === "degraded") return `${name} is responding with limited visibility.`;
  if (state === "unavailable") return `${name} is not responding normally.`;
  return `${name} monitoring is not configured.`;
}

function provider(name: string, checks: StatusCheck[]): ProviderStatus {
  const state = checkState(checks);
  return {
    state,
    summary: providerSummary(name, state),
    checks,
    configured: checks.some((check) => check.state !== "unconfigured"),
  };
}

async function endpointCheck(
  fetcher: Fetcher,
  input: { id: string; label: string; url: string; headers?: HeadersInit; healthyDetail: string },
): Promise<StatusCheck> {
  const response = await requestJson(fetcher, input.url, { headers: input.headers });

  return {
    id: input.id,
    label: input.label,
    state: response.ok ? "operational" : "unavailable",
    detail: response.ok
      ? input.healthyDetail
      : response.status
        ? `Health check returned HTTP ${response.status}.`
        : "Health check timed out or could not connect.",
    latencyMs: response.latencyMs,
  };
}

async function databaseCheck(supabase: SupabaseClient<Database>): Promise<StatusCheck> {
  const startedAt = Date.now();

  try {
    const { error } = await supabase.from("organization_members").select("user_id").limit(1);
    return {
      id: "database",
      label: "Database",
      state: error ? "unavailable" : "operational",
      detail: error ? "Authenticated database probe failed." : "Authenticated query completed.",
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      id: "database",
      label: "Database",
      state: "unavailable",
      detail: "Authenticated database probe could not connect.",
      latencyMs: Date.now() - startedAt,
    };
  }
}

function supabaseProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return undefined;

  try {
    const host = new URL(configuredUrl).hostname;
    const [projectRef] = host.split(".");
    return projectRef && projectRef !== "localhost" && projectRef !== "127" ? projectRef : undefined;
  } catch {
    return undefined;
  }
}

async function realtimeCheck(fetcher: Fetcher, projectRef: string | undefined, token: string | undefined) {
  if (!projectRef || !token) {
    return {
      id: "realtime",
      label: "Realtime",
      state: "unconfigured",
      detail: "Add a Supabase read token for platform-level health.",
    } satisfies StatusCheck;
  }

  const url = new URL(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/health`);
  url.searchParams.append("services", "realtime");
  const response = await requestJson(fetcher, url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const services = Array.isArray(response.data) ? response.data : [];
  const realtime = services.find((item) => isRecord(item) && item.name === "realtime");
  const healthy = response.ok && isRecord(realtime) && realtime.healthy === true;

  return {
    id: "realtime",
    label: "Realtime",
    state: healthy ? "operational" : "degraded",
    detail: healthy
      ? `Platform reports ${stringValue(realtime.status)?.toLowerCase() ?? "healthy"}.`
      : response.status === 429
        ? "Platform health rate limit reached; retry shortly."
        : "Platform health is temporarily unavailable.",
    latencyMs: response.latencyMs,
  } satisfies StatusCheck;
}

export function sanitizeLogMessage(message: string, source: string) {
  if (source === "postgres_logs") return "Database error recorded; open Logs Explorer for restricted details.";
  if (source === "storage_logs") return "Storage error recorded; open Logs Explorer for restricted details.";
  if (source === "realtime_logs") return "Realtime error recorded; open Logs Explorer for restricted details.";

  return message
    .replace(/bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-ip]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220) || "Provider error recorded.";
}

function safePath(value: unknown, source: string) {
  if (source !== "edge_logs") return undefined;
  const path = stringValue(value);
  if (!path) return undefined;
  return path
    .split(/[?#]/, 1)[0]
    ?.split("/")
    .map((segment) => {
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)) return ":id";
      if (segment.length > 32) return "[redacted]";
      return segment;
    })
    .join("/")
    .slice(0, 120);
}

export function normalizeSupabaseLogEvents(value: unknown): StatusLogEvent[] {
  if (!isRecord(value) || !Array.isArray(value.result)) return [];

  return value.result.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const timestamp = stringValue(item.timestamp);
    const source = stringValue(item.source) ?? stringValue(item.source_name) ?? "supabase";
    if (!timestamp) return [];
    const severityValue = (stringValue(item.severity) ?? stringValue(item.severity_text) ?? "error").toLowerCase();
    const severity: StatusLogEvent["severity"] = severityValue.includes("fatal") || severityValue.includes("panic")
      ? "fatal"
      : severityValue.includes("warn")
        ? "warning"
        : "error";
    const statusCode = numberValue(item.status_code);
    const rawMessage = stringValue(item.event_message) ?? stringValue(item.message) ?? "Provider error recorded.";

    return [{
      id: stringValue(item.id) ?? `${timestamp}-${index}`,
      timestamp,
      source,
      severity,
      message: sanitizeLogMessage(rawMessage, source),
      path: safePath(item.path, source),
      statusCode,
    }];
  });
}

async function recentSupabaseErrors(fetcher: Fetcher, projectRef: string | undefined, token: string | undefined) {
  if (!projectRef || !token) {
    return {
      configured: false,
      events: [] as StatusLogEvent[],
      check: {
        id: "logs",
        label: "Error telemetry",
        state: "unconfigured",
        detail: "Add a Supabase read token to show recent errors.",
      } satisfies StatusCheck,
    };
  }

  const now = new Date();
  const start = new Date(now.getTime() - SUPABASE_LOG_WINDOW_MS);
  const url = new URL(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/analytics/endpoints/logs`);
  url.searchParams.set("iso_timestamp_start", start.toISOString());
  url.searchParams.set("iso_timestamp_end", now.toISOString());
  url.searchParams.set("sql", `SELECT
    id,
    timestamp,
    source_name AS source,
    severity_text AS severity,
    log_attributes['request.path'] AS path,
    toInt32OrZero(log_attributes['response.status_code']) AS status_code,
    event_message
  FROM logs
  WHERE (
    (source_name = 'edge_logs' AND toInt32OrZero(log_attributes['response.status_code']) >= 500)
    OR (source_name = 'postgres_logs' AND match(log_attributes['parsed.error_severity'], 'ERROR|FATAL|PANIC'))
    OR (source_name IN ('auth_logs', 'storage_logs', 'realtime_logs') AND lower(severity_text) IN ('warning', 'error', 'fatal'))
  )
  ORDER BY timestamp DESC
  LIMIT 24`);
  const response = await requestJson(fetcher, url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    logWarning("status.supabase_logs_unavailable", { status: response.status || undefined });
  }

  return {
    configured: true,
    events: response.ok ? normalizeSupabaseLogEvents(response.data) : [],
    check: {
      id: "logs",
      label: "Error telemetry",
      state: response.ok ? "operational" : "degraded",
      detail: response.ok
        ? "Recent error query completed."
        : response.status === 429
          ? "Log query rate limit reached; retry shortly."
          : "Recent errors could not be queried.",
      latencyMs: response.latencyMs,
    } satisfies StatusCheck,
  };
}

async function supabaseStatus(supabase: SupabaseClient<Database>, fetcher: Fetcher) {
  const config = getSupabaseConfig();
  if (!config) {
    const checks: StatusCheck[] = [{
      id: "configuration",
      label: "Configuration",
      state: "unavailable",
      detail: "Supabase application settings are missing.",
    }];
    return { provider: provider("Supabase", checks), events: [], errorsConfigured: false };
  }

  const projectRef = supabaseProjectRef();
  const managementToken = process.env.SUPABASE_MANAGEMENT_TOKEN;
  const headers = { apikey: config.anonKey };
  const [auth, database, storage, realtime, logs] = await Promise.all([
    endpointCheck(fetcher, {
      id: "auth",
      label: "Authentication",
      url: `${config.url}/auth/v1/health`,
      headers,
      healthyDetail: "Authentication service is reachable.",
    }),
    databaseCheck(supabase),
    endpointCheck(fetcher, {
      id: "storage",
      label: "Storage",
      url: `${config.url}/storage/v1/status`,
      headers,
      healthyDetail: "Storage service is reachable.",
    }),
    realtimeCheck(fetcher, projectRef, managementToken),
    recentSupabaseErrors(fetcher, projectRef, managementToken),
  ]);
  const checks = [auth, database, storage, realtime, logs.check];

  return {
    provider: provider("Supabase", checks),
    events: logs.events,
    errorsConfigured: logs.configured,
  };
}

function deploymentState(value: unknown): DeploymentSummary["state"] {
  const state = String(value ?? "").toUpperCase();
  if (state === "READY") return "operational";
  if (["BUILDING", "QUEUED", "INITIALIZING"].includes(state)) return "degraded";
  if (["ERROR", "CANCELED"].includes(state)) return "unavailable";
  return "unconfigured";
}

function deploymentFromRecord(value: unknown): DeploymentSummary | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value.uid) ?? stringValue(value.id);
  if (!id) return undefined;
  const meta = isRecord(value.meta) ? value.meta : {};
  const url = stringValue(value.url);
  const created = numberValue(value.created) ?? numberValue(value.createdAt);
  const providerState = stringValue(value.readyState) ?? stringValue(value.state) ?? "UNKNOWN";

  return {
    id,
    state: deploymentState(providerState),
    providerState,
    url: url ? (url.startsWith("http") ? url : `https://${url}`) : undefined,
    createdAt: created ? new Date(created).toISOString() : stringValue(value.createdAt),
    commitSha: stringValue(meta.githubCommitSha) ?? stringValue(meta.gitCommitSha),
    commitMessage: stringValue(meta.githubCommitMessage) ?? stringValue(meta.gitCommitMessage),
    branch: stringValue(meta.githubCommitRef) ?? stringValue(meta.gitCommitRef),
  };
}

function currentDeploymentFromEnvironment(): DeploymentSummary | undefined {
  const id = process.env.VERCEL_DEPLOYMENT_ID;
  const url = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const release = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_RELEASE;
  if (!id && !url && !release) return undefined;

  return {
    id: id ?? release ?? "current",
    state: "operational",
    providerState: "SERVING",
    url: url ? (url.startsWith("http") ? url : `https://${url}`) : undefined,
    commitSha: release,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE,
    branch: process.env.VERCEL_GIT_COMMIT_REF,
  };
}

async function vercelStatus(fetcher: Fetcher) {
  const token = process.env.VERCEL_ACCESS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  const current = currentDeploymentFromEnvironment();
  const checks: StatusCheck[] = [{
    id: "runtime",
    label: "Hosting runtime",
    state: process.env.VERCEL || current ? "operational" : "unconfigured",
    detail: process.env.VERCEL || current ? "Current deployment is serving this request." : "Not running inside Vercel.",
  }];

  if (!token || !projectId) {
    checks.push({
      id: "deployment-api",
      label: "Deployment history",
      state: "unconfigured",
      detail: "Add a read-only Vercel token to show latest production history.",
    });
    return { provider: provider("Vercel", checks), deployment: current };
  }

  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("target", "production");
  url.searchParams.set("limit", "1");
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await requestJson(fetcher, url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const records = isRecord(response.data) && Array.isArray(response.data.deployments)
    ? response.data.deployments
    : [];
  const latest = deploymentFromRecord(records[0]) ?? current;
  const healthy = response.ok && latest;

  checks.push({
    id: "deployment-api",
    label: "Deployment history",
    state: !healthy ? "degraded" : latest.state === "unavailable" ? "degraded" : latest.state,
    detail: !response.ok
      ? response.status === 429
        ? "Deployment API rate limit reached; retry shortly."
        : "Latest deployment could not be queried."
      : latest
        ? `Latest production state is ${latest.providerState.toLowerCase()}.`
        : "No production deployment was returned.",
    latencyMs: response.latencyMs,
  });

  return { provider: provider("Vercel", checks), deployment: latest };
}

function applicationStatus(): ProviderStatus {
  const release = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_RELEASE;
  const checks: StatusCheck[] = [
    {
      id: "request",
      label: "Application",
      state: "operational",
      detail: "Status request completed on the server.",
    },
    {
      id: "release",
      label: "Release metadata",
      state: release ? "operational" : "unconfigured",
      detail: release ? `Release ${release.slice(0, 8)} is active.` : "Release metadata is unavailable locally.",
    },
  ];
  return provider("Application", checks);
}

export function overallStatus(application: ProviderStatus, supabase: ProviderStatus, vercel: ProviderStatus) {
  if (application.state === "unavailable" || supabase.state === "unavailable") {
    return { state: "unavailable" as const, summary: "A required application service is unavailable." };
  }
  if (
    application.state === "degraded" ||
    supabase.state === "degraded" ||
    vercel.state === "degraded" ||
    vercel.state === "unavailable"
  ) {
    return { state: "degraded" as const, summary: "Core services are reachable with limited visibility." };
  }
  return { state: "operational" as const, summary: "All configured core checks are operational." };
}

function statusLinks(projectRef: string | undefined) {
  const teamSlug = process.env.VERCEL_TEAM_SLUG;
  const projectName = process.env.VERCEL_PROJECT_NAME;
  const vercelProject = teamSlug && projectName
    ? `https://vercel.com/${encodeURIComponent(teamSlug)}/${encodeURIComponent(projectName)}`
    : "https://vercel.com/dashboard";

  return {
    vercelDashboard: vercelProject,
    vercelLogs: `${vercelProject}${vercelProject.endsWith("dashboard") ? "" : "/logs"}`,
    supabaseDashboard: projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : undefined,
    supabaseLogs: projectRef ? `https://supabase.com/dashboard/project/${projectRef}/logs/explorer` : undefined,
  };
}

export async function getStatusSnapshot(
  supabase: SupabaseClient<Database>,
  fetcher: Fetcher = fetch,
): Promise<StatusSnapshot> {
  const startedAt = Date.now();
  const application = applicationStatus();
  const [supabaseResult, vercelResult] = await Promise.allSettled([
    supabaseStatus(supabase, fetcher),
    vercelStatus(fetcher),
  ]);
  const supabaseSnapshot = supabaseResult.status === "fulfilled"
    ? supabaseResult.value
    : {
        provider: provider("Supabase", [{ id: "request", label: "Supabase", state: "unavailable", detail: "Provider checks failed." }]),
        events: [] as StatusLogEvent[],
        errorsConfigured: false,
      };
  const vercelSnapshot = vercelResult.status === "fulfilled"
    ? vercelResult.value
    : {
        provider: provider("Vercel", [{ id: "request", label: "Vercel", state: "degraded", detail: "Provider checks failed." }]),
        deployment: currentDeploymentFromEnvironment(),
      };
  const overall = overallStatus(application, supabaseSnapshot.provider, vercelSnapshot.provider);

  return {
    ...overall,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    application,
    supabase: supabaseSnapshot.provider,
    vercel: vercelSnapshot.provider,
    deployment: vercelSnapshot.deployment,
    recentErrors: supabaseSnapshot.events,
    errorsConfigured: supabaseSnapshot.errorsConfigured,
    links: statusLinks(supabaseProjectRef()),
  };
}
