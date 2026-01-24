// pages/api/ai/chat.js
// ✅ One endpoint: AI / Search / Hybrid (Google -> OpenAI)
// ✅ Server-only secrets: OPENAI_API_KEY, GOOGLE_API_KEY, GOOGLE_CX
// ✅ Pages Router (Next.js) - JavaScript

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------- helpers ----------
function json(res, code, payload) {
  return res.status(code).json(payload);
}

function safeLang(lang) {
  return lang === "en" ? "en" : "ar";
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

function buildSystemPrompt(lang) {
  if (lang === "ar") {
    return [
      `أنت مساعد "TAHEEL Smart Chat".`,
      `- أجب باختصار ووضوح وبالعربية.`,
      `- إذا السؤال غير واضح اسأل سؤال توضيحي واحد فقط.`,
      `- لا تكشف أي أسرار أو إعدادات داخلية أو مفاتيح.`,
      `- إذا احتاج الموضوع لموظف دعم، اقترح تحويله لخدمة العملاء.`,
    ].join("\n");
  }
  return [
    `You are "TAHEEL Smart Chat".`,
    `- Answer clearly and concisely in English.`,
    `- If unclear, ask one clarifying question only.`,
    `- Never reveal secrets, configs, or keys.`,
    `- If needs a human agent, suggest contacting support.`,
  ].join("\n");
}

// ---------- simple in-memory rate limiter (best-effort) ----------
// NOTE: On Vercel serverless, memory may not persist across invocations.
// Still useful as a light guard.
const RL = globalThis.__TAHEEL_AI_RL__ || (globalThis.__TAHEEL_AI_RL__ = new Map());

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
      text:
        lang === "ar"
          ? "ميزة البحث غير مفعّلة حالياً."
          : "Search is not enabled right now.",
      items: [],
    };
  }

  const q = String(queryText || "").trim();
  if (!q) {
    return {
      ok: true,
      text: lang === "ar" ? "اكتب سؤالك للبحث." : "Type your query to search.",
      items: [],
    };
  }

  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(GOOGLE_API_KEY)}` +
    `&cx=${encodeURIComponent(GOOGLE_CX)}` +
    `&q=${encodeURIComponent(q)}` +
    `&num=5`;

  const r = await fetch(url, { method: "GET" });
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    return {
      ok: false,
      text:
        lang === "ar"
          ? "فشل البحث حالياً."
          : "Search failed at the moment.",
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

  const text =
    summarized ||
    (lang === "ar" ? "لم أجد نتائج واضحة." : "No clear results found.");

  return { ok: true, text, items };
}

// ---------- openai ----------
async function callOpenAI(messages, lang) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      text:
        lang === "ar"
          ? "خدمة الذكاء الاصطناعي غير مفعّلة حالياً."
          : "AI service is not enabled right now.",
    };
  }

  const clean = sanitizeMessages(messages);
  const system = buildSystemPrompt(lang);
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
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ok: false, text: null, details: data };
  }

  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  return {
    ok: true,
    text: text || (lang === "ar" ? "لم أجد إجابة مناسبة." : "No suitable answer."),
  };
}

// ---------- handler ----------
export default async function handler(req, res) {
  // (اختياري) CORS بسيط لو هتطلبه من دومين غير نفس الدومين
  // res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  // res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TAHEEL-UID");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  // ✅ rate limit
  const rl = checkRateLimit(req, 40, 60_000); // 40 req/min per IP or UID
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  res.setHeader("X-RateLimit-Reset", String(rl.resetAt));
  if (!rl.ok) {
    return json(res, 429, { ok: false, error: "rate_limited" });
  }

  try {
    const body = req.body || {};
    const lang = safeLang(body?.lang);
    const mode = String(body?.mode || "auto").toLowerCase(); // auto | ai | search | hybrid
    const messages = sanitizeMessages(body?.messages || []);

    const queryText = lastUserText(messages);

    // ✅ auto decision (خفيف)
    const wantsSearch =
      /بحث|source|مصدر|link|روابط|موقع|government|official|verify|تأكد|أكد|citation/i.test(queryText);

    const finalMode =
      mode === "ai" || mode === "search" || mode === "hybrid"
        ? mode
        : wantsSearch
          ? "hybrid"
          : "ai";

    // 1) Search only
    if (finalMode === "search") {
      const s = await googleSearch(queryText, lang);
      return json(res, 200, { ok: true, mode: "search", text: s.text, items: s.items || [] });
    }

    // 2) Hybrid: Google -> OpenAI
    if (finalMode === "hybrid") {
      const s = await googleSearch(queryText, lang);

      // If search disabled or failed, fallback to AI only
      if (!s.ok) {
        const a = await callOpenAI(messages, lang);
        if (!a.ok) return json(res, 500, { ok: false, error: "ai_failed", details: a.details });
        return json(res, 200, { ok: true, mode: "ai", text: a.text });
      }

      const ragHint =
        lang === "ar"
          ? `استخدم نتائج البحث التالية كمصادر للمساعدة، واذكر الروابط ذات الصلة إن أمكن:\n\n${s.text}`
          : `Use the following search results as supporting sources, and include relevant links when useful:\n\n${s.text}`;

      const hybridMessages = [
        ...messages,
        { role: "system", content: ragHint },
      ];

      const a = await callOpenAI(hybridMessages, lang);
      if (!a.ok) return json(res, 500, { ok: false, error: "ai_failed", details: a.details });

      return json(res, 200, {
        ok: true,
        mode: "hybrid",
        text: a.text,
        sources: (s.items || []).map((it) => ({
          title: it?.title,
          link: it?.link,
          snippet: it?.snippet,
        })),
      });
    }

    // 3) AI only
    const a = await callOpenAI(messages, lang);
    if (!a.ok) return json(res, 500, { ok: false, error: "ai_failed", details: a.details });

    return json(res, 200, { ok: true, mode: "ai", text: a.text });
  } catch (e) {
    console.error("ai/chat error:", e);
    return json(res, 500, { ok: false, error: "internal_error" });
  }
}
