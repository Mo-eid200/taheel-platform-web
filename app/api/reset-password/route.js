export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getOtp, deleteOtp } from "@/lib/otpDb";
import { updateUserPassword } from "@/lib/usersDb"; // يجب أن تكتب هذه الوظيفة

export async function POST(req) {
  try {
    const { email, code, password } = await req.json();
    const cleanEmail = email?.trim().toLowerCase();

    console.log("---- بدء تغيير كلمة المرور ----");
    console.log("البيانات المستلمة:", { email, cleanEmail, code, password });

    if (!cleanEmail || !code || !password) {
      console.log("خطأ: هناك حقل ناقص");
      return NextResponse.json({ success: false, message: "كل الحقول مطلوبة" }, { status: 400 });
    }

    // تحقق من الرمز
    const otpObj = await getOtp(cleanEmail);
    console.log("الكود من قاعدة البيانات:", otpObj);

    if (!otpObj) {
      console.log("خطأ: لم يتم العثور على كود لهذا البريد");
      return NextResponse.json({ success: false, message: "رمز غير صالح أو منتهي" }, { status: 400 });
    }
    if (otpObj.code !== code) {
      console.log("خطأ: الكود المدخل غير مطابق للكود في القاعدة", { codeProvided: code, codeInDb: otpObj.code });
      return NextResponse.json({ success: false, message: "رمز غير صالح أو منتهي" }, { status: 400 });
    }
    if (Date.now() > otpObj.expires) {
      console.log("خطأ: الكود منتهي الصلاحية");
      return NextResponse.json({ success: false, message: "رمز غير صالح أو منتهي" }, { status: 400 });
    }

    // تحقق من قوة كلمة المرور
    if (password.length < 6) {
      console.log("خطأ: كلمة المرور أقل من 6 حروف");
      return NextResponse.json({ success: false, message: "كلمة المرور ضعيفة" }, { status: 400 });
    }

    // محاولة تغيير كلمة المرور
    let updated;
    try {
      updated = await updateUserPassword(cleanEmail, password);
      console.log("نتيجة محاولة تغيير كلمة المرور:", updated);
    } catch (err) {
      console.log("استثناء أثناء محاولة تغيير كلمة المرور:", err);
      return NextResponse.json({ success: false, message: "خطأ داخلي أثناء تغيير كلمة المرور" }, { status: 500 });
    }

    if (!updated) {
      console.log("خطأ: لم يتم تغيير كلمة المرور (الدالة رجعت false)");
      return NextResponse.json({ success: false, message: "تعذر تغيير كلمة المرور" }, { status: 500 });
    }

    // حذف الكود بعد النجاح
    try {
      await deleteOtp(cleanEmail);
      console.log("تم حذف كود التحقق من القاعدة");
    } catch (err) {
      console.log("استثناء أثناء حذف الكود:", err);
    }

    console.log("تم تغيير كلمة المرور بنجاح للبريد:", cleanEmail);
    return NextResponse.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    console.log("استثناء عام في دالة تغيير كلمة المرور:", err);
    return NextResponse.json({ success: false, message: "خطأ داخلي غير متوقع" }, { status: 500 });
  }
}