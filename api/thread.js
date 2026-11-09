// GET /api/thread?id=...&token=...  — a visitor reads their own conversation (with replies)
import { redis, safeEqual, getThread, publicThread, noStore } from "./_lib/store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
  if (!redis) return res.status(500).json({ error: "Storage isn't set up." });

  const t = await getThread(req.query.id);
  if (!t || !safeEqual(req.query.token, t.token)) return res.status(404).json({ error: "Conversation not found." });
  return res.status(200).json({ thread: publicThread(t) });
}
