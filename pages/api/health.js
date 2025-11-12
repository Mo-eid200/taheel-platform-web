export const config = { api: { bodyParser: false } };
export const runtime = "nodejs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  res.status(200).json({ ok: true, ts: Date.now(), host: req.headers.host });
}
