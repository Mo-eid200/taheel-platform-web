import { getAuth } from "firebase-admin/auth";
import { app } from "./firebaseAdmin"; // تأكد أن هذا الملف يهيئ Firebase Admin بشكل صحيح

export async function updateUserPassword(email, newPassword) {
  try {
    const auth = getAuth(app);
    console.log("بدء البحث عن المستخدم في Firebase:", email);

    // جلب المستخدم حسب البريد
    const userRecord = await auth.getUserByEmail(email);
    console.log("تم العثور على المستخدم:", userRecord.uid);

    // تغيير كلمة المرور
    await auth.updateUser(userRecord.uid, { password: newPassword });
    console.log(`تم تغيير كلمة مرور المستخدم: ${email}`);

    return true;
  } catch (err) {
    console.error("خطأ أثناء تغيير كلمة المرور في Firebase:");
    if (err.code) {
      console.error("الكود:", err.code);
    }
    if (err.message) {
      console.error("الرسالة:", err.message);
    }
    if (err.stack) {
      console.error("Stack trace:", err.stack);
    }
    // لو كان الخطأ عبارة عن object فيه تفاصيل:
    console.error("تفاصيل الخطأ بالكامل:", err);

    return false;
  }
}