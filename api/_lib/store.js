import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

// Works with either the Vercel Marketplace (KV_*) or plain Upstash (UPSTASH_*) env names.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

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
  const t = await redis.get(`thread:${id}`);
  return t || null;
}

export async function saveThread(t) {
  await redis.set(`thread:${t.id}`, t);
  await redis.zadd("threads", { score: Date.parse(t.updatedAt), member: t.id });
}

// Strip the visitor secret before sending a thread anywhere.
export function publicThread(t) {
  const { token, ...rest } = t;
  return rest;
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
