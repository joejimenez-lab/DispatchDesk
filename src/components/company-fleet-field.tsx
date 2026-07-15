"use client";

import { useId, useState, type FocusEvent } from "react";
import { Input } from "@/components/field";

type Props = {
  companies: string[];
  defaultValue?: string;
};

export function CompanyFleetField({ companies, defaultValue = "" }: Props) {
  const inputId = useId();
  const listId = `${inputId}-options`;
  const [value, setValue] = useState(defaultValue);
  const [options, setOptions] = useState(companies);
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLocaleLowerCase();
  const filteredOptions = options.filter((company) =>
    company.toLocaleLowerCase().includes(normalizedValue));
  const canAdd = Boolean(value.trim()) && !options.some((company) =>
    company.toLocaleLowerCase() === normalizedValue);

  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  function select(company: string) {
    setValue(company);
    setOpen(false);
  }

  function addCompany() {
    const company = value.trim();
    if (!company) return;
    setOptions((current) => [...current, company].sort((a, b) => a.localeCompare(b)));
    select(company);
  }

  return (
    <div className="relative" onBlur={closeWhenFocusLeaves}>
      <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700">Fleet company</label>
      <div className="relative">
        <Input
          id={inputId}
          name="company"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Select or type a new fleet"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="absolute inset-y-1 right-0 mt-1 flex w-10 items-center justify-center text-zinc-600 hover:text-zinc-950"
          aria-label={open ? "Close fleet options" : "Open fleet options"}
        >
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {open ? (
        <div id={listId} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
          <button type="button" role="option" aria-selected={!value} onClick={() => select("")} className="block w-full rounded px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100">
            No fleet
          </button>
          {filteredOptions.map((company) => (
            <button
              key={company}
              type="button"
              role="option"
              aria-selected={company.toLocaleLowerCase() === normalizedValue}
              onClick={() => select(company)}
              className="block w-full rounded px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100"
            >
              {company}
            </button>
          ))}
          {canAdd ? (
            <button type="button" role="option" aria-selected="false" onClick={addCompany} className="block w-full rounded px-3 py-2 text-left text-sm font-medium text-zinc-950 hover:bg-zinc-100">
              + Add “{value.trim()}”
            </button>
          ) : null}
          {!filteredOptions.length && !canAdd ? <div className="px-3 py-2 text-sm text-zinc-500">No saved fleets</div> : null}
        </div>
      ) : null}
      <span className="mt-1 block text-xs font-normal text-zinc-500">
        Choose a saved fleet or type a new one.
      </span>
    </div>
  );
}
