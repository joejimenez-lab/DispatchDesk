// Helpers for building safe PostgREST `or(...)` text-search filters.
//
// User-supplied search text is interpolated into PostgREST's `or` filter
// grammar, where `,` separates conditions and `(` `)` group them. Passing raw
// input lets a stray comma (e.g. a pasted lane like "Dallas, TX") corrupt the
// filter, and lets a crafted value inject extra conditions. We avoid both by
// splitting the query into tokens and stripping the characters that carry
// meaning to PostgREST or to the `ilike` pattern itself.

// Characters that are structural in a PostgREST filter (`,` `(` `)`), control
// the `ilike` pattern (`%` `*` `\`), or delimit a condition's value (`:`).
const META = /[(),%*\\:]/g;

/**
 * Split a raw query into sanitized search tokens. Splits on whitespace and
 * commas so multi-word and "City, ST" queries become independent terms, then
 * removes filter metacharacters from each token. Empty tokens are dropped.
 */
export function searchTokens(query: string | null | undefined): string[] {
  if (!query) return [];
  return query
    .split(/[\s,]+/)
    .map((token) => token.replace(META, "").trim())
    .filter(Boolean);
}

/**
 * Build the PostgREST `or(...)` argument for a case-insensitive substring match
 * of a single (already sanitized) token across the given columns.
 */
export function ilikeOr(columns: string[], token: string): string {
  return columns.map((column) => `${column}.ilike.%${token}%`).join(",");
}
