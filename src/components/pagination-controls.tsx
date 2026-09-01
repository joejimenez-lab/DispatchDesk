import Link from "next/link";
import { PAGE_SIZES, pageHref, paginationLabel, totalPages, type Pagination } from "@/lib/pagination";

export function PaginationControls({
  basePath,
  params,
  pagination,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  pagination: Pagination;
  total: number;
}) {
  const pages = totalPages(total, pagination.pageSize);
  const previous = Math.max(1, pagination.page - 1);
  const next = Math.min(pages, pagination.page + 1);
  const hidden = Object.entries(params).filter(([key, value]) => value && key !== "page" && key !== "pageSize");

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
      <div className="font-medium text-zinc-700" aria-live="polite">
        {paginationLabel(total, pagination)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={basePath} className="flex items-center gap-2">
          {hidden.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
          <label htmlFor="page-size" className="text-zinc-600">Rows</label>
          <select
            id="page-size"
            name="pageSize"
            defaultValue={pagination.pageSize}
            className="h-9 rounded-md border border-zinc-300 bg-white px-2"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <button className="h-9 rounded-md border border-zinc-300 px-3 font-medium hover:bg-zinc-50">Apply</button>
        </form>
        <span className="text-zinc-500">Page {pagination.page} of {pages}</span>
        <div className="flex gap-2">
          {pagination.page > 1 ? (
            <Link className="rounded-md border border-zinc-300 px-3 py-2 font-medium hover:bg-zinc-50" href={pageHref(basePath, params, previous, pagination.pageSize)}>Previous</Link>
          ) : (
            <span aria-disabled="true" className="rounded-md border border-zinc-200 px-3 py-2 text-zinc-400">Previous</span>
          )}
          {pagination.page < pages ? (
            <Link className="rounded-md border border-zinc-300 px-3 py-2 font-medium hover:bg-zinc-50" href={pageHref(basePath, params, next, pagination.pageSize)}>Next</Link>
          ) : (
            <span aria-disabled="true" className="rounded-md border border-zinc-200 px-3 py-2 text-zinc-400">Next</span>
          )}
        </div>
      </div>
    </nav>
  );
}
