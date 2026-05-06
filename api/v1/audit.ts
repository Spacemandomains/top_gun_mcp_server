import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runAudit } from "../../src/lib/audit.js";
import { verifyStripeSession, buildMPPPaymentRequired } from "../../src/lib/payment.js";

const REALM = "top-gun-mcp-server.vercel.app";
const AUDIT_PRICE_CENTS = 150; // $1.50 USDC

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const paymentUrl = process.env["STRIPE_PAYMENT_URL"] ?? "";

  const paymentToken = req.headers["x-payment-token"];
  if (!paymentToken || typeof paymentToken !== "string") {
    const { header, body } = buildMPPPaymentRequired(
      REALM,
      "1.50",
      paymentUrl,
      "Payment is required to run a Top Gun GEO Lens full audit."
    );
    res.setHeader("WWW-Authenticate", header);
    return res.status(402).json(body);
  }

  const query = req.query["query"];
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Missing required query parameter: query" });
  }

  const isPaid = await verifyStripeSession(paymentToken, stripeSecretKey, AUDIT_PRICE_CENTS);
  if (!isPaid) {
    const { header, body } = buildMPPPaymentRequired(
      REALM,
      "1.50",
      paymentUrl,
      "Payment token invalid or unpaid."
    );
    res.setHeader("WWW-Authenticate", header);
    return res.status(402).json(body);
  }

  try {
    const result = await runAudit(query.trim(), {
      braveApiKey: process.env["BRAVE_SEARCH_API_KEY"],
      exaApiKey: process.env["EXA_API_KEY"],
    });
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    return res.status(500).json({ error: "audit_failed", message });
  }
}
