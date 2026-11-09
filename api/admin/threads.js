// GET /api/admin/threads  — list all conversations, newest first (needs ADMIN_PASSWORD)
import { redis, isAdmin, publicThread, rateLimited, noStore } from "../_lib/store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
  if (!redis) return res.status(500).json({ error: "Storage isn't set up." });
  if (!isAdmin(req)) {
    if (await rateLimited(req, "login", 10, 900)) return res.status(429).json({ error: "Too many attempts. Wait 15 minutes." });
    return res.status(401).json({ error: "Wrong password." });
  }

  const ids = await redis.zrange("threads", 0, 199, { rev: true });
  if (!ids.length) return res.status(200).json({ threads: [] });
  const rows = await redis.mget(...ids.map((id) => `thread:${id}`));
  const threads = rows.filter(Boolean).map(publicThread);
  return res.status(200).json({ threads });
}
