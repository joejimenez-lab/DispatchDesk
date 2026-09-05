import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/button";
import { Field, Input } from "@/components/field";
import { FleetScopeTabs } from "@/components/fleet-scope-tabs";
import { getLoadFleetCompanies } from "@/lib/data/fleet";
import { getInvoices } from "@/lib/data/invoices";
import { fleetScopeLabel, fleetScopeParam, parseFleetScope } from "@/lib/fleet-scope";
import { invoiceStatusClass } from "@/lib/invoices";
import { currency, formatDate } from "@/lib/utils";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ fleet?: string; q?: string }> }) {
  const params = await searchParams;
  const companies = await getLoadFleetCompanies();
  const scope = parseFleetScope(params.fleet, companies);
  if (!scope) notFound();
  const invoices = await getInvoices(scope, params.q);
  const fleet = fleetScopeParam(scope);
  const createHref = fleet ? `/invoices/new?fleet=${encodeURIComponent(fleet)}` : "/invoices/new";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Invoices</h1>
          <p className="text-sm text-zinc-600">{fleetScopeLabel(scope)} · Create and review load invoices.</p>
        </div>
        <LinkButton href={createHref}>New invoice</LinkButton>
      </div>

      <FleetScopeTabs basePath="/invoices" companies={companies} scope={scope} params={{ q: params.q }} />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        {fleet ? <input type="hidden" name="fleet" value={fleet} /> : null}
        <Field label="Search" className="min-w-64 flex-1">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Invoice, load, customer, or lane" />
        </Field>
        <button className="h-10 rounded-xl bg-[#6757e8] px-4 text-sm font-semibold text-white hover:bg-[#5143c2]">Search</button>
        <Link href={fleet ? `/invoices?fleet=${encodeURIComponent(fleet)}` : "/invoices"} className="flex h-10 items-center rounded-xl border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Load</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Invoice date</th>
              <th className="px-4 py-3">Due date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-semibold"><Link href={`/invoices/${invoice.load_id}`} className="block">{invoice.invoice_number ?? "Draft"}</Link></td>
                <td className="px-4 py-3"><Link href={`/invoices/${invoice.load_id}`} className="block">{invoice.loads.load_number}</Link></td>
                <td className="px-4 py-3"><Link href={`/invoices/${invoice.load_id}`} className="block">{invoice.loads.brokers?.company_name ?? "Not set"}</Link></td>
                <td className="px-4 py-3"><Link href={`/invoices/${invoice.load_id}`} className="block">{currency(invoice.loads.load_rate)}</Link></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invoiceStatusClass(invoice.invoice_status)}`}>{invoice.invoice_status}</span></td>
                <td className="px-4 py-3">{invoice.invoice_date ? formatDate(invoice.invoice_date) : "Not set"}</td>
                <td className="px-4 py-3">{invoice.due_date ? formatDate(invoice.due_date) : "Not set"}</td>
              </tr>
            ))}
            {!invoices.length ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">No invoices found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
