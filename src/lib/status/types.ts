export type StatusState = "operational" | "degraded" | "unavailable" | "unconfigured";

export type StatusCheck = {
  id: string;
  label: string;
  state: StatusState;
  detail: string;
  latencyMs?: number;
};

export type StatusLogEvent = {
  id: string;
  timestamp: string;
  source: string;
  severity: "warning" | "error" | "fatal";
  message: string;
  path?: string;
  statusCode?: number;
};

export type DeploymentSummary = {
  id: string;
  state: StatusState;
  providerState: string;
  url?: string;
  createdAt?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
};

export type ProviderStatus = {
  state: StatusState;
  summary: string;
  checks: StatusCheck[];
  configured: boolean;
};

export type StatusLinks = {
  vercelDashboard: string;
  vercelLogs: string;
  supabaseDashboard?: string;
  supabaseLogs?: string;
};

export type StatusSnapshot = {
  state: Exclude<StatusState, "unconfigured">;
  summary: string;
  generatedAt: string;
  durationMs: number;
  application: ProviderStatus;
  supabase: ProviderStatus;
  vercel: ProviderStatus;
  deployment?: DeploymentSummary;
  recentErrors: StatusLogEvent[];
  errorsConfigured: boolean;
  links: StatusLinks;
};
