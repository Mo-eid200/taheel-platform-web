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

/** ✅ Collections */
const PLANS_COLLECTION = "companySubscriptionPlans";
const ADDONS_COLLECTION = "companyAddonsCatalog";

/** ✅ Version for safe migrations */
const VERSION = 3;

/* =========================
   ✅ NORMALIZERS
========================= */
function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normMap2(x) {
  // ensure {ar,en}
  if (x && typeof x === "object") {
    return { ar: String(x.ar || ""), en: String(x.en || "") };
  }
  if (typeof x === "string") {
    return { ar: x, en: x };
  }
  return { ar: "", en: "" };
}

function normStrArray(arr) {
  return Array.isArray(arr) ? arr.map((s) => String(s)).filter(Boolean) : [];
}

function normalizePricing(pricing) {
  const out = {};
  const allowed = ["monthly", "quarterly", "semiannual", "yearly"];

  for (const durKey of allowed) {
    const v = pricing?.[durKey] || {};

    const paidMonths = toNum(v.paidMonths, 0);
    let bonus = toNum(v.bonus, 0);

    // ✅ Offer only on semiannual & yearly (as you wanted)
    const isOfferAllowed = durKey === "semiannual" || durKey === "yearly";
    if (!isOfferAllowed) bonus = 0;

    const monthsShown = paidMonths + bonus;

    // ✅ tag rules
    let tag = String(v.tag || "").trim();
    if (!isOfferAllowed) tag = ""; // no tags on monthly/quarterly
    if (durKey === "semiannual") tag = bonus > 0 ? "offer" : "";
    if (durKey === "yearly") tag = "most"; // yearly is "Most" default

    // ✅ best rules (ONLY yearly)
    const best = durKey === "yearly";

    out[durKey] = {
      title: normMap2(v.title),
      price: toNum(v.price, 0),
      currency: String(v.currency || "AED"),
      paidMonths,
      bonus,
      monthsShown,
      tag,
      best,
      // Optional stripe mapping per duration (safe to keep empty)
      stripe: {
        productId: String(v?.stripe?.productId || ""),
        priceId: String(v?.stripe?.priceId || ""),
        mode: "subscription",
      },
    };
  }

  return out;
}

