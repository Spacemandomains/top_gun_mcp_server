import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runAudit } from "../../src/lib/audit.js";
import { verifyStripeSession, buildX402Required, buildMPPPaymentRequired } from "../../src/lib/payment.js";

const REALM = "top-gun-mcp-server.vercel.app";
const RESOURCE = "https://top-gun-mcp-server.vercel.app/api/v1/audit";
const AMOUNT = "1.50";
const AMOUNT_BASE_UNITS = "1500000"; // $1.50 USDC (6 decimals)
const AUDIT_PRICE_CENTS = 150;

const INPUT_SCHEMA = {
  type: "object",
  required: ["query"],
  properties: {
    query: { type: "string", description: "Brand name, company, URL, or topic to audit" },
  },
};

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    label: { type: "string", enum: ["Strong", "Moderate", "Weak", "Not Found"] },
    citations: { type: "array", items: { type: "object" } },
    llmIndexStatus: { type: "object" },
    recommendations: { type: "array", items: { type: "string" } },
  },
};

function send402(res: VercelResponse, paymentUrl: string) {
  const { header: x402Header, body: x402Body } = buildX402Required(
    RESOURCE,
    "TOP GUN GEO-Lens full brand visibility audit with citations, LLM index status, and recommendations.",
    AMOUNT_BASE_UNITS,
    INPUT_SCHEMA,
    OUTPUT_SCHEMA
  );
  const { header: mppHeader, body: mppBody } = buildMPPPaymentRequired(
    REALM,
    AMOUNT,
    paymentUrl,
    "Payment is required to run a Top Gun GEO Lens full audit."
  );
  res.setHeader("WWW-Authenticate", `${x402Header}, ${mppHeader}`);
  return res.status(402).json({ ...x402Body, ...mppBody });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const paymentUrl = process.env["STRIPE_PAYMENT_URL"] ?? "";

  const x402Payment = req.headers["x-payment"];
  const stripeToken = req.headers["x-payment-token"];

  if (!x402Payment && (!stripeToken || typeof stripeToken !== "string")) {
    return send402(res, paymentUrl);
  }

  const query = req.query["query"];
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Missing required query parameter: query" });
  }

  if (stripeToken && typeof stripeToken === "string") {
    const isPaid = await verifyStripeSession(stripeToken, stripeSecretKey, AUDIT_PRICE_CENTS);
    if (!isPaid) return send402(res, paymentUrl);
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
