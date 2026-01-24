// pages/api/ai/chat.js
// ✅ One endpoint: AI / Search / Hybrid (Google -> OpenAI)
// ✅ Server-only secrets: OPENAI_API_KEY, GOOGLE_API_KEY, GOOGLE_CX
// ✅ Pages Router (Next.js) - JavaScript

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------- helpers ----------
function json(res, code, payload) {
  return res.status(code).json(payload);
}

function sanitizeMessages(messages) {
  const arr = Array.isArray(messages) ? messages : [];
  const clean = arr
    .map((m) => ({
      role: ["system", "user", "assistant"].includes(m?.role) ? m.role : "user",
      content: String(m?.content || "").trim(),
    }))
    .filter((m) => m.content);

  // keep last 30 only to control token usage
  return clean.slice(-30);
}

function lastUserText(messages) {
  const arr = Array.isArray(messages) ? messages : [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    if (m?.role === "user" && String(m?.content || "").trim()) {
      return String(m.content).trim();
    }
  }
  // fallback to last message
  const last = arr[arr.length - 1];
  return String(last?.content || "").trim();
}

// ===== Language detection (best-effort) =====
// - uses body.lang if provided
// - otherwise infer from last user text
function pickLang(bodyLang, messages) {
  const candidate = String(bodyLang || "").trim().toLowerCase();
  if (candidate) return candidate;

  const t = String(lastUserText(messages) || "");

  // Arabic / Persian / Urdu ranges (covers most RTL scripts)
  if (/[\u0600-\u06FF]/.test(t)) return "ar";

  // Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(t)) return "hi";

  // Basic Latin fallback
  return "en";
}

// Google Custom Search "hl" supports limited languages.
// We'll keep the ANSWER language based on user, but hl can fallback safely.
function googleHl(lang) {
  const supported = new Set([
    "ar",
    "en",
    "fr",
    "hi",
    "ur",
    "tl",
    "es",
    "de",
    "it",
    "pt",
    "ru",
    "tr",
    "id",
    "ms",
    "zh-CN",
    "zh-TW",
    "ja",
    "ko",
  ]);

  const l = String(lang || "").trim();
  if (supported.has(l)) return l;

  // Map common variants
  if (l.startsWith("zh")) return "zh-CN";
  if (l.startsWith("pt")) return "pt";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  if (l.startsWith("it")) return "it";
  if (l.startsWith("ru")) return "ru";
  if (l.startsWith("tr")) return "tr";
  if (l.startsWith("id")) return "id";
  if (l.startsWith("ms")) return "ms";
  if (l.startsWith("ja")) return "ja";
  if (l.startsWith("ko")) return "ko";

  // default for search only
  return "en";
}

// ===== System Prompt (language-agnostic) =====
function buildSystemPrompt() {
  return [
    `You are "TAHEEL Smart Chat".`,
    `CRITICAL: Always reply in the SAME language as the user's latest message (detect from the text).`,
    `Be clear, concise, and helpful.`,
    `If the question is unclear, ask ONLY ONE clarifying question.`,
    `Never reveal secrets, configs, or API keys.`,
    `If the user needs a human agent, suggest contacting support.`,
    `If you cite sources/links, keep them minimal and relevant.`,
  ].join("\n");
}

// ---------- simple in-memory rate limiter (best-effort) ----------
// NOTE: On Vercel serverless, memory may not persist across invocations.
// Still useful as a light guard.
const RL =
  globalThis.__TAHEEL_AI_RL__ || (globalThis.__TAHEEL_AI_RL__ = new Map());

function rateLimitKey(req) {
  // prefer user id if sent (optional)
  const uid = String(req.headers["x-taheel-uid"] || "").trim();
  const ip =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() || req.socket?.remoteAddress || "unknown";
  return uid ? `uid:${uid}` : `ip:${ip}`;
}

function checkRateLimit(req, limit = 30, windowMs = 60_000) {
  const key = rateLimitKey(req);
  const now = Date.now();

  const entry = RL.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  RL.set(key, entry);

  const remaining = Math.max(0, limit - entry.count);
  return { ok: entry.count <= limit, remaining, resetAt: entry.resetAt };
}

