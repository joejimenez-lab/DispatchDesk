import type { Metadata } from "next";
import { connection } from "next/server";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CloudCog,
  Database,
  ExternalLink,
  Gauge,
  Radio,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { StatusRefresh } from "@/components/status-refresh";
import { requireStatusViewer } from "@/lib/status/access";
import { getStatusSnapshot } from "@/lib/status/observability";
import type { ProviderStatus, StatusCheck, StatusSnapshot, StatusState } from "@/lib/status/types";

export const metadata: Metadata = {
  title: "System status",
  description: "Private operational health for DispatchDesk.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const dynamic = "force-dynamic";

const stateLabels: Record<StatusState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  unavailable: "Unavailable",
  unconfigured: "Not configured",
};

const serviceIcons = {
  application: Server,
  supabase: Database,
  vercel: CloudCog,
};

function StateBadge({ state }: { state: StatusState }) {
  return (
    <span className="status-state" data-state={state}>
      <span aria-hidden="true" />
      {stateLabels[state]}
    </span>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatAge(value: string | undefined) {
  if (!value) return "Time unavailable";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Less than a minute ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function CheckRow({ check }: { check: StatusCheck }) {
  return (
    <li className="status-check-row">
      <div className="status-check-copy">
        <strong>{check.label}</strong>
        <span>{check.detail}</span>
      </div>
      <div className="status-check-result">
        {typeof check.latencyMs === "number" ? <span>{check.latencyMs} ms</span> : null}
        <StateBadge state={check.state} />
      </div>
    </li>
  );
}

function ProviderPanel({ id, title, provider }: { id: keyof typeof serviceIcons; title: string; provider: ProviderStatus }) {
  const Icon = serviceIcons[id];
  return (
    <section className="dispatch-panel status-provider-panel">
      <div className="panel-heading status-provider-heading">
        <div className="status-provider-title">
          <span className="status-provider-icon"><Icon aria-hidden="true" /></span>
          <div><h2>{title}</h2><p>{provider.summary}</p></div>
        </div>
        <StateBadge state={provider.state} />
      </div>
      <ul className="status-check-list">
        {provider.checks.map((check) => <CheckRow key={check.id} check={check} />)}
      </ul>
    </section>
  );
}

function OverallIcon({ state }: { state: StatusSnapshot["state"] }) {
  if (state === "operational") return <CheckCircle2 aria-hidden="true" />;
  if (state === "degraded") return <TriangleAlert aria-hidden="true" />;
  return <CircleAlert aria-hidden="true" />;
}

function sourceLabel(source: string) {
  return source
    .replace(/_logs$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function StatusPage() {
  await connection();
  const { supabase } = await requireStatusViewer();
  const snapshot = await getStatusSnapshot(supabase);
  const deployment = snapshot.deployment;

  return (
    <div className="status-page">
      <header className="status-page-header">
        <div>
          <div className="page-kicker"><ShieldCheck className="size-4" aria-hidden="true" /> Private operations</div>
          <h1>System status</h1>
          <p>Health, deployment context, and recent provider errors in one restricted workspace.</p>
        </div>
        <StatusRefresh />
      </header>

      <section className="status-overview" data-state={snapshot.state} aria-labelledby="overall-status-title">
        <div className="status-overview-main">
          <span className="status-overview-icon"><OverallIcon state={snapshot.state} /></span>
          <div>
            <span className="status-eyebrow">Overall status</span>
            <h2 id="overall-status-title">{stateLabels[snapshot.state]}</h2>
            <p>{snapshot.summary}</p>
          </div>
        </div>
        <dl className="status-overview-meta">
          <div><dt><Clock3 aria-hidden="true" /> Snapshot</dt><dd>{formatTime(snapshot.generatedAt)}</dd></div>
          <div><dt><Gauge aria-hidden="true" /> Refresh time</dt><dd>{snapshot.durationMs} ms</dd></div>
        </dl>
      </section>

      <div className="status-provider-grid">
        <ProviderPanel id="application" title="Application" provider={snapshot.application} />
        <ProviderPanel id="supabase" title="Supabase" provider={snapshot.supabase} />
        <ProviderPanel id="vercel" title="Vercel" provider={snapshot.vercel} />
      </div>

      <div className="status-detail-grid">
        <section className="dispatch-panel status-errors-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent provider errors</h2>
              <p>Redacted Supabase errors from the previous hour.</p>
            </div>
            <Activity className="status-heading-icon" aria-hidden="true" />
          </div>
          {snapshot.recentErrors.length ? (
            <div className="status-log-scroll">
              <table className="status-log-table">
                <thead><tr><th>Time</th><th>Source</th><th>Event</th><th>Status</th></tr></thead>
                <tbody>
                  {snapshot.recentErrors.map((event) => (
                    <tr key={event.id}>
                      <td>{formatTime(event.timestamp)}</td>
                      <td><span className="status-log-source">{sourceLabel(event.source)}</span></td>
                      <td><strong>{event.message}</strong>{event.path ? <span>{event.path}</span> : null}</td>
                      <td><span className="status-log-severity" data-severity={event.severity}>{event.statusCode ?? event.severity}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="status-empty-state">
              {snapshot.errorsConfigured ? <CheckCircle2 aria-hidden="true" /> : <Radio aria-hidden="true" />}
              <div>
                <strong>{snapshot.errorsConfigured ? "No recent provider errors" : "Error feed not configured"}</strong>
                <p>{snapshot.errorsConfigured
                  ? "The bounded provider query returned no errors during this window."
                  : "Core health checks still run. Add a Supabase read token to include the restricted error feed."}</p>
              </div>
            </div>
          )}
        </section>

        <div className="status-side-stack">
          <section className="dispatch-panel">
            <div className="panel-heading"><div><h2>Production release</h2><p>Latest deployment context available.</p></div><CloudCog className="status-heading-icon" aria-hidden="true" /></div>
            <div className="status-release">
              {deployment ? (
                <>
                  <div className="status-release-top">
                    <div><span>Provider state</span><strong>{deployment.providerState}</strong></div>
                    <StateBadge state={deployment.state} />
                  </div>
                  <dl>
                    <div><dt>Release</dt><dd>{deployment.commitSha?.slice(0, 8) ?? deployment.id.slice(0, 12)}</dd></div>
                    <div><dt>Branch</dt><dd>{deployment.branch ?? "Not reported"}</dd></div>
                    <div><dt>Created</dt><dd>{formatAge(deployment.createdAt)}</dd></div>
                  </dl>
                  {deployment.commitMessage ? <p className="status-release-message">{deployment.commitMessage}</p> : null}
                  {deployment.url ? <a href={deployment.url} target="_blank" rel="noreferrer">Open deployment <ArrowUpRight aria-hidden="true" /></a> : null}
                </>
              ) : (
                <div className="status-compact-empty"><CloudCog aria-hidden="true" /><p>Deployment metadata is not available in this environment.</p></div>
              )}
            </div>
          </section>

          <section className="dispatch-panel">
            <div className="panel-heading"><div><h2>Provider consoles</h2><p>Open restricted provider tooling.</p></div><ExternalLink className="status-heading-icon" aria-hidden="true" /></div>
            <nav className="status-console-links" aria-label="Provider consoles">
              <a href={snapshot.links.vercelLogs} target="_blank" rel="noreferrer"><span><CloudCog aria-hidden="true" /><span><strong>Vercel runtime logs</strong><small>Requests, errors, and function output</small></span></span><ArrowUpRight aria-hidden="true" /></a>
              <a href={snapshot.links.vercelDashboard} target="_blank" rel="noreferrer"><span><Server aria-hidden="true" /><span><strong>Vercel deployments</strong><small>Builds, releases, and rollback tools</small></span></span><ArrowUpRight aria-hidden="true" /></a>
              {snapshot.links.supabaseLogs ? <a href={snapshot.links.supabaseLogs} target="_blank" rel="noreferrer"><span><Database aria-hidden="true" /><span><strong>Supabase Logs Explorer</strong><small>Database, Auth, Storage, and Realtime</small></span></span><ArrowUpRight aria-hidden="true" /></a> : null}
              {snapshot.links.supabaseDashboard ? <a href={snapshot.links.supabaseDashboard} target="_blank" rel="noreferrer"><span><ShieldCheck aria-hidden="true" /><span><strong>Supabase project</strong><small>Health, configuration, and usage</small></span></span><ArrowUpRight aria-hidden="true" /></a> : null}
            </nav>
          </section>
        </div>
      </div>
    </div>
  );
}
