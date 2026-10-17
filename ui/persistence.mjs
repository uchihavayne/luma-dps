// Preserve the in-flight write and merge rapid queued edits into their final state.
// Only the latest failed edit may roll back the view.
export function createPreferenceCommitter(initial, { write, onConfirmed, onRejected }) {
  let lastConfirmed = structuredClone(initial), epoch = 0, tail = Promise.resolve(), pendingWrites = 0, queued = null;
  return {
    confirm(preferences) { lastConfirmed = structuredClone(preferences); },
    invalidate() { epoch += 1; },
    run(operation) {
      // Side effects such as stopping capture must follow every older write.
      // Later edits may not merge into a batch ahead of this operation.
      queued = null;
      epoch += 1;
      const pending = tail.then(operation);
      tail = pending.catch(() => {});
      return pending;
    },
    load(read) {
      queued = null; // A read is a barrier; later edits must stay after it.
      const revision = epoch;
      const pending = tail.then(read).then(preferences => {
        lastConfirmed = structuredClone(preferences);
        onConfirmed?.(structuredClone(preferences));
        return { preferences: structuredClone(preferences), untouched: revision === epoch };
      });
      tail = pending.catch(() => {});
      return pending;
    },
    save(preferences) {
      const revision = ++epoch, snapshot = structuredClone(preferences);
      if (queued) {
        queued.revision = revision; queued.snapshot = snapshot;
        return new Promise(resolve => queued.waiters.push(resolve));
      }
      const batch = { revision, snapshot, waiters: [] };
      const result = new Promise(resolve => batch.waiters.push(resolve));
      if (pendingWrites > 0) queued = batch;
      pendingWrites += 1;
      const pending = tail.then(async () => {
        if (queued === batch) queued = null;
        let success = false;
        try {
          const written = await write(batch.snapshot);
          const acknowledged = written && typeof written === 'object'
            && [Object.prototype, null].includes(Object.getPrototypeOf(written))
            ? written : batch.snapshot;
          lastConfirmed = structuredClone(acknowledged);
          onConfirmed?.(structuredClone(acknowledged));
          success = true;
        } catch (error) {
          onRejected?.(error, batch.revision === epoch ? structuredClone(lastConfirmed) : null);
        } finally {
          pendingWrites -= 1;
          for (const resolve of batch.waiters) resolve(success);
        }
      });
      tail = pending.catch(() => {});
      return result;
    },
  };
}
