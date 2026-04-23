import { describe, expect, it } from "bun:test";
import { showHandoff } from "@/features/handoff";
import { MaestroError } from "@/shared/errors.js";
import { makeHandoffRecord, mockHandoffStore } from "../../../../helpers/mocks.js";

describe("showHandoff", () => {
  it("returns the matching packet", async () => {
    const record = makeHandoffRecord({ id: "crimson-fox-1", createdAt: "2026-04-22T00:00:00.000Z" });
    const result = await showHandoff(mockHandoffStore([record]), "crimson-fox-1");
    expect(result.id).toBe("crimson-fox-1");
  });

  it("reconciles a launched packet when its linked task has already completed", async () => {
    const record = makeHandoffRecord({
      id: "amber-otter-2",
      createdAt: "2026-04-22T00:00:00.000Z",
      status: "launched",
      refs: { taskId: "tsk-complete" },
    });
    const store = mockHandoffStore([record]);
    const result = await showHandoff(store, "amber-otter-2", {
      taskStore: {
        async get(id: string) {
          return id === "tsk-complete" ? { id, status: "completed" } : undefined;
        },
      },
    });

    expect(result.status).toBe("completed");
    expect((await store.get("amber-otter-2"))?.status).toBe("completed");
  });

  it("throws MaestroError when the packet does not exist", async () => {
    const store = mockHandoffStore([]);
    await expect(showHandoff(store, "missing-id-9")).rejects.toThrow(MaestroError);
  });
});
