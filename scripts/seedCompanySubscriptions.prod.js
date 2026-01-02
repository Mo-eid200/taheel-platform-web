import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/** ✅ Firebase config (Prod) */
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "taheel-platform-v2",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/** ✅ Collection name */
const COLLECTION = "companySubscriptionPlans";

/** ✅ Version for safe migrations */
const VERSION = 1;

/** ✅ Plans payload */
const plans = {
  starter: {
    key: "starter",
    name: "Starter PRO",
    fit: { ar: "للشركات الصغيرة (1–5)", en: "Small companies (1–5)" },
    isActive: true,
    sortIndex: 1,
    perks: {
      ar: ["إلغاء رسوم الطباعة", "دعم مباشر", "تفعيل سريع", "متابعة أسهل"],
      en: ["Printing fees waived", "Direct support", "Fast activation", "Easier tracking"],
    },
    pricing: {
      monthly: { title: { ar: "شهري", en: "Monthly" }, monthsShown: 1, paidMonths: 1, bonus: 0, price: 299 },
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, monthsShown: 3, paidMonths: 3, bonus: 0, price: 799 },
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, monthsShown: 7, paidMonths: 6, bonus: 1, tag: "offer", price: 1799 },
      yearly: { title: { ar: "سنوي", en: "Yearly" }, monthsShown: 13, paidMonths: 12, bonus: 1, tag: "most", best: true, price: 3499 },
    },
  },

  growth: {
    key: "growth",
    name: "Growth PRO",
    fit: { ar: "للشركات المتوسطة (5–10)", en: "Mid teams (5–10)" },
    isActive: true,
    sortIndex: 2,
    perks: {
      ar: ["متابعة أسرع", "إلغاء رسوم الطباعة", "أولوية أعلى", "تقارير مبسطة"],
      en: ["Faster tracking", "Printing fees waived", "Higher priority", "Simplified reports"],
    },
    pricing: {
      monthly: { title: { ar: "شهري", en: "Monthly" }, monthsShown: 1, paidMonths: 1, bonus: 0, price: 499 },
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, monthsShown: 3, paidMonths: 3, bonus: 0, price: 1399 },
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, monthsShown: 7, paidMonths: 6, bonus: 1, tag: "offer", price: 2999 },
      yearly: { title: { ar: "سنوي", en: "Yearly" }, monthsShown: 13, paidMonths: 12, bonus: 1, tag: "most", best: true, price: 5999 },
    },
  },

  scale: {
    key: "scale",
    name: "Scale PRO",
    fit: { ar: "للشركات الكبيرة (10–20)", en: "Larger teams (10–20)" },
    isActive: true,
    sortIndex: 3,
    perks: {
      ar: ["أولوية معالجة أعلى", "إلغاء رسوم الطباعة", "تقارير أسهل", "تنظيم أكبر"],
      en: ["Higher priority", "Printing fees waived", "Cleaner reports", "More workload"],
    },
    pricing: {
      monthly: { title: { ar: "شهري", en: "Monthly" }, monthsShown: 1, paidMonths: 1, bonus: 0, price: 799 },
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, monthsShown: 3, paidMonths: 3, bonus: 0, price: 2199 },
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, monthsShown: 7, paidMonths: 6, bonus: 1, tag: "offer", price: 4999 },
      yearly: { title: { ar: "سنوي", en: "Yearly" }, monthsShown: 13, paidMonths: 12, bonus: 1, tag: "most", best: true, price: 9999 },
    },
  },

  enterprise: {
    key: "enterprise",
    name: "Enterprise PRO",
    fit: { ar: "مؤسسات / 20+", en: "Enterprise / 20+" },
    isActive: true,
    sortIndex: 4,
    perks: {
      ar: ["SLA ودعم مخصص", "أولوية قصوى", "حلول حسب النشاط", "مدير حساب"],
      en: ["SLA & dedicated support", "Maximum priority", "Tailored solutions", "Account manager"],
    },
    pricing: {
      monthly: { title: { ar: "شهري", en: "Monthly" }, monthsShown: 1, paidMonths: 1, bonus: 0, price: 1299 },
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, monthsShown: 3, paidMonths: 3, bonus: 0, price: 3599 },
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, monthsShown: 7, paidMonths: 6, bonus: 1, tag: "offer", price: 7999 },
      yearly: { title: { ar: "سنوي", en: "Yearly" }, monthsShown: 13, paidMonths: 12, bonus: 1, tag: "most", best: true, price: 15999 },
    },
  },
};

/**
 * ✅ SAFE MODE:
 * - if a doc already exists => SKIP (no overwrite)
 * - use { overwrite: true } if you want forced updates later
 */
async function upsertPlan(planKey, data, { overwrite = false } = {}) {
  const ref = doc(db, COLLECTION, planKey);
  const snap = await getDoc(ref);

  if (snap.exists() && !overwrite) {
    console.log(`⏭ SKIP (exists): ${planKey}`);
    return;
  }

  const payload = {
    ...data,
    version: VERSION,
    updatedAt: serverTimestamp(),
    ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(ref, payload, { merge: true }); // merge = safer for prod
  console.log(`✅ WRITE: ${planKey} ${snap.exists() ? "(merged)" : "(created)"}`);
}

async function run() {
  for (const key of Object.keys(plans)) {
    await upsertPlan(key, plans[key], { overwrite: false });
  }
  console.log("🎉 DONE. Company subscription plans are live.");
}

run().catch((e) => {
  console.error("❌ FAILED:", e);
  process.exit(1);
});
