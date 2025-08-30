import { useRef, useState, useEffect, useMemo } from "react";
import { FaFilePdf, FaUpload, FaCheckCircle, FaExclamationCircle, FaTimes, FaSpinner } from "react-icons/fa";

export default function ServiceUploadModal({
  open,
  onClose,
  service,
  userId,
  lang = "ar",
  setUploadedDocs,
  uploadedDocs = {},
  // requiredDocs: مصفوفة مفاتيح منطقية ثابتة (strings)
  requiredDocs = [],
  // displayDocs: نصوص العرض المقابلة لكل مفتاح (اختياري)
  displayDocs = [],
  onAllDocsUploaded,
}) {
  const fileRefs = useRef({});
  const modalRef = useRef(null);
  const [uploading, setUploading] = useState({});
  const [msg, setMsg] = useState({});
  const [error, setError] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});

  // دمج المفاتيح مع عناوين العرض
  const docItems = useMemo(() => {
    const list = Array.isArray(requiredDocs) ? requiredDocs : [];
    return list.map((key, i) => {
      const rawLabel = Array.isArray(displayDocs) && typeof displayDocs[i] !== "undefined" ? displayDocs[i] : key;
      const label = typeof rawLabel === "string" ? rawLabel : JSON.stringify(rawLabel ?? "");
      return { key: String(key), label: String(label || key) };
    });
  }, [requiredDocs, displayDocs]);

  // عند اكتمال رفع كل المطلوب
  useEffect(() => {
    if (!open) return;
    const allUploaded = docItems.length > 0 && docItems.every((d) => !!uploadedDocs[d.key]);
    if (allUploaded && typeof onAllDocsUploaded === "function") {
      onAllDocsUploaded();
    }
  }, [uploadedDocs, docItems, open, onAllDocsUploaded]);

  // إغلاق المودال عند الضغط خارج
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose && onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  function handleFileChange(e, docKey) {
    setError((prev) => ({ ...prev, [docKey]: "" }));
    setMsg((prev) => ({ ...prev, [docKey]: "" }));
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [docKey]: null }));
      return;
    }
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError((prev) => ({
        ...prev,
        [docKey]: lang === "ar" ? "يرجى رفع ملف PDF فقط" : "Please upload a PDF file only.",
      }));
      if (fileRefs.current[docKey]) fileRefs.current[docKey].value = null;
      setSelectedFiles((prev) => ({ ...prev, [docKey]: null }));
      return;
    }
    setSelectedFiles((prev) => ({ ...prev, [docKey]: file }));
  }

  async function handleUpload(e, docKey) {
    e.preventDefault();
    setError((prev) => ({ ...prev, [docKey]: "" }));
    setMsg((prev) => ({ ...prev, [docKey]: "" }));

    const file = selectedFiles[docKey];
    if (!file) {
      setError((prev) => ({
        ...prev,
        [docKey]: lang === "ar" ? "يجب اختيار ملف PDF" : "Please select a PDF file.",
      }));
      return;
    }

    setUploading((prev) => ({ ...prev, [docKey]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId || "");
      formData.append("serviceId", service?.serviceId || "");
      formData.append("serviceName", service?.name || "");
      formData.append("docName", docKey); // استخدم المفتاح المنطقي فقط

      const res = await fetch("/api/upload-to-gcs", {
        method: "POST",
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch {
        setError((prev) => ({
          ...prev,
          [docKey]: lang === "ar" ? "استجابة غير صحيحة من السيرفر." : "Invalid server response.",
        }));
        setUploading((prev) => ({ ...prev, [docKey]: false }));
        return;
      }

      if (res.ok && data?.url) {
        const fileObj = {
          name: file.name,
          url: data.url,
          type: "application/pdf",
          uploadedAt: new Date().toISOString(),
          userId: userId || "",
          serviceId: service?.serviceId || "",
          serviceName: service?.name || "",
        };

        setMsg((prev) => ({
          ...prev,
          [docKey]: lang === "ar" ? "تم رفع الملف بنجاح!" : "File uploaded successfully!",
        }));

        setSelectedFiles((prev) => ({ ...prev, [docKey]: null }));
        if (fileRefs.current[docKey]) fileRefs.current[docKey].value = null;

        if (setUploadedDocs) {
          setUploadedDocs((prev) => ({
            ...(prev || uploadedDocs || {}),
            [docKey]: fileObj, // نخزن على المفتاح المنطقي
          }));
        }
      } else {
        setError((prev) => ({
          ...prev,
          [docKey]: data?.error || (lang === "ar" ? "حدث خطأ أثناء رفع الملف." : "An error occurred during upload."),
        }));
      }
    } catch {
      setError((prev) => ({
        ...prev,
        [docKey]: lang === "ar" ? "حدث خطأ أثناء رفع الملف." : "An error occurred during upload.",
      }));
    }

    setUploading((prev) => ({ ...prev, [docKey]: false }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="relative bg-gradient-to-br from-cyan-50 via-white to-cyan-100 rounded-3xl shadow-2xl px-6 py-8 w-full max-w-md border border-cyan-200 flex flex-col items-center"
        style={{ maxHeight: "calc(100vh - 60px)", minHeight: "340px", overflowY: "auto" }}
      >
        {/* Close */}
        <button
          className="absolute top-3 right-3 bg-gray-100 hover:bg-red-500 text-gray-400 hover:text-white rounded-full w-8 h-8 flex items-center justify-center text-xl shadow transition duration-200"
          onClick={onClose}
          title={lang === "ar" ? "إغلاق" : "Close"}
        >
          <FaTimes />
        </button>

        <img src="/logo3.png" alt="Logo" className="w-20 h-20 mb-2 mx-auto drop-shadow-lg" style={{ objectFit: "contain" }} />

        <div className="font-extrabold text-cyan-900 text-lg text-center mb-2">
          {lang === "ar" ? "رفع المستندات المطلوبة" : "Upload Required Documents"}
        </div>
        <div className="text-sm text-gray-500 text-center mb-4 px-2 max-w-[90%]">
          {lang === "ar" ? "يرجى رفع ملف PDF فقط لكل مستند مطلوب." : "Please upload only a PDF file for each required document."}
        </div>

        <form className="flex flex-col items-center w-full gap-3 mt-1">
          {docItems.map(({ key: docKey, label }, idx) => {
            const isUploading = !!uploading[docKey];
            const selected = selectedFiles[docKey];
            const hasUploaded = !!uploadedDocs[docKey];

            return (
              <div key={docKey} className="w-full flex flex-col items-center p-3 rounded-xl border border-cyan-100 bg-cyan-50 shadow mb-2 transition-all duration-200 hover:shadow-lg">
                <div className="font-bold text-cyan-700 mb-1 w-full text-center">
                  {/* أظهر العنوان للعرض فقط */}
                  {label || docKey}
                </div>

                <label
                  htmlFor={`pdf-upload-${idx}`}
                  className={`flex flex-col items-center justify-center w-full py-2 rounded-2xl border-2 border-dashed
                    ${selected ? "border-emerald-400 bg-emerald-50" : "border-cyan-300 bg-cyan-50 hover:bg-cyan-100"} cursor-pointer transition`}
                  tabIndex={0}
                  style={{ minHeight: 60 }}
                >
                  <FaUpload className={`text-2xl mb-1 ${selected ? "text-emerald-700" : "text-cyan-400"}`} />
                  <span className={`font-bold text-sm ${selected ? "text-emerald-800" : "text-cyan-700"}`}>
                    {lang === "ar" ? "اختر ملف PDF" : "Choose PDF File"}
                  </span>
                  <input
                    id={`pdf-upload-${idx}`}
                    type="file"
                    ref={(el) => (fileRefs.current[docKey] = el)}
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, docKey)}
                    disabled={isUploading}
                  />
                  {selected && (
                    <div className="mt-1 text-xs text-emerald-700 font-bold truncate max-w-[90%] flex flex-col gap-1">
                      <span>{selected.name}</span>
                    </div>
                  )}
                </label>

                <button
                  type="button"
                  disabled={isUploading || !selected}
                  className={`w-full py-2 rounded-full font-black shadow transition text-base mt-2 duration-200
                    ${isUploading || !selected
                      ? "bg-cyan-200 text-white cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-600 hover:to-cyan-500 text-white cursor-pointer"}`}
                  style={{ fontSize: "1.05rem", letterSpacing: "1px" }}
                  onClick={(e) => handleUpload(e, docKey)}
                >
                  {isUploading ? (
                    <span className="inline-flex items-center gap-2">
                      <FaSpinner className="animate-spin" />
                      {lang === "ar" ? "جاري الرفع..." : "Uploading..."}
                    </span>
                  ) : (
                    <span>{lang === "ar" ? "رفع الملف" : "Upload File"}</span>
                  )}
                </button>

                {error[docKey] && (
                  <div className="text-center text-red-600 font-bold flex items-center gap-1 mt-1 text-xs">
                    <FaExclamationCircle /> {error[docKey]}
                  </div>
                )}
                {msg[docKey] && (
                  <div className="text-center text-green-700 font-bold flex items-center gap-1 mt-1 text-xs">
                    <FaCheckCircle /> {msg[docKey]}
                  </div>
                )}

                {hasUploaded && uploadedDocs[docKey]?.url && (
                  <div className="text-xs text-emerald-700 font-bold mt-1 text-center">
                    {lang === "ar" ? "تم رفع المستند: " : "Uploaded: "}
                    <a
                      href={uploadedDocs[docKey].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-emerald-800 font-bold"
                    >
                      {uploadedDocs[docKey].name}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </form>

        <button
          className="mt-4 px-7 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white rounded-xl font-bold shadow transition duration-200"
          onClick={onClose}
        >
          {lang === "ar" ? "إغلاق" : "Close"}
        </button>

        <div className="mt-4 text-xs text-center text-gray-500 font-bold">
          {lang === "ar"
            ? "جميع البيانات والمستندات مشفرة وآمنة ويتم حفظها بشكل سري."
            : "All data and documents are encrypted and securely stored."}
        </div>
        <style jsx>{`
          .animate-fadeIn {
            animation: fadeIn 0.7s cubic-bezier(.37,.75,.46,1) both;
          }
          .animate-fadeInUp {
            animation: fadeInUp 0.7s cubic-bezier(.37,.75,.46,1) both;
          }
          .animate-zoomIn {
            animation: zoomIn 0.6s cubic-bezier(.4,.8,.24,1) both;
          }
          @keyframes fadeIn {
            from { opacity: 0 }
            to   { opacity: 1 }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px);}
            to   { opacity: 1; transform: translateY(0);}
          }
          @keyframes zoomIn {
            from { opacity: 0; transform: scale(0.86);}
            to   { opacity: 1; transform: scale(1);}
          }
        `}</style>
      </div>
    </div>
  );
}