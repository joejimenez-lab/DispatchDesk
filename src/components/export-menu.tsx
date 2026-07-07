"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ExportMenuItem = {
  title: string;
  description: string;
  formats: {
    label: string;
    href: string;
    type: "csv" | "pdf";
  }[];
};

export function ExportMenu({
  items,
  heading = "Business exports",
  description = "Weekly reports use the filters on this page.",
}: {
  items: ExportMenuItem[];
  heading?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

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
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <Download aria-hidden="true" className="size-4" />
        Export reports
        <ChevronDown aria-hidden="true" className="size-4 transition group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 z-30 mt-2 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-950">{heading}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </div>
        <div className="max-h-[min(32rem,70vh)] overflow-y-auto p-2">
          {items.map((item) => (
            <div key={item.title} className="rounded-md px-2 py-2.5 hover:bg-zinc-50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-950">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-500">{item.description}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {item.formats.map((format) => {
                    const Icon = format.type === "pdf" ? FileText : FileSpreadsheet;
                    return (
                      <a
                        key={`${format.type}:${format.label}`}
                        href={format.href}
                        onClick={() => setOpen(false)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                      >
                        <Icon aria-hidden="true" className="size-3.5" />
                        {format.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
