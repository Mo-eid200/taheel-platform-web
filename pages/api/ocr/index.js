// pages/api/ocr.js
import { promises as fs } from "fs";
import formidable from "formidable";
import vision from "@google-cloud/vision";

export const config = {
  api: { bodyParser: false }, // ضروري لـ formidable / multipart
};

// ------- CORS -------
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ------- Google Credentials (env) -------
function getGoogleCredentials() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is undefined");
  }
  const raw = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  if (raw.private_key && raw.private_key.includes("\\n")) {
    raw.private_key = raw.private_key.replace(/\\n/g, "\n");
  }
  return raw;
}

let visionClient;
function getVisionClient() {
  if (!visionClient) {
    const credentials = getGoogleCredentials();
    visionClient = new vision.ImageAnnotatorClient({ credentials });
  }
  return visionClient;
}

// ------- Helpers -------
function normalizeDocType(dt) {
  const map = {
    ownerEidFront: "ownerIdFront",
    ownerEidBack: "ownerIdBack",
  };
  return map[dt] || dt;
}

function allowMimeFor(docType) {
  const imageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
    // أحيانًا أندرويد يرسل octet-stream مع HEIC
    "application/octet-stream",
  ];
  if (docType === "license") return [...imageTypes, "application/pdf"];
  return imageTypes;
}

function base64ToBuffer(b64) {
  // يدعم صيغ dataURL مثل: data:image/png;base64,xxxx
  const m = /^data:([\w/+.-]+);base64,(.*)$/i.exec(b64 || "");
  if (m) {
    return { buffer: Buffer.from(m[2], "base64"), mimetype: m[1] };
  }
  // لو جالك Base64 خام بدون dataURL:
  return { buffer: Buffer.from((b64 || "").trim(), "base64"), mimetype: "" };
}

