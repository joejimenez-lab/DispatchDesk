import { maintenanceReminderTypes, type Database, type MaintenanceReminderType, type UnitType } from "../types/database";

export const DEFAULT_WARNING_DAYS = 30;
export const DEFAULT_WARNING_MILES = 500;
export const BUSINESS_TIME_ZONE = "America/Los_Angeles";

const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type MaintenanceStatus = "overdue" | "due-soon" | "upcoming";
export type MaintenanceReminderRow = Database["public"]["Tables"]["maintenance_reminders"]["Row"];

export type MaintenanceAlert = MaintenanceReminderRow & {
  unit: {
    id: string;
    unit_number: string;
    unit_type: UnitType;
    odometer: number | null;
    company?: string | null;
  };
  status: MaintenanceStatus;
  daysRemaining: number | null;
  milesRemaining: number | null;
  snoozed: boolean;
};

export function localDateString(date = new Date()) {
  return businessDateFormatter.format(date);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function defaultIntervalDays(type: MaintenanceReminderType) {
  if (type === "Monthly service") return 30;
  if (type === "90-day inspection") return 90;
  if (type === "Annual inspection") return 365;
  return null;
}

export function maintenanceTypesForUnit(unitType: UnitType | null) {
  if (!unitType) return maintenanceReminderTypes;
  if (unitType === "Trailer") {
    return maintenanceReminderTypes.filter((type) => type !== "Monthly service" && type !== "Oil change");
  }
  return maintenanceReminderTypes;
}

export function isMaintenanceTypeAllowedForUnit(type: MaintenanceReminderType, unitType: UnitType) {
  return maintenanceTypesForUnit(unitType).includes(type);
}

export function defaultIntervalMiles(type: MaintenanceReminderType) {
  return type === "Oil change" ? 5_000 : null;
}

export function calculateInitialTargets({
  type,
  today,
  unitOdometer,
  dueDate,
  dueOdometer,
  intervalDays,
  intervalMiles,
}: {
  type: MaintenanceReminderType;
  today: string;
  unitOdometer: number | null;
  dueDate: string | null;
  dueOdometer: number | null;
  intervalDays: number | null;
  intervalMiles: number | null;
}) {
  const normalizedIntervalDays = intervalDays ?? defaultIntervalDays(type);
  const normalizedIntervalMiles = intervalMiles ?? defaultIntervalMiles(type);
  const normalizedDueDate = dueDate ?? (normalizedIntervalDays ? addDays(today, normalizedIntervalDays) : null);
  const normalizedDueOdometer = dueOdometer ?? (
    normalizedIntervalMiles != null && unitOdometer != null ? unitOdometer + normalizedIntervalMiles : null
  );

  return {
    intervalDays: normalizedIntervalDays,
    intervalMiles: normalizedIntervalMiles,
    dueDate: normalizedDueDate,
    dueOdometer: normalizedDueOdometer,
  };
}

export function calculateNextTargets({
  completedDate,
  completedOdometer,
  intervalDays,
  intervalMiles,
}: {
  completedDate: string;
  completedOdometer: number | null;
  intervalDays: number | null;
  intervalMiles: number | null;
}) {
  return {
    dueDate: intervalDays ? addDays(completedDate, intervalDays) : null,
    dueOdometer: intervalMiles != null && completedOdometer != null
      ? completedOdometer + intervalMiles
      : null,
  };
}

export function maintenanceRecurrenceLabel(
  reminder: Pick<MaintenanceReminderRow, "interval_days" | "interval_miles">,
) {
  const intervals = [];
  if (reminder.interval_days) intervals.push(`${reminder.interval_days} days`);
  if (reminder.interval_miles) intervals.push(`${reminder.interval_miles.toLocaleString()} mi`);
  return intervals.length ? intervals.join(" · ") : "One time";
}

export function maintenanceWillRepeat(
  reminder: Pick<MaintenanceReminderRow, "interval_days" | "interval_miles">,
) {
  return reminder.interval_days != null || reminder.interval_miles != null;
}

export function classifyMaintenanceReminder(
  reminder: Pick<MaintenanceReminderRow, "due_date" | "due_odometer" | "warning_days" | "warning_miles" | "snoozed_until">,
  unitOdometer: number | null,
  today = localDateString(),
) {
  const daysRemaining = reminder.due_date ? daysBetween(today, reminder.due_date) : null;
  const milesRemaining = reminder.due_odometer != null && unitOdometer != null
    ? reminder.due_odometer - unitOdometer
    : null;
  const overdue = (daysRemaining != null && daysRemaining < 0) || (milesRemaining != null && milesRemaining < 0);
  const dueSoon = (daysRemaining != null && daysRemaining <= reminder.warning_days)
    || (milesRemaining != null && milesRemaining <= reminder.warning_miles);
  const snoozed = reminder.snoozed_until != null && reminder.snoozed_until > today;

  return {
    status: overdue ? "overdue" as const : dueSoon ? "due-soon" as const : "upcoming" as const,
    daysRemaining,
    milesRemaining,
    snoozed,
  };
}

const statusOrder: Record<MaintenanceStatus, number> = { overdue: 0, "due-soon": 1, upcoming: 2 };

export function sortMaintenanceAlerts(alerts: MaintenanceAlert[]) {
  return [...alerts].sort((a, b) => {
    const statusDifference = statusOrder[a.status] - statusOrder[b.status];
    if (statusDifference) return statusDifference;
    if (a.daysRemaining != null && b.daysRemaining != null) return a.daysRemaining - b.daysRemaining;
    if (a.daysRemaining != null) return -1;
    if (b.daysRemaining != null) return 1;
    return (a.milesRemaining ?? Number.MAX_SAFE_INTEGER) - (b.milesRemaining ?? Number.MAX_SAFE_INTEGER);
  });
}

export function getDashboardMaintenanceSummary(alerts: MaintenanceAlert[], limit = 8) {
  const counts = alerts.reduce(
    (result, reminder) => {
      if (!reminder.snoozed) result[reminder.status] += 1;
      return result;
    },
    { overdue: 0, "due-soon": 0, upcoming: 0 },
  );
  const visible = alerts
    .filter((reminder) => !reminder.snoozed && reminder.status !== "upcoming")
    .slice(0, limit);

  return { counts, visible };
}
