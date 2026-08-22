"use client";

import { useRef, useState } from "react";
import { Field, Input } from "@/components/field";
import { factoringAmount, profitForLoad, totalDeductionsForLoad } from "@/lib/financials";
import { currency } from "@/lib/utils";

type Deduction = {
  id?: string;
  label: string;
  amount: number;
};

type DeductionRow = {
  key: number;
  label: string;
  amount: string;
};

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function LoadFinancialFields({
  loadRate = 0,
  driverPay = 0,
  dispatcherFee = 0,
  fuelCost = 0,
  factoringPercent = 0,
  deductions = [],
}: {
  loadRate?: number;
  driverPay?: number;
  dispatcherFee?: number;
  fuelCost?: number;
  factoringPercent?: number;
  deductions?: Deduction[];
}) {
  const nextKey = useRef(deductions.length);
  const [rate, setRate] = useState(String(loadRate));
  const [driver, setDriver] = useState(String(driverPay));
  const [dispatcher, setDispatcher] = useState(String(dispatcherFee));
  const [fuel, setFuel] = useState(String(fuelCost));
  const [factoring, setFactoring] = useState(String(factoringPercent));
  const [rows, setRows] = useState<DeductionRow[]>(() =>
    deductions.map((deduction, index) => ({
      key: index,
      label: deduction.label,
      amount: String(deduction.amount),
    })),
  );

  const rateAmount = numberValue(rate);
  const factoringDeduction = factoringAmount(rateAmount, numberValue(factoring));
  const customDeductions = rows.map((row) => ({ amount: numberValue(row.amount) }));
  const totalDeductions = totalDeductionsForLoad({
    factoring_amount: factoringDeduction,
    load_deductions: customDeductions,
  });
  const estimatedProfit = profitForLoad({
    load_rate: rateAmount,
    driver_pay: numberValue(driver),
    dispatcher_fee: numberValue(dispatcher),
    fuel_cost: numberValue(fuel),
    factoring_amount: factoringDeduction,
    load_deductions: customDeductions,
  });

  function updateRow(key: number, patch: Partial<Omit<DeductionRow, "key">>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const key = nextKey.current;
    nextKey.current += 1;
    setRows((current) => [...current, { key, label: "", amount: "0" }]);
  }

  return (
    <>
      <Field label="Load Rate (Total)">
        <Input type="number" step="0.01" min="0" name="load_rate" value={rate} onChange={(event) => setRate(event.target.value)} />
      </Field>
      <Field label="Driver Pay">
        <Input type="number" step="0.01" min="0" name="driver_pay" value={driver} onChange={(event) => setDriver(event.target.value)} />
      </Field>
      <Field label="Dispatcher Fee">
        <Input type="number" step="0.01" min="0" name="dispatcher_fee" value={dispatcher} onChange={(event) => setDispatcher(event.target.value)} />
      </Field>
      <Field label="Load fuel estimate / allocation">
        <Input type="number" step="0.01" min="0" name="fuel_cost" value={fuel} onChange={(event) => setFuel(event.target.value)} />
        <span className="mt-1 block text-xs font-normal text-zinc-500">Used only for estimated load profitability. Actual fuel spending is recorded through IFTA and Bookkeeping.</span>
      </Field>
      <Field label="Factoring percentage">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          name="factoring_percent"
          value={factoring}
          onChange={(event) => setFactoring(event.target.value)}
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">Calculated deduction: {currency(factoringDeduction)}</span>
      </Field>

      <fieldset className="space-y-3 md:col-span-2">
        <div>
          <legend className="text-[13px] font-semibold text-[#45475d]">Other deductions</legend>
          <p className="mt-1 text-xs text-zinc-500">Add separately labeled, fixed-dollar deductions such as lumper, detention, or advances.</p>
        </div>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.key} className="grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
              <Field label={`Description ${index + 1}`}>
                <Input
                  name="deduction_label"
                  required
                  value={row.label}
                  onChange={(event) => updateRow(row.key, { label: event.target.value })}
                  placeholder="e.g. Lumper fee"
                  aria-label={`Other deduction description ${index + 1}`}
                />
              </Field>
              <Field label="Amount">
                <Input
                  type="number"
                  name="deduction_amount"
                  required
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                  aria-label={`Other deduction amount ${index + 1}`}
                />
              </Field>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
                className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                aria-label={`Remove deduction ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-zinc-500">No other deductions.</p> : null}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          + Add deduction
        </button>
      </fieldset>

      <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm sm:grid-cols-3 md:col-span-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Factoring</div>
          <div className="mt-1 font-semibold text-blue-950">{currency(factoringDeduction)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total deductions</div>
          <div className="mt-1 font-semibold text-blue-950">{currency(totalDeductions)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Estimated profit</div>
          <div className={`mt-1 font-semibold ${estimatedProfit >= 0 ? "text-green-800" : "text-red-700"}`}>{currency(estimatedProfit)}</div>
        </div>
      </div>
    </>
  );
}
