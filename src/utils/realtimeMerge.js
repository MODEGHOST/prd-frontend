/** Merge a patched row into a list by id without full reload. */
export function upsertById(list, item, { prepend = false } = {}) {
  if (!item?.id) return list;
  const id = Number(item.id);
  const index = list.findIndex((row) => Number(row.id) === id);
  if (index >= 0) {
    const next = list.slice();
    const previous = list[index];
    next[index] = {
      ...previous,
      ...item,
      // Keep viewer-specific flags from the local row when the patch omits/differs.
      issue_participant: previous.issue_participant ?? item.issue_participant,
    };
    return next;
  }
  return prepend ? [item, ...list] : [...list, item];
}

export function removeById(list, id) {
  const target = Number(id);
  if (!Number.isInteger(target) || target <= 0) return list;
  return list.filter((row) => Number(row.id) !== target);
}

export function applyBoardGate(setters, boardGate) {
  if (!boardGate) return;
  const { setBoardLocked, setOpenTaskCount, setCanCreateTasks } = setters;
  if (typeof boardGate.boardLocked === "boolean") {
    setBoardLocked?.(boardGate.boardLocked);
    if (boardGate.boardLocked) setCanCreateTasks?.(false);
  }
  if (boardGate.openTaskCount != null) {
    setOpenTaskCount?.(Number(boardGate.openTaskCount) || 0);
  }
}

/**
 * Apply a task patch onto a board task list and adjust column totals when status changes.
 * Returns the next tasks array (caller sets state).
 */
export function mergeTaskPatch(tasks, task, setColumnTotals) {
  if (!task?.id) return tasks;
  const previous = tasks.find((row) => Number(row.id) === Number(task.id));
  const nextTasks = upsertById(tasks, task);
  if (setColumnTotals && previous && previous.status !== task.status) {
    setColumnTotals((current) => ({
      ...current,
      [previous.status]: Math.max(0, Number(current[previous.status] || 1) - 1),
      [task.status]: Number(current[task.status] || 0) + 1,
    }));
  } else if (setColumnTotals && !previous) {
    setColumnTotals((current) => ({
      ...current,
      [task.status]: Number(current[task.status] || 0) + 1,
    }));
  }
  return nextTasks;
}
