import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { MaintenanceCostFields } from "@/components/maintenance-cost-fields";
import { updateMaintenanceSpending } from "@/lib/actions/maintenance";
import { currency } from "@/lib/utils";

type ExpenseLink = {
  id: string;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
  bookkeeping_expenses: { id: string; amount: number; line_type: string }[];
  bookkeeping_receipts: { id: string }[];
};

export function MaintenanceSpendingEditor({
  table,
  recordId,
  unitId,
  date,
  odometer,
  notes,
  cost,
  expense,
}: {
  table: "service_records" | "inspection_records" | "repair_logs";
  recordId: string;
  unitId: string;
  date: string | null;
  odometer: number | null;
  notes: string | null;
  cost: number;
  expense?: ExpenseLink;
}) {
  if (!expense) {
    return cost > 0 ? <Link href="/bookkeeping" className="text-xs font-medium text-amber-700 underline">Cost not linked · reconcile in Bookkeeping</Link> : null;
  }
  const labor = Number(expense.bookkeeping_expenses.find((line) => line.line_type === "labor")?.amount ?? 0);
  const parts = Number(expense.bookkeeping_expenses.find((line) => line.line_type === "parts")?.amount ?? 0);
  const total = expense.bookkeeping_expenses.reduce((sum, line) => sum + Number(line.amount), 0);
  const mode = labor > 0 || parts > 0 ? "breakdown" : "total";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Link href={`/bookkeeping?unit=${unitId}&from=${expense.expense_date}&to=${expense.expense_date}`} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-200">
        Bookkeeping {currency(total)} · {expense.bookkeeping_receipts.length} receipt{expense.bookkeeping_receipts.length === 1 ? "" : "s"}
      </Link>
      <details>
        <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium">Edit spending</summary>
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:absolute sm:left-1/2 sm:z-10 sm:w-[min(46rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:shadow-xl">
          <ActionForm action={updateMaintenanceSpending.bind(null, table, recordId, unitId)} className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><Input type="date" name="completed_date" required defaultValue={date ?? expense.expense_date} /></Field>
            <input type="hidden" name="odometer" value={odometer ?? ""} />
            <MaintenanceCostFields defaultMode={mode} total={total} labor={labor} parts={parts} vendor={expense.vendor ?? ""} includeReceipt={false} />
            <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={notes ?? expense.notes ?? ""} /></Field>
            <SubmitButton className="sm:w-fit" pendingText="Saving...">Save everywhere</SubmitButton>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
