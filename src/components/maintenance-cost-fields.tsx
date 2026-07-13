"use client";

import { useState } from "react";
import { Field, Input } from "@/components/field";
import { receiptAccept } from "@/lib/bookkeeping";

export function MaintenanceCostFields({
  defaultMode = "total",
  total = 0,
  labor = 0,
  parts = 0,
  vendor = "",
  includeReceipt = true,
}: {
  defaultMode?: "total" | "breakdown";
  total?: number;
  labor?: number;
  parts?: number;
  vendor?: string;
  includeReceipt?: boolean;
} = {}) {
  const [mode, setMode] = useState<"total" | "breakdown">(defaultMode);
  return (
    <>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-zinc-700">Cost entry</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-700">
          <label className="flex items-center gap-2">
            <input type="radio" name="cost_mode" value="total" checked={mode === "total"} onChange={() => setMode("total")} />
            One total
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="cost_mode" value="breakdown" checked={mode === "breakdown"} onChange={() => setMode("breakdown")} />
            Labor + parts
          </label>
        </div>
      </fieldset>
      {mode === "total" ? (
        <Field label="Total cost"><Input type="number" min="0" step="0.01" name="total_cost" defaultValue={total} /></Field>
      ) : (
        <>
          <input type="hidden" name="total_cost" value="0" />
          <Field label="Labor"><Input type="number" min="0" step="0.01" name="labor_cost" defaultValue={labor} /></Field>
          <Field label="Parts"><Input type="number" min="0" step="0.01" name="parts_cost" defaultValue={parts} /></Field>
        </>
      )}
      {mode === "total" ? (
        <>
          <input type="hidden" name="labor_cost" value="0" />
          <input type="hidden" name="parts_cost" value="0" />
        </>
      ) : null}
      <Field label="Vendor"><Input name="vendor" defaultValue={vendor} placeholder="Shop or supplier" /></Field>
      {includeReceipt ? <Field label="Receipt" className="sm:col-span-2">
        <input name="file" type="file" accept={receiptAccept} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
        <span className="mt-1 block text-xs text-zinc-500">Optional for positive-cost work. PDF, JPG, PNG, HEIC, or HEIF.</span>
      </Field> : null}
    </>
  );
}
