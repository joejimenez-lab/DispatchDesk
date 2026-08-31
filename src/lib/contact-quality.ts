export type ContactKind = "broker" | "driver";

export type BrokerContact = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type DriverContact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  truck_number: string | null;
  trailer_number: string | null;
  notes: string | null;
};

export type DuplicateSuggestion<T> = {
  first: T;
  second: T;
  confidence: "exact" | "likely";
  signals: string[];
};

export type Completeness = {
  complete: boolean;
  percentage: number;
  missing: string[];
};

const COMPANY_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "ltd",
  "logistic",
  "logistics",
]);

export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCompany(value: string | null | undefined) {
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens.at(-1) ?? "")) tokens.pop();
  return tokens.join(" ");
}

export function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 && digits.startsWith("1") ? digits.slice(-10) : digits;
}

export function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function editDistance(first: string, second: string) {
  if (!first.length) return second.length;
  if (!second.length) return first.length;
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= second.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (first[row - 1] === second[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[second.length];
}

function similarName(first: string, second: string) {
  if (!first || !second || Math.min(first.length, second.length) < 5) return false;
  const allowance = Math.max(1, Math.floor(Math.max(first.length, second.length) * 0.12));
  return editDistance(first, second) <= allowance;
}

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function brokerCompleteness(broker: BrokerContact): Completeness {
  const fields = [
    ["contact name", broker.contact_name],
    ["phone", broker.phone],
    ["email", broker.email],
  ] as const;
  const missing = fields.filter(([, value]) => !present(value)).map(([label]) => label);
  return { complete: missing.length === 0, percentage: Math.round(((fields.length - missing.length) / fields.length) * 100), missing };
}

export function driverCompleteness(driver: DriverContact): Completeness {
  const fields = [
    ["phone", driver.phone],
    ["email", driver.email],
    ["default truck", driver.truck_number],
    ["default trailer", driver.trailer_number],
  ] as const;
  const missing = fields.filter(([, value]) => !present(value)).map(([label]) => label);
  return { complete: missing.length === 0, percentage: Math.round(((fields.length - missing.length) / fields.length) * 100), missing };
}

function sharedSignal(label: string, first: string, second: string, signals: string[]) {
  if (first && second && first === second) signals.push(label);
}

export function findBrokerDuplicates<T extends BrokerContact>(brokers: T[]): DuplicateSuggestion<T>[] {
  const suggestions: DuplicateSuggestion<T>[] = [];
  for (let firstIndex = 0; firstIndex < brokers.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < brokers.length; secondIndex += 1) {
      const first = brokers[firstIndex];
      const second = brokers[secondIndex];
      const exactSignals: string[] = [];
      sharedSignal("same normalized company", normalizeCompany(first.company_name), normalizeCompany(second.company_name), exactSignals);
      sharedSignal("same email", normalizeEmail(first.email), normalizeEmail(second.email), exactSignals);
      sharedSignal("same phone", normalizePhone(first.phone), normalizePhone(second.phone), exactSignals);
      const sameContact = Boolean(normalizeText(first.contact_name) && normalizeText(first.contact_name) === normalizeText(second.contact_name));
      if (exactSignals.length && sameContact) exactSignals.push("same contact name");
      if (exactSignals.length) {
        suggestions.push({ first, second, confidence: "exact", signals: exactSignals });
        continue;
      }
      if (similarName(normalizeCompany(first.company_name), normalizeCompany(second.company_name))) {
        suggestions.push({ first, second, confidence: "likely", signals: ["similar company name"] });
      }
    }
  }
  return suggestions;
}

export function findDriverDuplicates<T extends DriverContact>(drivers: T[]): DuplicateSuggestion<T>[] {
  const suggestions: DuplicateSuggestion<T>[] = [];
  for (let firstIndex = 0; firstIndex < drivers.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < drivers.length; secondIndex += 1) {
      const first = drivers[firstIndex];
      const second = drivers[secondIndex];
      const exactSignals: string[] = [];
      sharedSignal("same email", normalizeEmail(first.email), normalizeEmail(second.email), exactSignals);
      sharedSignal("same phone", normalizePhone(first.phone), normalizePhone(second.phone), exactSignals);
      const sameName = normalizeText(first.name) === normalizeText(second.name);
      if (exactSignals.length && sameName) exactSignals.push("same normalized name");
      if (exactSignals.length) {
        suggestions.push({ first, second, confidence: "exact", signals: exactSignals });
        continue;
      }
      const sameEquipment = Boolean(
        (normalizeText(first.truck_number) && normalizeText(first.truck_number) === normalizeText(second.truck_number))
        || (normalizeText(first.trailer_number) && normalizeText(first.trailer_number) === normalizeText(second.trailer_number)),
      );
      if (sameName || (sameEquipment && similarName(normalizeText(first.name), normalizeText(second.name)))) {
        suggestions.push({ first, second, confidence: "likely", signals: [sameName ? "same normalized name" : "similar name", ...(sameEquipment ? ["same default equipment"] : [])] });
      }
    }
  }
  return suggestions;
}

export function recordMatchesQuery(record: BrokerContact | DriverContact, query?: string) {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const searchable = normalizeText(Object.values(record).filter((value) => typeof value === "string").join(" "));
  return tokens.every((token) => searchable.includes(token));
}
