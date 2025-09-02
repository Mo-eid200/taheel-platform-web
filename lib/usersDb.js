import { getAuth } from "firebase-admin/auth";

export async function updateUserPassword(email, newPassword) {
  try {
    const auth = getAuth();
    // ابحث عن المستخدم بالميل
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: newPassword });
    return true;
  } catch (err) {
    console.error("Firebase update password error:", err);
    return false;
  }
}