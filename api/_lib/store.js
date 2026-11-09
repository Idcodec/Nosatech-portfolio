import crypto from "node:crypto";

/*
 * Storage adapter. Works with either Redis option on Vercel's Storage tab:
 *  - "Redis" (Redis Cloud)  → sets REDIS_URL               → uses the `redis` client
 *  - "Upstash for Redis"    → sets KV_REST_API_URL/_TOKEN  → uses @upstash/redis
 *    (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN also work)
 */
const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL;
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function tcpAdapter(url) {
  // Reuse one connection across warm serverless invocations.
  let ready = null;
  const client = async () => {
    if (!ready) {
      ready = (async () => {
        const { createClient } = await import("redis");
        const c = createClient({ url });
        c.on("error", (e) => console.error("Redis error:", e.message));
        await c.connect();
        return c;
      })().catch((e) => { ready = null; throw e; });
    }
    return ready;
  };
  const parse = (v) => (v == null ? null : JSON.parse(v));
  return {
    async get(k) { return parse(await (await client()).get(k)); },
    async set(k, v) { await (await client()).set(k, JSON.stringify(v)); },
    async mget(keys) { return (await (await client()).mGet(keys)).map(parse); },
    async zadd(k, score, member) { await (await client()).zAdd(k, { score, value: member }); },
    async zrevrange(k, start, stop) { return (await client()).zRange(k, start, stop, { REV: true }); },
    async incr(k) { return (await client()).incr(k); },
    async expire(k, s) { await (await client()).expire(k, s); },
  };
}

function restAdapter(url, token) {
  let r = null;
  const client = async () => {
    if (!r) { const { Redis } = await import("@upstash/redis"); r = new Redis({ url, token }); }
    return r;
  };
  return {
    async get(k) { return (await client()).get(k); },
    async set(k, v) { await (await client()).set(k, v); },
    async mget(keys) { return (await client()).mget(...keys); },
    async zadd(k, score, member) { await (await client()).zadd(k, { score, member }); },
    async zrevrange(k, start, stop) { return (await client()).zrange(k, start, stop, { rev: true }); },
    async incr(k) { return (await client()).incr(k); },
    async expire(k, s) { await (await client()).expire(k, s); },
  };
}

export const redis = REDIS_URL ? tcpAdapter(REDIS_URL) : REST_URL && REST_TOKEN ? restAdapter(REST_URL, REST_TOKEN) : null;

export const LIMITS = { name: 80, email: 120, text: 2000, perThread: 200 };

export function newId() {
  return crypto.randomBytes(9).toString("base64url");
}
export function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function getThread(id) {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id || "")) return null;
  return (await redis.get(`thread:${id}`)) || null;
}

export async function saveThread(t) {
  await redis.set(`thread:${t.id}`, t);
  await redis.zadd("threads", Date.parse(t.updatedAt), t.id);
}

export async function listThreads(max = 200) {
  const ids = await redis.zrevrange("threads", 0, max - 1);
  if (!ids.length) return [];
  return (await redis.mget(ids.map((id) => `thread:${id}`))).filter(Boolean);
}

// Strip the visitor secret and their device subscriptions before sending a thread anywhere.
export function publicThread(t) {
  const { token, subs, ...rest } = t;
  return { ...rest, notify: Boolean(subs && subs.length) };
}

export function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const h = req.headers.authorization || "";
  return safeEqual(h.replace(/^Bearer\s+/i, ""), pw);
}

// Simple per-IP limit: max `max` requests per `windowSec`.
export async function rateLimited(req, key, max = 8, windowSec = 600) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const k = `rl:${key}:${ip}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n > max;
}

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
}
