"use client";

import { useEffect, useRef, useState } from "react";

type LocationOption = {
  id: string;
  label: string;
  fullLabel: string;
  type: string;
};

type LocationAutocompleteProps = {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
};

export function LocationAutocomplete({
  name,
  defaultValue,
  required,
  placeholder = "Start typing a city or address",
}: LocationAutocompleteProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { locations?: LocationOption[]; message?: string };
        if (!response.ok) {
          setMessage(data.message ?? "Location lookup is temporarily unavailable.");
          setOptions([]);
          setOpen(true);
          return;
        }
        setOptions(data.locations ?? []);
        setMessage(data.locations?.length ? "" : "No matching US locations found.");
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setOptions([]);
          setMessage("Location lookup is temporarily unavailable.");
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [value]);

  return (
    <div ref={wrapperRef} className="relative mt-1">
      <input
        name={name}
        required={required}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          if (nextValue.trim().length < 3) {
            setOptions([]);
            setLoading(false);
            setMessage("");
          }
          setOpen(true);
        }}
        onFocus={() => {
          if (options.length) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
      />
      {open && (loading || options.length > 0 || message) ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
          {loading ? <div className="px-3 py-2 text-sm text-zinc-500">Searching...</div> : null}
          {!loading && message ? <div className="px-3 py-2 text-sm text-zinc-500">{message}</div> : null}
          {!loading
            ? options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setValue(option.label);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-50"
                >
                  <span className="block text-sm font-medium text-zinc-950">{option.label}</span>
                  <span className="block truncate text-xs text-zinc-500">{option.fullLabel}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
