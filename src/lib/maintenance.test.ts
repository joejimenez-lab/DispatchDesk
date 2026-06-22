import { describe, expect, it } from "vitest";
import {
  calculateInitialTargets,
  calculateNextTargets,
  classifyMaintenanceReminder,
  getDashboardMaintenanceSummary,
  localDateString,
  maintenanceRecurrenceLabel,
  sortMaintenanceAlerts,
  maintenanceTypesForUnit,
  type MaintenanceAlert,
} from "./maintenance";

const today = "2026-06-20";

describe("maintenance recurrence", () => {
  it("uses the Pacific business date instead of the server timezone", () => {
    expect(localDateString(new Date("2026-06-21T06:30:00Z"))).toBe("2026-06-20");
    expect(localDateString(new Date("2026-06-21T08:30:00Z"))).toBe("2026-06-21");
  });

  it.each([
    ["Monthly service", "2026-07-20", 30],
    ["90-day inspection", "2026-09-18", 90],
    ["Annual inspection", "2027-06-20", 365],
  ] as const)("calculates the first %s due date", (type, expectedDate, expectedInterval) => {
    const result = calculateInitialTargets({
      type,
      today,
      unitOdometer: 100_000,
      dueDate: null,
      dueOdometer: null,
      intervalDays: null,
      intervalMiles: null,
    });
    expect(result.dueDate).toBe(expectedDate);
    expect(result.intervalDays).toBe(expectedInterval);
  });

  it("defaults oil changes to an editable 5,000-mile cadence", () => {
    const result = calculateInitialTargets({
      type: "Oil change",
      today,
      unitOdometer: 100_000,
      dueDate: null,
      dueOdometer: null,
      intervalDays: null,
      intervalMiles: null,
    });
    expect(result.intervalMiles).toBe(5_000);
    expect(result.dueOdometer).toBe(105_000);
  });

  it("respects a client's custom oil-change interval", () => {
    const result = calculateInitialTargets({
      type: "Oil change",
      today,
      unitOdometer: 40_000,
      dueDate: null,
      dueOdometer: null,
      intervalDays: null,
      intervalMiles: 7_500,
    });
    expect(result.dueOdometer).toBe(47_500);
    expect(result.intervalMiles).toBe(7_500);
  });

  it("keeps both targets for a whichever-comes-first schedule", () => {
    expect(calculateInitialTargets({
      type: "Oil change",
      today,
      unitOdometer: 40_000,
      dueDate: "2026-09-01",
      dueOdometer: null,
      intervalDays: 90,
      intervalMiles: 5_000,
    })).toEqual({
      dueDate: "2026-09-01",
      dueOdometer: 45_000,
      intervalDays: 90,
      intervalMiles: 5_000,
    });
  });

  it("calculates the next date and mileage targets after completion", () => {
    expect(calculateNextTargets({
      completedDate: today,
      completedOdometer: 125_000,
      intervalDays: 90,
      intervalMiles: 5_000,
    })).toEqual({ dueDate: "2026-09-18", dueOdometer: 130_000 });
  });

  it("labels one-time, date, mileage, and combined recurrence correctly", () => {
    expect(maintenanceRecurrenceLabel({ interval_days: null, interval_miles: null })).toBe("One time");
    expect(maintenanceRecurrenceLabel({ interval_days: 30, interval_miles: null })).toBe("30 days");
    expect(maintenanceRecurrenceLabel({ interval_days: null, interval_miles: 5_000 })).toBe("5,000 mi");
    expect(maintenanceRecurrenceLabel({ interval_days: 90, interval_miles: 5_000 })).toBe("90 days · 5,000 mi");
  });

  it("keeps truck-only schedules and daily logs out of trailer reminder options", () => {
    expect(maintenanceTypesForUnit("Truck")).toContain("Monthly service");
    expect(maintenanceTypesForUnit("Truck")).toContain("Oil change");
    expect(maintenanceTypesForUnit("Trailer")).not.toContain("Monthly service");
    expect(maintenanceTypesForUnit("Trailer")).not.toContain("Oil change");
    expect(maintenanceTypesForUnit("Trailer")).not.toContain("Daily repair log");
  });
});

describe("maintenance alert classification", () => {
  const base = { warning_days: 30, warning_miles: 500, snoozed_until: null };

  it("classifies overdue, due-soon, and upcoming date reminders", () => {
    expect(classifyMaintenanceReminder({ ...base, due_date: "2026-06-19", due_odometer: null }, null, today).status).toBe("overdue");
    expect(classifyMaintenanceReminder({ ...base, due_date: "2026-07-01", due_odometer: null }, null, today).status).toBe("due-soon");
    expect(classifyMaintenanceReminder({ ...base, due_date: "2026-09-01", due_odometer: null }, null, today).status).toBe("upcoming");
  });

  it("classifies mileage-based oil changes using the configured warning distance", () => {
    expect(classifyMaintenanceReminder({ ...base, due_date: null, due_odometer: 100_000 }, 99_600, today).status).toBe("due-soon");
    expect(classifyMaintenanceReminder({ ...base, due_date: null, due_odometer: 100_000 }, 100_001, today).status).toBe("overdue");
  });

  it("uses whichever target is most urgent when both are present", () => {
    const result = classifyMaintenanceReminder(
      { ...base, due_date: "2026-12-01", due_odometer: 100_000 },
      99_600,
      today,
    );
    expect(result.status).toBe("due-soon");
  });

  it("treats exact warning and due thresholds consistently", () => {
    expect(classifyMaintenanceReminder(
      { ...base, due_date: "2026-07-20", due_odometer: null },
      null,
      today,
    ).status).toBe("due-soon");
    const mileage = classifyMaintenanceReminder(
      { ...base, due_date: null, due_odometer: 100_000 },
      100_000,
      today,
    );
    expect(mileage.status).toBe("due-soon");
    expect(mileage.milesRemaining).toBe(0);
  });

  it("does not invent mileage status when the unit has no odometer", () => {
    const result = classifyMaintenanceReminder(
      { ...base, due_date: null, due_odometer: 100_000 },
      null,
      today,
    );
    expect(result.status).toBe("upcoming");
    expect(result.milesRemaining).toBeNull();
  });

  it("marks future-snoozed reminders without changing their real status", () => {
    const result = classifyMaintenanceReminder({ ...base, due_date: "2026-06-19", due_odometer: null, snoozed_until: "2026-06-27" }, null, today);
    expect(result.status).toBe("overdue");
    expect(result.snoozed).toBe(true);
  });
});

describe("dashboard maintenance summary", () => {
  function alert(status: MaintenanceAlert["status"], snoozed = false): MaintenanceAlert {
    return { status, snoozed } as MaintenanceAlert;
  }

  it("excludes snoozed reminders from actionable counts and dashboard cards", () => {
    const alerts = sortMaintenanceAlerts([
      alert("upcoming"),
      alert("due-soon"),
      alert("overdue"),
      alert("overdue", true),
    ]);
    const summary = getDashboardMaintenanceSummary(alerts);
    expect(summary.counts).toEqual({ overdue: 1, "due-soon": 1, upcoming: 1 });
    expect(summary.visible.map((item) => item.status)).toEqual(["overdue", "due-soon"]);
  });

  it("limits the dashboard without limiting the all-alerts collection", () => {
    const alerts = Array.from({ length: 12 }, () => alert("due-soon"));
    expect(getDashboardMaintenanceSummary(alerts).visible).toHaveLength(8);
    expect(alerts).toHaveLength(12);
  });
});
