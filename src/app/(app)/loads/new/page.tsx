import { LoadForm } from "@/components/load-form";
import { createLoad } from "@/lib/actions/loads";
import { getFormOptions } from "@/lib/data/options";
import { getLoadFleetCompanies } from "@/lib/data/fleet";
import { parseFleetScope } from "@/lib/fleet-scope";
import { notFound } from "next/navigation";

export default async function NewLoadPage({ searchParams }: { searchParams: Promise<{ fleet?: string }> }) {
  const params = await searchParams;
  const [options, companies] = await Promise.all([getFormOptions(), getLoadFleetCompanies()]);
  const scope = parseFleetScope(params.fleet, companies);
  if (!scope) notFound();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Create Load</h1>
        <p className="text-sm text-zinc-600">Enter dispatch, lane, and financial details.</p>
      </div>
      <LoadForm action={createLoad} drivers={options.drivers} brokers={options.brokers} equipment={options.equipment} initialFleet={scope.kind === "fleet" ? scope.company : null} />
    </div>
  );
}
