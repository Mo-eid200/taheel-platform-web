import { Resend } from "resend";
import fs from "fs";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);

const templatePath = path.join(process.cwd(), "lib", "email-templates", "order-confirmation-bilingual.html");
const templateHTML = fs.readFileSync(templatePath, "utf-8");

// دعم طلب OPTIONS لـ CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
  });
}

export async function POST(req) {
  try {
    // DEBUG: اطبع المتغيرات المهمة
    console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY);
    console.log("templateHTML exists:", !!templateHTML);

    const { to, orderNumber, serviceName, price } = await req.json();

    const html = templateHTML
      .replace(/{{ORDER_NUMBER}}/g, orderNumber)
      .replace(/{{SERVICE_NAME}}/g, serviceName)
      .replace(/{{PRICE}}/g, price);

    const subject = "تأكيد الطلب - منصة تأهيل | Order Confirmation - Taheel";

    // إرسال الإيميل
    const result = await resend.emails.send({
      from: "Taheel Platform <info@taheel.ae>",
      to,
      subject,
      html,
      text: `رقم الطلب: ${orderNumber}\nاسم الخدمة: ${serviceName}\nالمبلغ المدفوع: ${price} درهم\nOrder No.: ${orderNumber}\nService: ${serviceName}\nPaid: ${price} AED`,
    });

    console.log("Resend response:", result);

    // رد مع دعم CORS
    return new Response(JSON.stringify({ success: true, result }), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  } catch (error) {
    console.error("Email API error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }
}