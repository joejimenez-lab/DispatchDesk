import Link from "next/link";
import { companyScopeParam, UNASSIGNED_COMPANY, type CompanyScope } from "@/lib/company-scope";

type CompanyScopeTabsProps = {
  basePath: string;
  companies: string[];
  scope: CompanyScope;
  params?: Record<string, string | null | undefined>;
};

export function companyScopedHref(
  basePath: string,
  company: string,
  params: Record<string, string | null | undefined> = {},
) {
  const next = new URLSearchParams();
  if (company) next.set("company", company);
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function CompanyScopeTabs({ basePath, companies, scope, params }: CompanyScopeTabsProps) {
  const selectedCompany = companyScopeParam(scope);

  return (
    <nav aria-label="Company scope" className="flex flex-wrap gap-2">
      {[
        { label: "All companies", value: "" },
        ...companies.map((company) => ({ label: company, value: company })),
        { label: "Unassigned", value: UNASSIGNED_COMPANY },
      ].map((option) => {
        const active = option.value === selectedCompany;
        return (
          <Link
            key={option.value || "all"}
            href={companyScopedHref(basePath, option.value, params)}
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
