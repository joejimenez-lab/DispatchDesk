import "server-only";

import { z } from "zod";
import { mapMaintenanceAlerts } from "@/lib/data/maintenance";
import { daysPastDue, receivableBalance, type ReceivableEntry } from "@/lib/collections";
import { addDays, localDateString } from "@/lib/maintenance";
import type { AssistantLink } from "@/lib/ai-assistant/schemas";
import type { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import { documentCategories } from "@/types/database";

type RouteSupabase = Extract<
  Awaited<ReturnType<typeof createAuthenticatedRouteClient>>,
  { supabase: unknown }
>["supabase"];

export type TrustedToolResult = {
  data: Record<string, unknown>;
  links?: AssistantLink[];
};

type TrustedTool = {
  description: string;
  parameters: Record<string, unknown>;
  run: (supabase: RouteSupabase, argumentsValue: unknown) => Promise<TrustedToolResult>;
};

const SOURCE_PAGE_SIZE = 1_000;
const MAX_SOURCE_ROWS = 20_000;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  let sourceResultsLimited = false;

  while (rows.length < MAX_SOURCE_ROWS) {
    const { data, error } = await fetchPage(rows.length, rows.length + SOURCE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < SOURCE_PAGE_SIZE) break;
    if (rows.length >= MAX_SOURCE_ROWS) sourceResultsLimited = true;
  }

  return { rows, sourceResultsLimited };
}

const emptyArgumentsSchema = z.object({}).strict();
const unpaidArgumentsSchema = z.object({
  minimum_age_days: z.number().int().min(0).max(365).default(0),
}).strict();
const maintenanceArgumentsSchema = z.object({
  within_days: z.number().int().min(1).max(365).default(30),
}).strict();
const latestDocumentArgumentsSchema = z.object({
  category: z.enum(documentCategories).optional(),
  load_number: z.string().trim().min(1).max(80).optional(),
}).strict();
const pdfReportNames = [
  "weekly_driver_summary",
  "weekly_payroll",
  "weekly_financial",
  "client_billing",
  "maintenance",
  "yearly_financial",
  "bookkeeping_summary",
  "bookkeeping_detailed",
] as const;
const pdfExportArgumentsSchema = z.object({
  report: z.enum(pdfReportNames).optional(),
  period: z.enum(["this", "last", "all"]).default("all"),
}).strict();

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function startOfBusinessWeek(today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return date.toISOString().slice(0, 10);
}

function reportLinks(period: "this" | "last" | "all") {
  const encodedPeriod = encodeURIComponent(period);
  return {
    weekly_driver_summary: {
      label: "Weekly driver financial summary (PDF)",
      href: `/api/reports/weekly/pdf?period=${encodedPeriod}`,
      download: true,
    },
    weekly_payroll: {
      label: "Weekly driver payroll (PDF)",
      href: `/api/reports/exports/weekly-payroll?format=pdf&period=${encodedPeriod}`,
      download: true,
    },
    weekly_financial: {
      label: "Weekly financial report (PDF)",
      href: `/api/reports/exports/weekly-financial?format=pdf&period=${encodedPeriod}`,
      download: true,
    },
    client_billing: {
      label: "Client billing report (PDF)",
      href: "/api/reports/exports/client-billing?format=pdf",
      download: true,
    },
    maintenance: {
      label: "Maintenance history (PDF)",
      href: "/api/reports/exports/maintenance?format=pdf",
      download: true,
    },
    yearly_financial: {
      label: "Yearly financial summary (PDF)",
      href: "/api/reports/exports/yearly-financial?format=pdf&period=all",
      download: true,
    },
    bookkeeping_summary: {
      label: "Bookkeeping summary (PDF)",
      href: "/api/bookkeeping/export?format=pdf&view=summary",
      download: true,
    },
    bookkeeping_detailed: {
      label: "Detailed bookkeeping expenses (PDF)",
      href: "/api/bookkeeping/export?format=pdf&view=detailed",
      download: true,
    },
  } satisfies Record<(typeof pdfReportNames)[number], AssistantLink>;
}

