import { describe, expect, it } from "vitest";
import { renderWeeklySummaryPdf } from "./weekly-summary-pdf";

describe("weekly summary PDF", () => {
  it("renders a valid PDF when the selected period has no loads", async () => {
    const pdf = await renderWeeklySummaryPdf([], { from: "2026-06-01", to: "2026-06-07" }, new Date("2026-06-08T12:00:00Z"));

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(4_000);
  });
});
