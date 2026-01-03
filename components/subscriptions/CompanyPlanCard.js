"use client";

export default function CompanyPlanCard({ plan, lang = "ar", darkMode = false }) {
  const name = lang === "ar" ? plan.nameAr || plan.name || "باقة" : plan.nameEn || plan.name || "Plan";
  const desc = lang === "ar" ? plan.descriptionAr || plan.description || "" : plan.descriptionEn || plan.description || "";
  const price = plan.price ?? plan.amount ?? 0;
  const currency = plan.currency || "AED";

  return (
    <div className={`rounded-2xl p-5 shadow-xl border transition hover:scale-[1.01]
      ${darkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white/95 border-emerald-100 text-gray-900"}`}>
      
      <div className="flex items-center justify-between mb-3">
        <div className="text-xl font-black">{name}</div>
        {plan.isPopular && (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-yellow-400 text-black">
            {lang === "ar" ? "الأكثر طلباً" : "Popular"}
          </span>
        )}
      </div>

      {desc && <div className={`${darkMode ? "text-gray-200" : "text-gray-700"} text-sm mb-4`}>{desc}</div>}

      <div className="text-3xl font-black text-emerald-500 mb-4">
        {price} <span className="text-sm font-bold text-gray-400">{currency}</span>
      </div>

      {!!plan.features?.length && (
        <ul className="space-y-2 text-sm mb-5">
          {plan.features.map((f, i) => (
            <li key={i} className={`${darkMode ? "text-gray-200" : "text-gray-700"} flex gap-2`}>
              <span className="text-emerald-500">✓</span> {f}
            </li>
          ))}
        </ul>
      )}

      <button
        className="w-full py-3 rounded-xl font-extrabold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow hover:brightness-110 transition"
        onClick={() => alert(lang === "ar" ? "هنوصل الدفع هنا" : "Payment flow here")}
      >
        {lang === "ar" ? "اشترك الآن" : "Subscribe Now"}
      </button>
    </div>
  );
}
