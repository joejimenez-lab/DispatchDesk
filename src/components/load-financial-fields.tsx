"use client";

import { useRef, useState } from "react";
import { Field, Input, Select } from "@/components/field";
import { factoringDeductionAmount, profitForLoad, totalDeductionsForLoad, type FactoringMode } from "@/lib/financials";
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
  factoringMode = "percentage",
  factoringPercent = 0,
  factoringFixedAmount = 0,
  deductions = [],
}: {
  loadRate?: number;
  driverPay?: number;
  dispatcherFee?: number;
  fuelCost?: number;
  factoringMode?: FactoringMode;
  factoringPercent?: number;
  factoringFixedAmount?: number;
  deductions?: Deduction[];
}) {
  const nextKey = useRef(deductions.length);
  const [rate, setRate] = useState(String(loadRate));
  const [driver, setDriver] = useState(String(driverPay));
  const [dispatcher, setDispatcher] = useState(String(dispatcherFee));
  const [fuel, setFuel] = useState(String(fuelCost));
  const [factoringType, setFactoringType] = useState<FactoringMode>(factoringMode);
  const [factoringPercentage, setFactoringPercentage] = useState(String(factoringPercent));
  const [factoringFixed, setFactoringFixed] = useState(String(factoringFixedAmount));
  const [rows, setRows] = useState<DeductionRow[]>(() =>
    deductions.map((deduction, index) => ({
      key: index,
      label: deduction.label,
      amount: String(deduction.amount),
    })),
  );

  const rateAmount = numberValue(rate);
  const factoringDeduction = factoringDeductionAmount(
    rateAmount,
    factoringType,
    numberValue(factoringPercentage),
    numberValue(factoringFixed),
  );
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
      <fieldset className="md:col-span-2">
        <legend className="text-[13px] font-semibold text-[#45475d]">Factoring</legend>
        <div className="mt-1.5 grid overflow-hidden rounded-xl border border-[#dfe1ed] bg-white shadow-sm transition focus-within:border-[#6757e8] focus-within:ring-2 focus-within:ring-[#dcd7ff]/70 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Select
            name="factoring_mode"
            value={factoringType}
            onChange={(event) => setFactoringType(event.target.value as FactoringMode)}
            aria-label="Factoring type"
            className="mt-0 rounded-none border-0 shadow-none focus:ring-0 sm:border-r sm:border-[#dfe1ed]"
          >
            <option value="percentage">Percentage</option>
            <option value="amount">Fixed amount</option>
          </Select>
          <div className="relative border-t border-[#dfe1ed] sm:border-t-0">
            <Input
              type="number"
              step="0.01"
              min="0"
              max={factoringType === "percentage" ? "100" : undefined}
              name={factoringType === "percentage" ? "factoring_percent" : "factoring_fixed_amount"}
              value={factoringType === "percentage" ? factoringPercentage : factoringFixed}
              onChange={(event) => {
                if (factoringType === "percentage") setFactoringPercentage(event.target.value);
                else setFactoringFixed(event.target.value);
              }}
              className={`mt-0 rounded-none border-0 shadow-none focus:ring-0 ${
                factoringType === "percentage" ? "pr-9" : "pl-8"
              }`}
              aria-label={factoringType === "percentage" ? "Factoring percentage" : "Factoring amount"}
            />
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-500 ${
                factoringType === "percentage" ? "right-3" : "left-3"
              }`}
            >
              {factoringType === "percentage" ? "%" : "$"}
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs font-normal text-zinc-500">
          {factoringType === "percentage" ? "Calculated deduction" : "Fixed deduction"}: {currency(factoringDeduction)}
        </p>
        {factoringType === "percentage" ? (
          <input type="hidden" name="factoring_fixed_amount" value="0" />
        ) : (
          <input type="hidden" name="factoring_percent" value="0" />
        )}
      </fieldset>

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
