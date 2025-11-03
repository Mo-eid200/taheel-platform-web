"use client";
import { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  Timestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import StyledQRCode from "@/components/StyledQRCode";

/* =========================
   ثابتات/Labels
========================= */
const CATEGORY_LABELS = {
  translation: { ar: "الترجمة", en: "Translation" },
  hr: { ar: "الموارد البشرية", en: "HR" },
  report: { ar: "التقارير", en: "Reports" },
  other: { ar: "أخرى", en: "Other" },
};

/* =========================
   Helpers: slug + URLs
========================= */
const slugify = (s) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "") // عربي/إنجليزي فقط
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);

const getVerifyUrl = (id) => `https://www.taheel.ae/verify/${id}`;
const getPageUrl = (slug) => `https://www.taheel.ae/p/u/${slug}`;
const getSmartQrUrl = (qrKey) => {
  if (qrKey?.startsWith("PAGE::")) {
    const slug = qrKey.replace("PAGE::", "");
    return getPageUrl(slug);
  }
  return getVerifyUrl(qrKey);
};

export default function ArchiveSection({ lang = "ar" }) {
  const [category, setCategory] = useState("translation");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // رفع ملف
  const [file, setFile] = useState(null);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [uploading, setUploading] = useState(false);

  // QR المعروض (id للملف أو PAGE::<slug>)
  const [qrFor, setQrFor] = useState(null);

  // إنشاء صفحة VIP
  const [createVipPage, setCreateVipPage] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientNumber, setClientNumber] = useState(""); // رقم العميل
  const [vipSlug, setVipSlug] = useState("");
  const [vipImageUrl, setVipImageUrl] = useState("");

  // مولّد QR يدوي لأي صفحة (اختياري صغير مفيد)
  const [quickSlug, setQuickSlug] = useState("");

  /* =========================
     جلب الملفات حسب التصنيف
  ========================== */
  useEffect(() => {
    setLoading(true);
    async function fetchFiles() {
      const qy = query(
        collection(firestore, "archiveFiles"),
        where("category", "==", category),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(qy);
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFiles(docs);
      setLoading(false);
    }
    fetchFiles();
  }, [category, uploading]);

  /* =========================
     رفع الملف ثم (اختياري) إنشاء صفحة VIP
  ========================== */
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !nameAr || !nameEn) {
      setMsg(lang === "ar" ? "كل الحقول مطلوبة!" : "All fields are required!");
      return;
    }
    if (createVipPage && (!clientName || !clientNumber)) {
      setMsg(lang === "ar" ? "اسم ورقم العميل مطلوبان لصفحة VIP" : "Client name & number required for VIP page");
      return;
    }

    setUploading(true);
    setMsg("");

    try {
      // 1) رفع الملف إلى GCS عبر API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const uploadRes = await fetch("/api/upload-to-gcs", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.url) throw new Error("Upload failed");

      // 2) حفظ بيانات الملف في Firestore
      const docRef = await addDoc(collection(firestore, "archiveFiles"), {
        nameAr,
        nameEn,
        descAr,
        descEn,
        category,
        link: uploadJson.url,
        createdAt: Timestamp.now(),
      });

      // 3) (اختياري) إنشاء صفحة VIP وتوليد QR للرابط الثابت
      if (createVipPage) {
        // slug تلقائي لو المستخدم ما كتبش
        let finalSlug = vipSlug || slugify(clientName) || slugify(nameEn) || `vip-${docRef.id}`;

        // حفظ تعريف الصفحة في client_pages/<slug>
        const pageRef = doc(collection(firestore, "client_pages"), finalSlug);
        await setDoc(pageRef, {
          slug: finalSlug,
          clientName: clientName,
          clientNumber: clientNumber,
          // بيانات أولية — تعدلها لاحقًا في الكود الخاص بكل صفحة
          title: clientName,
          bio: descAr || descEn || "",
          imageUrl: vipImageUrl || "",
          links: [
            { label: lang === "ar" ? "الملف" : "File", url: uploadJson.url },
          ],
          template: "custom", // مجرد مؤشر — التصميم الحقيقي هيكون في ملف منفصل حسب slug
          enabled: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // اعرض QR الخاص بالصفحة
        setQrFor(`PAGE::${finalSlug}`);
        setMsg(
          lang === "ar"
            ? "تم رفع الملف وإنشاء صفحة VIP ✅"
            : "File uploaded & VIP page created ✅"
        );
      } else {
        // افتراضي: اعرض QR التحقق للملف
        setQrFor(docRef.id);
        setMsg(lang === "ar" ? "تم رفع الملف بنجاح ✅" : "File uploaded successfully ✅");
      }

      // reset
      setFile(null);
      setNameAr("");
      setNameEn("");
      setDescAr("");
      setDescEn("");
      setVipImageUrl("");
      // متعمّد ما نمسحش clientName/Number/Slug عشان لو عايز تكرر بسرعة

    } catch (err) {
      setMsg(lang === "ar" ? "خطأ أثناء الرفع!" : "Upload error!");
    } finally {
      setUploading(false);
    }
  };

  /* =========================
     تحميل QR كصورة PNG
  ========================== */
  const qrRef = useRef(null);
  const handleDownloadQR = (qrKey) => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const niceName = qrKey?.startsWith("PAGE::")
      ? qrKey.replace("PAGE::", "")
      : qrKey;
    link.href = url;
    link.download = `taheel-qr-${niceName}.png`;
    link.click();
  };

  /* =========================
     تحميل QR يدوي لأي slug (اختياري)
  ========================== */
  const quickQrRef = useRef(null);
  const handleDownloadQuickQR = () => {
    const canvas = quickQrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `taheel-qr-${quickSlug || "page"}.png`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 font-cairo">
      {/* نموذج رفع ملف جديد + خيار صفحة VIP */}
      <div className="bg-[#171f26] rounded-xl shadow-lg p-5 mb-8 border border-emerald-800">
        <h2 className="font-extrabold text-2xl mb-6 text-emerald-400 text-center drop-shadow">
          {lang === "ar" ? "إضافة ملف جديد للأرشيف" : "Add New Archive File"}
        </h2>

        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <select
            className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-emerald-200 font-bold focus:outline-emerald-500 cursor-pointer col-span-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
              <option key={key} value={key}>
                {lang === "ar" ? val.ar : val.en}
              </option>
            ))}
          </select>

          <input
            type="text"
            className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
            placeholder={lang === "ar" ? "اسم الملف بالعربية" : "Arabic name"}
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
          />
          <input
            type="text"
            className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
            placeholder={lang === "ar" ? "اسم الملف بالإنجليزية" : "English name"}
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            required
          />
          <input
            type="text"
            className="p-3 rounded-lg border-2 border-gray-300 bg-[#26343d] text-gray-200 font-bold placeholder:text-gray-400"
            placeholder={lang === "ar" ? "وصف بالعربية (اختياري)" : "Arabic desc (opt)"}
            value={descAr}
            onChange={(e) => setDescAr(e.target.value)}
          />
          <input
            type="text"
            className="p-3 rounded-lg border-2 border-gray-300 bg-[#26343d] text-gray-200 font-bold placeholder:text-gray-400"
            placeholder={lang === "ar" ? "وصف بالإنجليزية (اختياري)" : "English desc (opt)"}
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
          />

          <input
            type="file"
            className="file:rounded-lg file:bg-emerald-600 file:text-white file:font-bold file:px-3 file:py-2 file:border-0 file:cursor-pointer col-span-2"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />

          {/* ===== خيار إنشاء صفحة VIP ===== */}
          <div className="col-span-2 mt-2 p-3 rounded-xl border border-emerald-700 bg-[#122019]">
            <label className="flex items-center gap-2 font-extrabold text-emerald-300">
              <input
                type="checkbox"
                checked={createVipPage}
                onChange={(e) => setCreateVipPage(e.target.checked)}
              />
              {lang === "ar"
                ? "إنشاء صفحة عميل مميز (VIP) + توليد رابط وQR"
                : "Create VIP client page + URL & QR"}
            </label>

            {createVipPage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <input
                  type="text"
                  className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
                  placeholder={lang === "ar" ? "اسم العميل" : "Client name"}
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    // لو مفيش slug، خليه يتولّد تلقائي من الاسم
                    if (!vipSlug) setVipSlug(slugify(e.target.value));
                  }}
                  required
                />
                <input
                  type="text"
                  className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
                  placeholder={lang === "ar" ? "رقم العميل" : "Client number"}
                  value={clientNumber}
                  onChange={(e) => setClientNumber(e.target.value)}
                  required
                />
                <input
                  type="text"
                  className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300 md:col-span-2"
                  placeholder={lang === "ar" ? "Slug الرابط (مثال: mohamed-kestiro)" : "URL slug (e.g., mohamed-kestiro)"}
                  value={vipSlug}
                  onChange={(e) => setVipSlug(slugify(e.target.value))}
                />
                <input
                  type="url"
                  className="p-3 rounded-lg border-2 border-gray-300 bg-[#26343d] text-gray-200 font-bold placeholder:text-gray-400 md:col-span-2"
                  placeholder={lang === "ar" ? "رابط صورة (اختياري)" : "Profile image URL (optional)"}
                  value={vipImageUrl}
                  onChange={(e) => setVipImageUrl(e.target.value)}
                />

                {vipSlug && (
                  <div className="md:col-span-2 text-emerald-300 font-bold">
                    {lang === "ar" ? "رابط الصفحة:" : "Page URL:"}{" "}
                    <a
                      className="underline text-emerald-400"
                      href={getPageUrl(vipSlug)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {getPageUrl(vipSlug)}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-3 rounded-lg font-extrabold shadow-lg transition col-span-2"
          >
            {uploading ? (lang === "ar" ? "جاري الرفع..." : "Uploading...") : (lang === "ar" ? "رفع الملف" : "Upload")}
          </button>
        </form>

        {msg && <div className="text-center text-emerald-300 mt-3 font-bold">{msg}</div>}

        {/* عرض QR (للتحقق أو للصفحة) بعد الرفع */}
        {qrFor && (
          <div ref={qrRef} className="mt-5 flex flex-col items-center justify-center gap-2 bg-[#101b15] border border-emerald-400 rounded-xl p-5">
            <div className="font-bold mb-1 text-emerald-600">
              {lang === "ar" ? "الكود" : "QR Code"}
            </div>
            <StyledQRCode value={getSmartQrUrl(qrFor)} size={140} />
            <a
              href={getSmartQrUrl(qrFor)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline break-all font-bold mt-2"
            >
              {getSmartQrUrl(qrFor)}
            </a>
            <button
              onClick={() => handleDownloadQR(qrFor)}
              className="mt-2 bg-white text-emerald-700 border-2 border-emerald-700 font-bold rounded-lg px-5 py-2 hover:bg-emerald-50"
            >
              {lang === "ar" ? "تحميل الكود كصورة" : "Download QR as image"}
            </button>
          </div>
        )}
      </div>

      {/* (اختياري) توليد QR سريع لأي صفحة VIP بالـ slug */}
      <div className="bg-[#151c23] rounded-xl shadow-lg p-5 mb-8 border border-emerald-800">
        <h3 className="font-extrabold text-xl mb-4 text-emerald-400">
          {lang === "ar" ? "توليد QR سريع لصفحة VIP" : "Quick QR for VIP page"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <input
            type="text"
            className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300 md:col-span-2"
            placeholder={lang === "ar" ? "اكتب الـ slug (مثال: mohamed-kestiro)" : "Enter slug (e.g., mohamed-kestiro)"}
            value={quickSlug}
            onChange={(e) => setQuickSlug(slugify(e.target.value))}
          />
          <a
            className={`text-center px-5 py-3 rounded-lg font-extrabold border-2 transition ${quickSlug ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700" : "bg-gray-600/40 text-gray-300 border-gray-600 pointer-events-none"}`}
            href={quickSlug ? getPageUrl(quickSlug) : "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {lang === "ar" ? "فتح الرابط" : "Open URL"}
          </a>
        </div>

        {quickSlug && (
          <div ref={quickQrRef} className="mt-5 flex flex-col items-center gap-2 bg-[#101b15] border border-emerald-400 rounded-xl p-5">
            <div className="font-bold mb-1 text-emerald-600">{lang === "ar" ? "كود الصفحة" : "Page QR"}</div>
            <StyledQRCode value={getPageUrl(quickSlug)} size={140} />
            <a href={getPageUrl(quickSlug)} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline break-all font-bold mt-2">
              {getPageUrl(quickSlug)}
            </a>
            <button onClick={handleDownloadQuickQR} className="mt-2 bg-white text-emerald-700 border-2 border-emerald-700 font-bold rounded-lg px-5 py-2 hover:bg-emerald-50">
              {lang === "ar" ? "تحميل الكود كصورة" : "Download QR as image"}
            </button>
          </div>
        )}
      </div>

      {/* فلاتر التصنيفات */}
      <div className="flex flex-wrap gap-3 justify-center mb-6">
        {Object.keys(CATEGORY_LABELS).map((cat) => (
          <button
            key={cat}
            className={`px-6 py-3 rounded-full font-extrabold border-2 text-lg shadow-lg transition ${
              category === cat
                ? "bg-emerald-500 text-white border-emerald-700"
                : "bg-[#1a272f] text-emerald-300 border-emerald-700 hover:bg-emerald-600 hover:text-white"
            }`}
            onClick={() => setCategory(cat)}
          >
            {lang === "ar" ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en}
          </button>
        ))}
      </div>

      {/* جدول الأرشيف */}
      <div className="bg-[#1a272f] rounded-xl shadow-lg p-5 border border-emerald-900">
        <div className="text-xl font-extrabold mb-4 text-emerald-400 text-center">
          {lang === "ar"
            ? `ملفات قسم "${CATEGORY_LABELS[category].ar}"`
            : `Files in "${CATEGORY_LABELS[category].en}"`}
        </div>

        {loading ? (
          <div className="text-center py-6 font-bold text-emerald-200">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
        ) : files.length === 0 ? (
          <div className="text-center py-6 text-gray-400 font-bold">
            {lang === "ar" ? "لا يوجد ملفات في هذا القسم." : "No files in this category."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-emerald-900 text-emerald-200 font-bold text-lg">
                  <th className="p-3">{lang === "ar" ? "الاسم" : "Name"}</th>
                  <th className="p-3">{lang === "ar" ? "الوصف" : "Description"}</th>
                  <th className="p-3">{lang === "ar" ? "الرابط" : "Link"}</th>
                  <th className="p-3">{lang === "ar" ? "QR التحقق" : "Verify QR"}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-emerald-800 hover:bg-emerald-950 transition">
                    <td className="p-3 font-extrabold text-white">{lang === "ar" ? f.nameAr : f.nameEn}</td>
                    <td className="p-3 text-emerald-200">{lang === "ar" ? f.descAr : f.descEn}</td>
                    <td className="p-3">
                      <a
                        href={f.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline break-all font-bold hover:text-emerald-200 transition"
                      >
                        {lang === "ar" ? "تحميل" : "Download"}
                      </a>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-800 focus:outline-none shadow"
                        onClick={() => setQrFor(f.id === qrFor ? null : f.id)}
                      >
                        {qrFor === f.id ? (lang === "ar" ? "إخفاء" : "Hide") : (lang === "ar" ? "عرض" : "Show")}
                      </button>
                      {/* عرض الكيو آر في مكان منفصل أسفل الجدول */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* مكان عرض كود تحقق الملف المختار من الجدول */}
        {qrFor && files.find((f) => f.id === qrFor) && (
          <div
            ref={qrRef}
            className="mt-7 flex flex-col items-center justify-center gap-2 bg-[#101b15] border border-emerald-400 rounded-xl p-5 w-fit mx-auto"
          >
            <div className="font-bold mb-1 text-emerald-600">{lang === "ar" ? "كود التحقق" : "Verification QR"}</div>
            <StyledQRCode value={getSmartQrUrl(qrFor)} size={140} />
            <a
              href={getSmartQrUrl(qrFor)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline break-all font-bold mt-2"
            >
              {getSmartQrUrl(qrFor)}
            </a>
            <button
              onClick={() => handleDownloadQR(qrFor)}
              className="mt-2 bg-white text-emerald-700 border-2 border-emerald-700 font-bold rounded-lg px-5 py-2 hover:bg-emerald-50"
            >
              {lang === "ar" ? "تحميل الكود كصورة" : "Download QR as image"}
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        body, .font-cairo { font-family: 'Cairo', 'Tajawal', Arial, sans-serif !important; }
        button, select, input[type="file"], a { cursor:pointer !important; }
      `}</style>
    </div>
  );
}
