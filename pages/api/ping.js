export const config = { api: { bodyParser: false } };
export const runtime = "nodejs";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "HEAD") return res.status(200).end();
  if (req.method === "GET")  return res.status(200).send("pong");
  res.status(405).end();
}
