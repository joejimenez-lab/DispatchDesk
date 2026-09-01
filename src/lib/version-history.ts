export type ReleaseKind = "major" | "minor" | "patch";

export type ProductRelease = {
  version: string;
  date: string;
  title: string;
  summary: string;
  kind: ReleaseKind;
};

export const VERSION_HISTORY: readonly ProductRelease[] = [
  { version: "2.10.2", date: "2026-08-31", title: "Payment rollback safety", summary: "Preserved existing client payment amounts and paid flags while removing the additional invoice workflow.", kind: "patch" },
  { version: "2.10.1", date: "2026-08-31", title: "Simplified client payments", summary: "Removed invoice aging and follow-up workflows and restored direct load-level client payment tracking.", kind: "patch" },
  { version: "2.10.0", date: "2026-08-31", title: "Operational and financial control", summary: "Separated load and billing lifecycles, improved data quality, maintenance and IFTA readiness, and made load and report navigation scale.", kind: "minor" },
  { version: "2.9.0", date: "2026-08-31", title: "Dispatch planning and contact data quality", summary: "Added ordered appointment stops, scheduling conflict warnings, a daily dispatch board, and contact cleanup and import workflows.", kind: "minor" },
  { version: "2.8.1", date: "2026-08-25", title: "Edit-load location dropdown fix", summary: "Stopped prefilled location suggestions from opening automatically when editing loads.", kind: "patch" },
  { version: "2.8.0", date: "2026-08-23", title: "Version history", summary: "Added a visible current-version link and a complete in-app release history.", kind: "minor" },
  { version: "2.7.0", date: "2026-08-22", title: "Fleet views and exports", summary: "Added first-class fleet views and separate fleet-scoped exports.", kind: "minor" },
  { version: "2.6.0", date: "2026-08-22", title: "Equipment assignments", summary: "Linked loads to durable fleet, truck, and trailer assignments.", kind: "minor" },
  { version: "2.5.0", date: "2026-08-22", title: "Deductions and factoring", summary: "Added custom load deductions and fixed factoring amounts to profitability.", kind: "minor" },
  { version: "2.4.0", date: "2026-08-04", title: "Dispatch Assistant beta", summary: "Introduced the private Dispatch Assistant beta experience.", kind: "minor" },
  { version: "2.3.0", date: "2026-08-03", title: "Private status dashboard", summary: "Added authenticated application and provider health monitoring.", kind: "minor" },
  { version: "2.2.0", date: "2026-07-31", title: "Organization isolation", summary: "Added organization-level data isolation and expanded exports.", kind: "minor" },
  { version: "2.1.3", date: "2026-07-17", title: "Receipt preview fix", summary: "Corrected PDF receipt preview framing.", kind: "patch" },
  { version: "2.1.2", date: "2026-07-16", title: "Location selection fix", summary: "Kept location suggestions closed after a selection.", kind: "patch" },
  { version: "2.1.1", date: "2026-07-16", title: "Location entry fallback", summary: "Kept location entry usable when Photon is not configured.", kind: "patch" },
  { version: "2.1.0", date: "2026-07-16", title: "Self-hosted location search", summary: "Moved production location autocomplete to self-hosted Photon.", kind: "minor" },
  { version: "2.0.0", date: "2026-07-16", title: "Redesigned workspace", summary: "Released the second-generation DispatchDesk workspace interface.", kind: "major" },
  { version: "1.6.1", date: "2026-07-15", title: "Production header hardening", summary: "Strengthened production response headers.", kind: "patch" },
  { version: "1.6.0", date: "2026-07-13", title: "Unified operational expenses", summary: "Unified maintenance and IFTA expenses in Bookkeeping.", kind: "minor" },
  { version: "1.5.0", date: "2026-07-13", title: "Receipt previews", summary: "Added in-place previews for bookkeeping receipts.", kind: "minor" },
  { version: "1.4.2", date: "2026-07-09", title: "Recoverable document changes", summary: "Made multi-step load and document mutations recoverable.", kind: "patch" },
  { version: "1.4.1", date: "2026-07-09", title: "CSV export security", summary: "Prevented spreadsheet formula injection in CSV exports.", kind: "patch" },
  { version: "1.4.0", date: "2026-07-08", title: "Fleet-scoped operations", summary: "Added fleet scope tabs across operational pages.", kind: "minor" },
  { version: "1.3.0", date: "2026-07-07", title: "Bookkeeping", summary: "Added receipt and expense tracking for back-office workflows.", kind: "minor" },
  { version: "1.2.0", date: "2026-07-07", title: "Client payment controls", summary: "Added load-level client payment status controls.", kind: "minor" },
  { version: "1.1.0", date: "2026-07-07", title: "Return destinations", summary: "Added explicit return locations for round-trip loads.", kind: "minor" },
  { version: "1.0.0", date: "2026-07-07", title: "Initial launch", summary: "Established the first launched release with IFTA fuel-tax tracking.", kind: "major" },
  { version: "0.9.1", date: "2026-06-29", title: "Upload security", summary: "Restricted document uploads to safer supported content.", kind: "patch" },
  { version: "0.9.0", date: "2026-06-27", title: "Read-first contacts", summary: "Made driver and broker lists easier to review before editing.", kind: "minor" },
  { version: "0.8.2", date: "2026-06-27", title: "Authentication outage handling", summary: "Distinguished dependency outages from signed-out sessions.", kind: "patch" },
  { version: "0.8.1", date: "2026-06-27", title: "Branded error handling", summary: "Added branded not-found and application error boundaries.", kind: "patch" },
  { version: "0.8.0", date: "2026-06-21", title: "Expanded exports", summary: "Added broader operational and financial business exports.", kind: "minor" },
  { version: "0.7.1", date: "2026-06-21", title: "Maintenance workflow", summary: "Improved the fleet maintenance workflow.", kind: "patch" },
  { version: "0.7.0", date: "2026-06-21", title: "Maintenance alerts", summary: "Added due and overdue maintenance alerts.", kind: "minor" },
  { version: "0.6.0", date: "2026-06-20", title: "Fleet maintenance", summary: "Added truck and trailer maintenance tracking.", kind: "minor" },
  { version: "0.5.1", date: "2026-06-20", title: "Load visibility", summary: "Improved load date and city visibility across views.", kind: "patch" },
  { version: "0.5.0", date: "2026-06-19", title: "Round trips", summary: "Added round-trip support to loads.", kind: "minor" },
  { version: "0.4.0", date: "2026-06-18", title: "Simplified statuses", summary: "Simplified the load status workflow.", kind: "minor" },
  { version: "0.3.0", date: "2026-06-18", title: "Driver payroll reports", summary: "Added weekly driver payroll and financial summaries.", kind: "minor" },
  { version: "0.2.1", date: "2026-06-17", title: "Search hardening", summary: "Hardened search filters, geocoding requests, and error handling.", kind: "patch" },
  { version: "0.2.0", date: "2026-06-16", title: "Operational guardrails", summary: "Added exports, safety checks, and financial guardrails.", kind: "minor" },
  { version: "0.1.1", date: "2026-06-15", title: "Initial stabilization", summary: "Stabilized load financials and location autocomplete.", kind: "patch" },
  { version: "0.1.0", date: "2026-06-13", title: "Initial application", summary: "Created the first functional DispatchDesk application.", kind: "minor" },
  { version: "0.0.1", date: "2026-06-13", title: "Project scaffold", summary: "Established the initial application scaffold.", kind: "patch" },
] as const;

export const CURRENT_VERSION = VERSION_HISTORY[0].version;