export const trustedTools = {
  count_drivers: {
    description: "Count all driver records visible to the signed-in organization.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(supabase, argumentsValue) {
      emptyArgumentsSchema.parse(argumentsValue);
      const { count, error } = await supabase.from("drivers").select("id", { count: "exact", head: true });
      if (error) throw error;
      return {
        data: { driver_count: count ?? 0, definition: "All driver records" },
        links: [{ label: "View drivers", href: "/drivers" }],
      };
    },
  },

  get_unpaid_load_summary: {
    description: "Get open client receivables and their ledger balance. Optionally restrict to invoices at least a given number of days past due.",
    parameters: {
      type: "object",
      properties: {
        minimum_age_days: { type: "integer", minimum: 0, maximum: 365, default: 0 },
      },
      additionalProperties: false,
    },
    async run(supabase, argumentsValue) {
      const { minimum_age_days: minimumAgeDays } = unpaidArgumentsSchema.parse(argumentsValue);
      const today = localDateString();
      type UnpaidLoadRow = {
        id: string;
        load_number: string;
        load_rate: number;
        pickup_date: string | null;
        delivery_date: string | null;
        created_at: string;
        status: string;
        brokers: { company_name: string } | { company_name: string }[] | null;
        payments: { due_date: string | null; invoice_status: "Draft" | "Sent" | "Void" } | { due_date: string | null; invoice_status: "Draft" | "Sent" | "Void" }[] | null;
        receivable_entries: ReceivableEntry[];
      };
      const { rows, sourceResultsLimited } = await fetchAllPages<UnpaidLoadRow>((from, to) => supabase
        .from("loads")
        .select("id, load_number, load_rate, pickup_date, delivery_date, created_at, status, brokers(company_name), payments(due_date, invoice_status), receivable_entries(entry_type, amount)")
        .neq("status", "Cancelled")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: UnpaidLoadRow[] | null; error: unknown }>);

      const unpaid = rows.flatMap((load) => {
        const payment = relation(load.payments);
        if (payment?.invoice_status === "Void") return [];
        const outstanding = receivableBalance(load.load_rate, load.receivable_entries);
        if (outstanding <= 0) return [];
        const basisDate = payment?.due_date ?? load.delivery_date ?? load.pickup_date ?? load.created_at.slice(0, 10);
        const ageDays = daysPastDue(payment?.due_date ?? null, today);
        if (ageDays < minimumAgeDays) return [];
        return [{
          load_number: load.load_number,
          broker: relation(load.brokers)?.company_name ?? null,
          status: load.status,
          basis_date: basisDate,
          age_days: ageDays,
          outstanding,
        }];
      });

      return {
        data: {
          minimum_age_days: minimumAgeDays,
          unpaid_load_count: unpaid.length,
          outstanding_total: unpaid.reduce((total, load) => total + load.outstanding, 0),
          loads: unpaid.slice(0, 25),
          results_limited: unpaid.length > 25,
          source_results_limited: sourceResultsLimited,
        },
        links: [{ label: "View collections", href: "/collections" }],
      };
    },
  },

  get_deliveries_this_week: {
    description: "List non-cancelled loads with a delivery date in the current Monday-through-Sunday business week.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(supabase, argumentsValue) {
      emptyArgumentsSchema.parse(argumentsValue);
      const from = startOfBusinessWeek(localDateString());
      const to = addDays(from, 6);
      type DeliveryRow = {
        id: string;
        load_number: string;
        status: string;
        delivery_date: string | null;
        delivery_location: string;
        pickup_location: string;
        brokers: { company_name: string } | { company_name: string }[] | null;
        drivers: { name: string } | { name: string }[] | null;
      };
      const { rows, sourceResultsLimited } = await fetchAllPages<DeliveryRow>((pageFrom, pageTo) => supabase
        .from("loads")
        .select("id, load_number, status, delivery_date, delivery_location, pickup_location, brokers(company_name), drivers(name)")
        .gte("delivery_date", from)
        .lte("delivery_date", to)
        .neq("status", "Cancelled")
        .order("delivery_date")
        .order("id")
        .range(pageFrom, pageTo) as unknown as PromiseLike<{ data: DeliveryRow[] | null; error: unknown }>);

      const loads = rows.map((load) => ({
        load_number: load.load_number,
        status: load.status,
        delivery_date: load.delivery_date,
        delivery_location: load.delivery_location,
        pickup_location: load.pickup_location,
        broker: relation(load.brokers)?.company_name ?? null,
        driver: relation(load.drivers)?.name ?? null,
      }));

      return {
        data: {
          week_start: from,
          week_end: to,
          load_count: loads.length,
          loads: loads.slice(0, 50),
          results_limited: loads.length > 50,
          source_results_limited: sourceResultsLimited,
        },
        links: [{ label: "View loads", href: "/loads" }],
      };
    },
  },

  get_pending_driver_payments: {
    description: "Calculate unpaid driver pay for delivered loads using stored driver payment amounts.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(supabase, argumentsValue) {
      emptyArgumentsSchema.parse(argumentsValue);
      type PendingDriverPayRow = {
        id: string;
        load_number: string;
        delivery_date: string | null;
        driver_pay: number;
        drivers: { name: string } | { name: string }[] | null;
        payments: { driver_paid: boolean; driver_amount_paid: number } | { driver_paid: boolean; driver_amount_paid: number }[] | null;
      };
      const { rows, sourceResultsLimited } = await fetchAllPages<PendingDriverPayRow>((from, to) => supabase
        .from("loads")
        .select("id, load_number, delivery_date, driver_pay, drivers(name), payments(driver_paid, driver_amount_paid)")
        .eq("status", "Delivered")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: PendingDriverPayRow[] | null; error: unknown }>);

      const pending = rows.flatMap((load) => {
        const payment = relation(load.payments);
        if (payment?.driver_paid) return [];
        const amount = Math.max(Number(load.driver_pay) - Number(payment?.driver_amount_paid ?? 0), 0);
        if (amount <= 0) return [];
        return [{
          load_number: load.load_number,
          delivery_date: load.delivery_date,
          driver: relation(load.drivers)?.name ?? null,
          pending_amount: amount,
        }];
      });

      return {
        data: {
          load_count: pending.length,
          pending_driver_pay_total: pending.reduce((total, load) => total + load.pending_amount, 0),
          loads: pending.slice(0, 25),
          results_limited: pending.length > 25,
          source_results_limited: sourceResultsLimited,
        },
        links: [{ label: "View reports", href: "/reports" }],
      };
    },
  },

  get_upcoming_truck_maintenance: {
    description: "List open truck maintenance reminders that are overdue, due soon, or due within a requested number of days.",
    parameters: {
      type: "object",
      properties: {
        within_days: { type: "integer", minimum: 1, maximum: 365, default: 30 },
      },
      additionalProperties: false,
    },
    async run(supabase, argumentsValue) {
      const { within_days: withinDays } = maintenanceArgumentsSchema.parse(argumentsValue);
      const today = localDateString();
      const through = addDays(today, withinDays);
      const { rows, sourceResultsLimited } = await fetchAllPages<unknown>((from, to) => supabase
        .from("maintenance_reminders")
        .select("*, fleet_units!inner(id, unit_number, unit_type, odometer, company)")
        .eq("fleet_units.unit_type", "Truck")
        .is("completed_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: unknown[] | null; error: unknown }>);

      const matchingAlerts = mapMaintenanceAlerts(rows, today)
        .filter((alert) => !alert.snoozed)
        .filter((alert) => alert.status !== "upcoming" || (alert.due_date != null && alert.due_date <= through));
      const alerts = matchingAlerts.slice(0, 25)
        .map((alert) => ({
          unit_number: alert.unit.unit_number,
          company: alert.unit.company ?? null,
          reminder: alert.reminder_type,
          status: alert.status,
          due_date: alert.due_date,
          days_remaining: alert.daysRemaining,
          due_odometer: alert.due_odometer,
          current_odometer: alert.unit.odometer,
          miles_remaining: alert.milesRemaining,
        }));

      return {
        data: {
          through,
          reminder_count: matchingAlerts.length,
          reminders: alerts,
          results_limited: matchingAlerts.length > 25,
          source_results_limited: sourceResultsLimited,
        },
        links: [{ label: "View maintenance", href: "/maintenance" }],
      };
    },
  },

  get_top_broker_last_month: {
    description: "Find the broker with the highest booked load revenue in the previous calendar month, excluding cancelled loads.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(supabase, argumentsValue) {
      emptyArgumentsSchema.parse(argumentsValue);
      const today = localDateString();
      const currentMonth = `${today.slice(0, 7)}-01`;
      const currentMonthDate = new Date(`${currentMonth}T00:00:00Z`);
      currentMonthDate.setUTCMonth(currentMonthDate.getUTCMonth() - 1);
      const from = currentMonthDate.toISOString().slice(0, 10);
      const to = currentMonth;
      const filter = `and(delivery_date.gte.${from},delivery_date.lt.${to}),and(delivery_date.is.null,pickup_date.gte.${from},pickup_date.lt.${to})`;
      type BrokerLoadRow = {
        id: string;
        load_number: string;
        load_rate: number;
        brokers: { company_name: string } | { company_name: string }[] | null;
      };
      const { rows, sourceResultsLimited } = await fetchAllPages<BrokerLoadRow>((pageFrom, pageTo) => supabase
        .from("loads")
        .select("id, load_number, load_rate, pickup_date, delivery_date, brokers(company_name)")
        .neq("status", "Cancelled")
        .or(filter)
        .order("id")
        .range(pageFrom, pageTo) as unknown as PromiseLike<{ data: BrokerLoadRow[] | null; error: unknown }>);

      const brokers = new Map<string, { broker: string; load_count: number; revenue: number }>();
      for (const load of rows) {
        const broker = relation(load.brokers)?.company_name;
        if (!broker) continue;
        const aggregate = brokers.get(broker) ?? { broker, load_count: 0, revenue: 0 };
        aggregate.load_count += 1;
        aggregate.revenue += Number(load.load_rate);
        brokers.set(broker, aggregate);
      }

      const ranking = [...brokers.values()].sort((a, b) => b.revenue - a.revenue || b.load_count - a.load_count);
      return {
        data: {
          month_start: from,
          month_end_exclusive: to,
          top_broker: ranking[0] ?? null,
          ranking: ranking.slice(0, 10),
          source_results_limited: sourceResultsLimited,
        },
        links: [{ label: "View brokers", href: "/brokers" }],
      };
    },
  },

  get_latest_load_document: {
    description: "Find the latest stored load document matching an optional supported category and exact load number. Returns a secure download link; document bytes are never sent to the model.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: documentCategories },
        load_number: { type: "string", minLength: 1, maxLength: 80 },
      },
      additionalProperties: false,
    },
    async run(supabase, argumentsValue) {
      const { category, load_number: loadNumber } = latestDocumentArgumentsSchema.parse(argumentsValue);
      let query = supabase
        .from("documents")
        .select("id, file_name, category, created_at, loads!inner(id, load_number)")
        .ilike("file_name", "%.pdf")
        .order("created_at", { ascending: false })
        .limit(1);
      if (category) query = query.eq("category", category);
      if (loadNumber) query = query.eq("loads.load_number", loadNumber);
      const { data, error } = await query;
      if (error) throw error;

      const document = relation((data ?? []) as unknown as Array<{
        id: string;
        file_name: string;
        category: string;
        created_at: string;
        loads: { id: string; load_number: string } | { id: string; load_number: string }[] | null;
      }>);
      if (!document) {
        return { data: { found: false, category: category ?? null, load_number: loadNumber ?? null } };
      }

      const load = relation(document.loads);
      const link: AssistantLink = {
        label: `${document.category}: ${document.file_name}`,
        href: `/api/documents/${encodeURIComponent(document.id)}/download`,
        download: true,
      };
      return {
        data: {
          found: true,
          file_name: document.file_name,
          category: document.category,
          created_at: document.created_at,
          load_number: load?.load_number ?? null,
        },
        links: [link],
      };
    },
  },

  get_available_pdf_exports: {
    description: "Return trusted links to PDF reports already generated by DispatchDesk. If no report is specified, list every available PDF export.",
    parameters: {
      type: "object",
      properties: {
        report: { type: "string", enum: pdfReportNames },
        period: { type: "string", enum: ["this", "last", "all"], default: "all" },
      },
      additionalProperties: false,
    },
    async run(_supabase, argumentsValue) {
      const { report, period } = pdfExportArgumentsSchema.parse(argumentsValue);
      const available = reportLinks(period);
      const links = report ? [available[report]] : Object.values(available);
      return { data: { report_count: links.length, reports: links.map(({ label, href }) => ({ label, href })) }, links };
    },
  },
} satisfies Record<string, TrustedTool>;

export type TrustedToolName = keyof typeof trustedTools;

export class InvalidToolArgumentsError extends Error {
  constructor() {
    super("Invalid tool arguments");
    this.name = "InvalidToolArgumentsError";
  }
}

export const providerToolDefinitions = Object.entries(trustedTools).map(([name, tool]) => ({
  type: "function" as const,
  function: {
    name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

export async function executeTrustedTool(
  supabase: RouteSupabase,
  name: string,
  rawArguments: string,
) {
  if (!(name in trustedTools)) throw new Error("Unknown assistant tool");

  let argumentsValue: unknown;
  try {
    argumentsValue = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    throw new InvalidToolArgumentsError();
  }

  try {
    return await trustedTools[name as TrustedToolName].run(supabase, argumentsValue);
  } catch (error) {
    if (error instanceof z.ZodError) throw new InvalidToolArgumentsError();
    throw error;
  }
}
