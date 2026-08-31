import type { Completeness } from "@/lib/contact-quality";

export function ContactQualityBadge({ completeness, duplicate }: { completeness: Completeness; duplicate: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        completeness.complete
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-amber-50 text-amber-800 ring-amber-200"
      }`} title={completeness.missing.length ? `Missing: ${completeness.missing.join(", ")}` : "Recommended contact fields are complete"}>
        {completeness.complete ? "Complete" : `${completeness.percentage}% complete`}
      </span>
      {duplicate ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">Possible duplicate</span> : null}
    </div>
  );
}
