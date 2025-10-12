export const dynamic = "force-dynamic";
// لو هتستخدم crypto تحت في reset-password خليه Node:
// export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { saveOtp, getOtp } from "@/lib/otpDb";
import { sendMail } from "@/lib/sendMail";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // فضّل حط دومينك في الإنتاج
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function withTimeout(promise, ms = 12000, label = "operation") {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(id); resolve(v); })
           .catch(e => { clearTimeout(id); reject(e); });
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { success: false, message: "بريد إلكتروني غير صالح" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // rate-limit بسيطة دقيقة
    const existing = await getOtp(email).catch(() => null);
    if (existing && typeof existing.created_at === "number") {
      const since = Date.now() - existing.created_at;
      if (since < 60 * 1000) {
        return NextResponse.json(
          { success: false, message: "يرجى الانتظار دقيقة لإعادة الإرسال" },
          { status: 429, headers: CORS_HEADERS }
        );
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expires = now + 10 * 60 * 1000; // 10 دقائق

    await saveOtp(email, code, expires, now); // تأكد saveOtp بتقبل created_at

    let mailResult = null;
    try {
      mailResult = await withTimeout(sendMail(email, "otp", { code }), 12000, "sendMail");
    } catch (e) {
      console.error("SEND OTP MAIL TIMEOUT/ERROR:", e);
      return NextResponse.json(
        { success: false, message: "تعذر إرسال البريد الإلكتروني. الرجاء المحاولة لاحقاً." },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    if (!mailResult || !mailResult.success) {
      console.error("SEND OTP MAIL ERROR:", mailResult && mailResult.error);
      return NextResponse.json(
        { success: false, message: "تعذر إرسال البريد الإلكتروني. الرجاء المحاولة لاحقاً." },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, message: "تم إرسال رمز التحقق" },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("OTP SEND ERROR:", err);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء معالجة الطلب. حاول لاحقاً." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
