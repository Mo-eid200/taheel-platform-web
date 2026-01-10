// utils/calcPaymentBreakdown.js
export function toMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) ? +x.toFixed(2) : 0;
}

/**
 * RULES:
 * - VAT = 5% on PRINTING ONLY.
 * - Company: printing+vat = 0 ONLY if waivePrinting=true (subscriptionActive OR addonsRemaining>0)
 * - Subscription: printing=0, vat=0 ALWAYS
 * - Processing fee: ALWAYS shown
 *   - wallet => 0
 *   - gateway => from calcStripeFees(finalSubtotal)
 */
export function calcPaymentBreakdown({
  requestType = "service", // service | subscription | addon | wallet_recharge
  baseAmount = 0,          // service price OR subscription price OR addon price OR wallet recharge amount
  printingPerUnit = 0,
  paperCount = 1,
  waivePrinting = false,
  vatRate = 0.05,
  coinDiscount = 0,        // AED value (not points)
  payMethod = "wallet",    // wallet | gateway
  calcStripeFees,          // function(amountAED) => { stripeFee, totalAmount }
}) {
  const base = toMoney(baseAmount);

  const isSubscription = requestType === "subscription";
  const isWallet = requestType === "wallet_recharge";
  const isAddon = requestType === "addon";

  // printing only for SERVICE (حسب منطقك)
  const printing =
    (isSubscription || isWallet || isAddon) ? 0 :
    waivePrinting ? 0 :
    toMoney(toMoney(printingPerUnit) * Math.max(1, Number(paperCount || 1)));

  const vat = (printing > 0) ? toMoney(printing * vatRate) : 0;

  const totalBeforeDiscount = toMoney(base + printing + vat);

  const discount = toMoney(Math.max(0, coinDiscount));
  const subtotalAfterDiscount = toMoney(Math.max(0, totalBeforeDiscount - discount));

  // processing fee ALWAYS visible
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
    printingFee: printing,
    vat,
    totalBeforeDiscount,
    coinDiscount: discount,
    subtotalAfterDiscount,
    processingFee,
    finalToPay,
  };
}
