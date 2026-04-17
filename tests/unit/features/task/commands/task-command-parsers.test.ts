import { describe, expect, it } from "bun:test";
import { MaestroError } from "@/shared/errors.js";
import {
  parseCreateStatus,
  parseLimit,
  parsePlanInput,
  parsePriority,
} from "@/features/task/commands/task-command-parsers.js";

describe("task command parsers", () => {
  describe("parseLimit", () => {
    it("accepts whole-number strings", () => {
      expect(parseLimit("0")).toBe(0);
      expect(parseLimit("20")).toBe(20);
    });

    it("rejects malformed numeric strings", () => {
      for (const value of ["2foo", "1.5", "-1", " 2"]) {
        expect(() => parseLimit(value)).toThrow(MaestroError);
      }
    });
  });

  describe("parsePriority", () => {
    it("accepts valid whole-number priorities", () => {
      expect(parsePriority("0")).toBe(0);
      expect(parsePriority("4")).toBe(4);
    });

    it("rejects malformed numeric strings", () => {
      for (const value of ["1abc", "2.9", "-1", " 3"]) {
        expect(() => parsePriority(value)).toThrow(MaestroError);
      }
    });
  });

  describe("parseCreateStatus", () => {
    it("returns undefined for missing or pending status", () => {
      expect(parseCreateStatus(undefined)).toBeUndefined();
      expect(parseCreateStatus("pending")).toBe("pending");
    });

    it("accepts in_progress for auto-claim on create", () => {
      expect(parseCreateStatus("in_progress")).toBe("in_progress");
    });

    it("rejects completed with a pointed 'create first, complete second' error", () => {
      expect(() => parseCreateStatus("completed")).toThrow(/cannot be created already 'completed'/);
    });

    it("rejects legacy status values with the same error as update", () => {
      for (const value of ["open", "blocked", "deferred", "closed"]) {
        expect(() => parseCreateStatus(value)).toThrow(MaestroError);
      }
    });

    it("rejects unknown status values", () => {
      expect(() => parseCreateStatus("wip")).toThrow(/Invalid --status 'wip'/);
    });
  });

  describe("parsePlanInput", () => {
    it("parses a well-formed plan JSON", () => {
      const raw = JSON.stringify({
        batchId: "abc",
        tasks: [{ name: "a", title: "A" }],
      });
      const parsed = parsePlanInput(raw);
      expect(parsed.batchId).toBe("abc");
      expect(parsed.tasks).toHaveLength(1);
    });

    it("rejects malformed JSON with a pointed error", () => {
      expect(() => parsePlanInput("{ not valid")).toThrow(/Invalid JSON in plan file/);
    });

    it("rejects non-object root", () => {
      expect(() => parsePlanInput("[]")).toThrow(/must be a JSON object/);
      expect(() => parsePlanInput("42")).toThrow(/must be a JSON object/);
      expect(() => parsePlanInput("null")).toThrow(/must be a JSON object/);
    });

    it("rejects missing or non-array tasks", () => {
      expect(() => parsePlanInput("{}")).toThrow(/'tasks' must be an array/);
      expect(() => parsePlanInput('{"tasks":42}')).toThrow(/'tasks' must be an array/);
    });

    it("rejects non-string batchId", () => {
      expect(() => parsePlanInput('{"batchId":42,"tasks":[]}')).toThrow(
        /'batchId' must be a string/,
      );
    });
  });
});
