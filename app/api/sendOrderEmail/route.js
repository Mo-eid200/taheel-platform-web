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
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  } catch (error) {
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