import { describe, expect, it } from "vitest";
import { agingBucket, defaultDueDate, isOverdue, receivableBalance } from "@/lib/collections";

describe("collections", () => {
  it.each([
    [null, "Current"], ["2026-08-31", "Current"], ["2026-08-30", "1–30"],
    ["2026-08-01", "1–30"], ["2026-07-31", "31–60"], ["2026-07-02", "31–60"],
    ["2026-07-01", "61–90"], ["2026-06-02", "61–90"], ["2026-06-01", "90+"],
  ])("places %s in %s", (dueDate, bucket) => {
    expect(agingBucket(dueDate, "2026-08-31")).toBe(bucket);
  });

  it("does not mark an invoice overdue until the day after its due date", () => {
    expect(isOverdue("2026-08-31", "2026-08-31")).toBe(false);
    expect(isOverdue("2026-08-31", "2026-09-01")).toBe(true);
    expect(isOverdue(null, "2026-09-01")).toBe(false);
  });

  it("reconciles partial payments, credits, adjustments, and write-offs", () => {
    expect(receivableBalance(1_000, [
      { entry_type: "Payment", amount: 400 },
      { entry_type: "Adjustment", amount: 100 },
      { entry_type: "Credit", amount: 50 },
      { entry_type: "Write-off", amount: 650 },
    ])).toBe(0);
  });

  it("derives due dates from explicit invoice dates and terms", () => {
    expect(defaultDueDate("2026-07-01", 30)).toBe("2026-07-31");
  });
});
