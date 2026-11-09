// POST /api/messages  — a visitor sends a message (starts or continues their thread)
// Body: { name, email?, text, threadId?, token? }  → { threadId, token, thread }
import { redis, LIMITS, newId, newToken, safeEqual, getThread, saveThread, publicThread, rateLimited, noStore } from "./_lib/store.js";
import { adminSubs, saveAdminSubs, sendAll, preview } from "./_lib/push.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!redis) return res.status(500).json({ error: "Storage isn't set up. Connect a Redis database in Vercel's Storage tab, then redeploy." });

  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, LIMITS.name);
  const email = String(b.email || "").trim().slice(0, LIMITS.email);
  const text = String(b.text || "").trim();
  if (!name || !text) return res.status(400).json({ error: "Add your name and a message." });
  if (text.length > LIMITS.text) return res.status(400).json({ error: `Keep the message under ${LIMITS.text} characters.` });
  if (b.website) return res.status(200).json({ ok: true }); // honeypot field: bots fill it, people don't

  if (await rateLimited(req, "msg")) return res.status(429).json({ error: "Too many messages. Try again in a few minutes." });

  const now = new Date().toISOString();
  let thread = b.threadId ? await getThread(b.threadId) : null;
  if (thread && !safeEqual(b.token, thread.token)) thread = null; // wrong token: start fresh

  if (thread) {
    if (thread.messages.length >= LIMITS.perThread) return res.status(400).json({ error: "This conversation is full. Start a new one." });
    thread.name = name;
    if (email) thread.email = email;
    thread.messages.push({ from: "visitor", text, at: now });
  } else {
    thread = { id: newId(), token: newToken(), name, email, messages: [{ from: "visitor", text, at: now }] };
  }
  thread.updatedAt = now;
  thread.awaitingReply = true;
  await saveThread(thread);

  // Notify your devices. A push failure never blocks the visitor's message.
  try {
    const subs = await adminSubs();
    if (subs.length) {
      const still = await sendAll(subs, { title: `New message from ${name}`, body: preview(text), url: "/admin" }, req);
      if (still.length !== subs.length) await saveAdminSubs(still);
    }
  } catch (e) { console.error("Admin notify failed:", e.message); }

  return res.status(200).json({ threadId: thread.id, token: thread.token, thread: publicThread(thread) });
}
