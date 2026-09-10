import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/button";
import { Field, Input } from "@/components/field";
import { CompanyScopeTabs } from "@/components/company-scope-tabs";
import { getLoadCompanies } from "@/lib/data/companies";
import { getInvoices } from "@/lib/data/invoices";
import { companyScopeLabel, companyScopeParam, parseCompanyScope } from "@/lib/company-scope";
import { invoiceStatusClass } from "@/lib/invoices";
import { currency, formatDate } from "@/lib/utils";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ company?: string; fleet?: string; q?: string }> }) {
  const params = await searchParams;
  const companies = await getLoadCompanies();
  const scope = parseCompanyScope(params.company ?? params.fleet, companies);
  if (!scope) notFound();
  const invoices = await getInvoices(scope, params.q);
  const company = companyScopeParam(scope);
  const createHref = company ? `/invoices/new?company=${encodeURIComponent(company)}` : "/invoices/new";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Invoices</h1>
          <p className="text-sm text-zinc-600">{companyScopeLabel(scope)} · Create and review load invoices.</p>
        </div>
        <LinkButton href={createHref}>New invoice</LinkButton>
      </div>

      <CompanyScopeTabs basePath="/invoices" companies={companies} scope={scope} params={{ q: params.q }} />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        {company ? <input type="hidden" name="company" value={company} /> : null}
        <Field label="Search" className="min-w-64 flex-1">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Invoice, load, customer, or lane" />
        </Field>
        <button className="h-10 rounded-xl bg-[#6757e8] px-4 text-sm font-semibold text-white hover:bg-[#5143c2]">Search</button>
        <Link href={company ? `/invoices?company=${encodeURIComponent(company)}` : "/invoices"} className="flex h-10 items-center rounded-xl border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Load</th>
              <th className="px-4 py-3">Carrier Company</th>
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
                <td className="px-4 py-3">{invoice.loads.accounting_company ?? "Unassigned"}</td>
                <td className="px-4 py-3"><Link href={`/invoices/${invoice.load_id}`} className="block">{invoice.loads.brokers?.company_name ?? "Not set"}</Link></td>
                <td className="px-4 py-3"><Link href={`/invoices/${invoice.load_id}`} className="block">{currency(invoice.loads.load_rate)}</Link></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invoiceStatusClass(invoice.invoice_status)}`}>{invoice.invoice_status}</span></td>
                <td className="px-4 py-3">{invoice.invoice_date ? formatDate(invoice.invoice_date) : "Not set"}</td>
                <td className="px-4 py-3">{invoice.due_date ? formatDate(invoice.due_date) : "Not set"}</td>
              </tr>
            ))}
            {!invoices.length ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-zinc-500">No invoices found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
