// GET /api/admin/threads  — list all conversations, newest first (needs ADMIN_PASSWORD)
import { redis, isAdmin, listThreads, publicThread, rateLimited, noStore } from "../_lib/store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
  if (!redis) return res.status(500).json({ error: "Storage isn't set up." });
  if (!isAdmin(req)) {
    if (await rateLimited(req, "login", 10, 900)) return res.status(429).json({ error: "Too many attempts. Wait 15 minutes." });
    return res.status(401).json({ error: "Wrong password." });
  }

  const threads = (await listThreads()).map(publicThread);
  return res.status(200).json({ threads });
}
