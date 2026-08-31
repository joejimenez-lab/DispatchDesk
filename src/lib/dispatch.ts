export const stopTypes = ["Pickup", "Delivery", "Intermediate", "Return"] as const;
export type StopType = (typeof stopTypes)[number];

export const dispatchTimeZones = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
] as const;

export type DispatchStop = {
  id?: string;
  position: number;
  stop_type: StopType;
  location: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  schedule_precision: "date" | "window";
  time_zone: string | null;
  appointment_number: string | null;
  reference_number: string | null;
  instructions: string | null;
};

export type AssignmentWindow = {
  loadId: string;
  loadNumber: string;
  driverId: string | null;
  driverName: string | null;
  truckUnitId: string | null;
  truckNumber: string | null;
  trailerUnitId: string | null;
  trailerNumber: string | null;
  startMs: number;
  endMs: number;
};

export type AssignmentSelection = {
  driverId: string | null;
  truckUnitId: string | null;
  trailerUnitId: string | null;
};

export type AssignmentConflict = AssignmentWindow & { resources: string[] };

function partsAt(epoch: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epoch));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
}

export function zonedDateTimeToEpoch(localDateTime: string | null, timeZone: string | null) {
  if (!localDateTime || !timeZone) return null;
  const desired = Date.parse(`${localDateTime.slice(0, 19)}Z`);
  if (!Number.isFinite(desired)) return null;
  try {
    let guess = desired;
    for (let index = 0; index < 3; index += 1) guess += desired - partsAt(guess, timeZone);
    return guess;
  } catch {
    return null;
  }
}

export function scheduleWindow(stops: DispatchStop[]) {
  const windows = stops
    .filter((stop) => stop.schedule_precision === "window")
    .map((stop) => ({
      start: zonedDateTimeToEpoch(stop.scheduled_start, stop.time_zone),
      end: zonedDateTimeToEpoch(stop.scheduled_end, stop.time_zone),
    }))
    .filter((window): window is { start: number; end: number } => window.start !== null && window.end !== null);
  if (!windows.length) return null;
  return { startMs: Math.min(...windows.map((window) => window.start)), endMs: Math.max(...windows.map((window) => window.end)) };
}

export function findAssignmentConflicts(
  selection: AssignmentSelection,
  stops: DispatchStop[],
  windows: AssignmentWindow[],
  excludeLoadId?: string,
): AssignmentConflict[] {
  const draft = scheduleWindow(stops);
  if (!draft) return [];
  return windows.flatMap((window) => {
    if (window.loadId === excludeLoadId || draft.startMs >= window.endMs || draft.endMs <= window.startMs) return [];
    const resources = [
      selection.driverId && selection.driverId === window.driverId ? `Driver ${window.driverName ?? "assigned"}` : null,
      selection.truckUnitId && selection.truckUnitId === window.truckUnitId ? `Truck ${window.truckNumber ?? "assigned"}` : null,
      selection.trailerUnitId && selection.trailerUnitId === window.trailerUnitId ? `Trailer ${window.trailerNumber ?? "assigned"}` : null,
    ].filter((value): value is string => Boolean(value));
    return resources.length ? [{ ...window, resources }] : [];
  });
}

export function stopDate(stop: DispatchStop) {
  return stop.scheduled_start?.slice(0, 10) ?? null;
}

export function formatLocalDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  const parsed = new Date(`${value.slice(0, 19)}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(parsed);
}

export function formatStopWindow(stop: DispatchStop) {
  if (!stop.scheduled_start) return "Schedule missing";
  if (stop.schedule_precision === "date") {
    const parsed = new Date(`${stop.scheduled_start.slice(0, 10)}T00:00:00Z`);
    return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(parsed)} · date only`;
  }
  const zone = stop.time_zone?.replace("America/", "").replaceAll("_", " ") ?? "Time zone missing";
  return `${formatLocalDateTime(stop.scheduled_start)} – ${formatLocalDateTime(stop.scheduled_end)} · ${zone}`;
}

export function isLateStop(stop: DispatchStop, now = Date.now()) {
  if (stop.schedule_precision !== "window") return false;
  const end = zonedDateTimeToEpoch(stop.scheduled_end, stop.time_zone);
  return end !== null && end < now;
}
