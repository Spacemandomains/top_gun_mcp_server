import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runQuickCheck } from "../../../src/lib/audit.js";
import { verifyStripeSession, buildX402Body, buildTempoHeader } from "../../../src/lib/payment.js";
import { QUICK_CHECK_PRICE_CENTS } from "../../../src/tools/quick-check.js";

const RESOURCE = "https://top-gun-mcp-server.vercel.app/api/v1/quick-check";
const REALM = "top-gun-mcp-server.vercel.app";
const AMOUNT = "0.50";
const AMOUNT_BASE_UNITS = "500000"; // $0.50 USDC — 6 decimals

const INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["brand", "query"],
  properties: {
    brand: { type: "string", description: "Company or brand name to check." },
    query: { type: "string", description: "Search prompt to test visibility against." },
    competitors: {
      type: "array",
      items: { type: "string" },
      description: "Competing brands to compare against.",
    },
  },
};

const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["score", "label", "topCitations", "quickTips", "checkedAt"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 100, description: "Visibility score (0–100)." },
    label: { type: "string", enum: ["Strong", "Moderate", "Weak", "Not Found"] },
    topCitations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          snippet: { type: "string" },
        },
      },
    },
    quickTips: { type: "array", items: { type: "string" } },
    checkedAt: { type: "string", format: "date-time" },
  },
};

function send402(res: VercelResponse, paymentUrl: string): VercelResponse {
  const body = buildX402Body(RESOURCE, "Fast GEO-Lens visibility check showing whether a brand appears in AI search, answer engines, and LLM-style recommendations.", AMOUNT_BASE_UNITS, INPUT_SCHEMA, OUTPUT_SCHEMA);
  const tempoHeader = buildTempoHeader(REALM, AMOUNT, paymentUrl);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("WWW-Authenticate", `x402 realm="${RESOURCE}", ${tempoHeader}`);
  return res.status(402).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const paymentUrl = process.env["STRIPE_QUICK_CHECK_PAYMENT_URL"] ?? "";

  const x402Payment = req.headers["x-payment"];
  const stripeToken = req.headers["x-payment-token"];

  // Payment check before method check — all unpaid requests return 402
  if (!x402Payment && (!stripeToken || typeof stripeToken !== "string")) {
    return send402(res, paymentUrl);
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const brand = req.query["brand"];
  const query = req.query["query"];

  if (!brand || typeof brand !== "string" || !brand.trim()) {
    return res.status(400).json({ error: "Missing required query parameter: brand" });
  }
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Missing required query parameter: query" });
  }

  if (stripeToken && typeof stripeToken === "string") {
    const isPaid = await verifyStripeSession(stripeToken, stripeSecretKey, QUICK_CHECK_PRICE_CENTS);
    if (!isPaid) return send402(res, paymentUrl);
  }

  const searchQuery = `${brand.trim()} ${query.trim()}`;

  try {
    const result = await runQuickCheck(searchQuery, {
      braveApiKey: process.env["BRAVE_SEARCH_API_KEY"],
      exaApiKey: process.env["EXA_API_KEY"],
    });
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quick check failed";
    return res.status(500).json({ error: "quick_check_failed", message });
  }
}
