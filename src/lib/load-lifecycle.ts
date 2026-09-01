import type { Database, LoadStatus } from "@/types/database";

export type LoadCloseoutStatus = Database["public"]["Enums"]["load_closeout_status"];

export const operationalLoadStatuses = [
  "Booked",
  "Dispatched",
  "Picked Up",
  "In Transit",
  "Delivered",
  "Cancelled",
] as const satisfies readonly LoadStatus[];

export const activeTransportationStatuses = [
  "Booked",
  "Dispatched",
  "Picked Up",
  "In Transit",
] as const satisfies readonly LoadStatus[];

export const closeoutStatuses: LoadCloseoutStatus[] = [
  "Awaiting Documents",
  "Documents Complete",
  "Invoiced",
  "Paid",
  "Closed",
];

export function isActiveTransportation(status: LoadStatus) {
  return (activeTransportationStatuses as readonly LoadStatus[]).includes(status);
}

export function closeoutReason(status: LoadCloseoutStatus | null) {
  switch (status) {
    case "Awaiting Documents":
      return "Documents still need to be reviewed and marked complete.";
    case "Documents Complete":
      return "Documents are complete; the invoice has not been sent.";
    case "Invoiced":
      return "The invoice was sent; one or more payments remain outstanding.";
    case "Paid":
      return "All payments are complete; the load is ready to close.";
    case "Closed":
      return "Closeout is complete.";
    default:
      return "Transportation has not been delivered.";
  }
}

export function summarizeLifecycle<T extends { status: LoadStatus; post_delivery_status: LoadCloseoutStatus | null }>(loads: T[]) {
  const closeoutCounts = Object.fromEntries(closeoutStatuses.map((status) => [status, 0])) as Record<LoadCloseoutStatus, number>;
  let activeLoads = 0;
  let deliveredLoads = 0;
  let closedLoads = 0;

  for (const load of loads) {
    if (isActiveTransportation(load.status)) activeLoads += 1;
    if (load.status === "Delivered") deliveredLoads += 1;
    if (load.post_delivery_status) closeoutCounts[load.post_delivery_status] += 1;
    if (load.post_delivery_status === "Closed") closedLoads += 1;
  }

  return {
    activeLoads,
    deliveredLoads,
    postDeliveryLoads: deliveredLoads - closedLoads,
    closedLoads,
    closeoutCounts,
  };
}
