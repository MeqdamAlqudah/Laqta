// Sliding-window rate limiter behind an interface (Strategy pattern):
// the in-memory store is fine for one server; swap in Redis/Upstash for
// multiple instances without touching callers.
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<number>;
}

class MemoryStore implements RateLimitStore {
  private hits = new Map<string, number[]>();
  async hit(key: string, windowMs: number) {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.clear(); // crude memory guard
    return list.length;
  }
}

const globalStore = globalThis as unknown as { __rlStore?: RateLimitStore };
const store: RateLimitStore = (globalStore.__rlStore ??= new MemoryStore());

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const count = await store.hit(key, windowMs);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
