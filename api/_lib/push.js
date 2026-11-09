import webpush from "web-push";
import { redis } from "./store.js";

/*
 * Browser push notifications (Web Push).
 * Signing keys are created automatically on first use and kept in Redis,
 * so there is nothing to configure. To use your own keys instead, set
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel.
 */
let keysPromise = null;
export function vapidKeys() {
  if (!keysPromise) {
    keysPromise = (async () => {
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
      }
      let k = await redis.get("vapid");
      if (!k) {
        k = webpush.generateVAPIDKeys();
        await redis.set("vapid", k);
        // If two cold starts raced, keep whichever was stored last.
        k = (await redis.get("vapid")) || k;
      }
      return k;
    })().catch((e) => { keysPromise = null; throw e; });
  }
  return keysPromise;
}

// Accept only well-formed subscriptions pointing at a real push service over https.
export function cleanSub(s) {
  if (!s || typeof s !== "object") return null;
  const { endpoint, keys } = s;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return null;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export function addSub(list, sub, max = 5) {
  const rest = (list || []).filter((x) => x.endpoint !== sub.endpoint);
  return [...rest, sub].slice(-max);
}

/**
 * Send one notification to each subscription.
 * Returns the subscriptions that are still valid (expired ones are dropped).
 */
export async function sendAll(subs, payload, req) {
  if (!subs || !subs.length) return subs || [];
  const { publicKey, privateKey } = await vapidKeys();
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const subject = process.env.VAPID_SUBJECT || `https://${host}`;
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(s, body, { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 24 })
    )
  );
  return subs.filter((s, i) => {
    const r = results[i];
    if (r.status === "fulfilled") return true;
    const code = r.reason && r.reason.statusCode;
    if (code === 404 || code === 410) return false; // unsubscribed or expired
    console.error("Push failed:", code || (r.reason && r.reason.message));
    return true; // temporary problem: keep it
  });
}

/* Your devices (the reply desk) are stored in one list. */
export async function adminSubs() {
  return (await redis.get("admin_subs")) || [];
}
export async function saveAdminSubs(list) {
  await redis.set("admin_subs", list);
}

export function preview(text, n = 120) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
