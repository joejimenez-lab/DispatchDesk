export const PAGE_SIZES = [25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export type Pagination = {
  page: number;
  pageSize: PageSize;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePagination(
  params: { page?: string | string[]; pageSize?: string | string[] },
  defaultPageSize: PageSize = 25,
): Pagination {
  const requestedPage = Number.parseInt(first(params.page) ?? "", 10);
  const requestedSize = Number.parseInt(first(params.pageSize) ?? "", 10);

  return {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: PAGE_SIZES.includes(requestedSize as PageSize) ? requestedSize as PageSize : defaultPageSize,
  };
}

export function pageRange({ page, pageSize }: Pagination) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginationLabel(total: number, { page, pageSize }: Pagination) {
  if (!total) return "No results";
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);
  return `Showing ${firstResult}–${lastResult} of ${total}`;
}

export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
  pageSize: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page" && key !== "pageSize") query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  if (pageSize !== 25) query.set("pageSize", String(pageSize));
  return query.size ? `${basePath}?${query.toString()}` : basePath;
}
