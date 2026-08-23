import Link from "next/link";
import { fleetScopeParam, UNASSIGNED_FLEET, type FleetScope } from "@/lib/fleet-scope";

type FleetScopeTabsProps = {
  basePath: string;
  companies: string[];
  scope: FleetScope;
  params?: Record<string, string | null | undefined>;
};

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

export function FleetScopeTabs({ basePath, companies, scope, params }: FleetScopeTabsProps) {
  const selectedFleet = fleetScopeParam(scope);

  return (
    <nav aria-label="Fleet scope" className="flex flex-wrap gap-2">
      {[
        { label: "All fleets", value: "" },
        ...companies.map((company) => ({ label: company, value: company })),
        { label: "Unassigned", value: UNASSIGNED_FLEET },
      ].map((option) => {
        const active = option.value === selectedFleet;
        return (
          <Link
            key={option.value || "all"}
            href={fleetScopedHref(basePath, option.value, params)}
            className={[
              "flex h-10 items-center rounded-lg border px-4 text-sm font-semibold transition",
              active ? "border-[#c8c1ff] bg-[#efedff] text-[#5143c2]" : "border-[#dfe1ed] bg-white text-[#5f6176] hover:border-[#b9bbcd] hover:bg-[#f7f6fc]",
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
