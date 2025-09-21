// app/api/sendOrderEmail/route.js
// نسخة مُحسّنة *بدون* تغيير منطق الإرسال القائم

export const runtime = "nodejs";          // لضمان عمل fs/path
export const dynamic = "force-dynamic";   // تفادي أي كاش غير مرغوب

import { Resend } from "resend";
import fs from "fs";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);

// CORS headers موحّدة
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // إن أردت حصره في نطاقك لاحقًا بدّل *
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, x-taheel-key",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

// تحميل القالب مرّة واحدة عند بدء التشغيل
const templatePath = path.join(
  process.cwd(),
  "lib",
  "email-templates",
  "order-confirmation-bilingual.html"
);
const templateHTML = fs.readFileSync(templatePath, "utf-8");

// دعم طلب OPTIONS لـ CORS
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// POST: نفس منطق الإرسال الموجود، مع تحسينات أمان/تحقق طفيفة غير مكسِّرة
export async function POST(req) {
  const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    if (!process.env.RESEND_API_KEY) {
      console.error(`[${reqId}] missing RESEND_API_KEY`);
      return new Response(JSON.stringify({ success: false, error: "missing_api_key" }), {
        status: 500,
        headers: corsHeaders(),
      });
    }

    // قراءة JSON بأمان
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[${reqId}] invalid_json`, e);
      return new Response(JSON.stringify({ success: false, error: "invalid_json" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const { to, orderNumber, serviceName, price } = body || {};
    if (!to || !orderNumber || !serviceName || (price === undefined || price === null)) {
      console.error(`[${reqId}] missing_fields`, body);
      return new Response(JSON.stringify({ success: false, error: "missing_fields" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // تجهيز HTML من القالب (مع تحويل القيم لنص)
    const html = templateHTML
      .replace(/{{ORDER_NUMBER}}/g, String(orderNumber))
      .replace(/{{SERVICE_NAME}}/g, String(serviceName))
      .replace(/{{PRICE}}/g, String(price));

    const subject = "تأكيد الطلب - منصة تأهيل | Order Confirmation - Taheel";

    // إرسال الإيميل عبر Resend (نفس المنطق الأصلي)
    const result = await resend.emails.send({
      from: "Taheel Platform <info@taheel.ae>",
      to,
      subject,
      html,
      text:
        `رقم الطلب: ${orderNumber}\n` +
        `اسم الخدمة: ${serviceName}\n` +
        `المبلغ المدفوع: ${price} درهم\n` +
        `Order No.: ${orderNumber}\n` +
        `Service: ${serviceName}\n` +
        `Paid: ${price} AED`,
    });

    console.log(`[${reqId}] Resend response:`, result);

    // لو مزوّد البريد رجّع خطأ داخل 200
    if (result?.error) {
      console.error(`[${reqId}] Resend error:`, result.error);
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        status: 502,
        headers: corsHeaders(),
      });
    }

    // ردّ JSON مع CORS
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error(`[${reqId}] Email API error:`, error?.message || error);
    return new Response(JSON.stringify({ success: false, error: error?.message || "send_failed" }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}
