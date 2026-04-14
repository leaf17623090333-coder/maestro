import { describe, expect, it } from "bun:test";
import { linkProjects } from "@/features/graph";
import { mockProjectGraphStore } from "../../../../helpers/mocks.js";

describe("linkProjects", () => {
  it("adds missing current and target nodes before saving the edge", async () => {
    const store = mockProjectGraphStore();

    const result = await linkProjects(store, {
      currentName: "maestro",
      currentPath: "/code/maestro",
      targetName: "shared-types",
      targetPath: "/code/shared-types",
      relation: "shared-types",
      detail: "contracts",
    });

    expect(result).toEqual({
      edge: {
        from: "maestro",
        to: "shared-types",
        relation: "shared-types",
        detail: "contracts",
      },
      nodesAdded: 2,
    });

    const graph = await store.load();
    expect(graph.nodes).toEqual([
      { name: "maestro", path: "/code/maestro" },
      { name: "shared-types", path: "/code/shared-types" },
    ]);
    expect(graph.edges).toEqual([result.edge]);
  });

  it("reuses existing nodes and falls back to the target name as the target path", async () => {
    const store = mockProjectGraphStore({
      nodes: [{ name: "maestro", path: "/code/maestro" }],
      edges: [],
    });

    const result = await linkProjects(store, {
      currentName: "maestro",
      currentPath: "/ignored",
      targetName: "maestro-web",
      relation: "exposes",
      detail: "mcp",
    });

    expect(result.nodesAdded).toBe(1);

    const graph = await store.load();
    expect(graph.nodes).toEqual([
      { name: "maestro", path: "/code/maestro" },
      { name: "maestro-web", path: "maestro-web" },
    ]);
  });

  it("replaces an existing edge with the same from/to/relation instead of appending", async () => {
    const store = mockProjectGraphStore({
      nodes: [
        { name: "maestro", path: "/code/maestro" },
        { name: "maestro-web", path: "/code/maestro-web" },
      ],
      edges: [
        { from: "maestro", to: "maestro-web", relation: "exposes", detail: "old-detail" },
      ],
    });

    const result = await linkProjects(store, {
      currentName: "maestro",
      currentPath: "/code/maestro",
      targetName: "maestro-web",
      targetPath: "/code/maestro-web",
      relation: "exposes",
      detail: "new-detail",
    });

    expect(result.nodesAdded).toBe(0);

    const graph = await store.load();
    expect(graph.edges).toEqual([
      { from: "maestro", to: "maestro-web", relation: "exposes", detail: "new-detail" },
    ]);
  });
});
