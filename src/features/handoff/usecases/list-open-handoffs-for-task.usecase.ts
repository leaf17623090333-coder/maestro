import type { TaskQueryPort } from "@/features/task";
import type { HandoffStorePort } from "../domain/handoff-types.js";
import { isOpenHandoffRecord } from "../domain/handoff-state.js";
import { reconcileHandoffRecord } from "./reconcile-handoff-record.usecase.js";

// Returns plain ids (not records) so the task feature can depend on this
// without importing any handoff domain types.
export async function listOpenHandoffsForTask(
  store: HandoffStorePort,
  taskId: string,
  options: {
    readonly taskStore?: Pick<TaskQueryPort, "get">;
    readonly currentProjectRoot?: string;
  } = {},
): Promise<readonly string[]> {
  const { currentProjectRoot, taskStore } = options;
  const relevantOpen = currentProjectRoot
    ? await store.listOpenForTask({ taskId, projectRoot: currentProjectRoot })
    : (await store.list()).filter((record) => record.refs.taskId === taskId && isOpenHandoffRecord(record));
  const reconciled = taskStore && currentProjectRoot
    ? await Promise.all(relevantOpen.map((record) => reconcileHandoffRecord({
      handoffStore: store,
      taskStore,
      currentProjectRoot,
    }, record)))
    : relevantOpen;
  return reconciled
    .filter(isOpenHandoffRecord)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((record) => record.id);
}
