/** Read complete accounting totals despite the API's per-response row limit. */
export async function readAllRows<T>(query: {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>;
}) {
  const data: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await query.range(offset, offset + 999);
    if (result.error) throw result.error;
    data.push(...result.data ?? []);
    if ((result.data ?? []).length < 1000) break;
  }
  return { data, error: null };
}
