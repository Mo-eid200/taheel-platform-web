// app/api/sendOrderEmail/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Resend } from "resend";
import fs from "fs";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);
const templatePath = path.join(process.cwd(), "lib", "email-templates", "order-confirmation-bilingual.html");
const templateHTML = fs.readFileSync(templatePath, "utf-8");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, x-taheel-key",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req) {
  const rid = `mail_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const t0 = Date.now();
  try {
    const ua = req.headers.get("user-agent") || "n/a";
    const origin = req.headers.get("origin") || "n/a";
    console.log(`[${rid}] HIT ua="${ua}" origin="${origin}" at=${t0}`);

    // اقرا body نص ثم JSON عشان نطبع عيّنة مفيدة
    const raw = await req.text();
    console.log(`[${rid}] bodyLen=${raw.length} sample="${raw.slice(0, 120)}"`);
    let body = {};
    try { body = JSON.parse(raw || "{}"); } catch {
      return new Response(JSON.stringify({ success:false, error:"invalid_json" }), { status:400, headers:corsHeaders() });
    }

    const { to, orderNumber, serviceName, price, lang="ar", clientSentAt } = body;
    if (!to || !orderNumber || !serviceName || price == null) {
      return new Response(JSON.stringify({ success:false, error:"missing_fields" }), { status:400, headers:corsHeaders() });
    }

    const html = templateHTML
      .replace(/{{ORDER_NUMBER}}/g, String(orderNumber))
      .replace(/{{SERVICE_NAME}}/g, String(serviceName))
      .replace(/{{PRICE}}/g, String(price));

    const subject =
      lang === "ar"
        ? "تأكيد الطلب - منصة تأهيل | Order Confirmation - Taheel"
        : "Order Confirmation - Taheel | تأكيد الطلب - منصة تأهيل";

    const t1 = Date.now();
    console.log(`[${rid}] send → ${to} #${orderNumber}`);
    const result = await resend.emails.send({
      from: "Taheel Platform <info@taheel.ae>",
      to,
      subject,
      html,
      text:
        `رقم الطلب: ${orderNumber}\n` +
        `اسم الخدمة: ${serviceName}\n` +
        `المبلغ المدفوع: ${price} درهم\n` +
        `Order No.: ${orderNumber}\nService: ${serviceName}\nPaid: ${price} AED`,
    });
    const t2 = Date.now();

    if (result?.error) {
      console.error(`[${rid}] Resend error:`, result.error);
      return new Response(JSON.stringify({ success:false, error:result.error }), { status:502, headers:corsHeaders() });
    }

    return new Response(JSON.stringify({
      success: true,
      rid,
      timings: {
        server_receive_ms: t1 - t0,   // الزمن لحد ما بدأ الإرسال
        provider_ms: t2 - t1,         // زمن مزوّد الإيميل
        total_ms: t2 - t0,
        client_sent_at: clientSentAt || null,
        server_received_at: t0,
      },
      resultId: result?.id || null,
    }), { status:200, headers:corsHeaders() });
  } catch (e) {
    console.error(`[${rid}] fail:`, e?.message || e);
    return new Response(JSON.stringify({ success:false, error: e?.message || "send_failed" }), {
      status:500, headers:corsHeaders(),
    });
  }
}