// ---------- google search ----------
async function googleSearch(queryText, lang) {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
  const GOOGLE_CX = process.env.GOOGLE_CX || "";

  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    return {
      ok: false,
      text: `Search is not enabled right now.`,
      items: [],
    };
  }

  const q = String(queryText || "").trim();
  if (!q) {
    return {
      ok: true,
      text: `Type your query to search.`,
      items: [],
    };
  }

  const hl = googleHl(lang);

  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(GOOGLE_API_KEY)}` +
    `&cx=${encodeURIComponent(GOOGLE_CX)}` +
    `&q=${encodeURIComponent(q)}` +
    `&hl=${encodeURIComponent(hl)}` +
    `&num=5`;

  const r = await fetch(url, { method: "GET" });
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    return {
      ok: false,
      text: `Search failed at the moment.`,
      items: [],
      details: data,
    };
  }

  const items = Array.isArray(data?.items) ? data.items.slice(0, 5) : [];
  const summarized = items
    .map((it, idx) => {
      const title = String(it?.title || "").trim();
      const snippet = String(it?.snippet || "").trim();
      const link = String(it?.link || "").trim();
      if (!title && !snippet) return null;
      return `${idx + 1}) ${title}\n${snippet}\n${link}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const text = summarized || `No clear results found.`;
  return { ok: true, text, items };
}

// ---------- openai ----------
async function callOpenAI(messages) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      text: `AI service is not enabled right now.`,
    };
  }

  const clean = sanitizeMessages(messages);
  const system = buildSystemPrompt();

  // IMPORTANT:
  // - We prepend ONE system message only (our guardrails)
  // - Any system messages inside "clean" (sent from client) will remain,
  //   but our system comes first, and the model should follow it.
  const finalMessages = [{ role: "system", content: system }, ...clean];

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: finalMessages,
      temperature: 0.3,
      max_tokens: 700,
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ok: false, text: null, details: data };
  }

  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  return {
    ok: true,
    text: text || "No suitable answer.",
  };
}

// ---------- handler ----------
export default async function handler(req, res) {
  // (optional) CORS
  // res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  // res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TAHEEL-UID");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return json(res, 405, { ok: false, error: "method_not_allowed" });

  // ✅ rate limit
  const rl = checkRateLimit(req, 40, 60_000); // 40 req/min per IP or UID
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  res.setHeader("X-RateLimit-Reset", String(rl.resetAt));
  if (!rl.ok) {
    return json(res, 429, { ok: false, error: "rate_limited" });
  }

  try {
    const body = req.body || {};
    const mode = String(body?.mode || "auto").toLowerCase(); // auto | ai | search | hybrid
    const messages = sanitizeMessages(body?.messages || []);

    // Determine language (any language)
    const lang = pickLang(body?.lang, messages);

    const queryText = lastUserText(messages);

    // ✅ auto decision (light)
    const wantsSearch =
      /بحث|source|مصدر|link|روابط|موقع|government|official|verify|تأكد|أكد|citation|news|latest|update/i.test(
        queryText
      );

    const finalMode =
      mode === "ai" || mode === "search" || mode === "hybrid"
        ? mode
        : wantsSearch
        ? "hybrid"
        : "ai";

    // 1) Search only
    if (finalMode === "search") {
      const s = await googleSearch(queryText, lang);
      return json(res, 200, {
        ok: true,
        mode: "search",
        text: s.text,
        items: s.items || [],
        lang,
      });
    }

    // 2) Hybrid: Google -> OpenAI
    if (finalMode === "hybrid") {
      const s = await googleSearch(queryText, lang);

      // If search disabled or failed, fallback to AI only
      if (!s.ok) {
        const a = await callOpenAI(messages);
        if (!a.ok)
          return json(res, 500, { ok: false, error: "ai_failed", details: a.details });
        return json(res, 200, { ok: true, mode: "ai", text: a.text, lang });
      }

      // We inject search results as context (not forcing a language here;
      // the main system prompt forces the assistant to use user's language)
      const ragHint = [
        `Use the following web search results as supporting sources.`,
        `Include relevant links when helpful.`,
        ``,
        s.text,
      ].join("\n");

      const hybridMessages = [...messages, { role: "system", content: ragHint }];

      const a = await callOpenAI(hybridMessages);
      if (!a.ok)
        return json(res, 500, { ok: false, error: "ai_failed", details: a.details });

      return json(res, 200, {
        ok: true,
        mode: "hybrid",
        text: a.text,
        lang,
        sources: (s.items || []).map((it) => ({
          title: it?.title,
          link: it?.link,
          snippet: it?.snippet,
        })),
      });
    }

    // 3) AI only
    const a = await callOpenAI(messages);
    if (!a.ok)
      return json(res, 500, { ok: false, error: "ai_failed", details: a.details });

    return json(res, 200, { ok: true, mode: "ai", text: a.text, lang });
  } catch (e) {
    console.error("ai/chat error:", e);
    return json(res, 500, { ok: false, error: "internal_error" });
  }
}
