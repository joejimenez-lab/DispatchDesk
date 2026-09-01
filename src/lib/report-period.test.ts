import { describe, expect, it } from "vitest";
import { normalizeReportPeriod } from "./report-period";

describe("report period defaults", () => {
  it("starts on the current week and preserves valid explicit periods", () => {
    expect(normalizeReportPeriod(undefined)).toBe("this");
    expect(normalizeReportPeriod("unexpected")).toBe("this");
    expect(normalizeReportPeriod("all")).toBe("all");
    expect(normalizeReportPeriod("custom")).toBe("custom");
  });
});
