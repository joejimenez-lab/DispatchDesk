import { InvoiceForm } from "@/components/invoice-form";
import { updateInvoice } from "@/lib/actions/invoices";
import { getInvoice } from "@/lib/data/invoices";

export default async function InvoiceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Invoice {invoice.invoice_number ?? "Draft"}</h1>
        <p className="text-sm text-zinc-600">Load {invoice.loads.load_number} · {invoice.loads.brokers?.company_name ?? "No broker"}</p>
      </div>
      <InvoiceForm action={updateInvoice.bind(null, id)} invoice={invoice} />
    </div>
  );
}
