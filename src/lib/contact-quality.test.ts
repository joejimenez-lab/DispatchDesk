import { describe, expect, it } from "vitest";
import {
  brokerCompleteness,
  driverCompleteness,
  findBrokerDuplicates,
  findDriverDuplicates,
  normalizeCompany,
  normalizeEmail,
  normalizePhone,
} from "@/lib/contact-quality";
import { brokerSchema } from "@/lib/validation/schemas";

describe("contact normalization", () => {
  it("normalizes common company suffixes and contact values", () => {
    expect(normalizeCompany("Acme Logistics, LLC")).toBe("acme");
    expect(normalizePhone("+1 (801) 555-0100")).toBe("8015550100");
    expect(normalizeEmail(" OPS@EXAMPLE.COM ")).toBe("ops@example.com");
  });
});

describe("duplicate suggestions", () => {
  it("explains exact and likely broker matches without merging anything", () => {
    const brokers = [
      { id: "a", company_name: "Acme Logistics LLC", contact_name: "Sam", phone: null, email: null, notes: null },
      { id: "b", company_name: "Acme Logistic, Inc.", contact_name: "Samuel", phone: null, email: null, notes: null },
      { id: "c", company_name: "Other Co", contact_name: null, phone: "801-555-0100", email: null, notes: null },
      { id: "d", company_name: "Different Co", contact_name: null, phone: "(801) 555-0100", email: null, notes: null },
    ];
    const matches = findBrokerDuplicates(brokers);
    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ first: brokers[0], second: brokers[1], confidence: "exact", signals: expect.arrayContaining(["same normalized company"]) }),
      expect.objectContaining({ first: brokers[2], second: brokers[3], confidence: "exact", signals: expect.arrayContaining(["same phone"]) }),
    ]));
  });

  it("requires supporting equipment evidence for a near-name driver match", () => {
    const drivers = [
      { id: "a", name: "Marco Reyes", phone: null, email: null, truck_number: "523", trailer_number: null, notes: null },
      { id: "b", name: "Marco Reyez", phone: null, email: null, truck_number: "523", trailer_number: null, notes: null },
    ];
    expect(findDriverDuplicates(drivers)).toHaveLength(1);
    expect(findDriverDuplicates(drivers)[0].signals).toContain("same default equipment");
  });

  it("does not flag unrelated brokers only because they share a contact name", () => {
    expect(findBrokerDuplicates([
      { id: "a", company_name: "North Freight", contact_name: "Alex", phone: null, email: null, notes: null },
      { id: "b", company_name: "South Freight", contact_name: "Alex", phone: null, email: null, notes: null },
    ])).toEqual([]);
  });
});

describe("completeness policies", () => {
  it("keeps recommended fields advisory", () => {
    expect(brokerCompleteness({ id: "a", company_name: "Acme", contact_name: null, phone: null, email: "a@example.com", notes: null }))
      .toEqual({ complete: false, percentage: 33, missing: ["contact name", "phone"] });
    expect(driverCompleteness({ id: "b", name: "Driver", phone: "1", email: "d@example.com", truck_number: "10", trailer_number: "20", notes: null }))
      .toEqual({ complete: true, percentage: 100, missing: [] });
  });

  it("does not block cleanup edits for legacy free-form email values", () => {
    expect(brokerSchema.safeParse({ company_name: "Legacy", contact_name: "", phone: "", email: "dispatch desk", notes: "" }).success).toBe(true);
  });
});
