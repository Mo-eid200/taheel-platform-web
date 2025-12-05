"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  setDoc,
  doc,
  Timestamp,
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
  vip_page: { ar: "صفحات VIP", en: "VIP Pages" },
};

/* =========================
   Helpers: slug + URLs
========================= */
const slugify = (s) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);

const getVerifyUrl = (id) => `https://www.taheel.ae/verify/${id}`;
const getPageUrl = (slug) => `https://www.taheel.ae/p/u/${slug}`;
const getSmartQrUrl = (qrKey) => {
  if (qrKey?.startsWith("PAGE::")) {
    return getPageUrl(qrKey.replace("PAGE::", ""));
  }
  return getVerifyUrl(qrKey);
};

/* ========================================================= */

export default function ArchiveSection({ lang = "ar" }) {
  const [category, setCategory] = useState("translation");
  const isVip = category === "vip_page";

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // رفع ملف (أرشيف)
  const [file, setFile] = useState(null);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [uploading, setUploading] = useState(false);

  // QR حالى (id للملف أو PAGE::<slug>)
  const [qrFor, setQrFor] = useState(null);

  // بيانات صفحة VIP
  const [clientName, setClientName] = useState("");
  const [clientNumber, setClientNumber] = useState("");
  const [vipSlug, setVipSlug] = useState("");
  const [vipImageUrl, setVipImageUrl] = useState("");

  // QR سريع لأى slug
  const [quickSlug, setQuickSlug] = useState("");

  // لإعادة التحميل بعد إضافة عنصر
  const [reloadKey, setReloadKey] = useState(0);

  /* =========================
     جلب البيانات حسب التصنيف
  ========================== */
  useEffect(() => {
    async function fetchList() {
      setLoading(true);

      try {
        if (isVip) {
          const qy = query(
            collection(firestore, "client_pages"),
            orderBy("createdAt", "desc")
          );
          const snap = await getDocs(qy);
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setFiles(docs);
        } else {
          const qy = query(
            collection(firestore, "archiveFiles"),
            where("category", "==", category),
            orderBy("createdAt", "desc")
          );
          const snap = await getDocs(qy);
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setFiles(docs);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchList();
  }, [category, isVip, reloadKey]);

  /* =========================
     Submit: VIP أو ملف
  ========================== */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (isVip) {
      // إنشاء صفحة VIP
      if (!clientName || !clientNumber) {
        setMsg(
          lang === "ar"
            ? "اسم ورقم العميل مطلوبان."
            : "Client name & number are required."
        );
        return;
      }

      setUploading(true);
      try {
        const finalSlug =
          vipSlug || slugify(clientName) || `vip-${Date.now().toString(36)}`;

        const pageRef = doc(collection(firestore, "client_pages"), finalSlug);
        await setDoc(pageRef, {
          slug: finalSlug,
          clientName,
          clientNumber,
          title: clientName,
          bio: descAr || descEn || "",
          imageUrl: vipImageUrl || "",
          links: [],
          template: "custom",
          enabled: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        setQrFor(`PAGE::${finalSlug}`);
        setMsg(
          lang === "ar" ? "تم إنشاء صفحة VIP ✅" : "VIP page created ✅"
        );
        setReloadKey((k) => k + 1);
      } catch (err) {
        console.error(err);
        setMsg(
          lang === "ar"
            ? "خطأ أثناء إنشاء الصفحة!"
            : "Error creating VIP page!"
        );
      } finally {
        setUploading(false);
      }

      return;
    }

    // رفع ملف للأرشيف
    if (!file || !nameAr || !nameEn) {
      setMsg(
        lang === "ar" ? "كل الحقول مطلوبة!" : "All fields are required!"
      );
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const uploadRes = await fetch("/api/upload-to-gcs", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.url) throw new Error("Upload failed");

      const docRef = await addDoc(collection(firestore, "archiveFiles"), {
        nameAr,
        nameEn,
        descAr,
        descEn,
        category,
        link: uploadJson.url,
        createdAt: Timestamp.now(),
      });

      setQrFor(docRef.id);
      setMsg(
        lang === "ar"
          ? "تم رفع الملف بنجاح ✅"
          : "File uploaded successfully ✅"
      );

      // reset
      setFile(null);
      setNameAr("");
      setNameEn("");
      setDescAr("");
      setDescEn("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setMsg(lang === "ar" ? "خطأ أثناء الرفع!" : "Upload error!");
    } finally {
      setUploading(false);
    }
  };

  /* =========================
     تنزيل QR كصورة (Canvas/SVG)
  ========================== */
  const qrRef = useRef(null);

  const downloadFromRef = (ref, filename) => {
    const root = ref.current;
    if (!root) return;

    // 1) Canvas → PNG
    const canvas = root.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      return;
    }

    // 2) SVG → SVG file (fallback)
    const svg = root.querySelector("svg");
    if (svg) {
      const data = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([data], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(".png", ".svg");
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadQR = (qrKey) => {
    if (!qrKey) return;
    const name = qrKey.startsWith("PAGE::")
      ? qrKey.replace("PAGE::", "")
      : qrKey;
    downloadFromRef(qrRef, `taheel-qr-${name}.png`);
  };

  /* =========================
     QR سريع لأي slug
  ========================== */
  const quickQrRef = useRef(null);

  const handleDownloadQuickQR = () => {
    if (!quickSlug) return;
    downloadFromRef(quickQrRef, `taheel-qr-${quickSlug}.png`);
  };

  /* =========================
     UI
  ========================== */

  return (
    <div className="max-w-4xl mx-auto p-4 font-cairo">
      {/* ===== نموذج الإضافة (VIP أو أرشيف) ===== */}
      <div className="bg-[#171f26] rounded-xl shadow-lg p-5 mb-8 border border-emerald-800">
        <h2 className="font-extrabold text-2xl mb-6 text-emerald-400 text-center drop-shadow">
          {isVip
            ? lang === "ar"
              ? "إنشاء صفحة عميل VIP"
              : "Create VIP Client Page"
            : lang === "ar"
            ? "إضافة ملف جديد للأرشيف"
            : "Add New Archive File"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end"
        >
          {/* اختيار التصنيف */}
          <select
            className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-emerald-200 font-bold focus:outline-emerald-500 cursor-pointer col-span-2"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setQrFor(null);
            }}
          >
            {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
              <option key={key} value={key}>
                {lang === "ar" ? val.ar : val.en}
              </option>
            ))}
          </select>

          {/* لو VIP */}
          {isVip ? (
            <>
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
                placeholder={
                  lang === "ar" ? "اسم العميل" : "Client name"
                }
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  if (!vipSlug) setVipSlug(slugify(e.target.value));
                }}
                required
              />
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
                placeholder={
                  lang === "ar" ? "رقم العميل" : "Client number"
                }
                value={clientNumber}
                onChange={(e) => setClientNumber(e.target.value)}
                required
              />
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300 md:col-span-2"
                placeholder={
                  lang === "ar"
                    ? "Slug الرابط (مثال: mohamed-kestiro)"
                    : "URL slug (e.g., mohamed-kestiro)"
                }
                value={vipSlug}
                onChange={(e) => setVipSlug(slugify(e.target.value))}
              />
              <input
                type="url"
                className="p-3 rounded-lg border-2 border-gray-300 bg-[#26343d] text-gray-200 font-bold placeholder:text-gray-400 md:col-span-2"
                placeholder={
                  lang === "ar"
                    ? "رابط صورة (اختياري)"
                    : "Profile image URL (optional)"
                }
                value={vipImageUrl}
                onChange={(e) => setVipImageUrl(e.target.value)}
              />
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-gray-300 bg-[#26343d] text-gray-200 font-bold placeholder:text-gray-400 md:col-span-2"
                placeholder={lang === "ar" ? "نبذة (اختياري)" : "Bio (optional)"}
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
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
            </>
          ) : (
            // حقول رفع ملف
            <>
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
                placeholder={
                  lang === "ar"
                    ? "اسم الملف بالعربية"
                    : "Arabic name"
                }
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                required
              />
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300"
                placeholder={
                  lang === "ar"
                    ? "اسم الملف بالإنجليزية"
                    : "English name"
                }
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
              />
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-gray-300 bg-[#26343d] text-gray-200 font-bold placeholder:text-gray-400"
                placeholder={
                  lang === "ar"
                    ? "وصف بالعربية (اختياري)"
                    : "Arabic desc (opt)"
                }
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
              />
              <input
                type="text"
                className="p-3 rounded-lg border-2 border-gray-300 bg-[#26343d] text-gray-200 font-bold placeholder:text-gray-400"
                placeholder={
                  lang === "ar"
                    ? "وصف بالإنجليزية (اختياري)"
                    : "English desc (opt)"
                }
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
            </>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-3 rounded-lg font-extrabold shadow-lg transition col-span-2"
          >
            {uploading
              ? lang === "ar"
                ? "جارٍ التنفيذ..."
                : "Working..."
              : isVip
              ? lang === "ar"
                ? "إنشاء الصفحة"
                : "Create Page"
              : lang === "ar"
              ? "رفع الملف"
              : "Upload"}
          </button>
        </form>

        {msg && (
          <div className="text-center text-emerald-300 mt-3 font-bold">
            {msg}
          </div>
        )}

        {/* عرض QR الناتج من الإضافة أو من الجدول */}
        {qrFor && (
          <div
            ref={qrRef}
            className="mt-5 flex flex-col items-center justify-center gap-2 bg-[#101b15] border border-emerald-400 rounded-xl p-5 w-fit mx-auto"
          >
            <div className="font-bold mb-1 text-emerald-600">
              {lang === "ar" ? "الكود" : "QR Code"}
            </div>
            <StyledQRCode value={getSmartQrUrl(qrFor)} size={260} />
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
              {lang === "ar"
                ? "تحميل الكود كصورة"
                : "Download QR as image"}
            </button>
          </div>
        )}
      </div>

      {/* ===== توليد QR سريع لأي صفحة VIP ===== */}
      <div className="bg-[#151c23] rounded-xl shadow-lg p-5 mb-8 border border-emerald-800">
        <h3 className="font-extrabold text-xl mb-4 text-emerald-400">
          {lang === "ar"
            ? "توليد QR سريع لصفحة VIP"
            : "Quick QR for VIP page"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <input
            type="text"
            className="p-3 rounded-lg border-2 border-emerald-400 bg-[#1a272f] text-white font-bold placeholder:text-emerald-300 md:col-span-2"
            placeholder={
              lang === "ar"
                ? "اكتب الـ slug (مثال: mohamed-kestiro)"
                : "Enter slug (e.g., mohamed-kestiro)"
            }
            value={quickSlug}
            onChange={(e) => setQuickSlug(slugify(e.target.value))}
          />
          <a
            className={`text-center px-5 py-3 rounded-lg font-extrabold border-2 transition ${
              quickSlug
                ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
                : "bg-gray-600/40 text-gray-300 border-gray-600 pointer-events-none"
            }`}
            href={quickSlug ? getPageUrl(quickSlug) : "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {lang === "ar" ? "فتح الرابط" : "Open URL"}
          </a>
        </div>

        {quickSlug && (
          <div
            ref={quickQrRef}
            className="mt-5 flex flex-col items-center gap-2 bg-[#101b15] border border-emerald-400 rounded-xl p-5 w-fit mx-auto"
          >
            <div className="font-bold mb-1 text-emerald-600">
              {lang === "ar" ? "كود الصفحة" : "Page QR"}
            </div>
            <StyledQRCode value={getPageUrl(quickSlug)} size={260} />
            <a
              href={getPageUrl(quickSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline break-all font-bold mt-2"
            >
              {getPageUrl(quickSlug)}
            </a>
            <button
              onClick={handleDownloadQuickQR}
              className="mt-2 bg-white text-emerald-700 border-2 border-emerald-700 font-bold rounded-lg px-5 py-2 hover:bg-emerald-50"
            >
              {lang === "ar"
                ? "تحميل الكود كصورة"
                : "Download QR as image"}
            </button>
          </div>
        )}
      </div>

      {/* ===== فلاتر التصنيفات ===== */}
      <div className="flex flex-wrap gap-3 justify-center mb-6">
        {Object.keys(CATEGORY_LABELS).map((cat) => (
          <button
            key={cat}
            className={`px-6 py-3 rounded-full font-extrabold border-2 text-lg shadow-lg transition ${
              category === cat
                ? "bg-emerald-500 text-white border-emerald-700"
                : "bg-[#1a272f] text-emerald-300 border-emerald-700 hover:bg-emerald-600 hover:text-white"
            }`}
            onClick={() => {
              setCategory(cat);
              setQrFor(null);
            }}
          >
            {lang === "ar"
              ? CATEGORY_LABELS[cat].ar
              : CATEGORY_LABELS[cat].en}
          </button>
        ))}
      </div>

      {/* ===== جدول العناصر ===== */}
      <div className="bg-[#1a272f] rounded-xl shadow-lg p-5 border border-emerald-900">
        <div className="text-xl font-extrabold mb-4 text-emerald-400 text-center">
          {lang === "ar"
            ? `قائمة: "${CATEGORY_LABELS[category].ar}"`
            : `Listing: "${CATEGORY_LABELS[category].en}"`}
        </div>

        {loading ? (
          <div className="text-center py-6 font-bold text-emerald-200">
            {lang === "ar" ? "جارٍ التحميل..." : "Loading..."}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-6 text-gray-400 font-bold">
            {lang === "ar" ? "لا يوجد عناصر." : "No items here."}
          </div>
        ) : isVip ? (
          // جدول صفحات VIP
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-emerald-900 text-emerald-200 font-bold text-lg">
                  <th className="p-3">
                    {lang === "ar" ? "الاسم" : "Client"}
                  </th>
                  <th className="p-3">
                    {lang === "ar" ? "رقم العميل" : "Client No."}
                  </th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">
                    {lang === "ar" ? "الرابط" : "URL"}
                  </th>
                  <th className="p-3">QR</th>
                </tr>
              </thead>
              <tbody>
                {files.map((p) => (
                  <tr
                    key={p.slug || p.id}
                    className="border-b border-emerald-800 hover:bg-emerald-950 transition"
                  >
                    <td className="p-3 font-extrabold text-white">
                      {p.clientName || "-"}
                    </td>
                    <td className="p-3 text-emerald-200">
                      {p.clientNumber || "-"}
                    </td>
                    <td className="p-3 text-emerald-300">
                      {p.slug || p.id}
                    </td>
                    <td className="p-3">
                      <a
                        href={getPageUrl(p.slug || p.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline break-all font-bold hover:text-emerald-200 transition"
                      >
                        {lang === "ar" ? "فتح" : "Open"}
                      </a>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-800 focus:outline-none shadow"
                        onClick={() => setQrFor(`PAGE::${p.slug || p.id}`)}
                      >
                        {lang === "ar" ? "عرض" : "Show"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // جدول ملفات الأرشيف
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-emerald-900 text-emerald-200 font-bold text-lg">
                  <th className="p-3">
                    {lang === "ar" ? "الاسم" : "Name"}
                  </th>
                  <th className="p-3">
                    {lang === "ar" ? "الوصف" : "Description"}
                  </th>
                  <th className="p-3">
                    {lang === "ar" ? "الرابط" : "Link"}
                  </th>
                  <th className="p-3">
                    {lang === "ar" ? "QR التحقق" : "Verify QR"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-emerald-800 hover:bg-emerald-950 transition"
                  >
                    <td className="p-3 font-extrabold text-white">
                      {lang === "ar" ? f.nameAr : f.nameEn}
                    </td>
                    <td className="p-3 text-emerald-200">
                      {lang === "ar" ? f.descAr : f.descEn}
                    </td>
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
                        onClick={() => setQrFor(f.id)}
                      >
                        {lang === "ar" ? "عرض" : "Show"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        body,
        .font-cairo {
          font-family: "Cairo", "Tajawal", Arial, sans-serif !important;
        }
        button,
        select,
        input[type="file"],
        a {
          cursor: pointer !important;
        }
      `}</style>
    </div>
  );
}
