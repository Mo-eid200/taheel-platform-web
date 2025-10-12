import { rtdb } from "@/lib/firebase.client";
import { ref, set, get, remove } from "firebase/database";

const toKey = (email) => email.trim().toLowerCase().replace(/\./g, "_");

export async function saveOtp(email, code, expires, created_at = Date.now()) {
  const key = toKey(email);
  await set(ref(rtdb, `otps/${key}`), {
    code,
    expires,
    created_at,
  });
}

export async function getOtp(email) {
  const key = toKey(email);
  const snap = await get(ref(rtdb, `otps/${key}`));
  return snap.exists() ? snap.val() : null;
}

export async function deleteOtp(email) {
  const key = toKey(email);
  await remove(ref(rtdb, `otps/${key}`));
}
