import type { TaskQueryPort } from "@/features/task";
import type { HandoffRecord, HandoffStorePort } from "../domain/handoff-types.js";
import { isOpenHandoffRecord } from "../domain/handoff-state.js";
import { reconcileHandoffRecord } from "./reconcile-handoff-record.usecase.js";

export interface ListHandoffsOptions {
  readonly openOnly?: boolean;
  readonly taskStore?: Pick<TaskQueryPort, "get">;
  readonly currentProjectRoot?: string;
}

export async function listHandoffs(
  store: HandoffStorePort,
  options: ListHandoffsOptions = {},
): Promise<readonly HandoffRecord[]> {
  const { currentProjectRoot, taskStore } = options;
  const all = await store.list();
  const candidates = options.openOnly ? all.filter(isOpenHandoffRecord) : all;
  const reconciled = taskStore && currentProjectRoot
    ? await Promise.all(candidates.map((record) => (
        record.refs.taskId
          ? reconcileHandoffRecord({
              handoffStore: store,
              taskStore,
              currentProjectRoot,
            }, record)
          : record
      )))
    : candidates;
  const filtered = options.openOnly ? reconciled.filter(isOpenHandoffRecord) : reconciled;
  return [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