/** =========================
 * ✅ FINAL PLANS (Ops + UI + Pricing)
 * - Based on your FINAL logic:
 *   Starter: yearly mandatory, entities tasheel+amer, limit 10/month
 *   Growth: semi/year, entities tasheel+amer+courts, limit 20/month
 *   Scale: semi/year, add extra entity, limit 30/month
 *   Enterprise: custom high cap, SLA, all entities
========================= */
const plans = {
  starter: {
    key: "starter",
    planKey: "starter",

    // ---- Ops Rules ----
    isActive: true,
    currency: "AED",
    isMandatory: true,
    allowedBillingPeriods: ["yearly"], // ✅ yearly only (mandatory)
    monthlyIncludedTxLimit: 10,
    includedEntities: ["tasheel", "amer"],
    allowEntitiesOutsidePlan: false,

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false, // ✅ always excluded
    },

    afterLimit: {
      mode: "charge_normal", // ✅ printing+vat+admin return automatically
      allowAddon: true,
      allowUpgrade: true,
      hardBlock: false, // ✅ never block
    },

    // ---- UI / Marketing ----
    name: { ar: "Starter GovOps", en: "Starter GovOps" },
    fit: { ar: "للشركات الصغيرة (1–5)", en: "Small companies (1–5)" },
    perks: {
      ar: ["حتى 10 معاملات شهريًا بدون طباعة وضريبة", "دعم مباشر", "تفعيل سريع", "إدارة أسهل"],
      en: ["Up to 10 monthly tx without printing & VAT", "Direct support", "Fast activation", "Easier management"],
    },
    sortIndex: 1,

    // ---- Pricing ----
    pricing: {
      // keep fields if UI needs them, but only yearly will be used by rules
      yearly: { title: { ar: "سنوي", en: "Yearly" }, paidMonths: 12, bonus: 0, price: 3499 },
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, paidMonths: 0, bonus: 0, price: 0 }, // not used
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, paidMonths: 0, bonus: 0, price: 0 }, // not used
      monthly: { title: { ar: "شهري", en: "Monthly" }, paidMonths: 0, bonus: 0, price: 0 }, // not used
    },
  },

  growth: {
    key: "growth",
    planKey: "growth",

    // ---- Ops Rules ----
    isActive: true,
    currency: "AED",
    isMandatory: false,
    allowedBillingPeriods: ["semiannual", "yearly"],
    monthlyIncludedTxLimit: 20,
    includedEntities: ["tasheel", "amer", "courts"],
    allowEntitiesOutsidePlan: false,

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false,
    },

    afterLimit: {
      mode: "charge_normal",
      allowAddon: true,
      allowUpgrade: true,
      hardBlock: false,
    },

    // ---- UI ----
    name: { ar: "Growth GovOps", en: "Growth GovOps" },
    fit: { ar: "للشركات المتوسطة (5–10)", en: "Mid teams (5–10)" },
    perks: {
      ar: ["حتى 20 معاملة شهريًا بدون طباعة وضريبة", "أولوية أعلى", "تقارير مبسطة", "دعم أسرع"],
      en: ["Up to 20 monthly tx without printing & VAT", "Higher priority", "Simplified reports", "Faster support"],
    },
    sortIndex: 2,

    pricing: {
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, paidMonths: 6, bonus: 0, price: 2999 },
      yearly: { title: { ar: "سنوي", en: "Yearly" }, paidMonths: 12, bonus: 0, price: 5999 },
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, paidMonths: 0, bonus: 0, price: 0 },
      monthly: { title: { ar: "شهري", en: "Monthly" }, paidMonths: 0, bonus: 0, price: 0 },
    },
  },

  scale: {
    key: "scale",
    planKey: "scale",

    // ---- Ops Rules ----
    isActive: true,
    currency: "AED",
    isMandatory: false,
    allowedBillingPeriods: ["semiannual", "yearly"],
    monthlyIncludedTxLimit: 30,
    includedEntities: ["tasheel", "amer", "courts", "hr_immigration"], // ✅ your "extra entity"
    allowEntitiesOutsidePlan: false,

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false,
    },

    afterLimit: {
      mode: "charge_normal",
      allowAddon: true,
      allowUpgrade: true,
      hardBlock: false,
    },

    // ---- UI ----
    name: { ar: "Scale GovOps", en: "Scale GovOps" },
    fit: { ar: "للشركات الكبيرة (10–20)", en: "Large teams (10–20)" },
    perks: {
      ar: ["حتى 30 معاملة شهريًا بدون طباعة وضريبة", "أولوية معالجة أعلى", "تنظيم أكبر", "تقارير أوضح"],
      en: ["Up to 30 monthly tx without printing & VAT", "Higher processing priority", "Better organization", "Clearer reports"],
    },
    sortIndex: 3,

    pricing: {
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, paidMonths: 6, bonus: 0, price: 4999 },
      yearly: { title: { ar: "سنوي", en: "Yearly" }, paidMonths: 12, bonus: 0, price: 9999 },
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, paidMonths: 0, bonus: 0, price: 0 },
      monthly: { title: { ar: "شهري", en: "Monthly" }, paidMonths: 0, bonus: 0, price: 0 },
    },
  },

  enterprise: {
    key: "enterprise",
    planKey: "enterprise",

    // ---- Ops Rules ----
    isActive: true,
    currency: "AED",
    isMandatory: false,
    allowedBillingPeriods: ["semiannual", "yearly", "contract"],
    monthlyIncludedTxLimit: 999, // ✅ high/custom cap
    includedEntities: ["all"],
    allowEntitiesOutsidePlan: true, // ✅ by definition

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false,
    },

    afterLimit: {
      mode: "custom", // for enterprise you can still charge or not depending contract
      allowAddon: true,
      allowUpgrade: false,
      hardBlock: false,
    },

    // ---- UI ----
    name: { ar: "Enterprise GovOps", en: "Enterprise GovOps" },
    fit: { ar: "مؤسسات / 20+", en: "Enterprise / 20+" },
    perks: {
      ar: ["سقف معاملات مخصص", "SLA + فريق مخصص", "أولوية قصوى", "مدير حساب"],
      en: ["Custom transaction cap", "SLA + dedicated team", "Maximum priority", "Account manager"],
    },
    sortIndex: 4,

    pricing: {
      semiannual: { title: { ar: "نصف سنوي", en: "Semiannual" }, paidMonths: 6, bonus: 0, price: 7999 },
      yearly: { title: { ar: "سنوي", en: "Yearly" }, paidMonths: 12, bonus: 0, price: 15999 },
      quarterly: { title: { ar: "3 شهور", en: "3 Months" }, paidMonths: 0, bonus: 0, price: 0 },
      monthly: { title: { ar: "شهري", en: "Monthly" }, paidMonths: 0, bonus: 0, price: 0 },
    },
  },
};

