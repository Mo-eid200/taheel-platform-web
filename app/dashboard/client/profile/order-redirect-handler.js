// إضافة: useEffect لجلب الطلب إذا وُجد ?order=... أو ?pi=...
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";

export function useOpenOrderFromQuery(openOrderCallback, onError) {
  const search = useSearchParams();
  const router = useRouter();
  const [loadingOrderFromQuery, setLoadingOrderFromQuery] = useState(false);

  useEffect(() => {
    const orderParam = search.get("order");
    const piParam = search.get("pi");
    if (!orderParam && !piParam) return;

    let cancelled = false;
    setLoadingOrderFromQuery(true);

    (async () => {
      try {
        // 1) Try treat orderParam as document id
        if (orderParam) {
          try {
            const ref = doc(firestore, "requests", String(orderParam));
            const snap = await getDoc(ref);
            if (!cancelled && snap.exists()) {
              openOrderCallback({ id: snap.id, ...snap.data() });
              setLoadingOrderFromQuery(false);
              return;
            }
          } catch (e) {
            // continue to fallback search
            console.warn("Direct getDoc failed:", e);
          }
        }

        // 2) If piParam (paymentIntent) or orderParam as orderNumber, try query
        const qField = piParam ? "paymentIntentId" : "orderNumber";
        const qValue = piParam ? piParam : orderParam;
        const q = query(collection(firestore, "requests"), where(qField, "==", String(qValue)));
        const qs = await getDocs(q);
        if (!cancelled) {
          if (!qs.empty) {
            const d = qs.docs[0];
            openOrderCallback({ id: d.id, ...d.data() });
          } else {
            // لم نجد المستند
            onError && onError({ code: "NOT_FOUND", message: "Order not found" });
          }
        }
      } catch (err) {
        console.error("Error fetching order from query:", err);
        onError && onError(err);
      } finally {
        if (!cancelled) setLoadingOrderFromQuery(false);
      }
    })();

    return () => { cancelled = true; };
  }, [search?.toString?.()]);
  
  return { loadingOrderFromQuery };
}