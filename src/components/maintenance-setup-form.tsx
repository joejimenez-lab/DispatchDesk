"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-buttons";
import type { ActionState } from "@/lib/actions/state";
import type { MaintenanceReadiness } from "@/lib/maintenance";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  readiness: MaintenanceReadiness[];
};

export function MaintenanceSetupForm({ action, readiness }: Props) {
  const [selected, setSelected] = useState(() => new Set(
    readiness.filter((item) => !item.configured).map((item) => item.unit.id),
  ));

  function select(ids: string[]) {
    setSelected(new Set(ids));
  }

  return (
    <ActionForm action={action} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-600">
          {selected.size} of {readiness.length} units selected
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => select(readiness.map((item) => item.unit.id))} className="text-sm font-medium text-blue-700 underline">Select all</button>
          <button type="button" onClick={() => select(readiness.filter((item) => !item.configured).map((item) => item.unit.id))} className="text-sm font-medium text-blue-700 underline">Select incomplete</button>
          <button type="button" onClick={() => select([])} className="text-sm font-medium text-zinc-600 underline">Clear</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr><th className="w-12 px-3 py-2">Use</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Current</th><th className="min-w-48 px-3 py-2">New odometer</th><th className="px-3 py-2">Setup</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {readiness.map((item) => {
              const checked = selected.has(item.unit.id);
              return (
                <tr key={item.unit.id} className={item.configured ? "" : "bg-amber-50/40"}>
                  <td className="px-3 py-3">
                    <input
                      aria-label={`Select ${item.unit.unit_number}`}
                      type="checkbox"
                      name="unit_id"
                      value={item.unit.id}
                      checked={checked}
                      onChange={(event) => setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.unit.id); else next.delete(item.unit.id);
                        return next;
                      })}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-zinc-950">{item.unit.unit_number}<span className="ml-2 text-xs font-normal text-zinc-500">{item.unit.unit_type}</span></td>
                  <td className="px-3 py-3 text-zinc-600">{item.unit.odometer == null ? "Not set" : `${item.unit.odometer.toLocaleString()} mi`}</td>
                  <td className="px-3 py-3">
                    <input
                      aria-label={`New odometer for ${item.unit.unit_number}`}
                      type="number"
                      min={item.unit.odometer ?? 0}
                      name={`odometer_${item.unit.id}`}
                      disabled={!checked}
                      placeholder={item.unit.odometer == null ? "Enter reading" : "Leave unchanged"}
                      className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-100"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className={item.configured ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                      {item.configured ? "Configured" : "Not configured"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
        <input type="checkbox" name="apply_default_templates" defaultChecked className="mt-0.5 h-4 w-4 rounded border-blue-300" />
        <span><strong>Apply missing default schedules.</strong> Trucks receive monthly service, oil change, 90-day, and annual schedules. Trailers receive 90-day and annual schedules. Existing schedules are preserved.</span>
      </label>

      <SubmitButton disabled={!selected.size} pendingText="Configuring units...">Update selected units</SubmitButton>
    </ActionForm>
  );
}
