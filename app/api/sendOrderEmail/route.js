import { Resend } from "resend";
import fs from "fs";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);

const templatePath = path.join(process.cwd(), "lib", "email-templates", "order-confirmation-bilingual.html");
const templateHTML = fs.readFileSync(templatePath, "utf-8");

export async function POST(req) {
  try {
    const { to, orderNumber, serviceName, price } = await req.json();
    const html = templateHTML
      .replace(/{{ORDER_NUMBER}}/g, orderNumber)
      .replace(/{{SERVICE_NAME}}/g, serviceName)
      .replace(/{{PRICE}}/g, price);

    const subject = "تأكيد الطلب - منصة تأهيل | Order Confirmation - Taheel";
    await resend.emails.send({
      from: "Taheel Platform <info@taheel.ae>",
      to,
      subject,
      html,
      text: `رقم الطلب: ${orderNumber}\nاسم الخدمة: ${serviceName}\nالمبلغ المدفوع: ${price} درهم\nOrder No.: ${orderNumber}\nService: ${serviceName}\nPaid: ${price} AED`,
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}