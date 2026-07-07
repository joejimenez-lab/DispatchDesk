import Link from "next/link";

type FleetScopeTabsProps = {
  basePath: string;
  companies: string[];
  selectedFleet: string;
  params?: Record<string, string | null | undefined>;
};

export function normalizeFleetScope(value: string | undefined, companies: string[]) {
  const requested = value?.trim().toLocaleLowerCase();
  if (!requested) return "";
  return companies.find((company) => company.toLocaleLowerCase() === requested) ?? "";
}

export function fleetScopedHref(
  basePath: string,
  fleet: string,
  params: Record<string, string | null | undefined> = {},
) {
  const next = new URLSearchParams();
  if (fleet) next.set("fleet", fleet);
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function FleetScopeTabs({ basePath, companies, selectedFleet, params }: FleetScopeTabsProps) {
  if (!companies.length) return null;

  return (
    <nav aria-label="Fleet scope" className="flex flex-wrap gap-2">
      {[
        { label: "All", value: "" },
        ...companies.map((company) => ({ label: company, value: company })),
      ].map((option) => {
        const active = option.value === selectedFleet;
        return (
          <Link
            key={option.value || "all"}
            href={fleetScopedHref(basePath, option.value, params)}
            className={[
              "flex h-10 items-center rounded-md border px-4 text-sm font-medium",
              active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
