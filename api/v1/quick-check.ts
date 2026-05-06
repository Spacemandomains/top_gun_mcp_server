import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runQuickCheck } from "../../src/lib/audit.js";
import { verifyStripeSession, buildPaymentRequired } from "../../src/lib/payment.js";
import { QUICK_CHECK_PRICE_CENTS } from "../../src/tools/quick-check.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const paymentUrl = process.env["STRIPE_QUICK_CHECK_PAYMENT_URL"] ?? "";
  const walletAddress = process.env["USDC_WALLET_ADDRESS"];

  const paymentToken = req.headers["x-payment-token"];
  if (!paymentToken || typeof paymentToken !== "string") {
    res.setHeader("X-Payment-Required", "true");
    res.setHeader("WWW-Authenticate", `MPP realm="top-gun-mcp-server.vercel.app", price="0.50", currency="USDC"`);
    return res.status(402).json(buildPaymentRequired(paymentUrl, "0.50", walletAddress));
  }

  const query = req.query["query"];
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Missing required query parameter: query" });
  }

  const isPaid = await verifyStripeSession(paymentToken, stripeSecretKey, QUICK_CHECK_PRICE_CENTS);
  if (!isPaid) {
    res.setHeader("X-Payment-Required", "true");
    res.setHeader("WWW-Authenticate", `MPP realm="top-gun-mcp-server.vercel.app", price="0.50", currency="USDC"`);
    return res
      .status(402)
      .json({ error: "invalid_payment", message: "Payment token invalid or unpaid." });
  }

  try {
    const result = await runQuickCheck(query.trim(), {
      braveApiKey: process.env["BRAVE_SEARCH_API_KEY"],
      exaApiKey: process.env["EXA_API_KEY"],
    });

    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quick check failed";
    return res.status(500).json({ error: "quick_check_failed", message });
  }
}
