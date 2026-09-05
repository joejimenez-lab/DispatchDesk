import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/invoice-form";
import { createInvoice } from "@/lib/actions/invoices";
import { getLoadFleetCompanies } from "@/lib/data/fleet";
import { getInvoiceLoadOptions } from "@/lib/data/invoices";
import { parseFleetScope } from "@/lib/fleet-scope";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ fleet?: string; load?: string }> }) {
  const params = await searchParams;
  const companies = await getLoadFleetCompanies();
  const scope = parseFleetScope(params.fleet, companies);
  if (!scope) notFound();
  const loads = await getInvoiceLoadOptions(scope);
  const selectedLoadId = loads.some((load) => load.id === params.load) ? params.load : undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">New Invoice</h1>
        <p className="text-sm text-zinc-600">Create an invoice for a load. Payment tracking stays on the load.</p>
      </div>
      {!loads.length ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">Every available load already has an invoice.</div>
      ) : (
        <InvoiceForm action={createInvoice} loads={loads} selectedLoadId={selectedLoadId} />
      )}
    </div>
  );
}
