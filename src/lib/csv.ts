const FORMULA_PREFIX_PATTERN = /^[\s\u0000-\u001f\u007f]*[=+\-@]/u;

export function csvCell(value: string | number | boolean | null | undefined) {
  // Excel and Sheets treat a leading apostrophe as a text marker, not formula input.
  const text = typeof value === "string" && FORMULA_PREFIX_PATTERN.test(value)
    ? `'${value}`
    : String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRow(values: (string | number | boolean | null | undefined)[]) {
  return values.map(csvCell).join(",");
}
