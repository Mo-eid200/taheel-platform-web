export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // لاستخدام crypto في Node runtime

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getOtp, deleteOtp } from "@/lib/otpDb";
import { updateUserPassword } from "@/lib/usersDb";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const password = String(body.password || "");

    if (!email || !code || !password) {
      return NextResponse.json(
        { success: false, message: "كل الحقول مطلوبة" },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "كلمة المرور ضعيفة" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const otpObj = await getOtp(email);
    if (!otpObj) {
      return NextResponse.json(
        { success: false, message: "رمز غير صالح أو منتهي" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const codeInDb = String(otpObj.code || "").trim();
    const expires = Number(otpObj.expires || 0);
    if (Date.now() > expires) {
      return NextResponse.json(
        { success: false, message: "رمز غير صالح أو منتهي" },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (!safeEqual(code, codeInDb)) {
      return NextResponse.json(
        { success: false, message: "رمز غير صالح أو منتهي" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let updated = false;
    try {
      updated = await updateUserPassword(email, password);
    } catch (e) {
      console.error("updateUserPassword error:", e);
      return NextResponse.json(
        { success: false, message: "خطأ داخلي أثناء تغيير كلمة المرور" },
        { status: 500, headers: CORS_HEADERS }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "تعذر تغيير كلمة المرور" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    try { await deleteOtp(email); } catch (e) { console.warn("deleteOtp warn:", e); }

    return NextResponse.json(
      { success: true, message: "تم تغيير كلمة المرور بنجاح" },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("reset-password unexpected error:", err);
    return NextResponse.json(
      { success: false, message: "خطأ داخلي غير متوقع" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
