import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runAudit } from "../../../src/lib/audit.js";
import { verifyStripeSession, buildTempoHeader } from "../../../src/lib/payment.js";
import {
  buildChallenge,
  verifyPayment,
  settlePayment,
  paymentHeaderValue,
  type GateRoute,
} from "../../../src/lib/x402gate.js";

const RESOURCE = "https://top-gun-mcp-server.vercel.app/api/v1/audit";
const REALM = "top-gun-mcp-server.vercel.app";
const AMOUNT = "1.50";
const AMOUNT_BASE_UNITS = "1500000"; // $1.50 USDC — 6 decimals
const AUDIT_PRICE_CENTS = 150;
const USDC_WALLET = "0xea8B7221507d1A0549e1ab96000a54401A7fDaC1";

const INPUT_PROPERTIES: Record<string, unknown> = {
  brand: { type: "string", description: "Company or brand name to audit." },
  query: { type: "string", description: "AI search prompt or discovery category to test brand visibility against." },
  competitors: {
    type: "array",
    items: { type: "string" },
    description: "Competing brands to compare against.",
  },
};

const ROUTE: GateRoute = {
  resource: RESOURCE,
  description:
    "Full TOP GUN GEO-Lens brand visibility audit measuring brand visibility, competitor presence, answer-engine positioning, and LLM recommendation strength.",
  amountAtomic: AMOUNT_BASE_UNITS,
  inputExample: { brand: "Nike", query: "best running shoes" },
  inputProperties: INPUT_PROPERTIES,
  inputRequired: ["brand", "query"],
  outputExample: {
    score: 72,
    label: "Strong",
    citations: [
      {
        url: "https://example.com/review",
        title: "Example review",
        snippet: "Nike ranked among the best running shoes.",
      },
    ],
    llmIndexStatus: { braveIndexed: true, exaIndexed: true, estimatedReach: "High" },
    recommendations: ["Publish a comparison guide targeting this prompt."],
    searchedAt: "2026-01-01T00:00:00.000Z",
  },
};

async function send402(res: VercelResponse, paymentUrl: string): Promise<VercelResponse> {
  const challenge = await buildChallenge(ROUTE);
  const tempoHeader = buildTempoHeader(REALM, AMOUNT, paymentUrl);

  const request = Buffer.from(
    JSON.stringify({
      resource: RESOURCE,
      route: "/api/v1/audit",
      amount: AMOUNT,
      amount_base_units: AMOUNT_BASE_UNITS,
      currency: "USDC",
      service: "Top Gun GEO Lens Audit",
      realm: REALM,
      recipient: USDC_WALLET,
      wallet: USDC_WALLET,
    })
  ).toString("base64url");

  const tempoChallenge = {
    method: "tempo",
    intent: "charge",
    realm: REALM,
    amount: AMOUNT,
    amount_base_units: AMOUNT_BASE_UNITS,
    currency: "USDC",
    recipient: USDC_WALLET,
    wallet: USDC_WALLET,
    request,
    payment_url: paymentUrl || undefined,
  };

  const body = {
    ...challenge.body,
    payment_options: [tempoChallenge],
    challenges: [tempoChallenge],
    recipient: USDC_WALLET,
    wallet: USDC_WALLET,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("PAYMENT-REQUIRED", challenge.header);
  res.setHeader(
    "WWW-Authenticate",
    `Payment method="tempo" intent="charge" realm="${REALM}" request="${request}", ${tempoHeader}`
  );
  return res.status(402).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const paymentUrl = process.env["STRIPE_PAYMENT_URL"] ?? "";

  const payHeader = paymentHeaderValue(req.headers);
  const stripeToken = req.headers["x-payment-token"];

  // Payment check before method check — all unpaid requests return 402
  if (!payHeader && (!stripeToken || typeof stripeToken !== "string")) {
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

  const searchQuery = `${brand.trim()} ${query.trim()}`;
  const run = () =>
    runAudit(searchQuery, {
      braveApiKey: process.env["BRAVE_SEARCH_API_KEY"],
      exaApiKey: process.env["EXA_API_KEY"],
    });

  // Standard x402 v2 path: verify first, run, settle only on success.
  if (payHeader) {
    const verified = await verifyPayment(payHeader, ROUTE);
    if (!verified.ok) return send402(res, paymentUrl);
    let result: unknown;
    try {
      result = await run();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Audit failed";
      return res.status(500).json({ error: "audit_failed", message });
    }
    const settled = await settlePayment(verified.payload, ROUTE);
    if (!settled.ok) {
      return res.status(502).json({ error: "settlement_failed", message: settled.reason });
    }
    res.setHeader("PAYMENT-RESPONSE", settled.header);
    return res.status(200).json(result);
  }

  // Stripe prepaid path (unchanged).
  if (stripeToken && typeof stripeToken === "string") {
    const isPaid = await verifyStripeSession(stripeToken, stripeSecretKey, AUDIT_PRICE_CENTS);
    if (!isPaid) return send402(res, paymentUrl);
  }

  try {
    const result = await run();
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    return res.status(500).json({ error: "audit_failed", message });
  }
}
