// src/utils/subscription.js
export function computeSubscriptionActive(docData) {
  if (!docData) return false;

  const isActiveFlag = docData.isActive === true;

  const startMs =
    docData.startAt?.toMillis?.() ??
    (docData.startAt?.seconds ? docData.startAt.seconds * 1000 : 0) ??
    (docData.startAtISO ? Date.parse(docData.startAtISO) : 0);

  const endMs =
    docData.endAt?.toMillis?.() ??
    (docData.endAt?.seconds ? docData.endAt.seconds * 1000 : 0) ??
    (docData.endAtISO ? Date.parse(docData.endAtISO) : 0);

  const now = Date.now();

  const withinWindow =
    (!startMs || now >= startMs) &&
    (!endMs || now < endMs);

  // ✅ المصدر الحقيقي الوحيد
  return isActiveFlag && withinWindow;
}
