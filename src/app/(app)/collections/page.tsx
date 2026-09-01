import Link from "next/link";
import { notFound } from "next/navigation";
import { DollarSign, Clock3, CalendarCheck2, UserRound, type LucideIcon } from "lucide-react";
import { FleetScopeTabs } from "@/components/fleet-scope-tabs";
import { Select } from "@/components/field";
import { agingBuckets } from "@/lib/collections";
import { getCollections, type CollectionInvoice } from "@/lib/data/collections";
import { getLoadFleetCompanies } from "@/lib/data/fleet";
import { fleetScopeLabel, fleetScopeParam, parseFleetScope } from "@/lib/fleet-scope";
import { currency, formatDate } from "@/lib/utils";

type Params = { fleet?: string; sort?: string; owner?: string };

function sortInvoices(invoices: CollectionInvoice[], sort: string) {
  return [...invoices].sort((a, b) => {
    if (sort === "amount") return b.balance - a.balance;
    if (sort === "owner") return (a.ownerName ?? "ZZZ").localeCompare(b.ownerName ?? "ZZZ") || b.balance - a.balance;
    if (sort === "follow-up") return (a.payment.next_follow_up_date ?? "9999-12-31").localeCompare(b.payment.next_follow_up_date ?? "9999-12-31") || b.balance - a.balance;
    return b.daysPastDue - a.daysPastDue || b.balance - a.balance;
  });
}

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const companies = await getLoadFleetCompanies();
  const scope = parseFleetScope(params.fleet, companies);
  if (!scope) notFound();
  const data = await getCollections(scope);
  const owner = params.owner ?? "all";
  const invoices = sortInvoices(data.invoices.filter((invoice) => owner === "all" || (owner === "unassigned" ? !invoice.payment.collection_owner_id : invoice.payment.collection_owner_id === owner)), params.sort ?? "age");
  const overdueTotal = data.invoices.filter((invoice) => invoice.overdue).reduce((sum, invoice) => sum + invoice.balance, 0);
  const followUps = data.invoices.filter((invoice) => invoice.payment.next_follow_up_date && invoice.payment.next_follow_up_date <= data.asOf).length;
  const fleet = fleetScopeParam(scope);
  return <div className="space-y-5">
    <section className="dashboard-hero">
      <div className="dashboard-hero-heading"><div><h1>Collections</h1><p>{fleetScopeLabel(scope)} · Invoice aging, follow-up ownership, and receivable reconciliation.</p></div></div>
      <FleetScopeTabs companies={companies} scope={scope} basePath="/collections" />
    </section>

    <section className="grid gap-3 sm:grid-cols-3">
      {([
        ["Outstanding", currency(data.total), DollarSign], ["Past due", currency(overdueTotal), Clock3], ["Follow-ups due", followUps, CalendarCheck2],
      ] as Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4"><Icon className="size-5 text-[#6757e8]"/><div className="mt-3 text-xs font-semibold uppercase text-zinc-500">{label}</div><div className="mt-1 text-2xl font-semibold text-zinc-950">{String(value)}</div></div>)}
    </section>

    <section className="dispatch-panel">
      <div className="panel-heading"><div><h2>Aging</h2><p>Totals reconcile to the outstanding receivables below.</p></div></div>
      <div className="grid grid-cols-2 gap-px bg-zinc-200 sm:grid-cols-5">
        {agingBuckets.map((bucket) => <div key={bucket} className="bg-white p-4"><div className="text-xs font-semibold uppercase text-zinc-500">{bucket}</div><div className="mt-1 text-lg font-semibold text-zinc-950">{currency(data.aging[bucket])}</div></div>)}
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="dispatch-panel overflow-hidden">
        <div className="panel-heading flex-wrap gap-3"><div><h2>Receivables</h2><p>Prioritize by age, value, owner, or follow-up date.</p></div>
          <form className="flex flex-wrap gap-2" action="/collections">
            {fleet ? <input type="hidden" name="fleet" value={fleet}/> : null}
            <Select name="owner" defaultValue={owner} aria-label="Collection owner" className="mt-0 w-44"><option value="all">All owners</option><option value="unassigned">Unassigned</option>{data.owners.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>)}</Select>
            <Select name="sort" defaultValue={params.sort ?? "age"} aria-label="Sort receivables" className="mt-0 w-44"><option value="age">Oldest first</option><option value="amount">Highest amount</option><option value="owner">Owner</option><option value="follow-up">Next follow-up</option></Select>
            <button className="rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white">Apply</button>
          </form>
        </div>
        <div className="divide-y divide-zinc-200">
          {invoices.map((invoice) => <Link key={invoice.id} href={`/collections/${invoice.id}`} className="grid gap-3 p-4 hover:bg-zinc-50 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center">
            <div><div className="font-semibold text-zinc-950">{invoice.load_number}</div><div className="text-xs text-zinc-500">{invoice.brokers?.company_name ?? "Unassigned customer"} · {invoice.payment.invoice_number ?? "Invoice not numbered"}</div></div>
            <div><div className="font-semibold text-zinc-950">{currency(invoice.balance)}</div><div className={`text-xs ${invoice.overdue ? "text-red-700" : "text-zinc-500"}`}>{invoice.payment.due_date ? `${invoice.bucket} · due ${formatDate(invoice.payment.due_date)}` : "Due date not set"}</div></div>
            <div className="text-sm"><div className="flex items-center gap-1 text-zinc-700"><UserRound className="size-3.5"/>{invoice.ownerName ?? "Unassigned"}</div><div className="text-xs text-zinc-500">Follow-up {formatDate(invoice.payment.next_follow_up_date)}</div></div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invoice.overdue ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-700"}`}>{invoice.overdue ? `${invoice.daysPastDue}d overdue` : invoice.payment.invoice_status}</span>
          </Link>)}
          {!invoices.length ? <p className="p-5 text-sm text-zinc-500">No receivables match these filters.</p> : null}
        </div>
      </div>

      <div className="dispatch-panel">
        <div className="panel-heading"><div><h2>Broker / customer aging</h2><p>Largest outstanding relationships first.</p></div></div>
        <div className="divide-y divide-zinc-200 px-5">{data.customers.slice(0, 12).map((customer) => <div key={customer.id} className="py-3"><div className="flex justify-between gap-3"><span className="font-semibold text-zinc-950">{customer.name}</span><span className="font-semibold">{currency(customer.balance)}</span></div><div className="mt-1 text-xs text-zinc-500">{customer.invoices} invoice{customer.invoices === 1 ? "" : "s"} · {currency(customer.overdue)} overdue</div></div>)}</div>
      </div>
    </section>
  </div>;
}
