"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";

export function useOpenOrderFromQuery(openOrderCallback, onError) {
  const search = useSearchParams();
  const [loadingOrderFromQuery, setLoadingOrderFromQuery] = useState(false);

  const orderParam = search.get("order");
  const piParam = search.get("pi");

  useEffect(() => {
    if (!orderParam && !piParam) return;

    let cancelled = false;
    setLoadingOrderFromQuery(true);

    (async () => {
      try {
        // 1) لو orderParam موجود نجربه كـ doc id
        if (orderParam) {
          try {
            const ref = doc(firestore, "requests", String(orderParam));
            const snap = await getDoc(ref);
            if (!cancelled && snap.exists()) {
              openOrderCallback?.({ id: snap.id, ...snap.data() });
              return;
            }
          } catch (e) {
            console.warn("Direct getDoc failed:", e);
          }
        }

        // 2) fallback query على paymentIntentId أو orderNumber
        const qField = piParam ? "paymentIntentId" : "orderNumber";
        const qValue = piParam ? piParam : orderParam;

        const qRef = query(
          collection(firestore, "requests"),
          where(qField, "==", String(qValue)),
          limit(1)
        );

        const qs = await getDocs(qRef);

        if (!cancelled) {
          if (!qs.empty) {
            const d = qs.docs[0];
            openOrderCallback?.({ id: d.id, ...d.data() });
          } else {
            onError?.({ code: "NOT_FOUND", message: "Order not found" });
          }
        }
      } catch (err) {
        console.error("Error fetching order from query:", err);
        onError?.(err);
      } finally {
        if (!cancelled) setLoadingOrderFromQuery(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderParam, piParam, openOrderCallback, onError]);

  return { loadingOrderFromQuery };
}
