import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { BookkeepingExpenseForm } from "@/components/bookkeeping-expense-form";
import { DetailsCloseButton } from "@/components/details-close-button";
import { ExportMenu } from "@/components/export-menu";
import { Field, Input, Select } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import {
  addBookkeepingExpense,
  deleteBookkeepingExpense,
  deleteBookkeepingReceipt,
  updateBookkeepingExpense,
  uploadBookkeepingReceipt,
} from "@/lib/actions/bookkeeping";
import { expenseCategoryTone, receiptAccept } from "@/lib/bookkeeping";
import {
  getBookkeepingExpenses,
  getBookkeepingOptions,
  normalizeExpenseCategory,
  type BookkeepingExpense,
  type BookkeepingOptions,
} from "@/lib/data/bookkeeping";
import { cn, currency, formatDate } from "@/lib/utils";
import { expenseCategories } from "@/types/database";

function linkedMaintenance(expense: BookkeepingExpense) {
  if (expense.service_records) return `Service - ${expense.service_records.description}`;
  if (expense.inspection_records) return `Inspection - ${expense.inspection_records.result ?? "Inspection"}`;
  if (expense.repair_logs) return `${expense.repair_logs.log_type} - ${expense.repair_logs.description}`;
  return null;
}

function linkedUnit(expense: BookkeepingExpense) {
  return expense.fleet_units ? `${expense.fleet_units.unit_type} ${expense.fleet_units.unit_number}` : null;
}

