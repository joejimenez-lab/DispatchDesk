const POSTGREST_MISSING_ROW = "PGRST116";

export function isMissingPostgrestRow(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === POSTGREST_MISSING_ROW
  );
}
