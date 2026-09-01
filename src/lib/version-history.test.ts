import { describe, expect, it } from "vitest";
import { CURRENT_VERSION, VERSION_HISTORY } from "./version-history";

function semverParts(version: string) {
  return version.split(".").map(Number);
}

describe("version history", () => {
  it("exposes the current release first", () => {
    expect(CURRENT_VERSION).toBe("2.11.0");
    expect(VERSION_HISTORY[0]).toMatchObject({
      version: CURRENT_VERSION,
      title: "Familiar workflows restored",
      kind: "minor",
    });
  });

  it("contains unique, valid public versions in newest-first order", () => {
    const versions = VERSION_HISTORY.map(({ version }) => version);

    expect(new Set(versions).size).toBe(versions.length);
    expect(versions.every((version) => /^\d+\.\d+\.\d+$/.test(version))).toBe(true);

    for (let index = 1; index < versions.length; index += 1) {
      const previous = semverParts(versions[index - 1]);
      const current = semverParts(versions[index]);
      const difference = previous.findIndex((part, partIndex) => part !== current[partIndex]);

      expect(difference).toBeGreaterThanOrEqual(0);
      expect(previous[difference]).toBeGreaterThan(current[difference]);
    }
  });

  it("does not expose internal or unversioned entries", () => {
    const serialized = JSON.stringify(VERSION_HISTORY).toLowerCase();

    expect(serialized).not.toContain("unversioned");
    expect(serialized).not.toContain("local artifact");
    expect(serialized).not.toContain("release metadata");
    expect(serialized).not.toContain("demo dataset");
  });
});
