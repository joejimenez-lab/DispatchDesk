import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

vi.mock("@/lib/data/fleet", () => ({
  getLoadFleetCompanies: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/data/dashboard", () => ({
  getDashboardMetrics: vi.fn().mockResolvedValue({
    activeLoads: 4,
    deliveredLoads: 12,
    unpaidLoads: 3,
    totalRevenue: 25000,
    collectedRevenue: 20000,
    outstandingRevenue: 5000,
    totalDeductions: 0,
    estimatedProfit: 10000,
    pendingDriverPayments: 0,
    pendingDispatcherFees: 0,
    currentLoads: [],
    unpaidAlerts: [],
    upcomingDeliveries: [],
    maintenanceAlerts: [],
    maintenanceCounts: { unconfigured: 0, overdue: 0, "due-soon": 0, upcoming: 0 },
    statusCounts: [],
  }),
}));

describe("DashboardPage", () => {
  it("uses the classic dashboard summary and compact section order", async () => {
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Active loads");
    expect(html).toContain("Delivered loads");
    expect(html).toContain("Unpaid loads");
    expect(html).toContain("Total revenue");
    expect(html).toContain("Current loads");
    expect(html).not.toContain("Post-delivery closeout");
    expect(html).not.toContain("Active transportation");
  });
});
