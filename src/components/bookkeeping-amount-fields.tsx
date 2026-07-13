"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/field";
import type { BookkeepingExpenseLine } from "@/lib/data/bookkeeping";
import { expenseCategories, type ExpenseCategory } from "@/types/database";

export function BookkeepingAmountFields({
  sourceType,
  category,
  amount,
  lines = [],
}: {
  sourceType: "manual" | "maintenance" | "ifta";
  category: ExpenseCategory;
  amount: number | string;
  lines?: BookkeepingExpenseLine[];
}) {
  const hasBreakdown = lines.some((line) => line.line_type === "labor" || line.line_type === "parts");
  const [mode, setMode] = useState<"total" | "breakdown">(hasBreakdown ? "breakdown" : "total");
  const labor = lines.find((line) => line.line_type === "labor")?.amount ?? 0;
  const parts = lines.find((line) => line.line_type === "parts")?.amount ?? 0;

  if (sourceType === "maintenance") {
    return (
      <>
        <fieldset>
          <legend className="text-sm font-medium text-zinc-700">Cost entry</legend>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="cost_mode" value="total" checked={mode === "total"} onChange={() => setMode("total")} /> One total</label>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="cost_mode" value="breakdown" checked={mode === "breakdown"} onChange={() => setMode("breakdown")} /> Labor + parts</label>
        </fieldset>
        {mode === "total" ? (
          <>
            <input type="hidden" name="category" value="Maintenance" />
            <input type="hidden" name="labor_cost" value="0" />
            <input type="hidden" name="parts_cost" value="0" />
            <Field label="Total amount"><Input type="number" min="0.01" step="0.01" name="amount" required defaultValue={amount} /></Field>
          </>
        ) : (
          <>
            <input type="hidden" name="category" value="Maintenance" />
            <input type="hidden" name="amount" value={String(amount)} />
            <Field label="Labor"><Input type="number" min="0" step="0.01" name="labor_cost" defaultValue={labor} /></Field>
            <Field label="Parts"><Input type="number" min="0" step="0.01" name="parts_cost" defaultValue={parts} /></Field>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <input type="hidden" name="cost_mode" value="total" />
      <input type="hidden" name="labor_cost" value="0" />
      <input type="hidden" name="parts_cost" value="0" />
      {sourceType === "ifta" ? <input type="hidden" name="category" value="Fuel" /> : (
        <Field label="Category">
          <Select name="category" required defaultValue={category}>{expenseCategories.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
        </Field>
      )}
      <Field label="Amount"><Input type="number" min="0.01" step="0.01" name="amount" required defaultValue={amount} /></Field>
    </>
  );
}
