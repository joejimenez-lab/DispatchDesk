export function csvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRow(values: (string | number | boolean | null | undefined)[]) {
  return values.map(csvCell).join(",");
}
