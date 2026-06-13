import { LoadForm } from "@/components/load-form";
import { createLoad } from "@/lib/actions/loads";
import { getFormOptions } from "@/lib/data/options";

export default async function NewLoadPage() {
  const options = await getFormOptions();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Create Load</h1>
        <p className="text-sm text-zinc-600">Enter dispatch, lane, and financial details.</p>
      </div>
      <LoadForm action={createLoad} drivers={options.drivers} brokers={options.brokers} />
    </div>
  );
}
