// Cache mémoire simple (TTL) pour amortir les appels API et respecter le
// quota de football-data.org (10 requêtes / minute en offre gratuite).

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const globalForCache = globalThis as typeof globalThis & {
  __dtechFootballCache?: Map<string, CacheEntry<unknown>>;
};

const store: Map<string, CacheEntry<unknown>> =
  globalForCache.__dtechFootballCache ?? new Map<string, CacheEntry<unknown>>();

if (!globalForCache.__dtechFootballCache) {
  globalForCache.__dtechFootballCache = store;
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  cacheSet(key, value, ttlMs);
  return value;
}
