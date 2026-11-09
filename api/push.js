// GET  /api/push            → { publicKey }  (needed by browsers to subscribe)
// POST /api/push            → visitor turns on reply notifications
//      Body: { threadId, token, subscription }
// DELETE /api/push          → visitor turns them off. Body: { threadId, token, endpoint }
import { redis, safeEqual, getThread, saveThread, noStore } from "./_lib/store.js";
import { vapidKeys, cleanSub, addSub } from "./_lib/push.js";

export default async function handler(req, res) {
  noStore(res);
  if (!redis) return res.status(500).json({ error: "Storage isn't set up." });

  if (req.method === "GET") {
    const { publicKey } = await vapidKeys();
    return res.status(200).json({ publicKey });
  }

  const b = req.body || {};
  const t = await getThread(b.threadId);
  if (!t || !safeEqual(b.token, t.token)) return res.status(404).json({ error: "Conversation not found." });

  if (req.method === "POST") {
    const sub = cleanSub(b.subscription);
    if (!sub) return res.status(400).json({ error: "That browser didn't provide a valid subscription." });
    t.subs = addSub(t.subs, sub);
    await saveThread(t);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    t.subs = (t.subs || []).filter((s) => s.endpoint !== b.endpoint);
    await saveThread(t);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Use GET, POST or DELETE." });
}