function linkedItems(expense: BookkeepingExpense) {
  return [
    linkedUnit(expense),
    expense.loads ? `Load ${expense.loads.load_number}` : null,
    expense.drivers?.name ? `Driver ${expense.drivers.name}` : null,
    linkedMaintenance(expense),
  ].filter((item): item is string => Boolean(item));
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="text-sm font-medium text-zinc-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function ExpenseCard({ expense, options }: { expense: BookkeepingExpense; options: BookkeepingOptions }) {
  const links = linkedItems(expense);
  const maintenanceLinked = Boolean(
    expense.service_record_id || expense.inspection_record_id || expense.repair_log_id,
  );

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              expenseCategoryTone(expense.category),
            )}>
              {expense.category}
            </span>
            {maintenanceLinked ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                Maintenance linked
              </span>
            ) : null}
            <span className="text-sm text-zinc-500">{formatDate(expense.expense_date)}</span>
          </div>
          <h2 className="mt-2 break-words text-lg font-semibold text-zinc-950">
            {expense.vendor || "No vendor"} <span className="text-zinc-400">/</span> {currency(expense.amount)}
          </h2>
          {links.length ? (
            <p className="mt-1 text-sm text-zinc-600">{links.join(" | ")}</p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">No linked truck, trailer, load, driver, or maintenance record.</p>
          )}
          {expense.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{expense.notes}</p> : null}
        </div>

        <ActionForm action={deleteBookkeepingExpense.bind(null, expense.id)} successMessage={false}>
          <ConfirmSubmitButton message={`Delete this ${expense.category.toLowerCase()} expense?`} variant="secondary">
            Delete
          </ConfirmSubmitButton>
        </ActionForm>
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <div className="mb-2 text-sm font-semibold text-zinc-950">Receipts</div>
        <div className="divide-y divide-zinc-100">
          {expense.bookkeeping_receipts.map((receipt) => (
            <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div>
                <div className="text-sm font-medium text-zinc-900">{receipt.file_name}</div>
                <div className="text-xs text-zinc-500">{new Date(receipt.created_at).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/api/bookkeeping/receipts/${receipt.id}/view`}
                  target="_blank"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium"
                >
                  View
                </Link>
                <Link
                  href={`/api/bookkeeping/receipts/${receipt.id}/download`}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium"
                >
                  Download
                </Link>
                <ActionForm action={deleteBookkeepingReceipt.bind(null, receipt.id, receipt.storage_path)} successMessage={false}>
                  <ConfirmSubmitButton message={`Delete receipt ${receipt.file_name}?`} variant="secondary">
                    Delete
                  </ConfirmSubmitButton>
                </ActionForm>
              </div>
            </div>
          ))}
          {!expense.bookkeeping_receipts.length ? (
            <p className="py-2 text-sm text-zinc-500">No receipts uploaded.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-2">
        <details className="group">
          <summary className="w-fit cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <span className="group-open:hidden">Edit expense</span>
            <span className="hidden group-open:inline">Close edit</span>
          </summary>
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <BookkeepingExpenseForm
              action={updateBookkeepingExpense.bind(null, expense.id)}
              options={options}
              expense={expense}
              submitLabel="Save expense"
            />
          </div>
        </details>

        <details className="group">
          <summary className="w-fit cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <span className="group-open:hidden">Upload receipt</span>
            <span className="hidden group-open:inline">Close upload</span>
          </summary>
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <ActionForm action={uploadBookkeepingReceipt.bind(null, expense.id)} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                name="file"
                type="file"
                accept={receiptAccept}
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
              <SubmitButton pendingText="Uploading...">Upload receipt</SubmitButton>
            </ActionForm>
          </div>
        </details>
      </div>
    </article>
  );
}

export default async function BookkeepingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string; unit?: string; load?: string; driver?: string }>;
}) {
  const params = await searchParams;
  const [expenses, options] = await Promise.all([
    getBookkeepingExpenses(params),
    getBookkeepingOptions(),
  ]);
  const category = normalizeExpenseCategory(params.category);
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const fuelTotal = expenses
    .filter((expense) => expense.category === "Fuel")
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const maintenanceTotal = expenses
    .filter((expense) => expense.category === "Maintenance" || linkedMaintenance(expense))
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const receiptCount = expenses.reduce((sum, expense) => sum + expense.bookkeeping_receipts.length, 0);

  const exportParams = new URLSearchParams();
  if (params.from) exportParams.set("from", params.from);
  if (params.to) exportParams.set("to", params.to);
  if (category) exportParams.set("category", category);
  if (params.unit) exportParams.set("unit", params.unit);
  if (params.load) exportParams.set("load", params.load);
  if (params.driver) exportParams.set("driver", params.driver);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Bookkeeping</h1>
          <p className="text-sm text-zinc-600">Expense records, receipt uploads, and CSV export for tax review.</p>
        </div>
        <ExportMenu
          heading="Bookkeeping export"
          description="The CSV uses the filters on this page."
          items={[
            {
              title: "Expenses",
              description: "Expense records with linked units, loads, drivers, maintenance records, and receipt filenames.",
              formats: [{ label: "CSV", href: `/api/bookkeeping/export?${exportParams.toString()}`, type: "csv" }],
            },
          ]}
        />
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-6">
        <Field label="From">
          <Input type="date" name="from" defaultValue={params.from ?? ""} />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={params.to ?? ""} />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={category ?? ""}>
            <option value="">All</option>
            {expenseCategories.map((expenseCategory) => (
              <option key={expenseCategory} value={expenseCategory}>
                {expenseCategory}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Truck / Trailer">
          <Select name="unit" defaultValue={params.unit ?? ""}>
            <option value="">All</option>
            {options.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_type} {unit.unit_number}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Driver">
          <Select name="driver" defaultValue={params.driver ?? ""}>
            <option value="">All</option>
            {options.drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">Filter</button>
          <Link href="/bookkeeping" className="flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">
            Reset
          </Link>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total expenses" value={currency(total)} />
        <SummaryCard label="Fuel" value={currency(fuelTotal)} />
        <SummaryCard label="Maintenance linked" value={currency(maintenanceTotal)} />
        <SummaryCard label="Receipts" value={receiptCount} />
      </section>

      <details className="group">
        <summary className="w-fit cursor-pointer list-none rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800">
          + Add expense
        </summary>
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:absolute lg:left-1/2 lg:z-10 lg:w-[min(68rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:shadow-xl">
          <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
          <BookkeepingExpenseForm
            action={addBookkeepingExpense}
            options={options}
            submitLabel="Add expense"
            pendingText="Adding..."
            includeReceipt
          />
        </div>
      </details>

      <section className="grid gap-4">
        {expenses.map((expense) => (
          <ExpenseCard key={expense.id} expense={expense} options={options} />
        ))}
        {!expenses.length ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No bookkeeping expenses match these filters.
          </p>
        ) : null}
      </section>
    </div>
  );
}
