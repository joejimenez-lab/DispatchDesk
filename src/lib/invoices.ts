export const invoiceStatuses = ["Draft", "Sent", "Void"] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];

export function invoiceStatusClass(status: string | null) {
  if (status === "Sent") return "bg-green-100 text-green-800";
  if (status === "Void") return "bg-zinc-200 text-zinc-700";
  return "bg-amber-100 text-amber-900";
}
