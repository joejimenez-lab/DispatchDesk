"use client";

import { Check, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ExportMenuItem = {
  title: string;
  description: string;
  formats: {
    label: string;
    description?: string;
    href: string;
    type: "csv" | "pdf";
  }[];
};

export type ExportMenuFilter = {
  key: string;
  label: string;
  allLabel: string;
  defaultValue?: string;
  options: { label: string; value: string }[];
};

function formatDescription(format: ExportMenuItem["formats"][number]) {
  if (format.description) return format.description;
  if (format.label.toLowerCase().includes("summary")) return "Condensed totals for review and sharing.";
  if (format.label.toLowerCase().includes("detailed")) return "Line-level records for reconciliation and analysis.";
  if (format.type === "pdf") return "Print-ready report with totals and page layout.";
  return "Editable rows for spreadsheets and accounting tools.";
}

function exportHref(href: string, filters: ExportMenuFilter[], values: Record<string, string>) {
  const [withoutHash, hash] = href.split("#", 2);
  const [path, query = ""] = withoutHash.split("?", 2);
  const params = new URLSearchParams(query);

  for (const filter of filters) {
    const value = values[filter.key]?.trim();
    if (value) params.set(filter.key, value);
    else params.delete(filter.key);
  }

  const nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

export function ExportMenu({
  items,
  filters = [],
  heading = "Business exports",
  description = "Weekly reports use the filters on this page.",
}: {
  items: ExportMenuItem[];
  filters?: ExportMenuFilter[];
  heading?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState(0);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const menuRef = useRef<HTMLDetailsElement>(null);
  const report = items[selectedReport] ?? items[0];
  const format = report?.formats[selectedFormat] ?? report?.formats[0];
  const resolvedFilterValues = Object.fromEntries(filters.map((filter) => [
    filter.key,
    filterValues[filter.key] ?? filter.defaultValue ?? "",
  ]));
  const downloadHref = format ? exportHref(format.href, filters, resolvedFilterValues) : "#";

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuRef.current?.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details
      ref={menuRef}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group relative"
    >
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl bg-[#6757e8] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(103,87,232,0.18)] transition hover:bg-[#5143c2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6757e8] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <Download aria-hidden="true" className="size-4" />
        Export reports
        <ChevronDown aria-hidden="true" className="size-4 transition group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 z-30 mt-2 w-[min(34rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#e3e8ef] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="border-b border-zinc-200 bg-zinc-50/80 px-5 py-4">
          <p className="text-sm font-semibold text-zinc-950">{heading}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
        </div>
        {report && format ? (
          <div className="max-h-[min(34rem,70vh)] overflow-y-auto">
            <div className="space-y-5 p-5">
              <div>
                <label htmlFor="export-report" className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  1. Choose report
                </label>
                <select
                  id="export-report"
                  value={selectedReport}
                  onChange={(event) => {
                    setSelectedReport(Number(event.target.value));
                    setSelectedFormat(0);
                  }}
                  className="mt-2 h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none transition focus:border-[#6757e8] focus:ring-2 focus:ring-[#6757e8]/20"
                >
                  {items.map((item, index) => <option key={item.title} value={index}>{item.title}</option>)}
                </select>
                <div className="mt-2 rounded-lg border border-[#ddd8ff] bg-[#f7f5ff] px-3 py-2.5">
                  <p className="text-xs leading-5 text-[#5143c2]">{report.description}</p>
                </div>
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  2. Choose export type
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {report.formats.map((option, index) => {
                    const Icon = option.type === "pdf" ? FileText : FileSpreadsheet;
                    const selected = index === selectedFormat;
                    const inputId = `export-format-${selectedReport}-${index}`;
                    return (
                      <div key={`${option.type}:${option.label}`}>
                        <input
                          id={inputId}
                          type="radio"
                          name="export-format"
                          value={index}
                          checked={selected}
                          onChange={() => setSelectedFormat(index)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={inputId}
                          className={`flex min-h-[5.25rem] cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selected ? "border-[#6757e8] bg-[#f5f3ff] shadow-[0_0_0_1px_#6757e8]" : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"}`}
                        >
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#6757e8] text-white" : "bg-zinc-100 text-zinc-600"}`}>
                            <Icon aria-hidden="true" className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-zinc-950">
                              {option.label}
                              {selected ? <Check aria-hidden="true" className="size-4 shrink-0 text-[#6757e8]" /> : null}
                            </span>
                            <span className="mt-1 block text-xs leading-4 text-zinc-500">{formatDescription(option)}</span>
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              {filters.length ? (
                <fieldset>
                  <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    3. Narrow this export
                  </legend>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Choose “All” to remove that filter from this download.</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filters.map((filter) => (
                      <label key={filter.key} className="text-xs font-medium text-zinc-700">
                        {filter.label}
                        <select
                          value={filterValues[filter.key] ?? filter.defaultValue ?? ""}
                          onChange={(event) => setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))}
                          className="mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-[#6757e8] focus:ring-2 focus:ring-[#6757e8]/20"
                        >
                          <option value="">{filter.allLabel}</option>
                          {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-4 text-zinc-500">Export selections override the matching page filters.</p>
              <a
                href={downloadHref}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#6757e8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5143c2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6757e8] focus-visible:ring-offset-2"
              >
                <Download aria-hidden="true" className="size-4" />
                Download {format.label}
              </a>
            </div>
          </div>
        ) : (
          <p className="p-5 text-sm text-zinc-500">No exports are available.</p>
        )}
      </div>
    </details>
  );
}
