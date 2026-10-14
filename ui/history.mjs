// Live frames advertise a revision; encounter records travel only when it changes.
export function createHistoryCache({ read, normalizeRecord = value => value, onChanged, onRejected } = {}) {
  let revision = 0, desiredRevision = 0, failedRevision = null, history = [], pending = null;
  const validRevision = value => Number.isSafeInteger(value) && value >= 0;

  function fetchLatest() {
    if (pending) return pending;
    if (revision >= desiredRevision || failedRevision === desiredRevision) return Promise.resolve();
    pending = (async () => {
      while (revision < desiredRevision) {
        const requestedRevision = desiredRevision;
        try {
          const result = await read();
          if (!validRevision(result?.revision) || !Array.isArray(result.history)) throw new Error('Invalid history response');
          // A newer live revision may arrive while this request is in flight.
          if (result.revision < desiredRevision) {
            if (desiredRevision > requestedRevision) continue;
            throw new Error('History response is older than the live revision');
          }
          const records = result.history.slice(0, 30).map(normalizeRecord);
          if (records.some(record => !record)) throw new Error('Invalid history record');
          revision = result.revision; desiredRevision = result.revision;
          history = records; failedRevision = null;
          onChanged?.({ revision, history });
        } catch (error) {
          if (desiredRevision > requestedRevision) continue;
          // Keep the confirmed records; an explicit retry or later revision retries.
          failedRevision = desiredRevision;
          onRejected?.(error);
          break;
        }
      }
    })().finally(() => { pending = null; });
    return pending;
  }

  return {
    observe(nextRevision) {
      if (validRevision(nextRevision) && nextRevision > desiredRevision) {
        desiredRevision = nextRevision; failedRevision = null;
      }
      return fetchLatest();
    },
    retry() { failedRevision = null; return fetchLatest(); },
    get history() { return history; },
    get revision() { return revision; },
    get desiredRevision() { return desiredRevision; },
    get pending() { return Boolean(pending); },
    get failed() { return failedRevision !== null; },
  };
}
