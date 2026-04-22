import { describe, expect, it } from "bun:test";
import { generateHandoffId, HANDOFF_ID_PATTERN } from "@/shared/domain/id.js";

describe("generateHandoffId", () => {
  it("generates an adjective-noun-N id", () => {
    const id = generateHandoffId([]);
    expect(id).toMatch(/^[a-z]+-[a-z]+-\d+$/);
  });

  it("starts a fresh pair at counter 1", () => {
    const id = generateHandoffId([]);
    expect(id.endsWith("-1")).toBe(true);
  });

  it("increments the counter for the same (adjective, noun) pair", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const first = generateHandoffId([]);
      const second = generateHandoffId([first]);
      if (second.startsWith(first.slice(0, first.lastIndexOf("-") + 1))) {
        const firstSeq = Number(first.slice(first.lastIndexOf("-") + 1));
        const secondSeq = Number(second.slice(second.lastIndexOf("-") + 1));
        expect(secondSeq).toBe(firstSeq + 1);
        seen.add("incremented");
      } else {
        expect(second.endsWith("-1")).toBe(true);
        seen.add("fresh");
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it("picks max-in-pair and adds 1 when gaps exist", () => {
    const existing = ["swift-otter-1", "swift-otter-5"];
    for (let i = 0; i < 50; i++) {
      const id = generateHandoffId([...existing, "bold-finch-2"]);
      if (id.startsWith("swift-otter-")) {
        expect(id).toBe("swift-otter-6");
        return;
      }
    }
  });

  it("ignores ids from other pairs", () => {
    const existing = ["bold-finch-9", "lucky-badger-3"];
    for (let i = 0; i < 50; i++) {
      const id = generateHandoffId(existing);
      if (id.startsWith("bold-finch-")) {
        expect(id).toBe("bold-finch-10");
        return;
      }
      if (id.startsWith("lucky-badger-")) {
        expect(id).toBe("lucky-badger-4");
        return;
      }
    }
  });

  it("ignores legacy date-style ids when counting pair sequence", () => {
    const existing = ["2026-03-28-001", "2026-03-28-002"];
    const id = generateHandoffId(existing);
    expect(id).toMatch(/^[a-z]+-[a-z]+-\d+$/);
    expect(id.endsWith("-1")).toBe(true);
  });
});

describe("HANDOFF_ID_PATTERN", () => {
  it("matches the new adjective-noun-N format", () => {
    expect(HANDOFF_ID_PATTERN.test("swift-otter-3")).toBe(true);
    expect(HANDOFF_ID_PATTERN.test("bold-finch-10")).toBe(true);
  });

  it("still matches legacy date-style ids", () => {
    expect(HANDOFF_ID_PATTERN.test("2026-04-22-001")).toBe(true);
    expect(HANDOFF_ID_PATTERN.test("2026-03-28-999")).toBe(true);
  });

  it("rejects unsafe path segments", () => {
    expect(HANDOFF_ID_PATTERN.test("../etc/passwd")).toBe(false);
    expect(HANDOFF_ID_PATTERN.test("swift-otter")).toBe(false);
    expect(HANDOFF_ID_PATTERN.test("swift_otter_3")).toBe(false);
    expect(HANDOFF_ID_PATTERN.test("Swift-Otter-3")).toBe(false);
  });
});
