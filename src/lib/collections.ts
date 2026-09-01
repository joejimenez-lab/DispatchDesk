export type ReceivableEntry = {
  entry_type: "Payment" | "Adjustment" | "Credit" | "Write-off";
  amount: number;
};

export type AgingBucket = "Current" | "1–30" | "31–60" | "61–90" | "90+";
export const agingBuckets: AgingBucket[] = ["Current", "1–30", "31–60", "61–90", "90+"];

export function entryEffect(entry: ReceivableEntry) {
  return entry.entry_type === "Adjustment" ? -Number(entry.amount) : Number(entry.amount);
}

export function receivableBalance(loadRate: number, entries: ReceivableEntry[]) {
  return Math.max(Number(loadRate) - entries.reduce((total, entry) => total + entryEffect(entry), 0), 0);
}

function utcDay(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

export function daysPastDue(dueDate: string | null, asOf: string) {
  if (!dueDate) return 0;
  return Math.max(0, Math.round((utcDay(asOf) - utcDay(dueDate)) / 86_400_000));
}

export function agingBucket(dueDate: string | null, asOf: string): AgingBucket {
  const days = daysPastDue(dueDate, asOf);
  if (days <= 0) return "Current";
  if (days <= 30) return "1–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

export function isOverdue(dueDate: string | null, asOf: string) {
  return Boolean(dueDate && dueDate < asOf);
}

export function defaultDueDate(invoiceDate: string, termsDays: number) {
  const date = new Date(`${invoiceDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + termsDays);
  return date.toISOString().slice(0, 10);
}
