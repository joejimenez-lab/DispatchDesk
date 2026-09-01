import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  executeTrustedTool,
  InvalidToolArgumentsError,
  providerToolDefinitions,
} from "@/lib/ai-assistant/tools";
import { documentCategories } from "@/types/database";

function resolvedQuery(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "neq", "order", "limit", "range", "gte", "lte", "in", "is", "eq", "or", "ilike"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query;
}

describe("trusted assistant tools", () => {
  it("exposes only the hard-coded read-only tool catalog", () => {
    expect(providerToolDefinitions.map((tool) => tool.function.name)).toEqual([
      "count_drivers",
      "get_unpaid_load_summary",
      "get_deliveries_this_week",
      "get_pending_driver_payments",
      "get_upcoming_truck_maintenance",
      "get_top_broker_last_month",
      "get_latest_load_document",
      "get_available_pdf_exports",
    ]);
    expect(providerToolDefinitions.some((tool) => /sql/i.test(tool.function.name))).toBe(false);
    const documentTool = providerToolDefinitions.find((tool) => tool.function.name === "get_latest_load_document");
    expect(documentTool?.function.parameters).toMatchObject({
      properties: { category: { enum: documentCategories } },
    });
  });

  it("calculates unpaid balances in application code", async () => {
    const query = resolvedQuery({
      data: [
        {
          id: "load-1",
          load_number: "DD-101",
          load_rate: 1_500,
          pickup_date: "2026-07-01",
          delivery_date: "2026-07-03",
          created_at: "2026-07-01T12:00:00Z",
          status: "Delivered",
          brokers: { company_name: "Trusted Broker" },
          payments: { due_date: "2026-07-03" },
          receivable_entries: [{ entry_type: "Payment", amount: 500 }],
        },
        {
          id: "load-2",
          load_number: "DD-102",
          load_rate: 800,
          pickup_date: "2026-07-02",
          delivery_date: "2026-07-04",
          created_at: "2026-07-02T12:00:00Z",
          status: "Closed",
          brokers: null,
          payments: { due_date: "2026-07-04" },
          receivable_entries: [{ entry_type: "Payment", amount: 800 }],
        },
      ],
      error: null,
    });
    const supabase = { from: vi.fn(() => query) };

    const result = await executeTrustedTool(supabase as never, "get_unpaid_load_summary", "{}");

    expect(result.data).toMatchObject({ unpaid_load_count: 1, outstanding_total: 1_000 });
    expect(result.links).toEqual([{ label: "View collections", href: "/collections" }]);
  });

  it("returns a secure download route for the latest matching document", async () => {
    const query = resolvedQuery({
      data: [{
        id: "8b7ba927-40a6-4a61-b00f-aaac4bc03bcf",
        file_name: "rate-confirmation.pdf",
        category: "Rate Confirmation",
        created_at: "2026-08-04T10:00:00Z",
        loads: { id: "load-1", load_number: "DD-101" },
      }],
      error: null,
    });
    const supabase = { from: vi.fn(() => query) };

    const result = await executeTrustedTool(
      supabase as never,
      "get_latest_load_document",
      JSON.stringify({ category: "Rate Confirmation", load_number: "DD-101" }),
    );

    expect(query.eq).toHaveBeenCalledWith("category", "Rate Confirmation");
    expect(query.eq).toHaveBeenCalledWith("loads.load_number", "DD-101");
    expect(query.ilike).toHaveBeenCalledWith("file_name", "%.pdf");
    expect(result.links).toEqual([{
      label: "Rate Confirmation: rate-confirmation.pdf",
      href: "/api/documents/8b7ba927-40a6-4a61-b00f-aaac4bc03bcf/download",
      download: true,
    }]);
  });

  it("returns existing application PDF routes and rejects unknown tools", async () => {
    const result = await executeTrustedTool({} as never, "get_available_pdf_exports", JSON.stringify({ report: "client_billing" }));
    expect(result.links).toEqual([{
      label: "Client billing report (PDF)",
      href: "/api/reports/exports/client-billing?format=pdf",
      download: true,
    }]);

    await expect(executeTrustedTool({} as never, "run_sql", "{}"))
      .rejects.toThrow("Unknown assistant tool");
  });

  it("uses one typed error for malformed JSON and schema-invalid arguments", async () => {
    await expect(executeTrustedTool({} as never, "get_available_pdf_exports", "{"))
      .rejects.toBeInstanceOf(InvalidToolArgumentsError);
    await expect(executeTrustedTool(
      {} as never,
      "get_latest_load_document",
      JSON.stringify({ category: "Not a document category" }),
    )).rejects.toBeInstanceOf(InvalidToolArgumentsError);
  });

  it("accepts every application document category", async () => {
    const query = resolvedQuery({ data: [], error: null });
    const supabase = { from: vi.fn(() => query) };

    await executeTrustedTool(
      supabase as never,
      "get_latest_load_document",
      JSON.stringify({ category: "Fuel Receipt" }),
    );

    expect(query.eq).toHaveBeenCalledWith("category", "Fuel Receipt");
  });
});
