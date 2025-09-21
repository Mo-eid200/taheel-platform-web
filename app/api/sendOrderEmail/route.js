import { Resend } from "resend";
import fs from "fs";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);
const templatePath = path.join(process.cwd(), "lib", "email-templates", "order-confirmation-bilingual.html");
const templateHTML = fs.readFileSync(templatePath, "utf-8");

// دالة CORS headers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };
}

// دعم طلب OPTIONS لـ CORS
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// دالة إرسال الإيميل
export async function POST(req) {
  try {
    // DEBUG: طباعة المتغيرات المهمة
    console.log("RESEND_API_KEY:", !!process.env.RESEND_API_KEY ? "OK" : "NOT FOUND");
    console.log("templateHTML exists:", !!templateHTML);

    // قراءة بيانات الطلب
    const { to, orderNumber, serviceName, price } = await req.json();

    // تجهيز الـ HTML من القالب
    const html = templateHTML
      .replace(/{{ORDER_NUMBER}}/g, String(orderNumber))
      .replace(/{{SERVICE_NAME}}/g, String(serviceName))
      .replace(/{{PRICE}}/g, String(price));

    const subject = "تأكيد الطلب - منصة تأهيل | Order Confirmation - Taheel";
    const text =
      `رقم الطلب: ${orderNumber}\n` +
      `اسم الخدمة: ${serviceName}\n` +
      `المبلغ المدفوع: ${price} درهم\n` +
      `Order No.: ${orderNumber}\n` +
      `Service: ${serviceName}\n` +
      `Paid: ${price} AED`;

    // إرسال الإيميل
    const result = await resend.emails.send({
      from: "Taheel Platform <info@taheel.ae>",
      to,
      subject,
      html,
      text,
    });

    console.log("Resend response:", result);

    // رد مع دعم CORS
    return new Response(JSON.stringify({ success: true, result }), {
      headers: corsHeaders(),
    });

  } catch (error) {
    console.error("Email API error:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || "send_failed" }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}