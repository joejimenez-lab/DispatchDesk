import { LoadForm } from "@/components/load-form";
import { updateLoad } from "@/lib/actions/loads";
import { getLoad } from "@/lib/data/loads";
import { getFormOptions } from "@/lib/data/options";

export default async function EditLoadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [load, options] = await Promise.all([getLoad(id), getFormOptions()]);
  const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Edit Load {load.load_number}</h1>
        <p className="text-sm text-zinc-600">Update load, status, and payment details.</p>
      </div>
      <LoadForm
        action={updateLoad.bind(null, id)}
        drivers={options.drivers}
        brokers={options.brokers}
        load={load}
        payment={payment}
        showPayments
      />
    </div>
  );
}
