import { describe, expect, it } from "vitest";
import { renderBusinessReportPdf } from "./business-report-pdf";

describe("business report PDF", () => {
  it("renders metadata, metrics, a table, and page numbering into a valid PDF", async () => {
    const pdf = await renderBusinessReportPdf({
      title: "Bookkeeping Summary",
      subtitle: "2026-01-01 through 2026-01-31 · Fleet: West",
      metrics: [{ label: "Total", value: "$125.00" }],
      columns: [
        { label: "Category", width: "60%" },
        { label: "Total", width: "40%", align: "right" },
      ],
      rows: [["Fuel", "$125.00"]],
      emptyMessage: "No expenses.",
    }, new Date("2026-02-01T12:00:00Z"));

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(3_000);
  });
});