/** =========================
 * ✅ ADD-ONS CATALOG (Universal)
 * - Covers: printing + VAT + adminProcessing
 * - Excludes: govFee + stripeFee
========================= */
const addons = {
  extra_5: {
    addonKey: "extra_5",
    title: { ar: "Add-On 5 معاملات إضافية", en: "Add-On 5 Extra Transactions" },
    qty: 5,
    price: 250,
    currency: "AED",
    perTxn: 50,
    popular: false,
    isActive: true,
    type: "bundle",

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false,
    },

    stripe: {
      mode: "payment",
      productId: "",
      priceId: "",
    },
  },

  extra_10: {
    addonKey: "extra_10",
    title: { ar: "Add-On 10 معاملات إضافية", en: "Add-On 10 Extra Transactions" },
    qty: 10,
    price: 450,
    currency: "AED",
    perTxn: 45,
    popular: true, // ⭐ Most popular
    isActive: true,
    type: "bundle",

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false,
    },

    stripe: {
      mode: "payment",
      productId: "",
      priceId: "",
    },
  },

  extra_20: {
    addonKey: "extra_20",
    title: { ar: "Add-On 20 معاملة إضافية", en: "Add-On 20 Extra Transactions" },
    qty: 20,
    price: 800,
    currency: "AED",
    perTxn: 40,
    popular: false,
    isActive: true,
    type: "bundle",

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false,
    },

    stripe: {
      mode: "payment",
      productId: "",
      priceId: "",
    },
  },

  emergency_single: {
    addonKey: "emergency_single",
    title: { ar: "معاملة طوارئ / مستعجلة", en: "Emergency / Urgent Transaction" },
    qty: 1,
    priceMin: 120,
    priceMax: 150,
    currency: "AED",
    isActive: true,
    type: "emergency",

    covers: {
      printingFee: true,
      vat: true,
      adminProcessing: true,
      governmentFee: false,
      stripeFee: false,
    },

    stripe: {
      mode: "payment",
      productId: "",
      priceId: "",
    },
  },
};

/* =========================
   ✅ UPSERT HELPERS
========================= */
async function upsertDoc(collectionName, docId, data) {
  const ref = doc(db, collectionName, docId);
  const snap = await getDoc(ref);

  const payload = {
    ...data,
    version: VERSION,
    updatedAt: serverTimestamp(),
    ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(ref, payload, { merge: true });
  console.log(`✅ UPDATED: ${collectionName}/${docId} ${snap.exists() ? "(merged)" : "(created)"}`);
}

function normalizePlanPayload(data) {
  return {
    ...data,
    key: String(data.key || data.planKey || ""),
    planKey: String(data.planKey || data.key || ""),
    name: normMap2(data.name),
    fit: normMap2(data.fit),
    includedEntities: normStrArray(data.includedEntities),
    allowedBillingPeriods: normStrArray(data.allowedBillingPeriods),
    perks: {
      ar: normStrArray(data?.perks?.ar),
      en: normStrArray(data?.perks?.en),
    },
    covers: {
      printingFee: !!data?.covers?.printingFee,
      vat: !!data?.covers?.vat,
      adminProcessing: !!data?.covers?.adminProcessing,
      governmentFee: !!data?.covers?.governmentFee,
      stripeFee: !!data?.covers?.stripeFee,
    },
    afterLimit: {
      mode: String(data?.afterLimit?.mode || "charge_normal"),
      allowAddon: !!data?.afterLimit?.allowAddon,
      allowUpgrade: !!data?.afterLimit?.allowUpgrade,
      hardBlock: !!data?.afterLimit?.hardBlock,
    },
    monthlyIncludedTxLimit: toNum(data.monthlyIncludedTxLimit, 0),
    pricing: normalizePricing(data.pricing),
  };
}

function normalizeAddonPayload(data) {
  return {
    ...data,
    addonKey: String(data.addonKey || ""),
    title: normMap2(data.title),
    qty: toNum(data.qty, 0),
    price: toNum(data.price, 0),
    priceMin: toNum(data.priceMin, 0),
    priceMax: toNum(data.priceMax, 0),
    perTxn: toNum(data.perTxn, 0),
    popular: !!data.popular,
    isActive: !!data.isActive,
    type: String(data.type || "bundle"),
    currency: String(data.currency || "AED"),
    covers: {
      printingFee: !!data?.covers?.printingFee,
      vat: !!data?.covers?.vat,
      adminProcessing: !!data?.covers?.adminProcessing,
      governmentFee: !!data?.covers?.governmentFee,
      stripeFee: !!data?.covers?.stripeFee,
    },
    stripe: {
      mode: String(data?.stripe?.mode || "payment"),
      productId: String(data?.stripe?.productId || ""),
      priceId: String(data?.stripe?.priceId || ""),
    },
  };
}

/* =========================
   ✅ RUN
========================= */
async function run() {
  // ---- Upsert Plans ----
  for (const key of Object.keys(plans)) {
    const planPayload = normalizePlanPayload(plans[key]);
    await upsertDoc(PLANS_COLLECTION, key, planPayload);
  }

  // ---- Upsert Add-ons ----
  for (const key of Object.keys(addons)) {
    const addonPayload = normalizeAddonPayload(addons[key]);
    await upsertDoc(ADDONS_COLLECTION, key, addonPayload);
  }

  console.log("🎉 DONE. Plans + Add-ons are fully synced (Ops + UI + Pricing).");
}

run().catch((e) => {
  console.error("❌ FAILED:", e);
  process.exit(1);
});
