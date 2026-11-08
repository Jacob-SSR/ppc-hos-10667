/** Coalesce identical in-flight requests and retain a small, short-lived cache. */
export function createPtDashboardCache<T>(ttlMs = 30_000, maxEntries = 8, now = Date.now) {
  const values = new Map<string, { value: T; expires: number }>();
  const pending = new Map<string, Promise<T>>();
  return async (key: string, build: () => Promise<T>): Promise<T> => {
    const hit = values.get(key);
    if (hit && hit.expires > now()) return hit.value;
    const running = pending.get(key);
    if (running) return running;
    const task = Promise.resolve().then(build).then((value) => {
      values.delete(key);
      values.set(key, { value, expires: now() + ttlMs });
      while (values.size > maxEntries) values.delete(values.keys().next().value!);
      return value;
    }).finally(() => { pending.delete(key); });
    pending.set(key, task);
    return task;
  };
}
