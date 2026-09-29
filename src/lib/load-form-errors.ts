export type IssueTarget = { label: string; name?: string; index?: number };

const labels: Record<string, string> = {
  load_number: "Load number",
  load_rate: "Load rate",
  driver_pay: "Driver pay",
  dispatcher_fee: "Dispatcher fee",
  fuel_cost: "Load fuel estimate",
  factoring_percent: "Factoring percentage",
  factoring_fixed_amount: "Factoring amount",
  weight_lbs: "Weight",
  pallet_count: "Pallets",
};

const stopFields: Record<string, { label: string; name: string }> = {
  stop_type: { label: "stop type", name: "stop_type" },
  location: { label: "location", name: "stop_location" },
  scheduled_start: { label: "appointment start", name: "stop_scheduled_start" },
  scheduled_end: { label: "appointment end", name: "stop_scheduled_end" },
  time_zone: { label: "time zone", name: "stop_time_zone" },
};

export function describeLoadIssue(path: string): IssueTarget {
  const [group, row, field] = path.split(".");
  if (group === "stops") {
    const index = Number(row);
    const target = stopFields[field];
    if (row !== undefined && Number.isInteger(index) && target) {
      return { label: `Stop ${index + 1}: ${target.label}`, name: target.name, index };
    }
    return { label: "Stops", name: "stop_type" };
  }
  if (group === "deductions") {
    const index = Number(row);
    if (row !== undefined && Number.isInteger(index) && (field === "label" || field === "amount")) {
      return { label: `Deduction ${index + 1}: ${field === "label" ? "description" : "amount"}`, name: field === "label" ? "deduction_label" : "deduction_amount", index };
    }
    return { label: "Deductions" };
  }
  return { label: labels[path] ?? path.replaceAll("_", " "), name: path };
}
