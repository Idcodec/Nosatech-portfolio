// POST /api/admin/reply  — owner replies to a conversation (needs ADMIN_PASSWORD)
// Body: { threadId, text }
import { redis, isAdmin, LIMITS, getThread, saveThread, publicThread, noStore } from "../_lib/store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!redis) return res.status(500).json({ error: "Storage isn't set up." });
  if (!isAdmin(req)) return res.status(401).json({ error: "Wrong password." });

  const { threadId, text } = req.body || {};
  const body = String(text || "").trim();
  if (!body) return res.status(400).json({ error: "Write a reply first." });
  if (body.length > LIMITS.text) return res.status(400).json({ error: `Keep replies under ${LIMITS.text} characters.` });

  const t = await getThread(threadId);
  if (!t) return res.status(404).json({ error: "Conversation not found." });

  const now = new Date().toISOString();
  t.messages.push({ from: "owner", text: body, at: now });
  t.updatedAt = now;
  t.awaitingReply = false;
  await saveThread(t);
  return res.status(200).json({ thread: publicThread(t) });
}
