// POST   /api/admin/push  → turn on new-message notifications for this device. Body: { subscription }
// DELETE /api/admin/push  → turn them off. Body: { endpoint }
import { redis, isAdmin, noStore } from "../_lib/store.js";
import { cleanSub, addSub, adminSubs, saveAdminSubs } from "../_lib/push.js";

export default async function handler(req, res) {
  noStore(res);
  if (!redis) return res.status(500).json({ error: "Storage isn't set up." });
  if (!isAdmin(req)) return res.status(401).json({ error: "Wrong password." });
  const b = req.body || {};

  if (req.method === "POST") {
    const sub = cleanSub(b.subscription);
    if (!sub) return res.status(400).json({ error: "This browser didn't provide a valid subscription." });
    await saveAdminSubs(addSub(await adminSubs(), sub, 10));
    return res.status(200).json({ ok: true });
  }
  if (req.method === "DELETE") {
    await saveAdminSubs((await adminSubs()).filter((s) => s.endpoint !== b.endpoint));
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Use POST or DELETE." });
}