// ------- Handler -------
export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  // محاولتين للقراءة:
  // 1) multipart عبر formidable
  // 2) fallback: JSON/fields فيها base64
  const form = formidable({
    keepExtensions: true,
    maxFileSize: 12 * 1024 * 1024, // 12MB
    multiples: false,
  });

  let fields = {};
  let files = {};

  // نحاول parse multipart، ولو فشل هنكمل على base64
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve([flds, fls])));
    });
  } catch {
    // تجاهل خطأ formidable — هنحاول قراءة body كـ JSON (base64)
  }

  try {
    const docTypeRaw =
      (Array.isArray(fields?.docType) ? fields.docType[0] : fields?.docType) || "";
    const docType = normalizeDocType(String(docTypeRaw).trim());

    let fileBuffer = null;
    let mimetype = "";
    let tempFilePath = "";

    // ---- (A) لو وصل ملف multipart ----
    const fileRaw = files?.file;
    const file = Array.isArray(fileRaw) ? fileRaw[0] : fileRaw;

    if (file?.filepath) {
      mimetype = typeof file?.mimetype === "string" ? file.mimetype : "";
      try {
        fileBuffer = await fs.readFile(file.filepath);
        tempFilePath = file.filepath;
      } catch {
        return res.status(400).json({ success: false, message: "تعذر قراءة الملف، أعد الرفع." });
      }
    }

    // ---- (B) لو ما فيش multipart، جرّب base64 من fields/body ----
    if (!fileBuffer) {
      // Next.js pages API مع bodyParser:false، ممكن body يكون ستريم؛ هنحاول نقرأه من fields لو الموبايل بعته كـ form fields
      const base64Raw =
        (Array.isArray(fields?.base64) ? fields.base64[0] : fields?.base64) ||
        (Array.isArray(fields?.fileBase64) ? fields.fileBase64[0] : fields?.fileBase64) ||
        null;

      if (base64Raw) {
        const { buffer, mimetype: mt } = base64ToBuffer(base64Raw);
        fileBuffer = buffer;
        mimetype = mt || "image/jpeg"; // تخمين افتراضي لو مش محدد
      } else {
        // آخر محاولة: لو البودي JSON (في حال تم إرساله application/json)
        // نجمع ستريم البودي:
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const rawBody = Buffer.concat(chunks).toString("utf8");
        if (rawBody) {
          try {
            const json = JSON.parse(rawBody);
            const base64 = json?.base64 || json?.fileBase64;
            const type = json?.mimetype || json?.type;
            if (base64) {
              const { buffer, mimetype: mt2 } = base64ToBuffer(base64);
              fileBuffer = buffer;
              mimetype = type || mt2 || "image/jpeg";
            }
          } catch {
            // مش JSON صالح — نكمل
          }
        }
      }
    }

    if (!docType) {
      return res.status(400).json({ success: false, message: "نوع المستند مفقود (docType)." });
    }

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      return res.status(400).json({ success: false, message: "الصورة/الملف غير صالحة أو فارغة." });
    }

    const allowed = allowMimeFor(docType);
    // لو الموبايل بعت octet-stream وفي الحقيقة صورة HEIC/PNG… هنسمح ونكمّل
    if (mimetype && !allowed.includes(mimetype)) {
      return res.status(400).json({
        success: false,
        message:
          docType === "license"
            ? "❌ نوع الملف غير مدعوم. مسموح PNG/JPG/HEIC/PDF."
            : "❌ نوع الملف غير مدعوم. مسموح PNG/JPG/HEIC.",
        receivedType: mimetype,
      });
    }

    // ------- OCR (Google Vision) -------
    const client = getVisionClient();
    let result;

    try {
      if (mimetype === "application/pdf") {
        // PDF: documentTextDetection أفضل
        [result] = await client.documentTextDetection({ image: { content: fileBuffer } });
      } else {
        [result] = await client.textDetection({ image: { content: fileBuffer } });
      }
    } catch (visionErr) {
      return res.status(500).json({
        success: false,
        message: "خطأ في خدمة OCR من Google Vision",
        error: visionErr?.message || "Unknown Vision API error",
      });
    } finally {
      // تنظيف الملف المؤقت لو موجود
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          /* ignore */
        }
      }
    }

    const detections = Array.isArray(result?.textAnnotations) ? result.textAnnotations : [];
    const text =
      detections[0]?.description && typeof detections[0].description === "string"
        ? detections[0].description
        : "";
    const cleanedText = (typeof text === "string" ? text : "").trim();
    const upperText = cleanedText ? cleanedText.toUpperCase() : "";

    if (cleanedText.length < 15) {
      return res.status(200).json({
        success: false,
        text: cleanedText,
        message: "فشل الفحص. المستند غير واضح أو لا يحتوي على نص قابل للتحليل.",
      });
    }

    let isValid = false;
    let extractedData = {};

    if (docType === "eidFront" || docType === "ownerIdFront") {
      const indicators = [
        upperText.includes("NATIONALITY"),
        upperText.includes("ISSUING DATE"),
        upperText.includes("EXPIRY DATE"),
      ];
      isValid = indicators.filter(Boolean).length >= 2;
    } else if (docType === "eidBack" || docType === "ownerIdBack") {
      isValid = upperText.includes("OCCUPATION") && upperText.includes("EMPLOYER");
    } else if (docType === "passport") {
      const mrzMatch = upperText.match(/P<([A-Z]{3})([A-Z<]+)<<([A-Z<]+)[\s\S]+?([A-Z0-9]{6,})[A-Z]{3}/);
      if (mrzMatch) {
        isValid = true;
        const countryCode = mrzMatch[1];
        const surname = mrzMatch[2]?.replace(/</g, " ").trim();
        const givenNames = mrzMatch[3]?.replace(/</g, " ").trim();
        const passportNumber = mrzMatch[4];
        extractedData = {
          passportNumber,
          countryCode,
          fullName: `${surname} ${givenNames}`.replace(/\s+/g, " ").trim(),
        };
      }
    } else if (docType === "license") {
      const licenseIndicators = [
        upperText.includes("LICENSE") || upperText.includes("رخصة"),
        upperText.includes("TRADE") || upperText.includes("تجاري"),
        upperText.includes("COMMERCIAL") || upperText.includes("اقتصادية"),
        upperText.includes("ECONOMIC") || upperText.includes("الاقتصادية"),
        upperText.includes("DEPARTMENT") || upperText.includes("دائرة"),
        upperText.includes("LICENSE NO") || upperText.includes("رقم الرخصة"),
        upperText.includes("EXPIRY DATE") || upperText.includes("تاريخ الانتهاء") || upperText.includes("تاريخ الإنتهاء"),
        upperText.includes("ISSUE DATE") || upperText.includes("تاريخ الاصدار") || upperText.includes("تاريخ الإصدار"),
        upperText.includes("TRADE NAME") || upperText.includes("الاسم التجاري") || upperText.includes("اسم النشاط"),
      ];
      isValid = licenseIndicators.filter(Boolean).length >= 3;

      const licenseNumberMatch = upperText.match(/(?:LICENSE\s*NO|رخصة\s*رقم|رقم\s*الرخصة)[:\s\-]*([A-Z0-9\-]+)/);
      const issueDateMatch = upperText.match(/(?:ISSUE\s*DATE|تاريخ\s*الإصدار|تاريخ\s*الاصدار)[:\s\-]*([\d\/\-]+)/);
      const expiryDateMatch = upperText.match(/(?:EXPIR[YI]\s*DATE|تاريخ\s*الانتهاء|تاريخ\s*الإنتهاء)[:\s\-]*([\d\/\-]+)/);
      const tradeNameMatch = upperText.match(/(?:TRADE\s*NAME|الاسم\s*التجاري|اسم\s*النشاط|اسم\s*الشركة)[:\s\-]*([A-Z\s\u0600-\u06FF]+)/);

      extractedData = {
        licenseNumber: licenseNumberMatch?.[1] || null,
        issueDate: issueDateMatch?.[1] || null,
        expiryDate: expiryDateMatch?.[1] || null,
        tradeName: (tradeNameMatch?.[1] || "").trim() || null,
      };
    }

    if (!isValid) {
      return res.status(200).json({
        success: false,
        text: cleanedText,
        message: `فشل الفحص. لم يتم العثور على محتوى مناسب في مستند (${docType}).`,
      });
    }

    return res.status(200).json({
      success: true,
      text: cleanedText,
      extracted: extractedData,
      message: "تم التحقق من المستند بنجاح",
    });
  } catch (error) {
    console.error("OCR Error:", error);
    return res.status(500).json({
      success: false,
      message: "OCR Server Error",
      error: error?.message || "Unknown error",
    });
  }
}
