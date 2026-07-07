import { describe, expect, it } from "vitest";
import {
  buildRouteTemplates,
  currentIftaQuarter,
  iftaStateName,
  iftaTotals,
  quarterDateRange,
  quarterLabel,
  quarterOfDate,
  statesWithMiles,
  summarizeIftaByState,
  tripTotalMiles,
} from "@/lib/ifta";

describe("quarterOfDate", () => {
  it("maps months to IFTA quarters", () => {
    expect(quarterOfDate("2025-01-01")).toEqual({ year: 2025, quarter: 1 });
    expect(quarterOfDate("2025-03-31")).toEqual({ year: 2025, quarter: 1 });
    expect(quarterOfDate("2025-04-01")).toEqual({ year: 2025, quarter: 2 });
    expect(quarterOfDate("2025-07-02")).toEqual({ year: 2025, quarter: 3 });
    expect(quarterOfDate("2025-12-31")).toEqual({ year: 2025, quarter: 4 });
  });
});

describe("currentIftaQuarter", () => {
  it("uses the local date", () => {
    expect(currentIftaQuarter(new Date(2026, 6, 1))).toEqual({ year: 2026, quarter: 3 });
    expect(currentIftaQuarter(new Date(2026, 0, 15))).toEqual({ year: 2026, quarter: 1 });
  });
});

describe("quarterDateRange", () => {
  it("returns inclusive quarter boundaries", () => {
    expect(quarterDateRange({ year: 2025, quarter: 1 })).toEqual({ start: "2025-01-01", end: "2025-03-31" });
    expect(quarterDateRange({ year: 2025, quarter: 2 })).toEqual({ start: "2025-04-01", end: "2025-06-30" });
    expect(quarterDateRange({ year: 2025, quarter: 3 })).toEqual({ start: "2025-07-01", end: "2025-09-30" });
    expect(quarterDateRange({ year: 2025, quarter: 4 })).toEqual({ start: "2025-10-01", end: "2025-12-31" });
  });

  it("labels quarters", () => {
    expect(quarterLabel({ year: 2025, quarter: 3 })).toBe("2025 Q3");
  });
});

describe("summarizeIftaByState", () => {
  const trips = [
    { ifta_trip_miles: [{ state: "NV", miles: 124 }, { state: "AZ", miles: 30 }, { state: "UT", miles: 309 }] },
    { ifta_trip_miles: [{ state: "NV", miles: 124 }, { state: "CA", miles: 180 }] },
  ];
  const purchases = [
    { state: "NV", gallons: 74.3, amount_paid: 297 },
    { state: "AZ", gallons: 122.9, amount_paid: 479.01 },
    { state: "NV", gallons: 100, amount_paid: 390.02 },
    { state: "WY", gallons: 50, amount_paid: 200 },
  ];

  it("merges trip miles and fuel purchases per state", () => {
    const summary = summarizeIftaByState(trips, purchases);
    expect(summary).toEqual([
      { state: "AZ", miles: 30, gallons: 122.9, paid: 479.01 },
      { state: "CA", miles: 180, gallons: 0, paid: 0 },
      { state: "NV", miles: 248, gallons: 174.3, paid: 687.02 },
      { state: "UT", miles: 309, gallons: 0, paid: 0 },
      { state: "WY", miles: 0, gallons: 50, paid: 200 },
    ]);
  });

  it("computes grand totals and MPG", () => {
    const totals = iftaTotals(summarizeIftaByState(trips, purchases));
    expect(totals.miles).toBe(767);
    expect(totals.gallons).toBeCloseTo(347.2);
    expect(totals.paid).toBeCloseTo(1366.03);
    expect(totals.mpg).toBeCloseTo(767 / 347.2);
  });

  it("returns null MPG when no gallons are recorded", () => {
    expect(iftaTotals(summarizeIftaByState(trips, [])).mpg).toBeNull();
  });

  it("coerces numeric strings from the database", () => {
    const summary = summarizeIftaByState(
      [{ ifta_trip_miles: [{ state: "NV", miles: "124" as unknown as number }] }],
      [{ state: "NV", gallons: "74.3" as unknown as number, amount_paid: "297" as unknown as number }],
    );
    expect(summary).toEqual([{ state: "NV", miles: 124, gallons: 74.3, paid: 297 }]);
  });
});

describe("tripTotalMiles", () => {
  it("sums the state legs", () => {
    expect(tripTotalMiles([{ state: "NV", miles: 124 }, { state: "AZ", miles: 30 }])).toBe(154);
    expect(tripTotalMiles([])).toBe(0);
  });
});

describe("statesWithMiles", () => {
  it("returns the sorted set of states across trips", () => {
    const states = statesWithMiles([
      { ifta_trip_miles: [{ state: "UT", miles: 309 }, { state: "NV", miles: 124 }] },
      { ifta_trip_miles: [{ state: "NV", miles: 124 }, { state: "AZ", miles: 30 }] },
    ]);
    expect(states).toEqual(["AZ", "NV", "UT"]);
  });
});

describe("buildRouteTemplates", () => {
  it("keeps the newest trip per route, matching routes case-insensitively", () => {
    const routes = buildRouteTemplates([
      { pickup_city: "Fontana", dropoff_city: "Salt Lake", ifta_trip_miles: [{ state: "NV", miles: 124 }, { state: "AZ", miles: 30 }] },
      { pickup_city: "fontana ", dropoff_city: "salt lake", ifta_trip_miles: [{ state: "NV", miles: 999 }] },
      { pickup_city: "Compton", dropoff_city: "Salt Lake", ifta_trip_miles: [{ state: "CA", miles: 50 }, { state: "NV", miles: 200 }] },
    ]);
    expect(routes).toEqual([
      { pickup_city: "Compton", dropoff_city: "Salt Lake", miles: [{ state: "CA", miles: 50 }, { state: "NV", miles: 200 }] },
      { pickup_city: "Fontana", dropoff_city: "Salt Lake", miles: [{ state: "AZ", miles: 30 }, { state: "NV", miles: 124 }] },
    ]);
  });

  it("skips trips without state miles", () => {
    expect(buildRouteTemplates([{ pickup_city: "Jean", dropoff_city: "Moapa", ifta_trip_miles: [] }])).toEqual([]);
  });
});

describe("iftaStateName", () => {
  it("resolves known codes and falls back to the code", () => {
    expect(iftaStateName("NV")).toBe("Nevada");
    expect(iftaStateName("ZZ")).toBe("ZZ");
  });
});
