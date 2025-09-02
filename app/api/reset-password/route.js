export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getOtp, deleteOtp } from "@/lib/otpDb";
import { updateUserPassword } from "@/lib/usersDb"; // يجب أن تكتب هذه الوظيفة

export async function POST(req) {
  const { email, code, password } = await req.json();
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !code || !password) {
    return NextResponse.json({ success: false, message: "كل الحقول مطلوبة" }, { status: 400 });
  }

  // تحقق من الرمز
  const otpObj = await getOtp(cleanEmail);
  if (!otpObj || otpObj.code !== code || Date.now() > otpObj.expires) {
    return NextResponse.json({ success: false, message: "رمز غير صالح أو منتهي" }, { status: 400 });
  }

  // تحقق من قوة كلمة المرور (مثال بسيط)
  if (password.length < 6) {
    return NextResponse.json({ success: false, message: "كلمة المرور ضعيفة" }, { status: 400 });
  }

  // غير كلمة المرور للمستخدم في قاعدة البيانات (اكتب دالة updateUserPassword بنفسك)
  const updated = await updateUserPassword(cleanEmail, password);
  if (!updated) {
    return NextResponse.json({ success: false, message: "تعذر تغيير كلمة المرور" }, { status: 500 });
  }

  await deleteOtp(cleanEmail);

  return NextResponse.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
}