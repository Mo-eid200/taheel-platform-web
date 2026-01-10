// utils/calcPaymentBreakdown.js
export function toMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) ? +x.toFixed(2) : 0;
}

/**
 * RULES (FINAL):
 * - VAT = 5% on PRINTING ONLY (for ALL services).
 * - Printing+VAT waived ONLY when waivePrinting=true.
 * - Subscription: printing=0, vat=0 ALWAYS (because it's not a paper service)
 * - Processing fee is ALWAYS shown:
 *   - wallet => 0
 *   - gateway => from calcStripeFees(subtotalAfterDiscount)
 */
export function calcPaymentBreakdown({
  requestType = "service", // service | subscription | addon | wallet_recharge
  baseAmount = 0,
  printingPerUnit = 0,
  paperCount = 1,
  waivePrinting = false,
  vatRate = 0.05,
  coinDiscount = 0,        // AED value (not points)
  payMethod = "wallet",    // wallet | gateway
  calcStripeFees,          // (amountAED) => { stripeFee, totalAmount }
}) {
  const base = toMoney(baseAmount);

  const isService = requestType === "service";
  const count = Math.max(1, Number(paperCount || 1));
  const printingUnit = toMoney(printingPerUnit);

  // ✅ printing applies only for service requests
  const printingTotal =
    !isService ? 0 :
    waivePrinting ? 0 :
    toMoney(printingUnit * count);

  // ✅ VAT on printing only
  const vatTotal = printingTotal > 0 ? toMoney(printingTotal * vatRate) : 0;

  const totalBeforeDiscount = toMoney(base + printingTotal + vatTotal);

  const discount = toMoney(Math.max(0, coinDiscount));
  const subtotalAfterDiscount = toMoney(Math.max(0, totalBeforeDiscount - discount));

  // ✅ processing fee always visible
  let processingFee = 0;
  let finalToPay = subtotalAfterDiscount;

  if (payMethod === "gateway") {
    const r = calcStripeFees ? calcStripeFees(subtotalAfterDiscount) : null;
    processingFee = toMoney(r?.stripeFee ?? 0);
    finalToPay = toMoney(r?.totalAmount ?? (subtotalAfterDiscount + processingFee));
  } else {
    processingFee = 0;
    finalToPay = subtotalAfterDiscount;
  }

  return {
    requestType,
    baseAmount: base,

    // ✅ clearer naming
    printingPerUnit: printingUnit,
    paperCount: count,

    printingTotal,
    vatTotal,

    totalBeforeDiscount,
    coinDiscount: discount,
    subtotalAfterDiscount,
    processingFee,
    finalToPay,
  };
}
